/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';

export default class FilesystemfilehandleField extends Field {
    view() {
        const fileName =
            this.value instanceof FileSystemFileHandle
                ? this.value.name
                : '< no file selected >';
        return html`
            <div class="value-controls">
                <div class="value">
                    <p>
                        <button
                            @click=${this.pickFile.bind(this)}
                            ?disabled=${this.inputMethod !== 'form'}
                        >
                            select file
                        </button>
                    </p>
                    ${textInput(this, {
                        id: 'filename',
                        '.value': fileName,
                        size: 20,
                        label: 'file name',
                        disabled: true,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    async pickFile(event: Event) {
        event.preventDefault();
        try {
            const [file] = await window.showOpenFilePicker();
            this.update(file);
        } catch {} // eslint-disable-line no-empty
    }
    override update(value: FileSystemFileHandle) {
        this.value = value;
        this.toFormValue();
    }
    get value(): FileSystemFileHandle {
        return this.state.value as FileSystemFileHandle;
    }
    set value(value: unknown) {
        let result = undefined;
        if (value instanceof FileSystemFileHandle) {
            result = value;
        }
        this.state.value = result;
    }
    toFormValue() {
        const nodeFileName = this.node.value;
        if (nodeFileName instanceof HTMLInputElement) {
            nodeFileName.value = this.value.name;
        }
    }
    fromFormValue(): undefined {}
    override toSourceValue(): string {
        return 'return value;';
    }
}
