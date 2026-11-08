/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { focusForceVisible } from '#components/value-editor/view-utils';

export default class FilesystemfilehandleField extends Field {
    selectFileButton: Ref<HTMLElement> = createRef();
    formView() {
        const fileName =
            this.value instanceof FileSystemFileHandle
                ? this.value.name
                : '< no file selected >';
        return html`
            <p>
                <button
                    @click=${this.pickFile.bind(this)}
                    ?disabled=${this.inputMethod !== 'form'}
                    ${ref(this.selectFileButton)}
                >
                    select file
                </button>
            </p>
            ${textInput(this, {
                id: this.valueInputId('file-name'),
                '.value': fileName,
                style: 'width: 15ch;',
                classes: ['resizable'],
                label: 'file name',
                disabled: true,
            })}
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
        const nodeFileName = this.nodeInput;
        if (nodeFileName instanceof HTMLInputElement) {
            nodeFileName.value = this.value.name;
        }
    }
    fromFormValue(): undefined {}
    override toSourceValue(): string {
        return 'return value;';
    }
    override focus() {
        const button = this.selectFileButton.value;
        if (!(button instanceof HTMLButtonElement) || this.inputMethod !== 'form') return;
        focusForceVisible(button);
    }
}
