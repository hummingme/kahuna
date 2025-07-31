/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

export interface Column {
    name: string;
    indexed: boolean;
    compoundHead: boolean; // first part of compound index acts like an index for some methods
    visible: boolean;
    width: number;
    format: string;
    innerValue: boolean; // innerValue (property) of object ?
    discoveredTS: number | null;
    deletedTS: number | null;
}

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
            deletedTS: null,
        },
        args ? args : {},
    );
};
