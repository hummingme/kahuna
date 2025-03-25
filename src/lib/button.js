/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';
import svgIcon from './svgicon.js';

export const button = (props) => {
    const { content, tabindex, refVar, ...attributes } = props;
    return html`
        <button
            ${refVar ? ref(refVar) : ''}
            ${spread(attributes)}
            tabindex=${tabindex || '0'}
        >
            ${content}
        </button>
    `;
};

export const symbolButton = (props) => {
    const { icon, classes = [], ...attributes } = props;
    const content = typeof icon === 'string' ? svgIcon(icon) : icon;
    classes.push('symbol');
    return button(
        Object.assign(attributes, {
            content,
            class: classes.join(' '),
        }),
    );
};
