/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import * as db from './settings-database.js';
import { action, namespace } from './runtime.js';

db.init();

export const messageListener = async (port, contentPorts, msg) => {
    const tabId = port.sender.tab.id;
    if (msg.type === 'saveSettings') {
        db.putSettings(msg.data);
        handleGlobalSettings(msg, port, contentPorts);
    } else if (msg.type === 'requestSettings') {
        const values = await db.getSettings(msg.key);
        port.postMessage({ type: 'obtainSettings', values, id: msg.id });
    } else if (msg.type === 'resetSettings') {
        db.clearSettings(msg.target);
    } else if (msg.type === 'foundDatabases') {
        adjustBrowserAction(tabId, msg.databases);
    } else if (msg.type === 'tableDropped') {
        handleTableDropped(msg.target);
    } else if (msg.type === 'databaseDropped') {
        handleDatabaseDropped(msg.target);
    } else if (msg.type === 'getPermissions') {
        const { permissions, hostPermissions } = await namespace.management.getSelf();
        port.postMessage({
            type: 'getPermissionsResult',
            values: { permissions, hostPermissions },
        });
    } else if (msg.type === 'pingBackground') {
        // console.log('got pinged');
    }
};

const handleGlobalSettings = (msg, port, contentPorts) => {
    if (msg.data.subject === 'globals') {
        // the contentscript should execute searchDatabases
        // to trigger an update of the database number in the action badge
        const contentPort = contentPorts.get(port.sender.tab.id);
        contentPort.postMessage(msg);
    }
};

const adjustBrowserAction = (tabId, databases) => {
    if (databases.length === 0) {
        action.setTitle({
            tabId,
            title: 'Kahuna: no databases found',
        });
        action.setBadgeText({ tabId, text: '' });
    } else {
        action.setTitle({
            tabId,
            title: `Kahuna: ${databases.length} databases`,
        });
        if (action.setBadgeBackgroundColor) {
            action.setBadgeBackgroundColor({ tabId, color: 'yellow' });
            action.setBadgeTextColor({ tabId, color: 'brown' });
        }
        action.setBadgeText({
            tabId,
            text: `${databases.length}`,
        });
    }
};

const handleTableDropped = async (target) => {
    const key = { ...target, subject: 'columns' };
    const columns = await db.getSettings(key);
    if (columns.length > 0) {
        columns.map((column) => (column.deletedTS = Date.now()));
        db.putSettings({ ...key, values: columns });
    }
};

const handleDatabaseDropped = async (target) => {
    const data = await db.getDatabaseTablesColumns(target.database);
    for (const tableData of data) {
        tableData.values.map((column) => (column.deletedTS = Date.now()));
        db.putSettings(tableData);
    }
};
