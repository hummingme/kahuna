/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';

export default class RegexpField extends Field {
    view() {
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(this, { id: 'regexp-value' })} ${this.inputMethodView()}
                </div>
            </div>
        `;
    }
    get value(): RegExp {
        return this.state.value as RegExp;
    }
    set value(value: unknown) {
        let result = new RegExp('');
        if (value instanceof RegExp) {
            result = value;
        } else if (typeof value === 'string') {
            const rx = this.fromString(value);
            if (rx instanceof RegExp) {
                result = rx;
            }
        }
        this.state.value = result;
    }
    toFormValue(): string {
        return this.value.toString();
    }
    fromFormValue(): RegExp | undefined {
        if (this.node.value instanceof HTMLInputElement) {
            return this.fromString(this.node.value.value);
        }
    }
    fromString(value: string) {
        const { pattern, flags } = this.extractPatternFlags(value.trim());
        if (typeof pattern === 'string' && typeof flags === 'string') {
            try {
                return new RegExp(pattern, flags);
            } catch {} // eslint-disable-line no-empty
        }
    }
    validate() {
        const input = this.node.value;
        if (input instanceof HTMLInputElement) {
            let valid = false;
            const value = input.value.trim();
            const { pattern, flags } = this.extractPatternFlags(value);
            if (typeof pattern === 'string' && typeof flags === 'string') {
                if (this.validFlagString(flags)) {
                    try {
                        new RegExp(pattern, flags);
                        valid = true;
                    } catch {} // eslint-disable-line no-empty
                }
            }
            input.setCustomValidity(
                valid
                    ? ''
                    : 'Please enter a valid RegExp in the format "/pattern/flags""!',
            );
            this.valid = valid;
        }
    }
    extractPatternFlags(value: string) {
        let pattern: string | null = null;
        let flags: string | null = null;
        const lastSlashIndex = value.lastIndexOf('/');
        if (value[0] === '/' && lastSlashIndex !== 0 && lastSlashIndex !== -1) {
            flags = value.slice(lastSlashIndex + 1);
            pattern = value.slice(1, lastSlashIndex);
        }
        return { pattern, flags };
    }
    validFlagString(flags: string) {
        const allowedFlags = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);
        const seenFlags = new Set<string>();
        for (const char of flags) {
            if (!allowedFlags.has(char) || seenFlags.has(char)) {
                return false;
            }
            seenFlags.add(char);
        }
        return true;
    }
}
