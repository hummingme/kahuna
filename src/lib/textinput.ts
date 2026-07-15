/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { ref, type RefOrCallback } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

interface Props {
    type?: string | undefined;
    refVar?: RefOrCallback;
    tabIndex?: number;
    '.value'?: unknown;
    liveValue?: boolean;
    [key: string]: unknown;
}

export default (props: Props): TemplateResult => {
    const { type, ['.value']: value, liveValue, refVar, tabIndex, ...attributes } = props;
    const val = String(value ?? '');
    return html`
        <input
           type=${type ?? 'text'}
            ${refVar ? ref(refVar) : ''}
            tabindex=${tabIndex ?? '0'}
           .value=${liveValue ? live(val) : val}
            ${spread(attributes)}
            spellcheck=false
        ></input>
    `;
};
