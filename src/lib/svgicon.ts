/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { spread } from '@open-wc/lit-helpers';

const svgIcon = (
    name: string,
    attributes: { [key: string]: unknown } = {},
): TemplateResult => {
    const defaults = { width: 18, height: 18 };
    attributes = Object.assign(defaults, attributes);
    return html`
        <svg ${spread(attributes)}>
            <use href="#${name}"></use>
        </svg>
    `;
};

export default svgIcon;
