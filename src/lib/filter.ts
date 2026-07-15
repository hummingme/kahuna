/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Table } from 'dexie';

import type { Column } from '#lib/column';
import { isPrimKeyNamed, isPrimKeyCompound } from '#lib/dexie-utils';
import { getType, isEmptyObject } from '#lib/datatypes';
import { ValueFormatter } from '#lib/value-formatter';
import {
    caseSensitiveMethods,
    compoundHeadIndexedMethods,
    CompoundHeadIndexedMethod,
    indexedMethods,
    type Filter,
    type FilterDefaultOptions,
    type FilterEmptyMethod,
    type FilterMethod,
    type IndexedMethod,
} from '#types/filter';

type FilterMethodProps = {
    short: string;
    funcFilter: (a: unknown, b: string | number) => boolean;
    funcIndexed?: string;
};

export const defaultFilterOptions = (): FilterDefaultOptions => ({
    method: 'equal',
    caseSensitive: true,
    includeBounds: false,
    empty: ['undefined', 'null'],
});

export const emptyFilter = (): Filter =>
    Object.assign(
        {
            field: '',
            search: '',
            indexed: false,
            compoundHead: false,
            valid: true,
        },
        defaultFilterOptions(),
    );

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
    return Object.assign(emptyFilter(), {
        field: column.name,
        indexed: column.indexed,
        compoundHead: column.compoundHead,
    });
};

const stringFormatter = new ValueFormatter('string');

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
            stringFormatter.render(a, getType(a)).startsWith(b),
    },
    endswith: {
        short: '%..',
        funcFilter: (a: unknown, b: string) =>
            stringFormatter.render(a, getType(a)).endsWith(b),
    },
    contains: {
        short: '%..%',
        funcFilter: (a: unknown, b: string) => {
            return stringFormatter.render(a, getType(a)).includes(b);
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
    const rx = new RegExp(filter.search, flags);
    return (a: unknown) => rx.test(stringFormatter.render(a, getType(a)));
};

const emptyFunc = (filter: Filter) => {
    const emptyCheck = emptyCheckFunc(filter.empty);
    // a: data value; b: filter value
    return (a: unknown, b: string | number) => {
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

export const getFuncFilter = (filter: Filter) => {
    switch (filter.method) {
        case 'regexp':
            return regexpFunc(filter);
        case 'empty':
            return emptyFunc(filter);
        default:
            return methodProperties(filter).funcFilter;
    }
};

export const getFuncIndexed = (filter: Filter) => {
    const funcIndexed = methodProperties(filter).funcIndexed;
    if (typeof funcIndexed === 'string') {
        if (
            ['equals', 'startsWith'].includes(funcIndexed) &&
            filter.caseSensitive === false
        ) {
            return `${funcIndexed}IgnoreCase`;
        }
        if (isIndexedMethod(filter.method)) {
            return funcIndexed;
        }
    } else {
        return;
    }
};

/*
 * return { short, funcFilter, ?funcIndexed } for the given method
 */
export const methodProperties = ({ method, includeBounds, caseSensitive }: Filter) => {
    const methodProps = searchMethods()[method];

    const props: FilterMethodProps =
        'includeBounds' in methodProps
            ? (methodProps as any)[includeBounds ? 'includeBounds' : 'excludeBounds']
            : methodProps;

    if (caseSensitive === false) {
        const func = props.funcFilter;
        props.funcFilter = (...args: unknown[]) => {
            const [a, b] = args.map((p) =>
                stringFormatter.render(p, getType(p)).toLowerCase(),
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

export const isIndexedFilter = (filter: Filter) => {
    const { indexed, method, caseSensitive } = filter;
    if (indexed) {
        if (method === 'notequal' && caseSensitive === true) return true;
        if (isIndexedMethod(method)) return true;
        if (isCompoundHeadIndexed(filter)) return true;
    }
    return false;
};

const isIndexedMethod = (method: FilterMethod): method is IndexedMethod => {
    return indexedMethods.includes(method as IndexedMethod);
};

export const isCompoundHeadIndexed = (filter: Filter) => {
    const { compoundHead, method, caseSensitive } = filter;
    return (
        compoundHead === true &&
        isCompoundHeadIndexedMethod(method) &&
        (!caseSensitiveMethods.includes(method) || caseSensitive === true)
    );
};

const isCompoundHeadIndexedMethod = (
    method: FilterMethod,
): method is CompoundHeadIndexedMethod => {
    return compoundHeadIndexedMethods.includes(method as CompoundHeadIndexedMethod);
};
