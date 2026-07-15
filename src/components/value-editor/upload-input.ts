/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import hintIcon from '#components/value-editor/hint-icon';
import Field from '#components/value-editor/fields/field';

export default class UploadInput {
    field;
    constructor(field: Field) {
        this.field = field;
    }
    view() {
        const icon = hintIcon(this.field, this.field.inputMethod);
        return html`
            <div class="value">
                <button class="upload" @click=${this.clickFileInput}>
                    <label>load from file</label>
                </button>
                <input
                    type="file"
                    id="field-upload"
                    @change=${this.getUploadedValue.bind(this)}
                    class="hidden"
                    accept=${this.accept()}
                />
                ${icon}
            </div>
        `;
    }
    accept() {
        switch (this.field.inputMethod) {
            case 'csv-upload':
                return '.csv';
            case 'json-upload':
                return '.json';
            case 'image-upload':
                return 'image/*';
            default:
                return null;
        }
    }
    clickFileInput(event: Event) {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const input = target.closest('button')?.nextElementSibling;
        if (input instanceof HTMLInputElement) input.click();
    }
    getUploadedValue(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.files?.length) {
            throw new Error("can't access uploaded file!");
        }
        this.field.handleUploadedValue(target.files[0]);
    }
}
