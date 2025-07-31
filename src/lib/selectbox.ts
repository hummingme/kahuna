/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { nothing } from 'lit';
import { ref, type RefOrCallback } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';
import { PlainObjectOf } from './types/common.ts';

interface SelectboxProps {
    options: PlainObjectOf<string>;
    selected: string;
    id?: string;
    tabIndex?: number;
    refVar?: RefOrCallback;
    [key: string]: unknown;
}

export const selectbox = (props: SelectboxProps) => {
    const { options, selected, tabIndex, refVar, ...attributes } = props;
    return html`
        <select
            ${spread(attributes)}
            tabindex=${tabIndex || '0'}
            ${refVar ? ref(refVar) : ''}
        >
            ${selectboxOptions(options, selected)}
        </select>
    `;
};

interface LabeledSelectboxProps extends SelectboxProps {
    label: string;
    classes?: string;
}

export const labeledSelectbox = (props: LabeledSelectboxProps) => {
    const { label, classes, ...sbProps } = props;
    return html`
        <label for=${props.id} class=${props.classes ?? nothing}>
            ${label} ${selectbox(sbProps)}
        </label>
    `;
};

interface LabeledNumbersSelectboxProps extends SelectboxProps {
    label: string;
    min: number;
    max: number;
}

export const labeledNumbersSelectbox = (props: LabeledNumbersSelectboxProps) =>
    labeledSelectbox({ ...props, options: numbersObject(props.min, props.max) });

export const selectboxOptions = (
    options: PlainObjectOf<string>,
    selected: string,
): TemplateResult[] =>
    Object.keys(options).map(
        (opt) => html`
            <option value=${opt} .selected=${selected === opt}>${options[opt]}</option>
        `,
    );

const numbersObject = (start: number, end: number): PlainObjectOf<string> => {
    const arr = Array.from({ length: end - start + 1 }, (_, i) => i + start).map(
        (num) => [num + '', num + ''],
    );
    return Object.fromEntries(arr);
};
