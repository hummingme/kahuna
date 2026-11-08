/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Table } from 'dexie';

import { isPrimKeyNamed, isPrimKeyCompound } from '#lib/dexie-utils';
import { getType, isEmptyObject } from '#lib/datatypes';
import { ValueFormatter } from '#lib/value-formatter';
import type { Column } from '#types';
import {
    indexedMethods,
    isGenericMethod,
    isStringOnlyMethod,
    type BaseFilter,
    type Filter,
    type FilterDefaultOptions,
    type FilterEmptyMethod,
    type FilterMethod,
    type IndexedMethod,
    type IndexedWhereClauseMethod,
} from '#types/filter';

type FilterMethodProps = {
    short: string;
    funcFilter: (a: unknown, b: string | number | Date) => boolean;
    funcIndexed?: string;
};

export const defaultFilterOptions = (): FilterDefaultOptions => ({
    method: 'equal',
    caseSensitive: true,
    includeBounds: false,
    empty: ['undefined', 'null'],
    datepicker: false,
    datespan: false,
});

export const emptyFilter = (): Filter => ({
    field: '',
    search: '',
    indexed: false,
    valid: true,
    ...defaultFilterOptions(),
});

export const filterCheckboxes = [
    'caseSensitive',
    'includeBounds',
    'emptyUndefined',
    'emptyNull',
    'emptyString',
    'emptyArray',
    'emptyObject',
] as const;

export const initialFilter = (columns: Column[], dexieTable: Table): Filter => {
    let name = '';
    const { primKey, indexes } = dexieTable.schema;
    if (isPrimKeyCompound(primKey) && primKey.keyPath) {
        name = primKey.keyPath[0];
    } else if (isPrimKeyNamed(primKey)) {
        name = primKey.name;
    } else if (indexes.length > 0) {
        const index = indexes.find((idx) => idx.keyPath !== undefined);
        if (index && index.keyPath) {
            name = index.keyPath[0];
        }
    }
    const column = columns.filter((c) => c.name === name)[0] || columns[0];
    return {
        ...emptyFilter(),
        field: column.name,
        indexed: column.indexed,
    };
};

const stringFormatter = new ValueFormatter('string');
const renderOptions = {
    escapeNonCharacters: false,
    escapeCR: false,
    escapeBackslash: false,
};

export const searchMethods = () => ({
    equal: {
        short: '=',
        funcIndexed: 'equals',
        funcFilter: (a: unknown, b: string | number) => a === b,
    },
    below: {
        includeBounds: {
            short: '<=',
            funcIndexed: 'belowOrEqual',
            funcFilter: (a: any, b: string | number) => a <= b,
        },
        excludeBounds: {
            short: '<',
            funcIndexed: 'below',
            funcFilter: (a: any, b: string | number) => a < b,
        },
    },
    above: {
        includeBounds: {
            short: '>=',
            funcIndexed: 'aboveOrEqual',
            funcFilter: (a: any, b: string | number) => a >= b,
        },
        excludeBounds: {
            short: '>',
            funcIndexed: 'above',
            funcFilter: (a: any, b: string | number) => a > b,
        },
    },
    notequal: {
        short: '≠',
        funcIndexed: 'notEqual',
        funcFilter: (a: unknown, b: string | number) => a !== b,
    },
    startswith: {
        short: '..%',
        funcIndexed: 'startsWith',
        funcFilter: (a: unknown, b: string) =>
            stringFormatter.render(a, getType(a), renderOptions).startsWith(b),
    },
    endswith: {
        short: '%..',
        funcFilter: (a: unknown, b: string) =>
            stringFormatter.render(a, getType(a), renderOptions).endsWith(b),
    },
    contains: {
        short: '%..%',
        funcFilter: (a: unknown, b: string) => {
            return stringFormatter.render(a, getType(a), renderOptions).includes(b);
        },
    },
    empty: {
        short: '(empty)',
        funcFilter: null, // depends on filter options, set by emptyFunc()
    },
    regexp: {
        short: '/regexp/',
        funcFilter: null, // depends on filter value, set by regexpFunc()
    },
});

const regexpFunc = (filter: Filter) => {
    const flags = filter.caseSensitive ? '' : 'i';
    const rx = new RegExp(String(filter.search), flags);
    return (a: unknown) => rx.test(stringFormatter.render(a, getType(a), renderOptions));
};

