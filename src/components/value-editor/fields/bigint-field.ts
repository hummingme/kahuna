/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import numberInput from '#components/value-editor/number-input';

export default class BigintField extends Field {
    view() {
        return html`
            <div class="value-controls">
                ${numberInput(this)} ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): bigint {
        return this.state.value as bigint;
    }
    set value(value: unknown) {
        const result = this.toBigInt(value);
        this.state.value = typeof result === 'bigint' ? result : 0n;
    }
    toFormValue(): string {
        return `${this.value.toString()}n`;
    }
    fromFormValue(): bigint | undefined {
        if (this.node.value instanceof HTMLInputElement) {
            const value = this.node.value.value.trim();
            const result = this.toBigInt(this.removeTrailingN(value));
            return typeof result === 'bigint' ? result : 0n;
        }
    }
    validate() {
        const input = this.node.value;
        if (input instanceof HTMLInputElement) {
            const result = this.toBigInt(this.removeTrailingN(input.value.trim()));
            this.valid = typeof result === 'bigint';
            input.setCustomValidity(
                this.valid ? '' : 'Please enter a valid BigInt value!',
            );
        }
    }
    toBigInt(value: any): bigint | null {
        try {
            return BigInt(value);
        } catch {
            return null;
        }
    }
    removeTrailingN(value: string) {
        return value.endsWith('n') ? value.slice(0, -1) : value;
    }
    hints = {
        form: `Valid integer numbers are accepted as input.
The trailing "n" is optional.`,
    };
}
