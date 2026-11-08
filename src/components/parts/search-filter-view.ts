/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import SearchFilter, { type SearchFilterOptions } from '#components/parts/search-filter';
import SearchDateFilter from '#components/parts/search-date-filter';
import SearchEmptyFilter from '#components/parts/search-empty-filter';
import type { ColumnFormat } from '#types';

type SearchFilterViewOptions = SearchFilterOptions & {
    format: ColumnFormat;
    useLocalTimezone: boolean;
};

export default function searchFilterView({
    format,
    useLocalTimezone,
    ...options
}: SearchFilterViewOptions) {
    const { method, datepicker } = options.filter;
    if (method === 'empty') {
        return new SearchEmptyFilter(options).view();
    }
    if (datepicker) {
        return new SearchDateFilter(options, format, useLocalTimezone).view();
    }
    return new SearchFilter(options).view();
}
