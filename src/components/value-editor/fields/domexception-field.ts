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
import type { FormatterOptions } from '#lib/value-formatter';

export default class DomexceptionField extends Field {
    nodeMessage: Ref<HTMLInputElement> = createRef();
    nodeName: Ref<HTMLInputElement> = createRef();
    view() {
        return html`
            <div class="value-controls">
                <div class="value">
                    <div class="form-wrapper">
                        <div>
                            ${textInput(this, {
                                id: 'domexception-message',
                                '.value': this.toFormString(this.value.message),
                                size: 25,
                                label: 'message',
                                refVar: this.nodeMessage,
                            })}
                            ${textInput(this, {
                                id: 'domexception-name',
                                '.value': this.toFormString(this.value.name),
                                size: 25,
                                list: 'standardnames-list',
                                label: 'name',
                                refVar: this.nodeName,
                            })}
                            ${this.standardNamesDatalist()}
                        </div>
                        <div class="value-icons">${optionsIcon(this, 'form')}</div>
                    </div>
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): DOMException {
        return this.state.value as DOMException;
    }
    set value(value: unknown) {
        let result: DOMException = new DOMException();
        if (value instanceof DOMException) {
            result = value;
        } else if (typeof value === 'string') {
            const { message, name } = stringToNameMessage(value);
            result = new DOMException(message, name);
        } else if (value instanceof Error) {
            result = new DOMException(value.message, value.name);
        }
        this.state.value = result;
    }
    toFormValue() {
        return '';
    }
    fromFormValue(): DOMException | undefined {
        if (
            this.nodeMessage.value instanceof HTMLInputElement &&
            this.nodeName.value instanceof HTMLInputElement
        ) {
            const message = this.nodeMessage.value.value;
            const name = this.nodeName.value.value;
            return new DOMException(message, name);
        }
    }
    override updateFormFieldValue(options: UpdateOptions) {
        const msgNode = this.nodeMessage.value;
        const nameNode = this.nodeName.value;
        if (!msgNode || !nameNode) return;

        super.updateFormFieldValue(options);
        msgNode.value = this.toFormString(this.value.message);
        nameNode.value = this.toFormString(this.value.name);
        const disabled = this.inputMethod !== 'form' || !this.state.formOptions.expanded;
        msgNode.disabled = nameNode.disabled = disabled;
    }
    override defaultValueOptions(): FormatterOptions {
        return {
            ...super.defaultValueOptions(),
            escapeNonCharacters: true,
            unescapedLineFeeds: false,
        };
    }
    standardNamesDatalist() {
        return html`
            <datalist id="standardnames-list">
                ${this.DOMExceptionNames.map(
                    (name) => html`
                        <option value="${name}"></option>
                    `,
                )}
            </datalist>
        `;
    }
    DOMExceptionNames = [
        'AbortError',
        'ConstraintError',
        'DataCloneError',
        'DataError',
        'EncodingError',
        'HierarchyRequestError',
        'InUseAttributeError',
        'IndexSizeError',
        'InvalidAccessError',
        'InvalidCharacterError',
        'InvalidModificationError',
        'InvalidNodeTypeError',
        'InvalidStateError',
        'NamespaceError',
        'NetworkError',
        'NoModificationAllowedError',
        'NotAllowedError',
        'NotFoundError',
        'NotReadableError',
        'NotSupportedError',
        'OperationError',
        'QuotaExceededError',
        'ReadOnlyError',
        'SecurityError',
        'SyntaxError',
        'TimeoutError',
        'TransactionInactiveError',
        'TypeMismatchError',
        'UnknownError',
        'URLMismatchError',
        'VersionError',
        'WrongDocumentError',
    ] as const;
}
