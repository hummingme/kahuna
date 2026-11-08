/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

import svgIcon from '#components/parts/svgicon';
import { expandAriaAttributes } from '#lib/aria';
import { ButtonProps, SymbolButtonProps } from '#types/button';

export const button = (props: ButtonProps) => {
    const { content, type, refVar, ...rawAttributes } = props;
    const attributes = expandAriaAttributes(rawAttributes);
    return html`
        <button
            type=${type || 'button'}
            ${refVar ? ref(refVar) : ''}
            ${spread(attributes)}
        >
            ${content}
        </button>
    `;
};

export const symbolButton = (props: SymbolButtonProps) => {
    const { icon, classes = [], ...attributes } = props;
    const content = typeof icon === 'string' ? svgIcon(icon) : icon;
    classes.push('symbol');

    return button({
        content,
        class: classes.join(' '),
        ...attributes,
    });
};
