/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { isPrimKeyNamed, isPrimKeyCompound } from '../lib/dexie-utils.js';
import { isEmptyObject, valueToString } from './types.js';

export const defaultFilterOptions = () => ({
    method: 'equal',
    caseSensitive: true,
    includeBounds: false,
    empty: ['undefined', 'null'], // 'array', 'object', 'string'
});

export const emptyFilter = () =>
    Object.assign(
        {
            field: null,
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
];

export const initialFilter = (columns, dexieTable) => {
    let name;
    const { primKey, indexes } = dexieTable.schema;
    if (isPrimKeyCompound(primKey)) {
        name = primKey.keyPath[0];
    } else if (isPrimKeyNamed(primKey)) {
        name = primKey.name;
    } else if (indexes.length > 0) {
        const index = indexes.find((idx) => idx.compound === false);
        name = index ? index.name : indexes[0].keyPath[0];
    }
    const column = columns.filter((c) => c.name === name)[0] || columns[0];
    return Object.assign(emptyFilter(), {
        field: column.name,
        indexed: column.indexed,
        compoundHead: column.compoundHead,
    });
};

export const searchMethods = () => ({
    equal: {
        short: '=',
        funcIndexed: 'equals',
        funcFilter: (a, b) => a === b,
    },
    below: {
        includeBounds: {
            short: '<=',
            funcIndexed: 'belowOrEqual',
            funcFilter: (a, b) => a <= b,
        },
        excludeBounds: {
            short: '<',
            funcIndexed: 'below',
            funcFilter: (a, b) => a < b,
        },
    },
    above: {
        includeBounds: {
            short: '>=',
            funcIndexed: 'aboveOrEqual',
            funcFilter: (a, b) => a >= b,
        },
        excludeBounds: {
            short: '>',
            funcIndexed: 'above',
            funcFilter: (a, b) => a > b,
        },
    },
    notequal: {
        short: '≠',
        funcIndexed: 'notEqual',
        funcFilter: (a, b) => a !== b,
    },
    startswith: {
        short: '..%',
        funcIndexed: 'startsWith',
        funcFilter: (a, b) => valueToString(a, typeof a, 'definite').startsWith(b),
    },
    endswith: {
        short: '%..',
        funcFilter: (a, b) => valueToString(a, typeof a, 'definite').endsWith(b),
    },
    contains: {
        short: '%..%',
        funcFilter: (a, b) => {
            return valueToString(a, typeof a, 'definite').includes(b);
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

// keep the order, it is used to determine which filter to apply first in queryData()
export const indexedMethods = ['equal', 'below', 'above', 'startswith', 'notequal'];

export const compoundHeadIndexedMethods = ['equal', 'notequal', 'startswith'];

export const caseSensitiveMethods = [
    'equal',
    'notequal',
    'startswith',
    'endswith',
    'contains',
    'regexp',
];

const regexpFunc = (filter) => {
    const flags = filter.caseSensitive ? '' : 'i';
    const rx = new RegExp(filter.search, flags);
    return (a) => rx.test(valueToString(a, typeof a, 'definite'));
};

const emptyFunc = (filter) => {
    const emptyCheck = emptyCheckFunc(filter.empty);
    // a: data value; b: filter value
    return (a, b) => {
        if (['yes', 'no'].includes(b)) {
            return b === 'yes' ? emptyCheck(a) : !emptyCheck(a);
        } else {
            return true;
        }
    };
};

const emptyCheckFunc = (checks) => {
    const conditions = [];
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
    return (value) => {
        for (const condition of conditions) {
            if (condition(value)) return true;
        }
        return false;
    };
};

export const getFuncFilter = (filter) => {
    switch (filter.method) {
        case 'regexp':
            return regexpFunc(filter);
        case 'empty':
            return emptyFunc(filter);
        default:
            return methodProperties(filter).funcFilter;
    }
};

export const getFuncIndexed = (filter) => {
    const funcIndexed = methodProperties(filter).funcIndexed;
    if (typeof funcIndexed === 'string' && indexedMethods.includes(filter.method)) {
        return funcIndexed;
    } else {
        return;
    }
};

/*
 * return { short, funcFilter, ?funcIndexed } for the given method
 */
export const methodProperties = ({ method, includeBounds, caseSensitive }) => {
    const props = searchMethods()[method];
    const bounds = includeBounds ? 'includeBounds' : 'excludeBounds';
    if (!caseSensitive) {
        const func = props.funcFilter;
        props.funcFilter = (...args) =>
            func(
                ...args.map((a) => valueToString(a, typeof a, 'definite').toLowerCase()),
            );
    }
    if (method === 'regexp' && !caseSensitive) {
        props.short += 'i';
    }
    return Object.hasOwn(props, bounds) ? props[bounds] : props;
};

export const isFiltered = (filters) => {
    const validFilters = filters.filter((f) => f.search !== '' && f.valid);
    return validFilters.length > 0;
};

export const isFilterValid = (val, filter) => {
    if (filter.method === 'empty') {
        return ['', 'yes', 'no'].includes(val) && filter.empty.length > 0;
    }
    return true;
};

export const isIndexedFilter = (filter) => {
    const indexed =
        filter.indexed &&
        indexedMethods.includes(filter.method) &&
        (!caseSensitiveMethods.includes(filter.method) || filter.caseSensitive === true);

    return indexed || isCompoundHeadIndexed(filter);
};

export const isCompoundHeadIndexed = (filter) => {
    return (
        filter.compoundHead === true &&
        compoundHeadIndexedMethods.includes(filter.method) &&
        (!caseSensitiveMethods.includes(filter.method) || filter.caseSensitive === true)
    );
};
