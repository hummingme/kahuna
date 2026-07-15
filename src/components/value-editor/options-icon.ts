/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import displayOptionsTooltip, {
    type OptionsUsage,
} from '#components/value-editor/options-tooltip';
import type Field from '#components/value-editor/fields/field';
import svgIcon from '#lib/svgicon';

export default function optionsIcon(field: Field, usage: OptionsUsage) {
    return html`
        <span
            title="configure the value format"
            class="value-icon"
            @mouseover=${displayTooltip.bind(null, field, usage)}
        >
            ${svgIcon('tabler-adjustments-code')}
        </span>
    `;
}

function displayTooltip(field: Field, usage: OptionsUsage, event: MouseEvent) {
    let anchor = event.target;
    if (anchor instanceof SVGElement) {
        anchor = anchor.closest('span');
    }
    if (anchor instanceof HTMLElement) {
        displayOptionsTooltip(field, usage, anchor);
    }
}
