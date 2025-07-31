/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Collection, IndexSpec, Table } from 'dexie';
import { getConnection } from './connection.ts';
import { collectionToArray } from './dexie-utils.ts';
import {
    getFuncFilter,
    getFuncIndexed,
    isIndexedFilter,
    indexedMethods,
    isCompoundHeadIndexed,
    type Filter,
    type IndexedMethod,
    type IndexedWhereClauseMethods,
} from './filter.ts';
import { hasIntersection, resolvePath } from './utils.ts';
import type { PlainObject } from './types/common.ts';

export interface QueryDataArgs {
    dbname: string;
    tablename: string;
    filters: Filter[];
    order: string;
    direction: 'asc' | 'desc';
    addUnnamedPk: boolean;
    offset: number;
    limit: number;
    encodeQueryResult: boolean;
}

export const queryData = async (args: QueryDataArgs) => {
    const dbHandle = await getConnection(args.dbname);
    const dexieTable = dbHandle.table(args.tablename);
    args = sanitizeArguments(args);

    return await dbHandle.transaction('r', args.tablename, async () => {
        const result = applyFilters(dexieTable, args.filters);
        const ordered = isCollection(result)
            ? await orderCollection(result, args)
            : await orderDexieTable(result, args);
        const total = await totalData(ordered);
        const data = await paginateData(ordered, args);
        return { data, total };
    });
};

export const applyFilters = (
    dexieTable: Table,
    filters: Filter[],
): Collection | Table => {
    filters = filters.filter((f) => f.search !== '' && f.valid);
    if (filters.length !== 0) {
        let collection: Collection;
        filters = optimizeApplyOrder(filters);
        if (filters[0].field === '*key*') {
            collection = applyUnnamedPkFilters(dexieTable, filters);
            filters = filters.filter((f) => f.field != '*key*');
        } else {
            const filter = filters.shift()!;
            const search = prepareSearchValue(filter);
            if (isIndexedFilter(filter)) {
                const where = dexieTable.where(filter.field);
                const indexedFunc = getFuncIndexed(filter) as IndexedWhereClauseMethods;
                collection = where[indexedFunc](search as any);
            } else {
                const func = filterFunc(filter);
                collection = dexieTable.filter((item) => func(item, search));
            }
        }
        filters.forEach((filter) => {
            const func = filterFunc(filter);
            const search = prepareSearchValue(filter);
            collection = collection.filter((item) => func(item, search));
        });
        return collection;
    } else {
        return dexieTable;
    }
};

interface Constraints {
    above: Set<CVal>;
    below: Set<CVal>;
    equal: Set<CVal>;
    notequal: Set<CVal>;
}
type ConstraintIndex = keyof Constraints;
type CVal = number | string;

const applyUnnamedPkFilters = (dexieTable: Table, filters: Filter[]): Collection => {
    const constraints: Constraints = {
        above: new Set(),
        below: new Set(),
        equal: new Set(),
        notequal: new Set(),
    };
    filters
        .filter((f) => f.field === '*key*')
        .forEach((f) => {
            const method = f.method as ConstraintIndex;
            let value = Number.isNaN(Number(f.search)) ? f.search : Number(f.search);
            if (f.includeBounds === false) {
                if (f.method === 'above') value = increaseConstraint(value);
                if (f.method === 'below') value = decreaseConstraint(value);
            }
            constraints[method].add(value);
        });
    const below = [...constraints.below].sort(compareConstraint).shift() || '\uffff';
    const above = [...constraints.above].sort(compareConstraint).pop() || -Infinity;

    if (impossibleUnnamedPkFilters(constraints)) {
        return emptyCollection(dexieTable);
    }
    if (constraints.equal.size > 0) {
        return applyUnnamedPkWithEqual(constraints, below, above, dexieTable);
    } else if (constraints.notequal.size > 0) {
        return applyUnnamedPkWithNotEquals(constraints, below, above, dexieTable);
    } else {
        return dexieTable.where(':id').between(above, below, true, true);
    }
};

const impossibleUnnamedPkFilters = (constraints: Constraints): boolean => {
    return (
        constraints.equal.size > 1 ||
        hasIntersection(constraints.equal, constraints.notequal)
    );
};

const applyUnnamedPkWithEqual = (
    constraints: Constraints,
    below: CVal,
    above: CVal,
    dexieTable: Table,
): Collection => {
    const [equal] = constraints.equal;
    if (compareConstraint(equal, above) === -1 || compareConstraint(equal, below) === 1) {
        return emptyCollection(dexieTable);
    } else {
        return dexieTable.where(':id').equals(equal);
    }
};

