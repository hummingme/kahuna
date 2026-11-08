/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import { dateToString } from '#components/value-editor/converter';
import optionsIcon from '#components/value-editor/options-icon';
import textInput from '#components/value-editor/text-input';
import { isNumber } from '#lib/datatypes';
import { datepickerAttributes } from '#lib/datepicker-types';
import { addTimezoneOffset } from '#lib/timezone';

export default class DateField extends Field {
    formView() {
        const { datepickerType } = this.state;
        const attribs =
            this.isFormOrCode() && datepickerType
                ? datepickerAttributes(datepickerType)
                : {
                      type: 'number',
                      min: 0,
                      style: `width: ${this.inputMethod === 'ts' ? '17' : '14'}ch;`,
                  };
        return html`
            <div class="form-wrapper">
                <div>${textInput(this, attribs)}</div>
                <div class="value-icons">${optionsIcon(this, 'form')}</div>
            </div>
        `;
    }
    get value(): Date {
        return this.state.value as Date;
    }
    set value(value: unknown) {
        let result: Date = new Date();
        if (this.isValidDate(value)) {
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
        const { datepickerType } = this.state;
        const useLocalTimezone = this.formatterMgr.getFormOptions().useLocalTimezone;
        if (this.isFormOrCode() && datepickerType) {
            return dateToString(this.value, datepickerType, useLocalTimezone);
        }
        return this.inputMethod === 'ts'
            ? String(this.value.getTime())
            : String(Math.round(this.value.getTime() / 1000));
    }
    fromFormValue(): Date | undefined {
        if (this.nodeInput instanceof HTMLInputElement) {
            const useLocalTimezone = this.formatterMgr.getFormOptions().useLocalTimezone;
            const value = this.nodeInput.value;
            const date = this.isFormOrCode()
                ? new Date(`${value}Z`)
                : this.inputMethod === 'ts'
                  ? new Date(parseInt(value))
                  : new Date(parseInt(value) * 1000);
            return useLocalTimezone ? addTimezoneOffset(date) : date;
        }
    }
    validate() {
        const input = this.nodeInput;
        if (input instanceof HTMLInputElement) {
            const value = this.fromFormValue();
            this.valid = this.isValidDate(value);
            input.setCustomValidity(this.valid ? '' : 'Please enter a valid date!');
        }
    }
    isValidDate(value: unknown): value is Date {
        return value instanceof Date && !Number.isNaN(value.getTime());
    }
    isFormOrCode() {
        return this.inputMethod === 'form' || this.inputMethod === 'code';
    }
}
