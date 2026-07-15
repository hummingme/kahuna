/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { isNumber } from '#lib/datatypes';

export default class DateField extends Field {
    view() {
        const type = this.isFormOrCode() ? 'datetime-local' : 'number';
        const step = this.isFormOrCode() ? '0.001' : undefined;
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(this, {
                        id: 'field-value',
                        type,
                        step,
                        size: undefined,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): Date {
        return this.state.value as Date;
    }
    set value(value: unknown) {
        let result: Date = new Date();
        if (value instanceof Date) {
            result = value;
        } else if (typeof value === 'number' && Number.isInteger(value)) {
            result = new Date(value);
        } else if (typeof value === 'string') {
            if (isNumber(Date.parse(value))) {
                result = new Date(Date.parse(value));
            } else if (isNumber(value)) {
                result = new Date(Number(value));
            }
        }
        this.state.value = result;
    }
    toFormValue(): string {
        return this.isFormOrCode()
            ? this.value.toISOString().slice(0, -1)
            : this.inputMethod === 'ts'
              ? String(this.value.getTime())
              : String(Math.round(this.value.getTime() / 1000));
    }
    fromFormValue(): Date | undefined {
        if (this.node.value instanceof HTMLInputElement) {
            const value = this.node.value.value;
            return this.isFormOrCode()
                ? new Date(`${value}Z`)
                : this.inputMethod === 'ts'
                  ? new Date(parseInt(value))
                  : new Date(parseInt(value) * 1000);
        }
    }
    validate() {
        const input = this.node.value;
        if (input instanceof HTMLInputElement) {
            const value = this.fromFormValue();
            this.valid = this.isValidDate(value);
            input.setCustomValidity(this.valid ? '' : 'Please enter a valid date!');
        }
    }
    isValidDate(value: Date | undefined) {
        return value instanceof Date && !isNaN(value.getTime());
    }
    isFormOrCode() {
        return this.inputMethod === 'form' || this.inputMethod === 'code';
    }
}
