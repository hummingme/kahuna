/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Dexie, { Collection, Table } from 'dexie';

import {
    addDatespan,
    datepickerSearchValue,
    datespanSearchValues,
} from '#lib/datepicker-search';
import { unescapeString } from '#lib/escape-string';
import {
    filterColumn,
    getFuncFilter,
    getFuncIndexed,
    isIndexedFilter,
} from '#lib/filter';
import { specialNumbers } from './special-numbers';
import { resolvePath } from '#lib/utils';
import {
    indexedMethods,
    BaseFilter,
    Column,
    ColumnFormat,
    DateSearchVal,
    Filter,
    IndexedMethod,
    PreparedFilter,
} from '#types';

export const applyFilters = (
    dexieTable: Table,
    rawFilters: Filter[],
    columns: Column[],
    useLocalTimezone: boolean,
): Collection | Table => {
    rawFilters = rawFilters.filter((f) => f.search !== '' && f.valid);
    if (rawFilters.length === 0) return dexieTable;

    let filters: PreparedFilter[] = rawFilters.map((f) => ({
        ...f,
        search: prepareSearchValue(f, filterColumn(f.field, columns), useLocalTimezone),
        indexed: validSearchIndex(f),
    }));
    let collection: Collection;
    filters = optimizeApplyOrder(filters);
    if (filters[0].field === '*key*') {
        collection = applyUnnamedPkFilters(
            dexieTable,
            filters,
            columns,
            useLocalTimezone,
        );
        filters = filters.filter((f) => f.field !== '*key*');
    } else {
        const column = filterColumn(filters[0].field, columns);
        if (isIndexedFilter(filters[0])) {
            const res = applyIndexedFilter(
                dexieTable,
                filters,
                columns,
                useLocalTimezone,
            );
            collection = res.collection;
            filters = res.filters;
        } else {
            collection = applyUnindexedFilter(
                dexieTable,
                filters.shift()!,
                column,
                useLocalTimezone,
            );
        }
    }
    filters.forEach((f) => {
        const column = filterColumn(f.field, columns);
        collection = applyUnindexedFilter(collection, f, column, useLocalTimezone);
    });
    return collection;
};

const applyUnindexedFilter = (
    source: Table | Collection,
    filter: PreparedFilter,
    column: Column,
    useLocalTimezone: boolean,
) => {
    if (filter.datespan) {
        return applyDatespanFilter(source, filter, column.format, useLocalTimezone);
    } else {
        const func = filterFunc(filter, column);
        return source.filter((item) => func(item, filter.search));
    }
};

const applyIndexedFilter = (
    dexieTable: Table,
    filters: PreparedFilter[],
    columns: Column[],
    useLocalTimezone: boolean,
) => {
    const field = filters[0].field;
    const combinable = filters.filter(
        (f) => f.field === field && isCombinableIndexedFilter(f),
    );
    if (combinable.length === 0) {
        const [filter, ...rest] = filters;
        const { datespan, field, method, search } = filter;
        if (method === 'notequal' && datespan) {
            const collection = applyIndexedNotEqualDatespanFilter(
                filter,
                filterColumn(field, columns),
                useLocalTimezone,
                dexieTable,
            );
            return { filters: rest, collection };
        }
        // only `startsWith` is not combinable
        const indexedFunc = getFuncIndexed(filter);
        const collection =
            typeof search === 'string' &&
            (indexedFunc === 'startsWith' ||
                indexedFunc === 'startsWithIgnoreCase' ||
                indexedFunc === 'equalsIgnoreCase')
                ? dexieTable.where(field)[indexedFunc](search)
                : emptyCollection(dexieTable);
        return { filters: rest, collection };
    }

    filters = filters.filter((f) => !combinable.includes(f));
    const constraints: Constraints = collectConstraints(
        combinable,
        columns,
        useLocalTimezone,
    );
    const above = combinedAbove(constraints);
    const below = combinedBelow(constraints);
    let collection: Collection;
    if (impossibleIndexedFilters(constraints)) {
        collection = emptyCollection(dexieTable);
    } else if (constraints.equal.size > 0) {
        collection = applyIndexedFiltersWithEqual(
            field,
            constraints,
            below,
            above,
            dexieTable,
        );
    } else if (constraints.notequal.size > 0) {
        collection = applyIndexedFiltersWithNotEquals(
            field,
            constraints,
            below,
            above,
            dexieTable,
        );
    } else {
        collection = dexieTable.where(field).between(above, below);
    }
    return { filters, collection };
};

