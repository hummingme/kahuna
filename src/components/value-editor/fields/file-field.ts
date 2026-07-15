/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import { isBlobPart, isFileBits } from '#components/value-editor/checkings';
import saveFileIcon from '#components/value-editor/save-file-icon';
import textInput from '#components/value-editor/text-input';
import { validateASCII } from '#components/value-editor/validations';
import type { RequiredVariables } from '#components/js-codearea';
import { isLarge } from '#lib/datatype-attributes';
import { isFileLike } from '#lib/datatypes';
import { escapeUnicode, unescapeUnicode } from '#lib/escape-unicode';
import {
    formattedNumericArray,
    type FormatterOptions,
    formatterOptions,
} from '#lib/value-formatter';

export default class FileField extends Field {
    nodeFileName: Ref<HTMLInputElement> = createRef();
    nodeFileType: Ref<HTMLInputElement> = createRef();
    nodeSaveIcon: Ref<HTMLInputElement> = createRef();
    buffer: ArrayBuffer = new ArrayBuffer(0);
    override async init(requireVariables: () => RequiredVariables) {
        await super.init(requireVariables);
        this.buffer = await this.value.arrayBuffer();
        this.codearea?.updateCode();
    }
    view() {
        return html`
            <div class="value-controls">
                <div class="value">
                    <div class="form-wrapper">
                        <div>
                            ${textInput(this, {
                                id: 'filename',
                                '.value': escapeUnicode(this.value.name),
                                size: 20,
                                label: 'name',
                                refVar: this.nodeFileName,
                            })}
                            ${textInput(this, {
                                id: 'filetype',
                                '.value': this.value.type,
                                size: 15,
                                maxLength: 100,
                                label: 'type',
                                refVar: this.nodeFileType,
                            })}
                        </div>
                        <div
                            class="value-icons"
                            ${ref(this.nodeSaveIcon)}
                            ${ref(this.renderSaveIcon.bind(this))}
                        ></div>
                    </div>
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    renderSaveIcon() {
        const node = this.nodeSaveIcon.value;
        if (node === undefined) return;
        render(saveFileIcon(this.value), node);
    }
    get value(): File {
        return this.state.value as File;
    }
    set value(value: unknown) {
        let result: File = new File([], '');
        if (value instanceof File || isFileLike(value)) {
            result = value;
        } else if (isFileBits(value)) {
            result = new File(value, '');
        } else if (isBlobPart(value)) {
            result = new File([value], '');
        }
        this.state.value = result;
    }
    toFormValue() {
        const nodeFieldName = this.nodeFileName.value;
        if (nodeFieldName instanceof HTMLInputElement) {
            nodeFieldName.value = escapeUnicode(this.value.name);
        }
        const nodeFileType = this.nodeFileType.value;
        if (nodeFileType instanceof HTMLInputElement) {
            nodeFileType.value = this.value.type;
        }
    }
    fromFormValue(): Blob | undefined {
        if (
            this.nodeFileName.value instanceof HTMLInputElement &&
            this.nodeFileType.value instanceof HTMLInputElement
        ) {
            let file = this.value;
            const fileName = unescapeUnicode(this.nodeFileName.value.value.trim());
            const fileType = this.nodeFileType.value.value.trim();
            if (fileName !== this.value.name || fileType !== this.value.type) {
                file = new File([this.buffer], fileName, { type: fileType });
            }
            return file;
        }
    }
    validate() {
        const fileNameInput = this.nodeFileName.value;
        if (!fileNameInput) return;

        let fileName;
        if (fileNameInput.value.trim() === '') {
            fileNameInput.setCustomValidity('Please enter a filename!');
        } else {
            fileName = fileNameInput.value;
            fileNameInput.setCustomValidity('');
        }
        const fileType = validateASCII(this.nodeFileType.value, false);

        this.valid = typeof fileName === 'string' && typeof fileType === 'string';
    }
    override async update(value: File) {
        this.value = value;
        this.toFormValue();
        this.renderSaveIcon();
        if (this.inputMethod !== 'code') {
            this.buffer = await this.value.arrayBuffer();
            this.codearea?.updateCode();
        }
    }
    override async handleUploadedValue(file: File) {
        const { name, type, lastModified } = file;
        if (!(file instanceof File)) {
            file = new File([file], name, { type, lastModified });
        }
        this.update(file);
    }
    override toSourceValue(expanded: boolean): string {
        if (!expanded) return 'return value;';
        const { name, type, lastModified } = this.value;
        const option_str = type
            ? `, {type:'${type}', lastModified: ${lastModified}}`
            : '';
        const options = this.formOptions({ expanded });
        const arr = formattedNumericArray(
            new Uint8Array(this.buffer),
            'uint8array',
            formatterOptions(options),
        );
        return `return new File([buffer()], "${name}"${option_str});
            
function buffer() {
    const buffer = new ArrayBuffer(${this.buffer.byteLength});
    new Uint8Array(buffer).set(${arr});
    return buffer;
}`;
    }
    isLarge() {
        return this.value.size > isLarge(this.state.type);
    }
    override defaultValueOptions(): FormatterOptions {
        return {
            ...super.defaultValueOptions(),
            offset: 4,
        };
    }
}
