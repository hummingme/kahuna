/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import numberInput from '#components/value-editor/number-input';
import { isNumber } from '#lib/datatypes';

export default class NumberField extends Field {
    view() {
        return html`
            <div class="value-controls">
                ${numberInput(this)} ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): number {
        return this.state.value as number;
    }
    set value(value: unknown) {
        this.state.value = isNumber(value) ? Number(value) : 0;
    }
    toFormValue(): string {
        return this.value.toString();
    }
    fromFormValue(): number | undefined {
        if (this.node.value instanceof HTMLInputElement) {
            const value = this.node.value.value;
            return isNumber(value) ? Number(value) : 0;
        }
    }
    validate() {
        const input = this.node.value;
        if (input instanceof HTMLInputElement) {
            this.valid = isNumber(input.value);
            input.setCustomValidity(
                this.valid ? '' : 'Please enter a valid number value!',
            );
        }
    }
    hints = {
        form: `All valid numeric literals are accepted as input.`,
    };
}
