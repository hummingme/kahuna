/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import {
    isArgsNumbersArray,
    isArgsNumbersList,
} from '#components/value-editor/checkings';
import textInput from '#components/value-editor/text-input';
import { requiredArgumentsList } from '#lib/value-formatter';

export default class DomrectField extends Field {
    view() {
        return html`
            <div class="value-controls">
                <div class="value">${textInput(this, { id: 'domrect-args' }, true)}</div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): DOMRect {
        return this.state.value as DOMRect;
    }
    set value(value: unknown) {
        let result = new DOMRect();
        if (value instanceof DOMRectReadOnly) {
            result = DOMRect.fromRect(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMRect(...args);
            }
        }
        this.state.value = result;
    }
    argsFromValue(value: unknown) {
        let args: number[] | undefined;
        if (isArgsNumbersArray(value, 4)) {
            args = value;
        } else if (value instanceof Set && isArgsNumbersArray([...value.values()], 4)) {
            args = [...value.values()];
        }
        return args;
    }
    toFormValue(): string {
        const value = this.value;
        return requiredArgumentsList(
            [value.x, value.y, value.width, value.height],
            [0, 0, 0, 0],
        );
    }
    fromFormValue(): DOMRect | undefined {
        const args = this.argsFromField();
        if (args) {
            return new DOMRect(...args);
        }
    }
    argsFromField() {
        let args: number[] = [];
        if (this.node.value instanceof HTMLInputElement) {
            const value = this.node.value.value;
            if (isArgsNumbersList(value, 4)) {
                args = value.split(',').map((arg) => Number(arg));
            }
        }
        return args;
    }
    validate() {
        const input = this.node.value;
        if (input instanceof HTMLInputElement) {
            this.valid = isArgsNumbersList(input.value, 4);
            const name = this.value instanceof DOMRect ? 'DOMRect' : 'DOMRectReadonly';
            input.setCustomValidity(
                this.valid
                    ? ''
                    : `Please enter ${name} arguments as a comma separated list of up to 4 numbers (x, y, width, height)!`,
            );
        }
    }
    hints = {
        form: `The valid form input for a DOMRect value is a
comma separated list of 0 to 4 numbers: x, y, width, height.`,
    };
}
