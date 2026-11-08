/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { searchMethods } from '#lib/filter';
import { DatepickerType } from '#types';

export type FilterDefaultOptions = {
    method: FilterMethod;
    caseSensitive: boolean;
    includeBounds: boolean;
    empty: FilterEmptyMethod[];
    datepicker: DatepickerType | false;
    datespan: Datespan;
};

export type Datespan = 'year' | 'month' | 'day' | false;

export type BaseFilter = FilterDefaultOptions & {
    field: string;
    indexed: boolean;
    valid: boolean;
};

export type Filter = BaseFilter & {
    search: string;
};

export type PreparedFilter = BaseFilter & {
    search: string | number | Date;
};

export type DateSearchVal = Date | number;

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

export const caseSensitiveMethods = [
    'equal',
    'notequal',
    'startswith',
    'endswith',
    'contains',
    'regexp',
];

type GenericWhereClauseMethod =
    | 'equals'
    | 'belowOrEqual'
    | 'below'
    | 'aboveOrEqual'
    | 'above'
    | 'notEqual';

type StringOnlyWhereClauseMethod =
    | 'startsWith'
    | 'equalsIgnoreCase'
    | 'startsWithIgnoreCase';

export type IndexedWhereClauseMethod =
    | GenericWhereClauseMethod
    | StringOnlyWhereClauseMethod;

const GENERIC_METHODS = new Set<string>([
    'equals',
    'belowOrEqual',
    'below',
    'aboveOrEqual',
    'above',
    'notEqual',
]);

const STRING_ONLY_METHODS = new Set<string>([
    'startsWith',
    'equalsIgnoreCase',
    'startsWithIgnoreCase',
]);

export const isGenericMethod = (m: string): m is GenericWhereClauseMethod =>
    GENERIC_METHODS.has(m);

export const isStringOnlyMethod = (m: string): m is StringOnlyWhereClauseMethod =>
    STRING_ONLY_METHODS.has(m);
