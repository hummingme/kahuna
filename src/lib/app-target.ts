/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

export interface AppTarget {
    database: string;
    table: string;
}

export const globalTarget: AppTarget = { database: '*', table: '*' } as const;

export const emptyTarget: AppTarget = { database: '', table: '' } as const;

export const isGlobal = (target: AppTarget): boolean =>
    target.table === '*' && target.database === '*';

export const isDatabase = (target: AppTarget): boolean =>
    target.table === '*' && target.database !== '*';

export const isTable = (target: AppTarget): boolean =>
    target.table !== '*' && target.database !== '*';

export const equalTarget = (a: AppTarget, b: AppTarget): boolean =>
    a.table === b.table && a.database === b.database;
