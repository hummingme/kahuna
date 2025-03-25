/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { getDB, getConnection, closeDB } from './connection.js';
import { isGlobal } from './utils.js';

const DBNAME = 'kahuna settings';
const DBVERSION = 1;
const DBSTORES = {
    settings: '[database+table+subject]',
};

export const init = () => {
    try {
        getDB(DBNAME).version(DBVERSION).stores(DBSTORES);
        getConnection(DBNAME).then(() => closeDB(DBNAME));
    } catch (err) {
        throw Error('Failed to open db: ' + err);
    }
};

export const putSettings = async (data) => {
    const dbHandle = await getConnection(DBNAME);
    dbHandle.table('settings').put(data);
};

export const getSettings = async (key) => {
    const dbHandle = await getConnection(DBNAME);
    let values = {};
    if (
        // settings without hierarchical default values
        ['application', 'globals', 'filters', 'columns', 'jscodearea'].includes(
            key.subject,
        )
    ) {
        values = (await dbHandle.table('settings').get(Object.values(key)))?.values;
    } else if (
        ['behavior', 'export', 'import', 'column-settings', 'filter-settings'].includes(
            key.subject,
        )
    ) {
        for (const settingKey of settingsKeys({ ...key })) {
            const result = await dbHandle
                .table('settings')
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

export const clearSettings = async (target) => {
    if (isGlobal(target)) {
        const dbHandle = await getConnection(DBNAME);
        dbHandle.table('settings').clear();
    }
};

const settingsKeys = (key) => {
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

export const getDatabaseTablesColumns = async (database) => {
    const dbHandle = await getConnection(DBNAME);
    return await dbHandle
        .table('settings')
        .where('database')
        .equals(database)
        .filter((row) => row.subject === 'columns')
        .toArray();
};
