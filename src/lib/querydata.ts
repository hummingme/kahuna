/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Collection, IndexSpec, Table } from 'dexie';

import { applyFilters } from './apply-filters';
import { getConnection } from '#lib/connection';
import { getType } from '#lib/datatypes';
import { collectionToArray } from '#lib/dexie-utils';
import { getFuncIndexed, isIndexedFilter } from '#lib/filter';
import { resolvePath } from '#lib/utils';
import { Filter, QueryDataArgs, UnknownRecord } from '#types';

export const queryData = async (args: QueryDataArgs) => {
    const dbHandle = await getConnection(args.dbname);
    const dexieTable = dbHandle.table(args.tablename);
    args = sanitizeArguments(args);

    return await dbHandle.transaction('r', args.tablename, async () => {
        const result = applyFilters(
            dexieTable,
            args.filters,
            args.columns,
            args.useLocalTimezone,
        );
        const ordered = isCollection(result)
            ? await orderCollection(result, args)
            : await orderDexieTable(result, args);
        const total = await totalData(ordered);
        const data = await paginateData(ordered, args);
        return { data, total };
    });
};

const orderCollection = async (
    collection: Collection,
    args: QueryDataArgs,
): Promise<Collection | UnknownRecord[]> => {
    const { order, direction, addUnnamedPk } = args;
    if (order === '') {
        return collection;
    }
    let data = await collectionToArray(collection, addUnnamedPk);
    if (order.length > 0) {
        data = ensureOrderData(data, order);
        const up = direction === 'asc' ? 1 : -1;
        const down = -up;
        data.sort((a, b) => {
            const va = a[order];
            const vb = b[order];
            if (va === null) return down;
            if (vb === null) return up;
            if (
                (typeof va === 'number' && typeof vb === 'number') ||
                (va && vb && getType(va) === 'date' && getType(vb) === 'date')
            ) {
                return va > vb ? up : down;
            }

            return String(va).localeCompare(String(vb)) > 0 ? up : down;
        });
    }
    return data;
};

/*
 * in case of sorting by an inner property, the values are required
 * as direct properties of the data rows. The same applies when sorting
 * by type-specific KeyPaths. i.e String.length or File.lastModified
 */
const ensureOrderData = (data: UnknownRecord[], order: string): UnknownRecord[] => {
    if (order.includes('.')) {
        for (const row of data) {
            row[order] = resolvePath(row, order);
        }
    }
    return data;
};

const orderDexieTable = async (dexieTable: Table, args: QueryDataArgs) => {
    const direction = args.direction;
    let order = args.order;
    const { primKey, indexes } = dexieTable.schema;
    if (order === '*key*') order = ':id';

    if (isPrimKeyOrder(order, primKey)) {
        return direction === 'asc' ? dexieTable.toCollection() : dexieTable.reverse();
    }
    if (isIndexedOrder(order, indexes)) {
        return direction === 'asc'
            ? dexieTable.orderBy(order)
            : dexieTable.orderBy(order).reverse();
    } else {
        return orderCollection(dexieTable.toCollection(), args);
    }
};

const isPrimKeyOrder = (order: string, primKey: IndexSpec) => {
    if (order === '') return true;
    if (order === ':id') return true;
    if (primKey.compound === false && primKey.name === order) return true;
    if (primKey.compound === true && primKey.keyPath && primKey.keyPath[0] === order)
        return true;
    return false;
};

const isIndexedOrder = (order: string, indexes: IndexSpec[]) => {
    for (const index of indexes) {
        if (index.compound === false && index.name === order) return true;
        if (index.compound === true && index.keyPath && index.keyPath[0] === order)
            return true;
    }
    return false;
};

const totalData = async (ordered: Collection | UnknownRecord[]): Promise<number> => {
    return isCollection(ordered) ? await ordered.count() : ordered.length;
};

const paginateData = async (
    ordered: Collection | UnknownRecord[],
    { offset, limit, addUnnamedPk }: QueryDataArgs,
) => {
    if (isCollection(ordered)) {
        const collection = ordered.offset(offset - 1).limit(limit);
        return await collectionToArray(collection, addUnnamedPk);
    } else {
        return ordered.slice(offset - 1, offset - 1 + limit);
    }
};

const isCollection = (val: unknown): val is Collection =>
    typeof val === 'object' && val !== null && 'eachPrimaryKey' in val;

const sanitizeArguments = (args: QueryDataArgs) => {
    // unordered and filtered by primary key is causing truncated results
    if (args.order === '') {
        const filters = args.filters.filter((f: Filter) => f.search !== '' && f.valid);
        filters.sort((f: Filter) => (f.indexed && getFuncIndexed(f) ? -1 : 1));
        for (const filter of filters) {
            if (isIndexedFilter(filter)) {
                args.order = filter.field;
                args.direction = 'asc';
                break;
            }
        }
    }
    return args;
};
