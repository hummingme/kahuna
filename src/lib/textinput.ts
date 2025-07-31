/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { ref, type RefOrCallback } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

interface Props {
    type?: string;
    refVar?: RefOrCallback;
    tabIndex?: number;
    [key: string]: unknown;
}

export default (props: Props): TemplateResult => {
    const { type, refVar, tabIndex, ...attributes } = props;
    return html`
        <input
            type=${type || 'text'}
            ${refVar ? ref(refVar) : ''}
            tabindex=${tabIndex || '0'}
            ${spread(attributes)}
        ></imput>
    `;
};
