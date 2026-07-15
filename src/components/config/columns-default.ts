/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Direction } from '#types';

export const columnsDefaultOptions = () => {
    const defaultOptions: {
        displayDiscoveredColumns: boolean;
        previewSize: number;
    } = {
        displayDiscoveredColumns: true,
        previewSize: 30,
    };
    return { ...defaultOptions, ...columnsDefaultOrder() };
};

export const columnsDefaultOrder = (): { order: string; direction: Direction } => {
    return { order: '', direction: 'asc' };
};
