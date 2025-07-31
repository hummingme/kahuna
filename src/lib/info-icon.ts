/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import svgIcon from './svgicon.ts';

export default (
    info: string,
    attributes: { [key: string]: unknown } = {},
): TemplateResult => {
    return html`
        <span title=${info}>${svgIcon('tabler-info-circle', attributes)}</span>
    `;
};
