/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { Dexie, Table } from 'dexie';
import { exportDB, peakImportFile } from 'dexie-export-import';

import { isGlobal } from './app-target';
import {
    AppTarget,
    ColumnsValues,
    SettingKey,
    SettingObject,
    SettingValues,
} from '#types';

const DBNAME = 'kahuna settings';
const DBVERSION = 3;
const DBSTORES = {
    settings: '[database+table+subject]',
    settings2: '[database+table+subject+detail]',
};
const SETTINGS_TABLE = 'settings2';

class SettingsDB extends Dexie {
    settings!: Table<SettingObject, [string, string, string]>;
    settings2!: Table<SettingObject, [string, string, string, string]>;
    constructor(dbName: string) {
        super(dbName);
        this.version(DBVERSION)
            .stores(DBSTORES)
            .upgrade(async (tx) => {
                const data = await tx.table('settings').toArray();
                data.map((setting) => (setting.detail = ''));
                tx.table('settings2').bulkAdd(data);
                tx.table('settings').clear();
            });
    }
}

async function openSettingsDB() {
    const db = new SettingsDB(DBNAME);
    await db.open().catch((err) => {
        throw Error('Failed to open db: ' + (err.stack || err));
    });
    return db;
}

export const putSettings = async (data: SettingObject) => {
    data.detail ??= ''; // the optional detail is part of the pk
    const dbHandle = await openSettingsDB();
    dbHandle.table(SETTINGS_TABLE).put(data);
};

export const getSettings = async (key: SettingKey): Promise<SettingValues> => {
    const dbHandle = await openSettingsDB();
    let values;
    if (
        // settings without hierarchical default values
        ['globals', 'filters', 'columns', 'jscodearea', 'editorfield'].includes(
            key.subject,
        )
    ) {
        values = (await dbHandle.table(SETTINGS_TABLE).get(Object.values(key)))?.values;
    } else if (
        ['behavior', 'export', 'import', 'column-settings', 'filter-settings'].includes(
            key.subject,
        )
    ) {
        for (const settingKey of settingsKeys({ ...key })) {
            const result = await dbHandle
                .table(SETTINGS_TABLE)
                .get(Object.values(settingKey));
            if (result) {
                values = Object.assign({ ...result.values }, values);
            }
        }
    } else {
        throw Error(`requestSettings for unknown subject: ${key.subject}`);
    }
    return values || {};
};

export const clearSettings = async (target: AppTarget) => {
    if (isGlobal(target)) {
        const dbHandle = await openSettingsDB();
        dbHandle.table(SETTINGS_TABLE).clear();
        dbHandle.table('settings').clear();
    }
};

export const exportSettings = async () => {
    const dbHandle = await openSettingsDB();
    return await exportDB(dbHandle, { prettyJson: false });
};

export const importSettings = async (data: Blob) => {
    try {
        const meta = await peakImportFile(data);
        if (meta.formatName !== 'dexie') {
            throw Error('The uploaded file does not contain a dexie export.');
        }
        if (meta.data.databaseName !== DBNAME) {
            throw Error(
                'The uploaded file does not contain an export of a Kahuna settings database.',
            );
        }
        if (
            !meta.data.tables.some(
                (t) => t.name === SETTINGS_TABLE || t.name === 'settings',
            )
        ) {
            throw Error('The uploaded file does not contain Kahuna settings data.');
        }
        const dbHandle = await openSettingsDB();
        await dbHandle.import(data, {
            acceptVersionDiff: true,
            clearTablesBeforeImport: true,
        });
    } catch (err) {
        return err instanceof Error
            ? err
            : Error('An error occurred while importing the settings.');
    }
};

const settingsKeys = (key: SettingKey): SettingKey[] => {
    const keys = [{ ...key }];
    if (key.table !== '*') {
        key.table = '*';
        keys.push({ ...key });
    }
    if (key.database !== '*') {
        key.database = '*';
        keys.push({ ...key });
    }
    return keys;
};

type TableColumnsValues = SettingKey & { values: ColumnsValues };

export const getDatabaseTablesColumns = async (
    database: string,
): Promise<TableColumnsValues[]> => {
    const dbHandle = await openSettingsDB();
    return await dbHandle
        .table(SETTINGS_TABLE)
        .where('database')
        .equals(database)
        .filter((row: SettingObject) => row.subject === 'columns')
        .toArray();
};
