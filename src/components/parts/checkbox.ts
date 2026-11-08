/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { nothing } from 'lit';
import { live } from 'lit-html/directives/live.js';
import { ref, type RefOrCallback } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

export type CheckboxProps = {
    id?: string;
    label?: string | TemplateResult;
    refVar?: RefOrCallback;
    checked?: boolean;
    disabled?: boolean;
    tabIndex?: number;
    liveValue?: boolean;
    [key: string]: unknown;
};

const checkbox = (props: CheckboxProps): TemplateResult => {
    const { id, label, refVar, checked, disabled, tabIndex, liveValue, ...attributes } =
        props;
    return html`
        <label for=${id ?? nothing}>
            <input
                type="checkbox"
                id=${id || nothing}
                ${refVar ? ref(refVar) : ''}
                .checked=${liveValue ? live(checked ?? false) : (checked ?? false)}
                ?disabled=${disabled}
                tabindex=${tabIndex || '0'}
                ${spread(attributes)}
            />
            ${label}
        </label>
    `;
};

export default checkbox;