const applyUnnamedPkWithNotEquals = (
    constraints: Constraints,
    below: CVal,
    above: CVal,
    dexieTable: Table,
): Collection => {
    const notEquals = [...constraints.notequal].sort(compareConstraint);
    const insideRange = notEquals.filter(
        (value) =>
            compareConstraint(value, above) === 1 &&
            compareConstraint(value, below) === -1,
    );
    if (insideRange.length === 0) {
        return dexieTable.where(':id').between(above, below);
    } else {
        const ranges: [CVal, CVal][] = Array(insideRange.length + 1)
            .fill(null)
            .map((_) => [0, 0]);
        ranges[0][0] = decreaseConstraint(above);
        for (let idx = 0; idx < insideRange.length; idx++) {
            ranges[idx][1] = insideRange[idx];
            ranges[idx + 1][0] = insideRange[idx];
        }
        ranges[insideRange.length][1] = increaseConstraint(below);
        return dexieTable.where(':id').inAnyRange(ranges, { includeLowers: false });
    }
};

const MIN_FLOAT = 0.00000000000001; // floats have at least 15 significant digits

const increaseConstraint = (value: CVal): CVal => {
    if (typeof value === 'number') {
        return value + MIN_FLOAT;
    } else {
        const last = value.codePointAt(value.length - 1)!;
        return last < 0xffff
            ? value.slice(0, -1) + String.fromCodePoint(last + 1)
            : value + String.fromCodePoint(1);
    }
};

const decreaseConstraint = (value: CVal): CVal => {
    if (typeof value === 'number') {
        return value - MIN_FLOAT;
    } else {
        const last = value.codePointAt(value.length - 1)!;
        return last === 1
            ? value.slice(0, -2) + String.fromCodePoint(0xffff)
            : value.slice(0, -1) + String.fromCodePoint(last - 1);
    }
};

const compareConstraint = (a: CVal, b: CVal): number => {
    if (typeof a === typeof b) {
        return a >= b ? 1 : -1;
    } else {
        return typeof a === 'string' ? 1 : -1;
    }
};

const emptyCollection = (dexieTable: Table) => {
    return dexieTable.where(':id').below(-Infinity);
};

const optimizeApplyOrder = (filters: Filter[]) => {
    return filters.sort((a, b) => {
        if (a.field === '*key*' || b.field === '*key*') {
            return a.field === '*key*' ? -1 : 1;
        }
        if (a.indexed !== b.indexed) {
            return a.indexed ? -1 : 1;
        }
        if (a.indexed && getFuncIndexed(a)) {
            return (
                indexedMethods.indexOf(a.method as IndexedMethod) -
                indexedMethods.indexOf(b.method as IndexedMethod)
            );
        }
        if (!a.indexed && !b.indexed) {
            return isCompoundHeadIndexed(a) ? -1 : 1;
        }
        return Number.MAX_SAFE_INTEGER;
    });
};

const filterFunc = (filter: Filter) => {
    const func = getFuncFilter(filter);
    if (filter.field.includes('.')) {
        return (a: any, b: any) => func(resolvePath(a, filter.field), b);
    } else if (filter.field === '*value*') {
        return func;
    } else {
        return (a: any, b: any) => func(a[filter.field], b);
    }
};

const prepareSearchValue = ({ search, method }: { search: string; method: string }) => {
    if (Number.isNaN(Number(search)) === false) {
        if (['equal', 'notequal', 'below', 'above'].includes(method)) {
            return +search;
        }
    }
    return search;
};

const orderCollection = async (
    collection: Collection,
    {
        order,
        direction,
        addUnnamedPk,
    }: Pick<QueryDataArgs, 'order' | 'direction' | 'addUnnamedPk'>,
): Promise<Collection | PlainObject[]> => {
    if (order === '') {
        return collection;
    }
    let data = await collectionToArray(collection, addUnnamedPk);
    if (order.length > 0) {
        data = ensureOrderData(data, order);
        const up = direction === 'asc' ? 1 : -1;
        const down = -up;
        data.sort((a, b) => {
            if (a[order] === undefined) return down;
            if (b[order] === undefined) return up;
            return a[order] > b[order] ? up : down;
        });
    }
    return data;
};

/*
 * in case of sorting by an inner property, the values are required
 * as direct properties of the data rows. The same applies when sorting
 * by type-specific KeyPaths. i.e String.length or File.lastModified
 */
const ensureOrderData = (data: PlainObject[], order: string): object[] => {
    if (order.includes('.')) {
        for (const row of data) {
            row[order] = resolvePath(row, order);
        }
    }
    return data;
};

const orderDexieTable = async (
    dexieTable: Table,
    { order, direction, addUnnamedPk }: QueryDataArgs,
) => {
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
        return orderCollection(dexieTable.toCollection(), {
            order,
            direction,
            addUnnamedPk,
        });
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

const totalData = async (ordered: Collection | PlainObject[]): Promise<number> => {
    return isCollection(ordered) ? await ordered.count() : ordered.length;
};

const paginateData = async (
    ordered: Collection | PlainObject[],
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
