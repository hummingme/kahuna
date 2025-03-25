/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

export default (props) => {
    const { type, refVar, tabindex, ...attributes } = props;
    return html`
        <input
            type=${type || 'text'}
            ${refVar ? ref(refVar) : ''}
            tabindex=${tabindex || '0'}
            ${spread(attributes)}
        ></imput>
    `;
};