const applyUnnamedPkFilters = (
    dexieTable: Table,
    filters: PreparedFilter[],
    columns: Column[],
    useLocalTimezone: boolean,
): Collection => {
    const constraints = collectConstraints(
        filters.filter((f) => f.field === '*key*'),
        columns,
        useLocalTimezone,
    );
    const below = combinedBelow(constraints);
    const above = combinedAbove(constraints);

    if (impossibleIndexedFilters(constraints)) {
        return emptyCollection(dexieTable);
    }
    if (constraints.equal.size > 0) {
        return applyIndexedFiltersWithEqual(':id', constraints, below, above, dexieTable);
    } else if (constraints.notequal.size > 0) {
        return applyIndexedFiltersWithNotEquals(
            ':id',
            constraints,
            below,
            above,
            dexieTable,
        );
    } else {
        return dexieTable.where(':id').between(above, below);
    }
};

type Constraints = {
    above: Set<CVal>;
    below: Set<CVal>;
    equal: Set<CVal>;
    notequal: Set<CVal>;
};
type ConstraintIndex = keyof Constraints;
type CVal = number | string | Date;
type Bound = CVal | typeof Dexie.maxKey;

const isConstraintIndex = (method: string): method is ConstraintIndex => {
    return ['above', 'below', 'equal', 'notequal'].includes(method);
};

const collectConstraints = (
    filters: PreparedFilter[],
    columns: Column[],
    useLocalTimezone: boolean,
) => {
    const constraints: Constraints = {
        above: new Set(),
        below: new Set(),
        equal: new Set(),
        notequal: new Set(),
    };
    filters.forEach((filter) => {
        const method = filter.method;
        if (!isConstraintIndex(method)) return;

        let value = filter.search;
        if (isCombinableDatespanFilter(value, filter, method)) {
            const { below, above } = datespanSearchValues(
                value,
                filter,
                filterColumn(filter.field, columns),
                useLocalTimezone,
            );
            constraints['below'].add(below);
            constraints['above'].add(above);
        } else {
            if (method === 'above' && filter.includeBounds === false) {
                value = successor(value); // exclusive lower -> inclusive lower
            }
            if (method === 'below' && filter.includeBounds !== false) {
                value = successor(value); // inclusive upper -> exclusive upper
            }
            constraints[method].add(value);
        }
    });
    return constraints;
};

const combinedBelow = (constraints: Constraints): Bound =>
    constraints.below.size > 0
        ? [...constraints.below].sort(compareConstraint)[0]
        : Dexie.maxKey;

const combinedAbove = (constraints: Constraints): CVal =>
    constraints.above.size > 0
        ? [...constraints.above].sort(compareConstraint).at(-1)!
        : -Infinity;

const impossibleIndexedFilters = (constraints: Constraints): boolean => {
    const above = combinedAbove(constraints);
    const below = combinedBelow(constraints);
    return (
        constraints.equal.size > 1 ||
        !constraints.equal.isDisjointFrom(constraints.notequal) ||
        compareConstraint(above, below) >= 0
    );
};

const applyIndexedFiltersWithEqual = (
    field: string,
    constraints: Constraints,
    below: Bound,
    above: CVal,
    dexieTable: Table,
): Collection => {
    const [equal] = constraints.equal;
    if (compareConstraint(equal, above) < 0 || compareConstraint(equal, below) >= 0) {
        return emptyCollection(dexieTable);
    } else {
        return dexieTable.where(field).equals(equal);
    }
};

