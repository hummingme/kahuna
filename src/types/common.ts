/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { IndexSpec } from 'dexie';

export type PlainObject = {
    [key: string]: any;
};

export type UnknownRecord = Record<string, unknown>;

export type RecordOf<T> = Record<string, T>;

export type KeysOfType<T, U> = {
    [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type Direction = 'asc' | 'desc';

export const EMPTY_AS = ['empty string', 'null', 'undefined', 'exclude'] as const;
export type EmptyAsValue = (typeof EMPTY_AS)[number];

export type ExecutionMethod = 'webworker' | 'unsafeEval' | 'userscript';

export const EMPTY_POSITION = { x: 0, y: 0 };
export type Position = typeof EMPTY_POSITION;

export type AppTarget = { database: string; table: string };

export type KDatabase = {
    name: string;
    version: number;
    tables: string[];
};

export type KTable = {
    name: string;
    indexes: IndexSpec[];
    primKey: IndexSpec;
    count: number;
};

export type Schema = {
    [key: string]: string | null;
};
