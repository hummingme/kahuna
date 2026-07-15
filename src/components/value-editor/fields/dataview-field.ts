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
import type { RequiredVariables } from '#components/js-codearea';
import { isArrayBuffer, isDataView, isTypedArray } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';

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
    view() {
        const { buffer, byteLength, byteOffset } = this.value;
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(this, {
                        id: 'bufferlength',
                        '.value': String(buffer.byteLength),
                        size: 11,
                        maxLength: 12,
                        label: 'bufferLength',
                        refVar: this.nodeBufferLength,
                    })}
                    ${textInput(this, {
                        id: 'byteoffset',
                        '.value': String(byteOffset),
                        size: 11,
                        maxLength: 12,
                        label: 'byteOffset',
                        refVar: this.nodeByteOffset,
                    })}
                    ${textInput(this, {
                        id: 'bytelength',
                        '.value': String(byteLength),
                        size: 11,
                        maxLength: 12,
                        label: 'byteLength',
                        refVar: this.nodeByteLength,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
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
    }
    validate() {
        let valid = false;
        const bufferLength = validatePositiveInteger(this.nodeBufferLength.value);
        const byteOffset = validatePositiveInteger(this.nodeByteOffset.value);
        const byteLength = validatePositiveInteger(this.nodeByteLength.value);
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
    override update(value: DataView, options?: UpdateOptions) {
        super.update(value, options);
        this.toFormValue();
    }
    override async handleUploadedValue(file: File) {
        const blob = new Blob([file], { type: file.type });
        this.buffer = await blob.arrayBuffer();
        this.state.codeOptions.expanded = this.buffer.byteLength < isLarge('dataview');
        this.update(new DataView(this.buffer));
    }
    override toSourceValue(expanded: boolean): string {
        if (!expanded) return 'return value;';
        const value = this.value;
        const options = this.formOptions({ expanded });
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
}