const applyIndexedFiltersWithNotEquals = (
    field: string,
    constraints: Constraints,
    below: Bound, // exclusive
    above: CVal, // inclusive
    dexieTable: Table,
): Collection => {
    const notEquals = [...constraints.notequal]
        .filter(
            (v) => compareConstraint(v, above) >= 0 && compareConstraint(v, below) < 0,
        )
        .sort(compareConstraint);

    if (notEquals.length === 0) {
        return dexieTable.where(field).between(above, below); // [above, below)
    }

    const ranges: [CVal, Bound][] = []; // ranges are [inclusive lower bound, exclusive upper bound]
    let lower: CVal = above;
    for (const ne of notEquals) {
        if (compareConstraint(lower, ne) < 0) ranges.push([lower, ne]); // skip empty ranges
        lower = successor(ne);
    }
    if (compareConstraint(lower, below) < 0) ranges.push([lower, below]);
    return dexieTable.where(field).inAnyRange(ranges); // lowers inclusive, uppers exclusive
};

const applyIndexedNotEqualDatespanFilter = (
    filter: PreparedFilter,
    column: Column,
    useLocalTimezone: boolean,
    dexieTable: Table,
) => {
    const { search: start, field, datespan } = filter;
    if (typeof start === 'string') {
        throw new Error(
            'applyIndexedNotEqualDatespanFilter called with improper search argument!',
        );
    }
    const end = addDatespan(start, datespan, column.format, useLocalTimezone);
    const first = typeof start === 'number' ? -Infinity : new Date(-8640000000000000);
    const last = typeof start === 'number' ? Infinity : new Date(8640000000000000);
    const ranges: [DateSearchVal, DateSearchVal][] = [
        [first, start],
        [end, last],
    ];
    return dexieTable.where(field).inAnyRange(ranges);
};

const applyDatespanFilter = (
    source: Table | Collection,
    filter: PreparedFilter,
    format: ColumnFormat,
    useLocalTimezone: boolean,
) => {
    const { search: start, field, datespan, method } = filter;
    if (typeof start === 'string' || (method !== 'equal' && method !== 'notequal')) {
        throw new Error('applyDatespanFilter called with improper arguments!');
    }
    const end = addDatespan(start, datespan, format, useLocalTimezone);
    const matcher =
        method === 'equal'
            ? (item: { [field]: DateSearchVal }) =>
                  item[field] >= start && item[field] < end
            : (item: { [field]: DateSearchVal }) =>
                  item[field] < start || item[field] >= end;
    return source.filter(matcher);
};

const emptyCollection = (dexieTable: Table) => {
    return dexieTable.where(':id').below(-Infinity);
};

const isCombinableIndexedFilter = (filter: PreparedFilter) => {
    const { caseSensitive, datespan, indexed, method, search } = filter;
    return (
        indexed &&
        (typeof search !== 'string' || caseSensitive === true) &&
        (['equal', 'above', 'below'].includes(method) ||
            (method === 'notequal' && !datespan))
    );
};

const optimizeApplyOrder = (filters: PreparedFilter[]) => {
    const indexedCounts: Record<string, number> = {};
    for (const f of filters) {
        if (isCombinableIndexedFilter(f)) {
            indexedCounts[f.field] = (indexedCounts[f.field] ?? 0) + 1;
        }
    }

    return filters.sort((a, b) => {
        // '*key*' filters must be applied first, because ':id' can be used
        // in table.where() but not in collection.filter()
        if (a.field === '*key*' || b.field === '*key*') {
            return Number(b.field === '*key*') - Number(a.field === '*key*');
        }
        // prioritize combinable indexed filters
        if (indexedCounts[a.field] > 1 || indexedCounts[b.field] > 1) {
            return indexedCounts[b.field] - indexedCounts[a.field];
        }

        const aIndexed = a.indexed && !!getFuncIndexed(a);
        const bIndexed = b.indexed && !!getFuncIndexed(b);

        // indexed filters before unindexed filters
        if (aIndexed !== bIndexed) {
            return aIndexed ? -1 : 1;
        }
        // consider the order of indexedMethods
        if (aIndexed && bIndexed) {
            return (
                indexedMethods.indexOf(a.method as IndexedMethod) -
                indexedMethods.indexOf(b.method as IndexedMethod)
            );
        }
        // sort unindexed filters at the end
        return Number.MAX_SAFE_INTEGER;
    });
};

