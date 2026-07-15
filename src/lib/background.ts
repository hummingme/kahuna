/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { action, manifestVersion, namespace, type NSPort } from '#lib/runtime';
import {
    clearSettings,
    exportSettings,
    getDatabaseTablesColumns,
    getSettings,
    importSettings,
    putSettings,
} from '#lib/settings-database';
import type { AppTarget, Message, SettingKey, UnknownRecord } from '#types';

type PortMap = Map<number, NSPort>;

export const messageListener = async (
    port: NSPort,
    contentPorts: PortMap,
    message: object,
) => {
    const msg = message as Message;
    const type = msg.type;
    const tabId = port?.sender?.tab?.id;
    if (!tabId) return;

    if (type === 'saveSettings') {
        putSettings(msg.data);
        handleGlobalSettings(msg, port, contentPorts);
    } else if (type === 'requestSettings') {
        const values = await getSettings(msg.key);
        port.postMessage({ type: 'obtainSettings', values, id: msg.id });
    } else if (type === 'resetSettings') {
        clearSettings(msg.target);
    } else if (type === 'exportSettings') {
        const data = await exportSettings();
        port.postMessage({ type: 'exportedSettings', data: await data.text() });
    } else if (type === 'importSettings') {
        handleImportMessage(msg.dataSrc, port);
    } else if (type === 'foundDatabases') {
        adjustBrowserAction(tabId, msg.databases);
    } else if (type === 'tableDropped') {
        handleTableDropped(msg.target);
    } else if (type === 'databaseDropped') {
        handleDatabaseDropped(msg.target);
    } else if (type === 'getPermissions') {
        handleGetPermissions(port);
    } else if (type === 'injectExportImport') {
        injectExportImport(tabId);
    } else if (type === 'kahunaAlive') {
        activateActionIcon(tabId);
    } else {
        throw new Error(`Kahuna: Received unexpected message: ${msg.type}`);
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
    const columns = await getSettings(key);
    if (Array.isArray(columns) && columns.length > 0) {
        columns.map((column: UnknownRecord) => (column.deletedTS = Date.now()));
        putSettings({ ...key, values: columns });
    }
};

const handleDatabaseDropped = async (target: AppTarget) => {
    const data = await getDatabaseTablesColumns(target.database);
    for (const tableData of data) {
        if (Array.isArray(tableData.values)) {
            tableData.values.map((column) => (column.deletedTS = Date.now()));
            putSettings(tableData);
        }
    }
};

const handleGetPermissions = async (port: NSPort) => {
    const {
        permissions = [],
        hostPermissions = [],
        version = '',
    } = await namespace.management.getSelf();
    if (manifestVersion === 2 && namespace.userScripts) {
        permissions.push('userScripts');
    }
    port.postMessage({
        type: 'getPermissionsResult',
        values: { permissions, hostPermissions, version },
    });
};

const handleImportMessage = async (dataSrc: string | Blob, port: NSPort) => {
    if (typeof dataSrc === 'string') {
        const res = await fetch(dataSrc);
        dataSrc = await res.blob();
    }
    const error = await importSettings(dataSrc);
    port.postMessage({ type: 'importSettingsResult', ...(error && { error }) });
};

const injectExportImport = async (tabId: number) => {
    if (manifestVersion !== 2) return; // for Firefox only
    try {
        await browser.scripting.executeScript({
            target: {
                tabId: tabId,
            },
            world: 'MAIN',
            files: ['injected_export_import.js'],
        });
    } catch (err) {
        throw Error(`failed to execute script: ${err}`, { cause: err });
    }
};
