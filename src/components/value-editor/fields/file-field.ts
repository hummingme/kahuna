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
import { isLarge } from '#lib/datatype-attributes';
import { isFileLike } from '#lib/datatypes';
import { escapeUnicode, unescapeString } from '#lib/escape-string';
import {
    formattedNumericArray,
    type FormatterOptions,
    formatterOptions,
} from '#lib/value-formatter';
import { RequiredVariables } from '#types';

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
    formView() {
        return html`
            <div class="form-wrapper">
                <div>
                    ${textInput(this, {
                        id: this.valueInputId('name'),
                        '.value': escapeUnicode(this.value.name),
                        style: 'width: 15ch;',
                        classes: ['resizable'],
                        label: 'name',
                        refVar: this.nodeFileName,
                    })}
                    ${textInput(this, {
                        id: this.valueInputId('type'),
                        '.value': this.value.type,
                        style: 'width: 10ch;',
                        classes: ['resizable'],
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
            const mimeType = (value as Blob).type;
            const options = typeof mimeType === 'string' ? { type: mimeType } : {};
            result = new File([value], '', options);
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
            const fileName = unescapeString(this.nodeFileName.value.value.trim());
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
    override toSourceValue(compacted: boolean): string {
        if (compacted) return 'return value;';
        const { name, type, lastModified } = this.value;
        const formattedName = this.sourceFormatter.render(
            name,
            'string',
            this.codeOptions(),
        );
        const typeOptionStr = type ? `type: '${type}', ` : '';
        const option_str = `, {${typeOptionStr}lastModified: ${lastModified}}`;
        const options = this.formOptions({ compacted });
        const arr = formattedNumericArray(
            new Uint8Array(this.buffer),
            'uint8array',
            formatterOptions(options),
        );
        return `return new File([buffer()], ${formattedName} ${option_str});
            
function buffer() {
    const buffer = new ArrayBuffer(${this.buffer.byteLength});
    new Uint8Array(buffer).set(${arr});
    return buffer;
}`;
    }
    isLarge() {
        return this.value.size > isLarge(this.state.type);
    }
    override defaultOptionsOverrides: Partial<FormatterOptions> = {
        offset: 4,
    };
    override focus(): void {
        super.focus(this.nodeFileName.value);
    }
}
