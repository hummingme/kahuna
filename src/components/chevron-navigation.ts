/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { symbolButton } from '../lib/button.ts';
import textinput from '../lib/textinput.ts';

interface ChevronNavigationState {
    offset: number;
    step: number;
    min: number;
    max: number;
    total: number;
    sparse: boolean;
    input: boolean;
    navigate: (arg0: number) => void;
    posInfo: ((arg0: ChevronNavigationState) => TemplateResult) | null;
}

const state = Symbol('chevron state');

const ChevronNavigation = class {
    [state]: ChevronNavigationState;
    constructor(props: Partial<ChevronNavigationState>) {
        this[state] = { ...this.#initState, ...props };
        this[state].total = this[state].max - this[state].min + 1;
    }
    get #initState(): ChevronNavigationState {
        return {
            offset: 0,
            step: 1,
            min: 1,
            max: 1,
            total: 0,
            sparse: false,
            input: false,
            navigate: () => {},
            posInfo: null,
        };
    }
    view(): TemplateResult {
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
    firstButton(): TemplateResult {
        const { offset, min, sparse, navigate } = this[state];
        return offset > min || sparse === false
            ? symbolButton({
                  title: `goto ${min}`,
                  icon: 'tabler-chevrons-left',
                  '@click': navigate.bind(null, min),
              })
            : this.gap;
    }
    prevButton(): TemplateResult {
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
    nextButton(): TemplateResult {
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
    lastButton(): TemplateResult {
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
    inputFields(): TemplateResult | '' {
        const { input, total, step, offset } = this[state];
        if (input === false) {
            return '';
        }
        const pattern = `[0-9]{1,${String(total).length}}`;
        const size = total < 10 ? 1 : String(total).length - 1;
        const inputFrom = textinput({
            name: 'from',
            '.value': offset,
            size,
            pattern,
            '@change': this.fromChanged.bind(this),
        });
        const toValue = offset + step - 1 > total ? total : offset + step - 1;
        const inputTo =
            step > 1
                ? textinput({
                      name: 'to',
                      '.value': toValue,
                      size,
                      pattern,
                      '@change': this.toChanged.bind(this),
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
    fromChanged(event: Event) {
        const target = event.target as HTMLInputElement;
        this[state].navigate(parseInt(target.value));
    }
    toChanged(event: Event) {
        const { navigate, step } = this[state];
        const target = event.target as HTMLInputElement;
        navigate(parseInt(target.value) - step + 1);
    }
    posInfo(): TemplateResult {
        const { total, offset, input, posInfo } = this[state];
        return typeof posInfo === 'function'
            ? posInfo(this[state])
            : html`
                  <div>${input ? '' : offset} (${total})</div>
              `;
    }
};

export default ChevronNavigation;
