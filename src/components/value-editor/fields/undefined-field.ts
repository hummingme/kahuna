/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field, { UpdateOptions } from '#components/value-editor/fields/field';
import { RememberedValue, RequiredVariables } from '#types';
import { focusForceVisible } from '../view-utils';

export default class UndefinedField extends Field {
    nodeValue: Ref<HTMLInputElement> = createRef();
    override async init(requireVariables: () => RequiredVariables) {
        await super.init(requireVariables);
        this.codearea!.codearea.updateOptions({ executed: this.codeExecuted.bind(this) });
    }
    formView() {
        const value = this.toFormValue();
        return html`
            <label>
                <input
                    type="radio"
                    name="field-type-undefined"
                    value="property"
                    .checked=${live(value === 'property')}
                    disabled=${this.inputMethod === 'form' ? nothing : true}
                    @change=${this.handleFormChange.bind(this)}
                    ${ref(this.setNodeInput)},
                />
                undefined property
            </label>
            <label>
                <input
                    type="radio"
                    name="field-type-undefined"
                    value="value"
                    .checked=${live(value === 'value')}
                    disabled=${this.inputMethod === 'form' ? nothing : true}
                    @change=${this.handleFormChange.bind(this)}
                    ${ref(this.nodeValue)},
                />
                undefined value
            </label>
        `;
    }
    get value() {
        return this.state.value;
    }
    set value(value: unknown) {
        let result = 'value';
        if (value === 'property' || value === 'value') {
            result = value;
        } else if (value === undefined) {
            result = this.state.absent ? 'property' : 'value';
        }
        this.state.value = result;
    }
    toFormValue() {
        return this.state.value as 'property' | 'value';
    }
    fromFormValue() {
        if (this.nodeInput instanceof HTMLInputElement) {
            return this.nodeInput.checked ? 'property' : 'value';
        }
    }
    override handleFormChange() {
        this.value = this.fromFormValue();
        if (this.value === 'property' || this.value === 'value') {
            this.update(this.value);
        }
    }
    override update(value: 'property' | 'value', options?: UpdateOptions) {
        this.value = value;
        const checkboxProperty = this.value;
        const checkboxValue = this.nodeValue.value;
        if (
            checkboxProperty instanceof HTMLInputElement &&
            checkboxValue instanceof HTMLInputElement
        ) {
            checkboxProperty.checked = this.value === 'property';
            checkboxValue.checked = this.value === 'value';
        }
        this.updateFormFieldValue(options);
    }
    override toSourceValue(compacted?: boolean): string {
        if (compacted) return 'return value;';
        return `return ${this.state.value === 'value' ? 'undefined' : 'false'};`;
    }
    codeExecuted(result: unknown) {
        this.update(result === undefined ? 'value' : 'property', {
            updateCodearea: false,
        });
    }
    valueChanged(remembered: RememberedValue) {
        const absent = remembered.absent;
        return (
            (absent === true && this.value === 'value') ||
            (absent === false && this.value === 'property')
        );
    }
    override focus() {
        if (this.inputMethod === 'form') {
            const node =
                this.value === 'property' ? this.nodeInput : this.nodeValue.value;
            focusForceVisible(node);
        }
    }
}
