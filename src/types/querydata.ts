/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */
import type { Column } from '#types/column';
import type { Filter } from '#types/filter';

export type QueryDataArgs = {
    dbname: string;
    tablename: string;
    filters: Filter[];
    columns: Column[];
    order: string;
    direction: 'asc' | 'desc';
    addUnnamedPk: boolean;
    offset: number;
    limit: number;
    useLocalTimezone: boolean;
    encodeQueryResult: boolean;
};
