/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import SearchFilter from '#components/parts/search-filter';
import { selectbox } from '#components/parts/selectbox';

export default class SearchEmptyFilter extends SearchFilter {
    override view() {
        return selectbox(this.attributes());
    }
    override attributes() {
        return {
            ...super.attributes(),
            options: this.emptyOptions(),
            selected: this.filter.search,
        };
    }
    emptyOptions() {
        const { field } = this.filter;
        return {
            '': '',
            yes: `${field} is empty`,
            no: `${field} not empty`,
        };
    }
}
