/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

const selectbox = (props) => {
    const { options, selected, tabindex, refVar, ...attributes } = props;
    return html`
        <select
            ${spread(attributes)}
            tabindex=${tabindex || '0'}
            ${refVar ? ref(refVar) : ''}
        >
            ${selectboxOptions(options, selected)}
        </select>
    `;
};

const labeledSelectbox = (props) => {
    const { label, class: _, ...sbProps } = props;
    return html`
        <label for=${props.id} class=${props.class ?? nothing}>
            ${label} ${selectbox(sbProps)}
        </label>
    `;
};

const labeledNumbersSelectbox = (props) =>
    labeledSelectbox({ ...props, options: numbersObject(props.min, props.max) });

const selectboxOptions = (options, selected) =>
    Object.keys(options).map(
        (opt) => html`
            <option value=${opt} .selected=${selected === opt}>${options[opt]}</option>
        `,
    );

const numbersObject = (start, end) => {
    const arr = Array.from({ length: end - start + 1 }, (_, i) => i + start).map(
        (num) => [num, num],
    );
    return Object.fromEntries(arr);
};

export { selectbox, selectboxOptions, labeledSelectbox, labeledNumbersSelectbox };
