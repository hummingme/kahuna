/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import svgIcon from './svgicon.js';

export default (info, attributes) => {
    return html`
        <span title=${info}>${svgIcon('tabler-info-circle', attributes)}</span>
    `;
};
