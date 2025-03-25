/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import Dexie from 'dexie';

const databases = new Map();
const connections = new Map();

export const getDB = (databaseName) => {
    if (databases.has(databaseName)) {
        return databases.get(databaseName);
    } else {
        const db = new Dexie(databaseName, { cache: 'disabled' });
        databases.set(databaseName, db);
        db.on('versionchange', () => {
            closeDB(databaseName);
        });
        return db;
    }
};

export const getConnection = async (databaseName) => {
    if (connections.has(databaseName)) {
        return connections.get(databaseName);
    } else {
        const connection = await getDB(databaseName).open();
        connections.set(databaseName, connection);
        return connection;
    }
};

export const closeDB = (databaseName) => {
    const dbHandle = connections.get(databaseName);
    if (dbHandle !== undefined) {
        connections.delete(databaseName);
        dbHandle.close();
    }
    databases.delete(databaseName);
    return true;
};
