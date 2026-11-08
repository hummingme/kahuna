/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import svgIcon from '#components/parts/svgicon';
import displayOptionsTooltip, {
    type OptionsUsage,
} from '#components/value-editor/options-tooltip';
import type Field from '#components/value-editor/fields/field';

export default function optionsIcon(field: Field, usage: OptionsUsage) {
    return html`
        <span
            title="configure the value format"
            class="value-icon"
            @mouseenter=${(ev: MouseEvent) => scheduleTooltip(field, usage, ev)}
            @mouseleave=${cancelTooltip}
        >
            ${svgIcon('tabler-adjustments-code')}
        </span>
    `;
}

let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleTooltip(field: Field, usage: OptionsUsage, event: MouseEvent) {
    cancelTooltip();
    const anchor = event.currentTarget;
    if (!(anchor instanceof HTMLElement)) return;

    hoverTimeout = setTimeout(() => displayOptionsTooltip(field, usage, anchor), 300);
}

function cancelTooltip() {
    if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
}
