/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { IndexSpec } from 'dexie';

export interface PlainObject {
    [key: string]: any;
}

export interface PlainObjectOf<T> {
    [key: string]: T;
}

export type Direction = 'asc' | 'desc';

export const DATA_FORMATS = ['json', 'csv', 'dexie'] as const;
export type ExportFormat = (typeof DATA_FORMATS)[number];
export type ImportFormat = (typeof DATA_FORMATS)[number];

export const EMPTY_AS = ['empty string', 'null', 'undefined', 'exclude'] as const;
export type EmptyAsValue = (typeof EMPTY_AS)[number];

export type ExecutionMethod = 'webworker' | 'unsafeEval' | 'userscript';

export interface Position {
    x: number;
    y: number;
}

export const EMPTY_POSITION: Position = { x: 0, y: 0 };

export interface KDatabase {
    name: string;
    version: number;
    tables: string[];
}
export interface KTable {
    name: string;
    indexes: IndexSpec[];
    primKey: IndexSpec;
    count: number;
}
