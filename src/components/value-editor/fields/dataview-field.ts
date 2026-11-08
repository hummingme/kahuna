/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import ArraybufferField from '#components/value-editor/fields/arraybuffer-field';
import Field, { type UpdateOptions } from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { validatePositiveInteger } from '#components/value-editor/validations';
import { isArrayBuffer, isDataView, isTypedArray } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import {
    BUFFER_MAX_LENGTH,
    RememberedValue,
    RequiredVariables,
    VERY_LARGE_VALUE,
} from '#types';

export default class DataviewField extends Field {
    nodeBufferLength: Ref<HTMLInputElement> = createRef();
    nodeByteOffset: Ref<HTMLInputElement> = createRef();
    nodeByteLength: Ref<HTMLInputElement> = createRef();
    buffer: ArrayBuffer = new ArrayBuffer(0);
    override async init(requireVariables: () => RequiredVariables) {
        if (this.state.value instanceof Blob) {
            // async preparation of the value
            // before using the synchronous setter in super.init()
            this.state.value = await this.state.value.arrayBuffer();
        }
        await super.init(requireVariables);
        if (isArrayBuffer(this.value.buffer)) {
            this.buffer = this.value.buffer;
        }
    }
    formView() {
        const { buffer, byteLength, byteOffset } = this.value;
        const commonAttributes = {
            type: 'number',
            min: 0,
            max: BUFFER_MAX_LENGTH,
            style: 'width: 13ch;',
        };
        return html`
            ${textInput(this, {
                ...commonAttributes,
                id: this.valueInputId('bufferlength'),
                '.value': String(buffer.byteLength),
                label: 'bufferLength',
                refVar: this.nodeBufferLength,
            })}
            ${textInput(this, {
                ...commonAttributes,
                id: this.valueInputId('byteoffset'),
                '.value': String(byteOffset),
                label: 'byteOffset',
                refVar: this.nodeByteOffset,
            })}
            ${textInput(this, {
                ...commonAttributes,
                id: this.valueInputId('bytelength'),
                '.value': String(byteLength),
                label: 'byteLength',
                refVar: this.nodeByteLength,
            })}
        `;
    }
    get value(): DataView {
        return this.state.value as DataView;
    }
    set value(value: unknown) {
        let result: DataView<ArrayBufferLike> = new DataView(new ArrayBuffer(0));
        if (isDataView(value)) {
            result = value;
        } else if (isArrayBuffer(value)) {
            result = new DataView(value);
        } else if (isTypedArray(value) && isArrayBuffer(value.buffer)) {
            result = new DataView(value.buffer);
        }
        this.state.value = result;
    }
    toFormValue() {
        const { buffer, byteOffset, byteLength } = this.value;
        const nodeBufferLength = this.nodeBufferLength.value;
        if (nodeBufferLength instanceof HTMLInputElement) {
            nodeBufferLength.value = String(buffer.byteLength);
        }
        const nodeByteOffset = this.nodeByteOffset.value;
        if (nodeByteOffset instanceof HTMLInputElement) {
            nodeByteOffset.value = String(byteOffset);
        }
        const nodeByteLength = this.nodeByteLength.value;
        if (nodeByteLength instanceof HTMLInputElement) {
            nodeByteLength.value = String(byteLength);
        }
    }
    fromFormValue(): DataView | undefined {
        const fieldValues = this.valuesFromForm();
        if (!fieldValues) return;

        const { bufferLength, byteOffset, byteLength } = fieldValues;
        let buffer = this.buffer;
        if (bufferLength !== this.buffer.byteLength) {
            buffer = new ArrayBuffer(bufferLength);
            const newView = new DataView(buffer);
            const oldView = new DataView(this.buffer);
            for (let i = 0; i < bufferLength; i++) {
                const byte = i < this.buffer.byteLength ? oldView.getUint8(i) : 0;
                newView.setUint8(i, byte);
            }
        }
        return new DataView(buffer, byteOffset, byteLength);
    }
    valuesFromForm():
        | { bufferLength: number; byteOffset: number; byteLength: number }
        | undefined {
        if (
            this.valid &&
            this.nodeBufferLength.value instanceof HTMLInputElement &&
            this.nodeByteOffset.value instanceof HTMLInputElement &&
            this.nodeByteLength.value instanceof HTMLInputElement
        ) {
            const bufferLength = Number(this.nodeBufferLength.value.value);
            const byteOffset = Number(this.nodeByteOffset.value.value);
            const byteLength =
                byteOffset > 0 && this.nodeByteLength.value.value === ''
                    ? bufferLength - byteOffset
                    : Number(this.nodeByteLength.value.value);
            return { bufferLength, byteOffset, byteLength };
        }
    }
    validate() {
        let valid = false;
        const opts = { max: BUFFER_MAX_LENGTH };
        const bufferLength = validatePositiveInteger(this.nodeBufferLength.value, opts);
        const byteOffset = validatePositiveInteger(this.nodeByteOffset.value, opts);
        const byteLength = validatePositiveInteger(this.nodeByteLength.value, opts);
        if (
            typeof bufferLength === 'number' &&
            typeof byteOffset === 'number' &&
            typeof byteLength === 'number'
        ) {
            if (bufferLength < byteOffset + byteLength) {
                const bufferLengthNode = this.nodeBufferLength.value as HTMLInputElement;
                bufferLengthNode.setCustomValidity(
                    "Range error: byteOffset + byteLength didn't fit into the buffer!",
                );
            } else {
                valid = true;
            }
        } else if (byteOffset !== null && byteLength === null) {
            const byteLengthNode = this.nodeByteLength.value as HTMLInputElement;
            byteLengthNode.setCustomValidity(
                'Range error: byteLength must be an integer not bigger than bufferLength - byteOffset!',
            );
        }
        this.valid = valid;
    }
    valueChanged(remembered: RememberedValue) {
        const oldValue = remembered.value;
        if (!(oldValue instanceof DataView)) return true;

        const fieldValues = this.valuesFromForm();
        if (!fieldValues) return;

        const { bufferLength, byteOffset, byteLength } = fieldValues;
        return (
            bufferLength !== oldValue.buffer.byteLength ||
            byteOffset !== oldValue.byteOffset ||
            byteLength !== oldValue.byteLength
        );
    }
    override update(value: DataView, options?: UpdateOptions) {
        super.update(value, options);
        this.toFormValue();
    }
    override async handleUploadedValue(file: File) {
        const blob = new Blob([file], { type: file.type });
        this.buffer = await blob.arrayBuffer();
        this.formatterMgr.setOptions('code', {
            compacted: this.buffer.byteLength >= isLarge('dataview'),
        });
        this.update(new DataView(this.buffer));
    }
    override toSourceValue(compacted: boolean): string {
        if (compacted) return 'return value;';
        const value = this.value;
        const options = this.formOptions({ compacted });
        const func = ArraybufferField.sourceFunction(value.buffer, options);
        const param_str =
            value.byteLength !== value.buffer.byteLength
                ? `, ${value.byteOffset}, ${value.byteLength}`
                : '';
        return `return new DataView(arrayBuffer()${param_str});
            
${func}`;
    }
    isLarge() {
        return this.value.byteLength > isLarge(this.state.type);
    }
    override focus(): void {
        super.focus(this.nodeBufferLength.value);
    }
    override isVeryLargeValue(): boolean {
        return this.value.buffer.byteLength >= VERY_LARGE_VALUE;
    }
}
