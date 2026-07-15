/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';

export default class CryptokeyField extends Field {
    view() {
        let form: TemplateResult | string = '';
        if (this.value?.algorithm) {
            // Chromium only, in Firefox the CryptoKey properties cannot be read
            const algo = this.value.algorithm;
            const length = 'length' in algo ? `, ${algo.length}` : '';
            const algoValue = `${algo.name}${length}`;
            form = html`
                <div class="value">
                    ${textInput(this, {
                        id: 'cryptokey-algorithm',
                        '.value': algoValue,
                        size: 20,
                        label: 'algorithm',
                    })}
                    ${textInput(this, {
                        id: 'cryptokey-type',
                        '.value': this.value.type,
                        size: 20,
                        label: 'type',
                    })}
                    ${textInput(this, {
                        id: 'cryptokey-usages',
                        '.value': this.value.usages.join(', '),
                        size: 20,
                        label: 'usages',
                    })}
                    ${textInput(this, {
                        id: 'cryptokey-extractable',
                        '.value': String(this.value.extractable),
                        size: 20,
                        label: 'usages',
                    })}
                </div>
            `;
        }

        return html`
            <div class="value-controls">${form}${this.inputMethodView()}</div>
        `;
    }
    get value(): CryptoKey {
        return this.state.value as CryptoKey;
    }
    set value(value: unknown) {
        if (value instanceof CryptoKey) {
            this.state.value = value;
        }
    }
    toFormValue(): string {
        return '';
    }
    fromFormValue(): undefined {}
    override toSourceValue(): string {
        return 'return value;';
    }
}