const filterFunc = (filter: BaseFilter, column: Column) => {
    const func = getFuncFilter(filter, column);
    if (filter.field.includes('.')) {
        return (a: any, b: any) => func(resolvePath(a, filter.field), b);
    } else if (filter.field === '*value*') {
        return func;
    } else {
        return (a: any, b: any) => func(a[filter.field], b);
    }
};

const prepareSearchValue = (
    filter: Filter,
    column: Column,
    useLocalTimezone: boolean,
) => {
    const { search, method, datepicker } = filter;
    if (method === 'regexp' || method === 'empty') {
        return search;
    }
    if (datepicker) {
        const searchDate = datepickerSearchValue(filter, useLocalTimezone);
        return column.format === 'date'
            ? searchDate.valueOf()
            : column.format === 'date/1000'
              ? Math.round(searchDate.valueOf() / 1000)
              : searchDate;
    }
    if (search.startsWith("'")) {
        return search.slice(1);
    }
    if (['equal', 'notequal', 'below', 'above'].includes(method)) {
        const specialNumber = specialNumbers.get(search);
        if (specialNumber !== undefined) {
            return specialNumber;
        }

        if (Number.isNaN(Number(search)) === false) {
            return +search;
        }
    }
    return unescapeString(search);
};

const validSearchIndex = (filter: Filter) => {
    const { caseSensitive, indexed, method, search } = filter;
    if (
        (method === 'equal' || method === 'startswith') &&
        caseSensitive === false &&
        !canUseIgnoreCase(search)
    ) {
        return false;
    }
    return indexed;
};

// certain characters crash equalIgnoreCase and startsWithIgnoreCase
// https://github.com/dexie/Dexie.js/issues/2339
export function canUseIgnoreCase(needle: string) {
    return needle.toUpperCase() <= needle.toLowerCase();
}

// smallest value strictly greater in IndexedDB key order
const successor = <T extends CVal>(value: T): T => {
    if (typeof value === 'number') return nextUp(value) as T;
    if (typeof value === 'string') return (value + '\u0000') as T;
    return new Date(value.getTime() + 1) as T;
};

const upBuffer = new ArrayBuffer(8);
const f64 = new Float64Array(upBuffer);
const u64 = new BigUint64Array(upBuffer);
const nextUp = (x: number): number => {
    if (!Number.isFinite(x)) return x;
    if (x === 0) return Number.MIN_VALUE;

    f64[0] = x;
    if (x > 0) {
        u64[0]++;
    } else {
        u64[0]--;
    }
    return f64[0];
};

const compareConstraint = (a: Bound, b: Bound): number => {
    const ra = rank(a),
        rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 3) return 0;
    return a < b ? -1 : a > b ? 1 : 0;
};

// IndexedDB key order: number < Date < string < array
const rank = (v: Bound): number =>
    typeof v === 'number' ? 0 : v instanceof Date ? 1 : typeof v === 'string' ? 2 : 3;

const isCombinableDatespanFilter = (
    value: CVal,
    filter: PreparedFilter,
    method: string,
): value is DateSearchVal => {
    return (
        filter.datepicker &&
        filter.datespan &&
        method === 'equal' &&
        (value instanceof Date || typeof value === 'number')
    );
};
