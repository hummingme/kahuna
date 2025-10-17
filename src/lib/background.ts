/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { AppTarget } from './app-target.ts';
import { action, manifestVersion, namespace, type NSPort } from './runtime.ts';
import * as db from './settings-database.ts';
import type { PlainObject } from './types/common.ts';
import type { Message } from './types/messages.ts';
import { SettingKey } from './types/settings.ts';

type PortMap = Map<number, NSPort>;

db.init();

export const messageListener = async (
    port: NSPort,
    contentPorts: PortMap,
    msg: unknown,
) => {
    const message = msg as Message;
    if (message.type === 'saveSettings') {
        db.putSettings(message.data);
        handleGlobalSettings(message, port, contentPorts);
    } else if (message.type === 'requestSettings') {
        const values = await db.getSettings(message.key);
        port.postMessage({ type: 'obtainSettings', values, id: message.id });
    } else if (message.type === 'resetSettings') {
        db.clearSettings(message.target);
    } else if (message.type === 'foundDatabases') {
        const tabId = port?.sender?.tab?.id;
        if (tabId) {
            adjustBrowserAction(tabId, message.databases);
        }
    } else if (message.type === 'tableDropped') {
        handleTableDropped(message.target);
    } else if (message.type === 'databaseDropped') {
        handleDatabaseDropped(message.target);
    } else if (message.type === 'getPermissions') {
        const {
            permissions = [],
            hostPermissions = [],
            version = '',
        } = await namespace.management.getSelf();
        if (manifestVersion === 2 && namespace.userScripts) {
            permissions.push('userScripts');
        }
        const message: Message = {
            type: 'getPermissionsResult',
            values: { permissions, hostPermissions, version },
        };
        port.postMessage(message);
    } else if (message.type === 'kahunaAlive') {
        const tabId = port?.sender?.tab?.id;
        if (tabId) {
            activateActionIcon(tabId);
        }
    }
};

const handleGlobalSettings = (msg: Message, port: NSPort, contentPorts: PortMap) => {
    if (msg.type === 'saveSettings' && msg.data.subject === 'globals') {
        // the contentscript should execute searchDatabases
        // to trigger an update of the database number in the action badge
        const tabId = port?.sender?.tab?.id;
        if (tabId) {
            const contentPort = contentPorts.get(tabId);
            if (contentPort) {
                contentPort.postMessage(msg);
            }
        }
    }
};

const adjustBrowserAction = (tabId: number, databases: string[]) => {
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

const activateActionIcon = (tabId: number) => {
    action.setIcon({
        path: {
            16: 'icons/kahuna-16.png',
            32: 'icons/kahuna-32.png',
            48: 'icons/kahuna-48.png',
        },
        tabId,
    });
    action.setTitle({
        tabId,
        title: 'Kahuna: no databases found',
    });
};

const handleTableDropped = async (target: AppTarget) => {
    const key: SettingKey = { ...target, subject: 'columns' };
    const columns = await db.getSettings(key);
    if (columns.length > 0) {
        columns.map((column: PlainObject) => (column.deletedTS = Date.now()));
        db.putSettings({ ...key, values: columns });
    }
};

const handleDatabaseDropped = async (target: AppTarget) => {
    const data = await db.getDatabaseTablesColumns(target.database);
    for (const tableData of data) {
        tableData.values.map((column: PlainObject) => (column.deletedTS = Date.now()));
        db.putSettings(tableData);
    }
};
