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

export default class NumberField extends Field {
    formView() {
        const { datepickerType } = this.state;
        const attribs =
            datepickerType && this.editAsDate()
                ? datepickerAttributes(datepickerType)
                : { classes: ['resizable'] };
        const withHint = datepickerType ? false : true;
        return html`
            <div class="form-wrapper">
                <div>${textInput(this, attribs, withHint)}</div>
                <div class="value-icons">${optionsIcon(this, 'form')}</div>
            </div>
        `;
    }
    editAsDate() {
        const { columnFormat, datepickerType } = this.state;
        return (
            datepickerType && (columnFormat === 'date' || columnFormat === 'date/1000')
        );
    }
    get value(): number {
        return this.state.value as number;
    }
    set value(value: unknown) {
        this.state.value = isNumber(value) ? Number(value) : 0;
    }
    toFormValue(): string {
        const { columnFormat, datepickerType } = this.state;
        const useLocalTimezone = this.formatterMgr.getFormOptions().useLocalTimezone;
        if (this.editAsDate() && datepickerType && Number.isInteger(this.value)) {
            const value = columnFormat === 'date' ? this.value : this.value * 1000;
            return dateToString(new Date(value), datepickerType, useLocalTimezone);
        }
        return this.value.toString();
    }
    fromFormValue(): number | undefined {
        if (this.nodeInput instanceof HTMLInputElement) {
            const value = this.nodeInput.value;
            if (this.editAsDate()) {
                const { columnFormat } = this.state;
                const useLocalTimezone =
                    this.formatterMgr.getFormOptions().useLocalTimezone;
                const date = new Date(`${value}Z`);
                const ms = useLocalTimezone
                    ? addTimezoneOffset(date).valueOf()
                    : date.valueOf();
                return columnFormat === 'date/1000' ? Math.round(ms / 1000) : ms;
            }
            return isNumber(value) ? Number(value) : 0;
        }
    }
    validate() {
        const input = this.nodeInput;
        if (input instanceof HTMLInputElement) {
            let validity: string;
            if (this.editAsDate()) {
                this.valid = !Number.isNaN(new Date(`${input.value}Z`));
                validity = 'Please enter a valid date!';
            } else {
                this.valid = isNumber(input.value);
                validity = 'Please enter a valid number value!';
            }
            input.setCustomValidity(this.valid ? '' : validity);
        }
    }
    hints = {
        form: `All valid numeric literals are accepted as input.
(e.g.: -10.01, 2.5e-3, 0xFE, 0b1010, 1_000, Infinity, NaN)`,
    };
}
