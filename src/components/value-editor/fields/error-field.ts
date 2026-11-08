/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field, { type UpdateOptions } from '#components/value-editor/fields/field';
import { stringToNameMessage } from '#components/value-editor/converter';
import optionsIcon from '#components/value-editor/options-icon';
import textInput from '#components/value-editor/text-input';
import { selectbox } from '#components/parts/selectbox';
import { selfMap } from '#lib/utils';
import type { FormatterOptions } from '#lib/value-formatter';

export default class ErrorField extends Field {
    nodeMessage: Ref<HTMLInputElement> = createRef();
    nodeName: Ref<HTMLInputElement> = createRef();
    formView() {
        const { message, name } = this.value;
        return html`
            <div class="form-wrapper">
                <div>
                    ${textInput(this, {
                        id: this.valueInputId('message'),
                        '.value': this.toFormString(message),
                        classes: ['resizable'],
                        style: 'width: 20ch;',
                        label: 'message',
                        refVar: this.nodeMessage,
                    })}
                    ${this.nameSelectbox(name)}
                </div>
                <div class="value-icons">${optionsIcon(this, 'form')}</div>
            </div>
        `;
    }
    get value(): Error {
        return this.state.value as Error;
    }
    set value(value: unknown) {
        let result = new Error();
        if (value instanceof Error) {
            result = value;
        } else if (typeof value === 'string') {
            const { message, name } = stringToNameMessage(value);
            result = new Error(message);
            if (name !== '') {
                result.name = name;
            }
        } else if (value instanceof DOMException) {
            result = new Error(value.message);
            result.name = this.errorNames.includes(value.name) ? value.name : 'Error';
        }
        this.state.value = result;
    }
    toFormValue(): string {
        return '';
    }
    fromFormValue(): Error | undefined {
        if (
            this.nodeMessage.value instanceof HTMLInputElement &&
            this.nodeName.value instanceof HTMLSelectElement
        ) {
            const message = this.nodeMessage.value.value.trim();
            const name = this.nodeName.value.value;
            const error = new Error(message, { cause: this.value.cause });
            if (name !== '') {
                error.name = name;
            }
            return error;
        }
    }
    override updateFormFieldValue(options?: UpdateOptions) {
        const msgNode = this.nodeMessage.value;
        if (!msgNode) return;
        msgNode.value = this.toFormString(this.value.message);
        const disabled =
            this.inputMethod !== 'form' || this.formatterMgr.getFormOptions().compacted;
        msgNode.disabled = disabled;
        super.updateFormFieldValue(options);
    }
    override defaultOptionsOverrides: Partial<FormatterOptions> = {
        escapeNonCharacters: true,
        escapeLf: true,
    };
    nameSelectbox(selected: string) {
        return html`
            <p>
                ${selectbox({
                    id: this.valueInputId('name'),
                    selected,
                    options: selfMap(this.errorNames),
                    '?disabled': this.inputMethod !== 'form',
                    '@change': this.handleFormChange.bind(this),
                    refVar: this.nodeName,
                })}
                <label for="error-name">name</label>
            </p>
        `;
    }
    errorNames = [
        'AggregateError',
        'Error',
        'EvalError',
        'RangeError',
        'ReferenceError',
        'SyntaxError',
        'TypeError',
        'URIError',
    ];
    override focus(): void {
        super.focus(this.nodeMessage.value);
    }
}
