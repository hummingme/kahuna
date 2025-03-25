/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { live } from 'lit/directives/live.js';
import { symbolButton } from '../lib/button.js';

const state = Symbol('chevron state');

const ChevronNavigation = class {
    constructor(props) {
        this[state] = { ...this.#initState, ...props };
        this[state].total = this[state].max - this[state].min + 1;
    }

    get #initState() {
        return {
            offset: 0,
            step: 1, // datatable: limit
            min: 1,
            max: 1,
            total: null,
            navigate: () => false,
            sparse: false,
            input: false,
        };
    }

    view() {
        return html`
            <div class="chevron-nav">
                ${this.firstButton()} ${this.prevButton()} ${this.inputFields()}
                ${this.posInfo()} ${this.nextButton()} ${this.lastButton()}
            </div>
        `;
    }

    gap = html`
        <div class="chevron-gap"></div>
    `;

    firstButton() {
        const { offset, min, sparse, navigate } = this[state];
        return offset > min || sparse === false
            ? symbolButton({
                  title: `goto ${min}`,
                  icon: 'tabler-chevrons-left',
                  '@click': navigate.bind(null, min),
              })
            : this.gap;
    }
    prevButton() {
        const { offset, step, min, sparse, navigate } = this[state];
        const offset_left = offset - step < min ? min : offset - step;
        return offset > min || sparse === false
            ? symbolButton({
                  title: `goto ${offset_left}`,
                  icon: 'tabler-chevron-left',
                  '@click': navigate.bind(null, offset_left),
              })
            : this.gap;
    }
    nextButton() {
        const { total, offset, step, max, sparse, navigate } = this[state];
        const offset_max = Math.floor((max - 1) / step) * step + 1;
        const offset_right = offset + step < offset_max ? offset + step : offset_max;
        return (total > 1 && offset <= max - step) || sparse === false
            ? symbolButton({
                  title: `goto ${offset_right}`,
                  icon: 'tabler-chevron-right',
                  '@click': navigate.bind(null, offset_right),
              })
            : this.gap;
    }
    lastButton() {
        const { total, offset, step, max, sparse, navigate } = this[state];
        const offset_max = Math.floor((max - 1) / step) * step + 1;
        return (total > 1 && offset <= max - step) || sparse === false
            ? symbolButton({
                  title: `goto ${offset_max}`,
                  icon: 'tabler-chevrons-right',
                  '@click': navigate.bind(null, offset_max),
              })
            : this.gap;
    }

    input = (props) => html`
        <input
            type="text"
            size=${props.size}
            .value=${props.value}
            pattern=${props.pattern}
            name=${props.name}
            @change=${props.navigate}
        />
    `;

    inputFields() {
        const { input, total, step, offset, navigate } = this[state];
        if (input === false) {
            return '';
        }
        const pattern = `[0-9]{1,${String(total).length}}`;
        const size = total < 10 ? 1 : String(total).length - 1;
        const inputFrom = this.input({
            size,
            value: offset,
            pattern,
            name: 'from',
            navigate: (ev) => navigate(parseInt(ev.target.value)),
        });
        const toValue = offset + step - 1 > total ? total : offset + step - 1;
        const inputTo =
            step > 1
                ? this.input({
                      size,
                      value: live(toValue),
                      pattern,
                      name: 'to',
                      navigate: (ev) => navigate(parseInt(ev.target.value) - step + 1),
                  })
                : '';
        return html`
            ${inputFrom}${inputTo !== ''
                ? html`
                      &dash; ${inputTo}
                  `
                : ''}
        `;
    }

    posInfo() {
        const { total, offset, input, posInfo } = this[state];
        return typeof posInfo === 'function'
            ? posInfo(this[state])
            : html`
                  <div>${input ? '' : offset} (${total})</div>
              `;
    }
};

export default ChevronNavigation;
