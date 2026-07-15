/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Filter } from '#types/filter';

export interface QueryDataArgs {
    dbname: string;
    tablename: string;
    filters: Filter[];
    order: string;
    direction: 'asc' | 'desc';
    addUnnamedPk: boolean;
    offset: number;
    limit: number;
    encodeQueryResult: boolean;
}
