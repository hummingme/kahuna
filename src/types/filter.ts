/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { searchMethods } from '#lib/filter';

export type FilterDefaultOptions = {
    method: FilterMethod;
    caseSensitive: boolean;
    includeBounds: boolean;
    empty: FilterEmptyMethod[];
};

export type Filter = FilterDefaultOptions & {
    field: string;
    search: string;
    indexed: boolean;
    compoundHead: boolean;
    valid: boolean;
};

export type FilterEmptyMethod = 'undefined' | 'null' | 'array' | 'object' | 'string';

export type FilterMethod = keyof ReturnType<typeof searchMethods>;

// keep the order, it is used to determine which filter to apply first in queryData()
export const indexedMethods = [
    'equal',
    'startswith',
    'below',
    'above',
    'notequal',
] as const;
export type IndexedMethod = (typeof indexedMethods)[number];

export const compoundHeadIndexedMethods = ['equal', 'notequal', 'startswith'] as const;
export type CompoundHeadIndexedMethod = (typeof compoundHeadIndexedMethods)[number];

export const caseSensitiveMethods = [
    'equal',
    'notequal',
    'startswith',
    'endswith',
    'contains',
    'regexp',
];

export type IndexedWhereClauseMethods =
    | 'equals'
    | 'belowOrEqual'
    | 'below'
    | 'aboveOrEqual'
    | 'above'
    | 'notEqual'
    | 'startsWith';
