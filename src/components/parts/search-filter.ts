/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import textinput from '#components/parts/textinput';
import { expandAriaAttributes } from '#lib/aria';
import { isIndexedFilter, methodProperties } from '#lib/filter';
import type { Filter, TextinputProps } from '#types';

export type SearchFilterOptions = {
    filter: Filter;
    idx: number;
    markUnindexed: boolean;
    onChange: (this: HTMLInputElement) => void;
    onKeydown: (this: HTMLInputElement, event: KeyboardEvent) => void;
};

export default class SearchFilter {
    constructor(protected readonly options: SearchFilterOptions) {}
    get filter() {
        return this.options.filter;
    }
    view(): TemplateResult {
        return html`
            ${textinput({
                ...this.attributes(),
                typ: 'search',
                '.value': this.filter.search,
            }).view()}
        `;
    }
    attributes(): TextinputProps {
        const { field } = this.filter;
        const { idx, markUnindexed, onChange, onKeydown } = this.options;
        const id = `filter-${encodeURIComponent(`${field}-${idx}`)}`;
        const classes = ['resizable'];
        if (markUnindexed && !isIndexedFilter(this.filter)) {
            classes.push('warn');
        }
        const placeholder = this.placeholder();
        return expandAriaAttributes({
            id,
            title: `search ${placeholder}`,
            placeholder,
            classes,
            'data-searchindex': idx,
            '@change': onChange,
            '@keydown': onKeydown,
            aria: {},
        });
    }
    placeholder(): string {
        const { field } = this.filter;
        const method = methodProperties(this.filter).short;
        return `${field} ${method}`;
    }
}
