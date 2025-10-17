/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { Dexie } from 'dexie';

const databases: Map<string, Dexie> = new Map();
const connections: Map<string, Dexie> = new Map();

export const getDB = (databaseName: string): Dexie => {
    if (databases.has(databaseName)) {
        return databases.get(databaseName)!;
    } else {
        const db = new Dexie(databaseName, { cache: 'disabled' });
        databases.set(databaseName, db);
        db.on('versionchange', () => {
            closeDB(databaseName);
        });
        return db;
    }
};

export const getConnection = async (databaseName: string): Promise<Dexie> => {
    const connection = connections.get(databaseName);
    if (!connection || connection.isOpen() === false) {
        connections.set(databaseName, await getDB(databaseName).open());
    }
    return connections.get(databaseName)!;
};

export const closeDB = (databaseName: string) => {
    const dbHandle = connections.get(databaseName);
    if (dbHandle !== undefined) {
        connections.delete(databaseName);
        dbHandle.close();
    }
    databases.delete(databaseName);
};
