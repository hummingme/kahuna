/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import BigintField from '#components/value-editor/fields/bigint-field';
import NumberField from '#components/value-editor/fields/number-field';
import hintIcon from '#components/value-editor/hint-icon';
import textinput from '#lib/textinput';

export default function numberInput(field: NumberField | BigintField) {
    const icon = hintIcon(field, 'form');
    return html`
        <div class="value">
            ${textinput({
                id: 'field-value',
                class: 'number-input',
                '.value': field.toFormValue(),
                liveValue: true,
                '?disabled': field.inputMethod !== 'form',
                spellcheck: false,
                '@change': field.handleFormChange.bind(field),
                '@input': field.validate.bind(field),
                refVar: field.node,
            })}
            ${icon}
        </div>
    `;
}
