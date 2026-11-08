/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import { symbolButton } from '#components/parts/button';
import SearchFilter, { type SearchFilterOptions } from '#components/parts/search-filter';
import {
    decreaseDateValue,
    increaseDateValue,
    parseSearchDate,
    toDatepickerValue,
} from '#lib/datepicker-search';
import { datepickerAttributes, isDatepickerTypeOption } from '#lib/datepicker-types';
import env from '#lib/environment';
import { datespan, isIndexedFilter } from '#lib/filter';
import type { ColumnFormat, DatepickerType } from '#types';

export default class SearchDateFilter extends SearchFilter {
    private div?: HTMLDivElement;
    private input?: HTMLInputElement;
    constructor(
        options: SearchFilterOptions,
        private readonly format: ColumnFormat,
        private readonly useLocalTimezone: boolean,
    ) {
        super(options);
    }
    override view() {
        const navLeft = symbolButton({
            icon: 'tabler-chevron-left',
            classes: ['left-datespan-nav'],
            '@click': this.setPrevious.bind(this),
            title: `previous ${this.filter.datespan}`,
        });
        const navRight = symbolButton({
            icon: 'tabler-chevron-right',
            classes: ['right-datespan-nav'],
            '@click': this.setNext.bind(this),
            title: `next ${this.filter.datespan}`,
        });

        return html`
            <div ${ref(this.nodeReady.bind(this))} class="date-search-wrapper">
                ${navLeft}${super.view()}${navRight}
            </div>
        `;
    }
    private nodeReady(node?: Element) {
        if (node instanceof HTMLDivElement) this.div = node;
    }
    private inputReady(node?: Element) {
        if (node instanceof HTMLInputElement) {
            this.input = node;
            requestAnimationFrame(() => {
                this.onBlur();
                this.onKeyup();
            });
        }
    }
    override attributes() {
        const { markUnindexed } = this.options;
        const datepicker = this.filter.datepicker;
        if (!isDatepickerTypeOption(String(datepicker))) {
            return super.attributes();
        }

        const classes =
            markUnindexed && !isIndexedFilter(this.filter) ? ['warn'] : ['inactive'];
        const placeholder = this.placeholder();
        return {
            ...super.attributes(),
            classes,
            placeholder,
            title: `search ${placeholder}`,
            refVar: this.inputReady.bind(this),
            ...datepickerAttributes(datepicker as DatepickerType),
            '@focus': this.onFocus.bind(this),
            '@blur': this.onBlur.bind(this),
            '@keyup': () => this.onKeyup(),
        };
    }
    override placeholder(): string {
        const { datepicker, datespan: span } = this.filter;
        let desc = '';
        if (datepicker) {
            const as = this.format === 'date' || this.format === 'date/1000' ? 'as ' : '';
            if (datepicker === 'year') {
                desc = ' YYYY';
            } else if (env.isFirefox && datepicker === 'month') {
                desc = ' YYYY-MM';
            }
            if (span) {
                desc = `${desc} (${as}${datespan(this.filter)} span)`;
            }
        }
        const ph = super.placeholder();
        const pos = ph.lastIndexOf(' ');
        return ph.slice(0, pos) + desc + ph.slice(pos);
    }
    private onFocus() {
        if (this.div) this.setColor(this.div, '');
    }
    private onBlur() {
        if (!this.div) return;
        const input = this.input;
        if (input && input.value.trim() === '' && input.validity.valid === true) {
            this.setColor(this.div, 'var(--nice-grey-400)');
        }
    }
    private setColor(node: HTMLElement, color: string) {
        node.querySelectorAll<HTMLElement>('input, svg').forEach((el) => {
            el.style.color = color;
        });
    }
    private setPrevious() {
        this.changeDateValue(decreaseDateValue);
    }
    private setNext() {
        this.changeDateValue(increaseDateValue);
    }
    private changeDateValue(
        change: (
            date: Date,
            datepicker: DatepickerType,
            useLocalTimezone: boolean,
        ) => Date,
    ) {
        const { input, useLocalTimezone, filter } = this;
        const datepicker = filter.datepicker;
        if (!input || input.value.trim() === '' || !input.validity.valid || !datepicker)
            return;

        const date = change(
            parseSearchDate(input.value, useLocalTimezone),
            datepicker,
            useLocalTimezone,
        );
        input.value = toDatepickerValue(date, datepicker, useLocalTimezone);
        input.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
            }),
        );
    }
    private wasValid = true;
    private onKeyup() {
        const input = this.input;
        if (!input) return;
        const isValid = input.checkValidity();

        if (this.wasValid !== isValid) {
            this.wasValid = isValid;
            if (isValid) {
                input.title = `search ${this.placeholder()}`;
            } else {
                const { datepicker: period } = this.filter;
                const { rangeOverflow, rangeUnderflow } = input.validity;
                let error = '';
                if (
                    this.filter.datepicker === 'year' &&
                    (rangeOverflow || rangeUnderflow)
                ) {
                    const attribs = datepickerAttributes('year');
                    if ('min' in attribs) {
                        const { min, max } = attribs;
                        error = `Year must be a value between ${min} and ${max}`;
                    }
                } else {
                    error = `Please enter a valid ${period}`;
                    if (env.isFirefox && period === 'month') {
                        error = `${error} in the format "YYYY-MM"`;
                    }
                }
                input.title = `${this.placeholder()}\nError: ${error}!`;
            }
        }
    }
}
