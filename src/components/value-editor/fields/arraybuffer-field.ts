/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field, { type UpdateOptions } from '#components/value-editor/fields/field';
import { copyArrayBuffer } from '#components/value-editor/converter';
import textInput from '#components/value-editor/text-input';
import { validatePositiveInteger } from '#components/value-editor/validations';
import type { RequiredVariables } from '#components/js-codearea';
import { isArrayBuffer, isTypedArray } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import {
    formattedNumericArray,
    formatterOptions,
    type FormatterOptions,
} from '#lib/value-formatter';

export default class ArraybufferField extends Field {
    nodeByteLength: Ref<HTMLInputElement> = createRef();
    nodeMaxByteLength: Ref<HTMLInputElement> = createRef();
    buffer: ArrayBuffer = new ArrayBuffer(0);
    override async init(requireVariables: () => RequiredVariables) {
        if (this.state.value instanceof Blob) {
            // async preparation of the value
            // before using the synchronous setter in super.init()
            this.state.value = await this.state.value.arrayBuffer();
        }
        await super.init(requireVariables);
        this.buffer = this.value;
    }
    view() {
        const { byteLength, maxByteLength } = this.value;
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(this, {
                        id: 'bytelength',
                        '.value': String(byteLength),
                        size: 11,
                        maxLength: 12,
                        label: 'byteLength',
                        refVar: this.nodeByteLength,
                    })}
                    ${textInput(this, {
                        id: 'maxbytelength',
                        '.value':
                            maxByteLength !== byteLength ? String(maxByteLength) : '',
                        size: 11,
                        maxLength: 12,
                        label: 'maxByteLength',
                        refVar: this.nodeMaxByteLength,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): ArrayBuffer {
        return this.state.value as ArrayBuffer;
    }
    set value(value: unknown) {
        let result = new ArrayBuffer(0);
        if (isArrayBuffer(value)) {
            result = value;
        } else if (isTypedArray(value) && isArrayBuffer(value.buffer)) {
            result = value.buffer;
        }
        this.state.value = result;
    }
    toFormValue() {
        const { byteLength, maxByteLength } = this.value;
        const nodeBytelength = this.nodeByteLength.value;
        if (nodeBytelength instanceof HTMLInputElement) {
            nodeBytelength.value = String(byteLength);
        }
        const nodeMaxBytelength = this.nodeMaxByteLength.value;
        if (nodeMaxBytelength instanceof HTMLInputElement && maxByteLength > byteLength) {
            nodeMaxBytelength.value = String(maxByteLength);
        }
    }
    fromFormValue(): ArrayBuffer | undefined {
        const fieldValues = this.valuesFromForm();
        if (fieldValues) {
            const { byteLength, maxByteLength, resizable } = fieldValues;
            let buffer = this.buffer;
            if (
                byteLength !== buffer.byteLength ||
                maxByteLength !== buffer.maxByteLength
            ) {
                const options = resizable ? { maxByteLength } : {};
                buffer = copyArrayBuffer(
                    this.buffer,
                    new ArrayBuffer(byteLength, options),
                ) as ArrayBuffer;
            }
            return buffer;
        }
    }
    valuesFromForm():
        | { byteLength: number; maxByteLength: number; resizable: boolean }
        | undefined {
        if (
            this.nodeByteLength.value instanceof HTMLInputElement &&
            this.nodeMaxByteLength.value instanceof HTMLInputElement
        ) {
            const byteLength = Number(this.nodeByteLength.value.value);
            const maxLength = Number(this.nodeMaxByteLength.value.value);
            const maxByteLength = maxLength > byteLength ? maxLength : byteLength;
            const resizable = this.nodeMaxByteLength.value.value.trim() !== '';
            return { byteLength, maxByteLength, resizable };
        }
    }
    validate() {
        let valid = false;
        const maxByteLengthNode = this.nodeMaxByteLength.value as HTMLInputElement;
        const byteLength = validatePositiveInteger(this.nodeByteLength.value);
        const maxByteLength = validatePositiveInteger(this.nodeMaxByteLength.value);
        if (typeof byteLength === 'number' && typeof maxByteLength === 'number') {
            if (maxByteLength === 0 && maxByteLengthNode.value.trim() === '') {
                valid = true;
            } else if (byteLength > maxByteLength) {
                maxByteLengthNode.setCustomValidity(
                    'Range error: maxByteLength cannot be smaller than byleLength!',
                );
            } else {
                valid = true;
            }
        }
        this.valid = valid;
    }
    override update(value: ArrayBufferLike, options?: UpdateOptions) {
        super.update(value, options);
        this.toFormValue();
    }
    override async handleUploadedValue(file: File) {
        let buffer = await file.arrayBuffer();
        if (!(buffer instanceof ArrayBuffer)) {
            buffer = structuredClone(buffer);
        }
        if (this.codearea) {
            this.state.codeOptions.expanded = buffer.byteLength < isLarge('arraybuffer');
        }
        this.update(buffer);
    }

    override toSourceValue(expanded: boolean): string {
        if (!expanded) return 'return value;';
        const options = this.formOptions({ expanded });
        const bufferFunc = ArraybufferField.sourceFunction(this.value, options);
        return `return arrayBuffer();
            
${bufferFunc}`;
    }
    static sourceFunction(value: ArrayBufferLike, options: Partial<FormatterOptions>) {
        const option_str =
            value.maxByteLength !== value.byteLength
                ? `, {maxByteLength:${value.maxByteLength}}`
                : '';
        options.offset = 4;
        const arr = formattedNumericArray(
            new Uint8Array(value),
            'uint8array',
            formatterOptions(options),
        );
        return `function arrayBuffer() {
    const buffer = new ArrayBuffer(${value.byteLength}${option_str});
    new Uint8Array(buffer).set(${arr});
    return buffer;
}`;
    }
    isLarge() {
        return this.value.byteLength > isLarge(this.state.type);
    }
}