const emptyFunc = (filter: BaseFilter) => {
    const emptyCheck = emptyCheckFunc(filter.empty);
    // a: data value; b: filter value
    return (a: unknown, b: string | number | Date) => {
        if (typeof b === 'string' && ['yes', 'no'].includes(b)) {
            return b === 'yes' ? emptyCheck(a) : !emptyCheck(a);
        } else {
            return true;
        }
    };
};

const emptyCheckFunc = (checks: FilterEmptyMethod[]): ((arg0: unknown) => boolean) => {
    const conditions: ((arg0: unknown) => boolean)[] = [];
    if (checks.includes('undefined')) {
        conditions.push((value) => value === undefined);
    }
    if (checks.includes('null')) {
        conditions.push((value) => value === null);
    }
    if (checks.includes('string')) {
        conditions.push((value) => value === '');
    }
    if (checks.includes('array')) {
        conditions.push((value) => Array.isArray(value) && value.length === 0);
    }
    if (checks.includes('object')) {
        conditions.push((value) => isEmptyObject(value));
    }
    return (value: unknown) => {
        for (const condition of conditions) {
            if (condition(value)) return true;
        }
        return false;
    };
};

export const getFuncFilter = (filter: BaseFilter, column: Column) => {
    if (filter.datepicker && column.format !== 'date' && column.format !== 'date/1000') {
        return (a: Date, b: unknown) => {
            if (!(b instanceof Date)) return false;
            return methodProperties(filter).funcFilter(a.valueOf(), b.valueOf());
        };
    }
    switch (filter.method) {
        case 'regexp':
            return regexpFunc(filter as Filter);
        case 'empty':
            return emptyFunc(filter);
        default:
            return methodProperties(filter).funcFilter;
    }
};

export const getFuncIndexed = (
    filter: BaseFilter,
): IndexedWhereClauseMethod | undefined => {
    const funcIndexed = methodProperties(filter).funcIndexed;
    if (typeof funcIndexed !== 'string' || !isIndexedMethod(filter.method)) {
        return undefined;
    }
    const method = appliesIgnoreCaseFunction(funcIndexed, filter.caseSensitive)
        ? `${funcIndexed}IgnoreCase`
        : funcIndexed;

    return isGenericMethod(method) || isStringOnlyMethod(method) ? method : undefined;
};

export function appliesIgnoreCaseFunction(func: string, caseSensitive: boolean) {
    return (func === 'equals' || func === 'startsWith') && caseSensitive === false;
}

/*
 * return { short, funcFilter, ?funcIndexed } for the given method
 */
export const methodProperties = ({
    method,
    includeBounds,
    caseSensitive,
}: BaseFilter) => {
    const methodProps = searchMethods()[method];

    const props: FilterMethodProps =
        'includeBounds' in methodProps
            ? (methodProps as any)[includeBounds ? 'includeBounds' : 'excludeBounds']
            : methodProps;

    if (caseSensitive === false) {
        const func = props.funcFilter;
        props.funcFilter = (...args: unknown[]) => {
            const [a, b] = args.map((p) =>
                stringFormatter.render(p, getType(p), renderOptions).toLowerCase(),
            );
            return func(a, b);
        };
    }
    if (method === 'regexp' && caseSensitive === false) {
        props.short += 'i';
    }
    return props;
};

export const isFiltered = (filters: Filter[]) => {
    const validFilters = filters.filter((f) => f.search !== '' && f.valid);
    return validFilters.length > 0;
};

export const isFilterValid = (val: string, filter: Filter) => {
    if (filter.method === 'empty') {
        return ['', 'yes', 'no'].includes(val) && filter.empty.length > 0;
    }
    return true;
};

export const isIndexedFilter = (filter: BaseFilter) => {
    const { indexed, method, caseSensitive } = filter;
    if (indexed) {
        if (method === 'notequal' && caseSensitive === true) return true;
        if (isIndexedMethod(method)) return true;
    }
    return false;
};

const isIndexedMethod = (method: FilterMethod): method is IndexedMethod => {
    return indexedMethods.includes(method as IndexedMethod);
};

export const filterColumn = (filterField: string, columns: Column[]) => {
    const column = columns.find((c) => c.name === filterField);
    if (!column) throw new Error('Cannot find filtered column!');
    return column;
};

export const datespanLabel = (filter: Filter) => {
    const spanName = datespan(filter);
    return `as ${spanName} span`;
};

export const datespan = (filter: Filter) => {
    const dp = filter.datepicker;
    if (dp === 'datetime' || dp === 'millisecond') {
        return false;
    }
    return dp === 'date' ? 'day' : dp;
};
