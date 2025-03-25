/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { collectionToArray } from './dexie-utils.js';
import { getConnection } from './connection.js';
import {
    getFuncFilter,
    getFuncIndexed,
    isIndexedFilter,
    indexedMethods,
    isCompoundHeadIndexed,
} from './filter.js';
import { resolvePath } from './utils.js';

export const queryData = async (args) => {
    const dbHandle = await getConnection(args.dbname);
    args.dexieTable = dbHandle.table(args.tablename);
    args = sanitizeArguments(args);

    return await dbHandle.transaction('r', args.tablename, async () => {
        const result = applyFilters(args);
        const ordered = isCollection(result)
            ? await orderCollection(result, args)
            : await orderDexieTable(result, args);
        const total = await totalData(ordered);
        const data = await paginateData(ordered, args);
        return { data, total };
    });
};

export const applyFilters = ({ dexieTable, filters }) => {
    filters = filters.filter((f) => f.search !== '' && f.valid);
    if (filters.length > 0) {
        let collection;
        filters = optimizeApplyOrder(filters);
        if (filters[0].field === '*key*') {
            collection = applyUnnamedPkFilters(dexieTable, filters);
            filters = filters.filter((f) => f.field != '*key*');
        } else if (filters.length > 0) {
            const filter = filters.shift();
            const search = prepareSearchValue(filter);
            if (isIndexedFilter(filter)) {
                const indexedFunc = getFuncIndexed(filter);
                collection = dexieTable.where(filter.field)[indexedFunc](search);
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

const applyUnnamedPkFilters = (dexieTable, filters) => {
    const constraints = {
        above: new Set(),
        below: new Set(),
        equal: new Set(),
        notequal: new Set(),
    };
    const pkFilters = filters.filter((f) => f.field === '*key*');
    pkFilters.forEach((f) => {
        let value = +f.search;
        if (f.includeBounds === false) {
            if (f.method === 'above') value = value + 1;
            if (f.method === 'below') value = value - 1;
        }
        constraints[f.method].add(value);
    });
    const below = [...constraints.below].sort((a, b) => a - b).shift() || Infinity;
    const above = [...constraints.above].sort((a, b) => a - b).pop() || -Infinity;

    if (constraints.equal.size > 0) {
        return applyUnnamedPkWithEquals(constraints, below, above, dexieTable);
    } else if (constraints.notequal.size > 0) {
        return applyUnnamedPkWithNotEquals(constraints, below, above, dexieTable);
    } else {
        return dexieTable.where(':id').between(above, below, true, true);
    }
};

const applyUnnamedPkWithEquals = (constraints, below, above, dexieTable) => {
    if (
        constraints.equal.size > 1 ||
        constraints.equal.intersection(constraints.notequal).size > 0
    ) {
        return emptyCollection(dexieTable);
    }
    const [equal] = constraints.equal;
    if (equal < above || equal > below) {
        return emptyCollection(dexieTable);
    } else {
        return dexieTable.where(':id').equals(equal);
    }
};

const applyUnnamedPkWithNotEquals = (constraints, below, above, dexieTable) => {
    const notEquals = [...constraints.notequal].sort((a, b) => a - b);
    const insideRange = notEquals.filter((value) => value >= above && value <= below);
    if (insideRange.length === 0) {
        dexieTable.where(':id').between(above, below);
    } else {
        const ranges = Array(insideRange.length + 1)
            .fill()
            .map((_entry) => []);
        ranges[0][0] = above - 1;
        for (let idx = 0; idx < insideRange.length; idx++) {
            ranges[idx][1] = insideRange[idx];
            ranges[idx + 1][0] = insideRange[idx];
        }
        ranges[insideRange.length][1] = below + 1;
        return dexieTable.where(':id').inAnyRange(ranges, { includeLowers: false });
    }
};

const emptyCollection = (dexieTable) => {
    return dexieTable.where(':id').below(-Infinity);
};

const optimizeApplyOrder = (filters) => {
    return filters.sort((a, b) => {
        if (a.field === '*key*' || b.field === '*key*') {
            return a.field === '*key*' ? -1 : 1;
        }
        if (a.indexed !== b.indexed) {
            return a.indexed ? -1 : 1;
        }
        if (a.indexed && getFuncIndexed(a)) {
            return indexedMethods.indexOf(a.method) - indexedMethods.indexOf(b.method);
        }
        if (!a.indexed && !b.indexed) {
            return isCompoundHeadIndexed(a) ? -1 : 1;
        }
        return Number.MAX_SAFE_INTEGER;
    });
};

const filterFunc = (filter) => {
    const func = getFuncFilter(filter);
    if (filter.field.includes('.')) {
        return (a, b) => func(resolvePath(a, filter.field), b);
    } else if (filter.field === '*value*') {
        return func;
    } else {
        return (a, b) => func(a[filter.field], b);
    }
};

const prepareSearchValue = ({ search, method }) => {
    if (Number.isNaN(Number(search)) === false) {
        if (['equal', 'notequal', 'below', 'above'].includes(method)) {
            return +search;
        }
    }
    return search;
};

const orderCollection = async (collection, { order, direction, addUnnamedPk }) => {
    if (order === '') {
        return collection;
    }
    if (direction === 'desc') {
        collection = collection.reverse();
    }
    return await collectionToArray(collection, addUnnamedPk, order, direction);
};

const orderDexieTable = async (dexieTable, { order, direction, addUnnamedPk }) => {
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
        return await collectionToArray(
            dexieTable.toCollection(),
            addUnnamedPk,
            order,
            direction,
        );
    }
};

const isPrimKeyOrder = (order, primKey) => {
    if (order === '') return true;
    if (order === ':id') return true;
    if (primKey.compound === false && primKey.name === order) return true;
    if (primKey.compound === true && primKey.keyPath[0].name === order) return true;
    return false;
};

const isIndexedOrder = (order, indexes) => {
    for (const index of indexes) {
        if (index.compound === false && index.name === order) return true;
        if (index.compound === true && index.keyPath[0] === order) return true;
    }
    return false;
};

const totalData = async (ordered) => {
    return isCollection(ordered) ? await ordered.count() : ordered.length;
};

const paginateData = async (ordered, { offset, limit, addUnnamedPk }) => {
    if (isCollection(ordered)) {
        const collection = ordered.offset(offset - 1).limit(limit);
        return await collectionToArray(collection, addUnnamedPk);
    } else {
        return ordered.slice(offset - 1, offset - 1 + limit);
    }
};

const isCollection = (val) => typeof val === 'object' && 'eachPrimaryKey' in val;

const sanitizeArguments = (args) => {
    // unordered and filtered by primary key is causing truncated results
    if (args.order === '') {
        const filters = args.filters.filter((f) => f.search !== '' && f.valid);
        filters.sort((f) => (f.indexed && getFuncIndexed(f) ? -1 : 1));
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
