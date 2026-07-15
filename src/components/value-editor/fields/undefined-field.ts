/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field, { UpdateOptions } from '#components/value-editor/fields/field';
import type { RequiredVariables } from '#components/js-codearea';

export default class UndefinedField extends Field {
    nodeValue: Ref<HTMLElement> = createRef();
    override async init(requireVariables: () => RequiredVariables) {
        await super.init(requireVariables);
        this.codearea!.codearea.updateOptions({ executed: this.codeExecuted.bind(this) });
    }
    view() {
        const value = this.toFormValue();
        return html`
            <div class="value-controls">
                <div class="value">
                    <label>
                        <input
                            type="radio"
                            name="field-type-undefined"
                            value="property"
                            .checked=${live(value === 'property')}
                            @change=${this.handleFormChange.bind(this)}
                            ${ref(this.node)},
                        />
                        undefined property
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="field-type-undefined"
                            value="value"
                            .checked=${live(value === 'value')}
                            @change=${this.handleFormChange.bind(this)}
                            ${ref(this.nodeValue)},
                        />
                        undefined value
                    </label>
                    ${this.inputMethodView()}
                </div>
            </div>
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
        if (this.node.value instanceof HTMLInputElement) {
            return this.node.value.checked ? 'property' : 'value';
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
        const checkboxProperty = this.node.value;
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
    override toSourceValue(expanded?: boolean): string {
        if (!expanded) return 'return value;';
        return `return ${this.state.value === 'value' ? 'undefined' : 'false'};`;
    }
    codeExecuted(result: unknown) {
        this.update(result === undefined ? 'value' : 'property', {
            updateCodearea: false,
        });
    }
}
