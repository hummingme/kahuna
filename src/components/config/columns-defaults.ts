/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Direction } from '#types';

export type ColumnsOptions = {
    displayDiscoveredColumns: boolean;
    previewSize: number;
    order: string;
    direction: Direction;
};

export const columnsDefaultOptions = (): ColumnsOptions => {
    return {
        displayDiscoveredColumns: true,
        previewSize: 30,
        ...columnsDefaultOrder(),
    };
};

export const columnsDefaultOrder = (): { order: string; direction: Direction } => {
    return { order: '', direction: 'asc' };
};
