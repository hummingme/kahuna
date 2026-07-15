/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import svgIcon from '#lib/svgicon';

export default function infoIcon(
    info: string,
    attributes: { [key: string]: unknown } = {},
): TemplateResult {
    return html`
        <span title=${info}>${svgIcon('tabler-info-circle', attributes)}</span>
    `;
}
