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
import { isArrayBuffer, isTypedArray } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import {
    formattedNumericArray,
    formatterOptions,
    type FormatterOptions,
} from '#lib/value-formatter';
import {
    RequiredVariables,
    BUFFER_MAX_LENGTH,
    VERY_LARGE_VALUE,
    RememberedValue,
} from '#types';

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
    formView() {
        const { byteLength, maxByteLength } = this.value;
        return html`
            ${textInput(this, {
                id: this.valueInputId('bytelength'),
                '.value': String(byteLength),
                type: 'number',
                min: 0,
                max: BUFFER_MAX_LENGTH,
                style: 'width: 13ch;',
                label: 'byteLength',
                refVar: this.nodeByteLength,
            })}
            ${textInput(this, {
                id: this.valueInputId('maxbytelength'),
                '.value': maxByteLength !== byteLength ? String(maxByteLength) : '',
                type: 'number',
                min: 0,
                max: BUFFER_MAX_LENGTH,
                style: 'width: 13ch',
                label: 'maxByteLength',
                refVar: this.nodeMaxByteLength,
            })}
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
        if (!fieldValues) return;

        const { byteLength, maxByteLength, resizable } = fieldValues;
        let buffer = this.buffer;
        if (byteLength !== buffer.byteLength || maxByteLength !== buffer.maxByteLength) {
            const options = resizable ? { maxByteLength } : {};
            buffer = copyArrayBuffer(
                this.buffer,
                new ArrayBuffer(byteLength, options),
            ) as ArrayBuffer;
        }
        return buffer;
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
        const byteLength = validatePositiveInteger(this.nodeByteLength.value, {
            max: BUFFER_MAX_LENGTH,
        });
        const maxByteLength = validatePositiveInteger(this.nodeMaxByteLength.value, {
            max: BUFFER_MAX_LENGTH,
        });
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
    valueChanged(remembered: RememberedValue) {
        const oldValue = remembered.value;
        if (!(oldValue instanceof ArrayBuffer)) return true;

        const fieldValues = this.valuesFromForm();
        if (!fieldValues) return false;

        const { byteLength, maxByteLength } = fieldValues;
        return (
            byteLength !== oldValue.byteLength || maxByteLength !== oldValue.maxByteLength
        );
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
            this.codeOptions().compacted = buffer.byteLength >= isLarge('arraybuffer');
        }
        this.update(buffer);
    }

    override toSourceValue(compacted: boolean): string {
        if (compacted) return 'return value;';
        const options = this.formOptions({ compacted });
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
    override focus(): void {
        super.focus(this.nodeByteLength.value);
    }
    override isVeryLargeValue(): boolean {
        return this.value.byteLength >= VERY_LARGE_VALUE;
    }
}
