/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import { isFileBits, isBlobPart } from '#components/value-editor/checkings';
import { copyArrayBuffer } from '#components/value-editor/converter';
import textInput from '#components/value-editor/text-input';
import {
    validateASCII,
    validatePositiveInteger,
} from '#components/value-editor/validations';
import { isLarge } from '#lib/datatype-attributes';
import { isBlobLike, isFileLike } from '#lib/datatypes';
import { formattedNumericArray, type FormatterOptions } from '#lib/value-formatter';
import {
    RequiredVariables,
    BUFFER_MAX_LENGTH,
    VERY_LARGE_VALUE,
    RememberedValue,
} from '#types';

export default class BlobField extends Field {
    nodeBlobSize: Ref<HTMLInputElement> = createRef();
    nodeBlobType: Ref<HTMLInputElement> = createRef();
    buffer: ArrayBuffer = new ArrayBuffer(0);
    override async init(requireVariables: () => RequiredVariables) {
        await super.init(requireVariables);
        this.buffer = await this.value.arrayBuffer();
    }
    formView() {
        return html`
            <div>
                ${textInput(
                    this,
                    {
                        id: this.valueInputId('size'),
                        '.value': String(this.value.size),
                        type: 'number',
                        min: 0,
                        max: BUFFER_MAX_LENGTH,
                        style: 'width: 13ch;',
                        label: 'size',
                        refVar: this.nodeBlobSize,
                    },
                    true,
                )}
                ${textInput(this, {
                    id: this.valueInputId('type'),
                    '.value': String(this.value.type),
                    style: 'width: 15ch;',
                    classes: ['resizable'],
                    maxLength: 100,
                    label: 'type',
                    refVar: this.nodeBlobType,
                })}
            </div>
        `;
    }
    get value(): Blob {
        return this.state.value as Blob;
    }
    set value(value: unknown) {
        let result: Blob = new Blob(['']);
        if ((isBlobLike(value) || isFileLike(value)) && !(value instanceof Blob)) {
            value = new Blob([value], { type: (value as Blob).type });
        }
        if (value instanceof Blob) {
            result = value;
        } else if (isFileBits(value)) {
            result = new File(value, '');
        } else if (isBlobPart(value)) {
            result = new Blob([value]);
        }
        this.state.value = result;
    }
    toFormValue() {
        const nodeBlobSize = this.nodeBlobSize.value;
        if (nodeBlobSize instanceof HTMLInputElement) {
            nodeBlobSize.value = String(this.value.size);
        }
        const nodeBlobType = this.nodeBlobType.value;
        if (nodeBlobType instanceof HTMLInputElement) {
            nodeBlobType.value = this.value.type;
        }
    }
    fromFormValue(): Blob | undefined {
        const fieldValues = this.valuesFromForm();
        if (!fieldValues) return;
        const { size, type } = fieldValues;
        const buffer = this.buffer;
        let blob = this.value;
        if (size !== buffer.byteLength || type !== this.value.type) {
            blob = new Blob([copyArrayBuffer(buffer, new ArrayBuffer(size))], {
                type,
            });
        }
        return blob;
    }
    valuesFromForm(): { size: number; type: string } | undefined {
        if (
            this.nodeBlobSize.value instanceof HTMLInputElement &&
            this.nodeBlobType.value instanceof HTMLInputElement
        ) {
            const size = Number(this.nodeBlobSize.value.value);
            const type = this.nodeBlobType.value.value.trim();
            return { size, type };
        }
    }
    validate() {
        let valid = false;
        const blobSize = validatePositiveInteger(this.nodeBlobSize.value, {
            max: BUFFER_MAX_LENGTH,
        });
        const blobType = validateASCII(this.nodeBlobType.value, false);
        if (typeof blobSize === 'number' && typeof blobType === 'string') {
            valid = true;
        }
        this.valid = valid;
    }
    valueChanged(remembered: RememberedValue) {
        const oldValue = remembered.value;
        if (!(oldValue instanceof Blob)) return true;

        const fieldValues = this.valuesFromForm();
        if (!fieldValues) return;

        const { size, type } = fieldValues;
        return size !== oldValue.size || type !== oldValue.type;
    }
    override async update(value: Blob) {
        this.value = value;
        this.toFormValue();
        if (this.inputMethod !== 'code') {
            this.buffer = await this.value.arrayBuffer();
            this.codearea?.updateCode();
        }
    }
    override async handleUploadedValue(file: File) {
        const blob = new Blob([file], { type: file.type });
        this.formatterMgr.setOptions('code', { compacted: blob.size >= isLarge('blob') });
        this.update(blob);
    }
    override toSourceValue(compacted: boolean): string {
        if (compacted) return 'return value;';
        const options = this.formOptions({ compacted });
        const arr = formattedNumericArray(
            new Uint8Array(this.buffer),
            'uint8array',
            options,
        );
        const option_str = this.value.type ? `, {type:'${this.value.type}'}` : '';
        return `return new Blob([buffer()]${option_str})
            
function buffer() {
    const buffer = new ArrayBuffer(${this.buffer.byteLength});
    new Uint8Array(buffer).set(${arr});
    return buffer;
}`;
    }
    hints = {
        form: `If the size is increased, the added region
is initialized with zeros.`,
    };
    isLarge() {
        return this.value.size > isLarge(this.state.type);
    }
    override defaultOptionsOverrides: Partial<FormatterOptions> = {
        offset: 4,
    };
    override focus(): void {
        super.focus(this.nodeBlobSize.value);
    }
    override isVeryLargeValue(): boolean {
        return this.value.size >= VERY_LARGE_VALUE;
    }
}
