/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export type ColumnFormat = (typeof COLUMN_FORMATS)[number];

export type Column = {
    name: string;
    indexed: boolean;
    visible: boolean;
    width: number;
    format: ColumnFormat;
    innerValue: boolean; // innerValue (property) of object?
    discoveredTS: number | null;
    deletedTS?: number | null;
};

export const COLUMN_FORMATS = ['', 'date', 'date/1000', 'url', 'image'] as const;
