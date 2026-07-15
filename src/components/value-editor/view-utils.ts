/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { guard } from 'lit/directives/guard.js';

import Field from '#components/value-editor/fields/field';

export function valueControlsTextareaView(field: Field) {
    return html`
        <div class="value-controls">
            ${guard([field.value, field.inputMethod], () => {
                return html`
                    ${field.textarea?.view(field.toFormValue() || '')}
                    ${field.inputMethodView()}
                `;
            })}
        </div>
    `;
}
