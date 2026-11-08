/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';

export default class CryptokeyField extends Field {
    formView() {
        if (this.value?.algorithm) {
            // Chromium only, in Firefox the CryptoKey properties cannot be read
            const algo = this.value.algorithm;
            const length = 'length' in algo ? `, ${algo.length}` : '';
            const algoValue = `${algo.name}${length}`;
            return html`
                ${textInput(this, {
                    id: this.valueInputId('algorithm'),
                    '.value': algoValue,
                    classes: ['resizable'],
                    style: 'width: 20ch;',
                    label: 'algorithm',
                })}
                ${textInput(this, {
                    id: this.valueInputId('type'),
                    '.value': this.value.type,
                    classes: ['resizable'],
                    style: 'width: 20ch;',
                    label: 'type',
                })}
                ${textInput(this, {
                    id: this.valueInputId('usages'),
                    '.value': this.value.usages.join(', '),
                    classes: ['resizable'],
                    style: 'width: 20ch;',
                    label: 'usages',
                })}
                ${textInput(this, {
                    id: this.valueInputId('extractable'),
                    '.value': String(this.value.extractable),
                    classes: ['resizable'],
                    style: 'width: 20ch;',
                    label: 'extractable',
                })}
            `;
        }
        return '';
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
