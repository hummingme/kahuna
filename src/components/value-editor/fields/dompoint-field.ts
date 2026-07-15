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
import { validateDOMPoint } from '#components/value-editor/validations';
import { requiredArgumentsList } from '#lib/value-formatter';

export default class DompointField extends Field {
    view() {
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(
                        this,
                        {
                            id: 'dompoint-coordinates',
                        },
                        true,
                    )}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): DOMPoint {
        return this.state.value as DOMPoint;
    }
    set value(value: unknown) {
        let result = new DOMPoint();
        if (value instanceof DOMPointReadOnly) {
            result = DOMPoint.fromPoint(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMPoint(...args);
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
        return requiredArgumentsList([value.x, value.y, value.z, value.w], [0, 0, 0, 1]);
    }
    fromFormValue(): DOMPoint | undefined {
        const args = this.argsFromField();
        if (args) {
            return new DOMPoint(...args);
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
        const name = this.value instanceof DOMPoint ? 'DOMPoint' : 'DOMPointReadonly';
        this.valid = validateDOMPoint(this.node.value, name);
    }
    hints = {
        form: `The valid form input for a DOMPoint value is a
comma separated list of 0 to 4 numbers: x, y, z, w.`,
    };
}
