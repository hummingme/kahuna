/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export type FiltersOptions = ReturnType<typeof filtersDefaultOptions>;

export const filtersDefaultOptions = () => {
    return {
        markUnindexed: true,
    };
};
