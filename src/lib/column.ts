/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */
import { selfMap } from '#lib/utils';
import { Column, ColumnFormat, COLUMN_FORMATS } from '#types/column';

export const buildColumn = (args: Partial<Column> = {}): Column => {
    return {
        name: '',
        indexed: false,
        visible: true,
        width: 100,
        format: '',
        innerValue: false,
        discoveredTS: null,
        ...args,
    };
};

export function columnFormatOptions() {
    return selfMap(COLUMN_FORMATS);
}

export function isColumnFormat(name: string): name is ColumnFormat {
    return COLUMN_FORMATS.includes(name as ColumnFormat);
}
