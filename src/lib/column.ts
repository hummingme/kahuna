/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

type ColumnFormat = keyof ReturnType<typeof columnFormatOptions>;

export type Column = {
    name: string;
    indexed: boolean;
    compoundHead: boolean; // first part of compound index acts like an index for some methods
    visible: boolean;
    width: number;
    format: ColumnFormat;
    innerValue: boolean; // innerValue (property) of object ?
    discoveredTS: number | null;
    deletedTS?: number | null;
};

export const buildColumn = (args?: Partial<Column>): Column => {
    return Object.assign(
        {
            name: '',
            indexed: false,
            compoundHead: false,
            visible: true,
            width: 100,
            format: '',
            innerValue: false,
            discoveredTS: null,
        },
        args ? args : {},
    );
};

export function columnFormatOptions() {
    return {
        '': '',
        date: 'date',
        url: 'url',
        image: 'image',
    } as const;
}

export function isColumnFormat(name: string): name is ColumnFormat {
    return Object.keys(columnFormatOptions()).includes(name);
}
