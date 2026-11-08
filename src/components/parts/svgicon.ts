/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { spread } from '@open-wc/lit-helpers';

import { expandAriaAttributes } from '#lib/aria';

const svgIcon = (
    name: string,
    attributes: Record<string, unknown> = {},
): TemplateResult => {
    const defaults = { width: 18, height: 18, 'aria-hidden': true, focusable: false };
    return html`
        <svg ${spread({ ...defaults, ...expandAriaAttributes(attributes) })}>
            <use href="#${name}"></use>
        </svg>
    `;
};

export default svgIcon;
