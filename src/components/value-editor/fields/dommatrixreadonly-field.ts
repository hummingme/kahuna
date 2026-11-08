/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { isNumbersArray } from '#components/value-editor/checkings';
import textInput from '#components/value-editor/text-input';
import { dommatrixArgsList } from '#lib/value-formatter';

export default class DommatrixreadonlyField extends Field {
    formView() {
        return textInput(this, { style: 'width: 20ch;', classes: ['resizable'] }, true);
    }
    get value(): DOMMatrixReadOnly {
        return this.state.value as DOMMatrixReadOnly;
    }
    set value(value: unknown) {
        let result = new DOMMatrixReadOnly();
        if (value instanceof DOMMatrixReadOnly) {
            result = DOMMatrixReadOnly.fromMatrix(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMMatrixReadOnly(args);
            }
        }
        this.state.value = result;
    }
    argsFromValue(value: unknown) {
        let args: number[] | undefined;
        if (this.isSuitableArg(value)) {
            args = value;
        }
        return args;
    }
    isSuitableArg(value: unknown): value is number[] {
        return isNumbersArray(value) && [6, 16].includes(value.length);
    }
    toFormValue(): string {
        return this.value.isIdentity ? '' : dommatrixArgsList(this.value);
    }
    fromFormValue(): DOMMatrixReadOnly | undefined {
        const arg = this.argFromField();
        return new DOMMatrixReadOnly(arg);
    }
    argFromField() {
        let arg: number[] | undefined;
        if (this.nodeInput instanceof HTMLInputElement) {
            const value = this.nodeInput.value.trim();
            const argArray = value.split(',').map((arg) => Number(arg));
            if (this.isSuitableArg(argArray)) {
                arg = argArray;
            }
        }
        return arg;
    }
    validate() {
        const input = this.nodeInput;
        if (input instanceof HTMLInputElement) {
            const parts = input.value.split(',');
            this.valid =
                input.value.trim().length === 0 ||
                (parts.every(
                    (part) => part.trim() !== '' && Number.isFinite(Number(part)),
                ) &&
                    [6, 16].includes(parts.length));
            const hint = `Form input must be a comma separated list of 6 or 16 numbers!`;
            input.setCustomValidity(this.valid ? '' : hint);
        }
    }
    hints = {
        form: `The valid form input for a DOMMatrix value is a
comma separated list of either 6 or 16 numbers.`,
    };
}
