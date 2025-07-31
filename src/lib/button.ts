/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { ref, type RefOrCallback } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';
import svgIcon from './svgicon.ts';

interface ButtonProps {
    content: TemplateResult | string;
    refVar?: RefOrCallback;
    tabIndex?: number;
    [key: string]: unknown;
}

export const button = (props: ButtonProps) => {
    const { content, tabIndex, refVar, ...attributes } = props;
    return html`
        <button
            ${refVar ? ref(refVar) : ''}
            tabindex=${tabIndex || '0'}
            ${spread(attributes)}
        >
            ${content}
        </button>
    `;
};

interface SymbolButtonProps {
    icon: TemplateResult | string;
    classes?: string[];
    [key: string]: unknown;
}

export const symbolButton = (props: SymbolButtonProps): TemplateResult => {
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
