/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Collection, IndexSpec, Table } from 'dexie';
import { isPlainObject } from './datatypes.ts';
import { selectedPrimKeys } from './row-selection.ts';
import { KTable, PlainObject } from './types/common.ts';
import { getConnection } from './connection.ts';

export const isPrimKeyUnnamed = (primKey: IndexSpec): boolean =>
    primKey.name === null || primKey.name.length === 0;

export const isPrimKeyNamed = (primKey: IndexSpec): boolean =>
    primKey.name !== null && primKey.name.length > 0;

export const isPrimKeyCompound = (primKey: IndexSpec): boolean =>
    primKey.compound === true;

/**
 * convert a dexie collection to an javascript array of objects
 */
export const collectionToArray = async (
    collection: Collection | Table,
    addUnnamedPk: boolean,
): Promise<PlainObject[]> => {
    const data = addUnnamedPk
        ? await includeUnnamedPkValues(collection)
        : await collection.toArray();
    return data;
};

const includeUnnamedPkValues = async (
    collection: Collection | Table,
): Promise<object[]> => {
    const data: object[] = [];
    await collection.each((item, cursor) => {
        if (isPlainObject(item)) {
            item['*key*'] = cursor.primaryKey;
        } else {
            item = {
                '*key*': cursor.primaryKey,
                '*value*': item,
            };
        }
        data.push(item);
    });
    return data;
};

export const leadingUnnamedPkValues = async (
    collection: Collection,
    pkName: string,
): Promise<object[]> => {
    const data: object[] = [];
    await collection.each((item: unknown, cursor) => {
        let row: object;
        if (isPlainObject(item)) {
            row = Object.assign(Object.fromEntries([[pkName, cursor.primaryKey]]), item);
        } else {
            row = {
                [pkName]: cursor.primaryKey,
                '*value*': item,
            };
        }
        data.push(row);
    });
    return data;
};

export const getCollection = ({
    dexieTable,
    selectorFields,
    selected,
}: {
    dexieTable: Table;
    selectorFields: string[];
    selected: Set<string | number>;
}): Collection => {
    const { idx, keys } = selectedPrimKeys({ selected, selectorFields });
    return dexieTable.where(idx).anyOf(keys);
};

export const tableIndexesSpec = (table: KTable) => {
    return [table.primKey.src, ...table.indexes.map((idx: IndexSpec) => idx.src)].join(
        ',',
    );
};

interface DataRow {
    [key: string]: any;
}

export const copyTableData = async (
    source: { table: string; database: string },
    target: { table: string; database: string },
): Promise<void> => {
    const sourceHandle = await getConnection(source.database);
    const targetHandle = await getConnection(target.database);
    const CHUNKSIZE = 10000;
    const sourceTable: Table | undefined = sourceHandle.tables.find(
        (table) => table.name === source.table,
    );
    const targetTable: Table | undefined = targetHandle.tables.find(
        (table) => table.name === target.table,
    );
    if (sourceTable && targetTable) {
        const primKeyNamed = isPrimKeyNamed(sourceTable.schema.primKey);
        let skip = 0;
        let data: object[] = [];
        do {
            const collection = sourceTable.offset(skip).limit(CHUNKSIZE);
            data = (await collectionToArray(collection, primKeyNamed)) as object[];
            if (primKeyNamed) {
                targetTable.bulkAdd(data);
            } else {
                const keys = data.map((row: DataRow) => row['*key*']);
                const items = data.map((row: DataRow) => {
                    delete row['*key*'];
                    return Object.hasOwn(row, '*value*') ? row['*value*'] : row;
                });
                targetTable.bulkAdd(items, keys);
            }
            skip += CHUNKSIZE;
        } while (data.length === CHUNKSIZE);
    }
};
