/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { focusForceVisible } from '#components/value-editor/view-utils';

export default class FilesystemdirectoryhandleField extends Field {
    selectDirectoryButton: Ref<HTMLElement> = createRef();
    nodeDirEntries: Ref<HTMLElement> = createRef();
    nodeFileEntries: Ref<HTMLElement> = createRef();
    formView() {
        const directoryName =
            this.value instanceof FileSystemDirectoryHandle
                ? this.value.name
                : '< no directory selected >';
        return html`
            <div ${ref(this.displayEntries.bind(this))}>
                <p>
                    <button
                        @click=${this.pickDirectory.bind(this)}
                        ?disabled=${this.inputMethod !== 'form'}
                        ${ref(this.selectDirectoryButton)}
                    >
                        select directory
                    </button>
                </p>
                ${textInput(this, {
                    id: this.valueInputId('directory-name'),
                    '.value': directoryName,
                    style: 'width: 15ch;',
                    classes: ['resizable'],
                    label: 'directory name',
                    disabled: true,
                })}
                <p>
                    <textarea
                        id="${this.valueInputId('direntries')}"
                        disabled=""
                        ${ref(this.nodeDirEntries)}
                        cols="35"
                    ></textarea>
                    <label for="${this.valueInputId('direntries')}">
                        directory entries
                    </label>
                </p>
                <p>
                    <textarea
                        id="${this.valueInputId('fileentries')}"
                        disabled=""
                        ${ref(this.nodeFileEntries)}
                        cols="35"
                    ></textarea>
                    <label for="${this.valueInputId('fileentries')}">file entries</label>
                </p>
            </div>
        `;
    }
    async displayEntries() {
        if (this.value instanceof FileSystemDirectoryHandle === false) return;
        const dirs: string[] = [];
        const files: string[] = [];
        for await (const [name, handle] of this.value) {
            if (handle.kind === 'directory') dirs.push(name);
            else files.push(name);
        }
        dirs.sort();
        files.sort();
        const nodeDirEntries = this.nodeDirEntries.value;
        if (nodeDirEntries instanceof HTMLTextAreaElement) {
            nodeDirEntries.value = dirs.join('\n');
            nodeDirEntries.rows =
                dirs.length <= 1 ? 1 : dirs.length <= 3 ? dirs.length : 3;
        }
        const nodeFileEntries = this.nodeFileEntries.value;
        if (nodeFileEntries instanceof HTMLTextAreaElement) {
            nodeFileEntries.value = files.join('\n');
            nodeFileEntries.rows =
                files.length <= 1 ? 1 : files.length <= 3 ? files.length : 3;
        }
    }
    async pickDirectory(event: Event) {
        event.preventDefault();
        try {
            const directory = await window.showDirectoryPicker();
            this.update(directory);
        } catch {} // eslint-disable-line no-empty
    }
    override update(value: FileSystemDirectoryHandle) {
        this.value = value;
        this.toFormValue();
    }
    get value(): FileSystemDirectoryHandle {
        return this.state.value as FileSystemDirectoryHandle;
    }
    set value(value: unknown) {
        let result = undefined;
        if (value instanceof FileSystemDirectoryHandle) {
            result = value;
        }
        this.state.value = result;
    }
    toFormValue() {
        const nodeDirectoryName = this.nodeInput;
        if (nodeDirectoryName instanceof HTMLInputElement === false) return;
        nodeDirectoryName.value = this.value.name;
        this.displayEntries();
    }
    fromFormValue(): undefined {}
    override toSourceValue(): string {
        return 'return value;';
    }
    override focus() {
        const button = this.selectDirectoryButton.value;
        if (!(button instanceof HTMLButtonElement) || this.inputMethod !== 'form') return;
        focusForceVisible(button);
    }
}
