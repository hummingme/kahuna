/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import { focusForceVisible } from '#components/value-editor/view-utils';

export default class BooleanField extends Field {
    nodeFalse: Ref<HTMLInputElement> = createRef();
    formView() {
        const value = this.toFormValue();
        return html`
            <label>
                <input
                    type="radio"
                    name="field-type-boolean"
                    value="true"
                    .checked=${live(value === 'true')}
                    disabled=${this.inputMethod === 'form' ? nothing : true}
                    @change=${this.handleFormChange.bind(this)}
                    ${ref(this.setNodeInput)},
                />
                true
            </label>
            <label>
                <input
                    type="radio"
                    name="field-type-boolean"
                    value="false"
                    .checked=${live(value === 'false')}
                    disabled=${this.inputMethod === 'form' ? nothing : true}
                    @change=${this.handleFormChange.bind(this)}
                    ${ref(this.nodeFalse)},
                />
                false
            </label>
        `;
    }
    get value(): boolean {
        return this.state.value as boolean;
    }
    set value(value: unknown) {
        this.state.value = !!value;
    }
    toFormValue() {
        return this.state.value === true ? 'true' : 'false';
    }
    fromFormValue(): boolean | undefined {
        if (this.nodeInput instanceof HTMLInputElement) {
            return this.nodeInput.checked;
        }
    }
    override update(value: unknown) {
        this.value = value;
        const checkboxTrue = this.nodeInput;
        const checkboxFalse = this.nodeFalse.value;
        if (
            checkboxTrue instanceof HTMLInputElement &&
            checkboxFalse instanceof HTMLInputElement
        ) {
            checkboxTrue.checked = this.value === true;
            checkboxFalse.checked = this.value === false;
        }
    }
    override focus() {
        if (this.inputMethod === 'form') {
            const node = this.value === true ? this.nodeInput : this.nodeFalse.value;
            focusForceVisible(node);
        }
    }
}
