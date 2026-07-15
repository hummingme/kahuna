/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';

export default class BooleanField extends Field {
    nodeFalse: Ref<HTMLElement> = createRef();
    view() {
        const value = this.toFormValue();
        return html`
            <div class="value-controls">
                <div class="value">
                    <label>
                        <input
                            type="radio"
                            name="field-type-boolean"
                            value="true"
                            .checked=${live(value === 'true')}
                            @change=${this.handleFormChange.bind(this)}
                            ${ref(this.node)},
                        />
                        true
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="field-type-boolean"
                            value="false"
                            .checked=${live(value === 'false')}
                            @change=${this.handleFormChange.bind(this)}
                            ${ref(this.nodeFalse)},
                        />
                        false
                    </label>
                </div>
                ${this.inputMethodView()}
            </div>
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
        if (this.node.value instanceof HTMLInputElement) {
            return this.node.value.checked;
        }
    }
    override update(value: unknown) {
        this.value = value;
        const checkboxTrue = this.node.value;
        const checkboxFalse = this.nodeFalse.value;
        if (
            checkboxTrue instanceof HTMLInputElement &&
            checkboxFalse instanceof HTMLInputElement
        ) {
            checkboxTrue.checked = this.value === true;
            checkboxFalse.checked = this.value === false;
        }
    }
}
