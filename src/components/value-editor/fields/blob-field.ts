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
import type { RequiredVariables } from '#components/js-codearea';
import { isLarge } from '#lib/datatype-attributes';
import { isBlobLike } from '#lib/datatypes';
import { formattedNumericArray, type FormatterOptions } from '#lib/value-formatter';

export default class BlobField extends Field {
    nodeBlobSize: Ref<HTMLInputElement> = createRef();
    nodeBlobType: Ref<HTMLInputElement> = createRef();
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
                    <div>
                        ${textInput(
                            this,
                            {
                                id: 'blobsize',
                                '.value': String(this.value.size),
                                size: 8,
                                maxLength: 9,
                                label: 'size',
                                refVar: this.nodeBlobSize,
                            },
                            true,
                        )}
                        ${textInput(this, {
                            id: 'blobtype',
                            '.value': String(this.value.type),
                            size: 15,
                            maxLength: 100,
                            label: 'type',
                            refVar: this.nodeBlobType,
                        })}
                    </div>
                    ${this.inputMethodView()}
                </div>
            </div>
        `;
    }
    get value(): Blob {
        return this.state.value as Blob;
    }
    set value(value: unknown) {
        let result: Blob = new Blob(['']);
        if (isBlobLike(value) && !(value instanceof Blob)) {
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
        if (
            this.nodeBlobSize.value instanceof HTMLInputElement &&
            this.nodeBlobType.value instanceof HTMLInputElement
        ) {
            let blob = this.value;
            const blobSize = Number(this.nodeBlobSize.value.value);
            const blobType = this.nodeBlobType.value.value;
            const buffer = this.buffer;
            if (blobSize !== buffer.byteLength || blobType !== this.value.type) {
                blob = new Blob([copyArrayBuffer(buffer, new ArrayBuffer(blobSize))], {
                    type: blobType,
                });
            }
            return blob;
        }
    }
    validate() {
        let valid = false;
        const blobSize = validatePositiveInteger(this.nodeBlobSize.value);
        const blobType = validateASCII(this.nodeBlobType.value, false);
        if (typeof blobSize === 'number' && typeof blobType === 'string') {
            valid = true;
        }
        this.valid = valid;
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
        this.state.codeOptions.expanded = blob.size < isLarge('blob');
        this.update(blob);
    }
    override toSourceValue(expanded: boolean): string {
        if (!expanded) return 'return value;';
        const options = this.formOptions({ expanded });
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
    override defaultValueOptions(): FormatterOptions {
        return {
            ...super.defaultValueOptions(),
            offset: 4,
        };
    }
}
