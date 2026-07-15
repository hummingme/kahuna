/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field, { type UpdateOptions } from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import messageStack from '#components/messagestack';

export default class ImagebitmapField extends Field {
    nodeWidth: Ref<HTMLInputElement> = createRef();
    nodeHeight: Ref<HTMLInputElement> = createRef();
    view() {
        const { width, height } = this.value;
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(this, {
                        id: 'bitmap-width',
                        '.value': String(width),
                        size: 10,
                        label: 'width',
                        disabled: true,
                        refVar: this.nodeWidth,
                    })}
                    ${textInput(this, {
                        id: 'bitmap-height',
                        '.value': String(height),
                        size: 10,
                        label: 'height',
                        disabled: true,
                        refVar: this.nodeHeight,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): ImageBitmap {
        return this.state.value as ImageBitmap;
    }
    set value(value: unknown) {
        let result: ImageBitmap | undefined;
        if (value instanceof ImageBitmap) {
            result = value;
        } else if (value instanceof Blob || value instanceof ImageData) {
            this.toValue(value);
            return;
        }
        this.state.value = result;
    }
    async toValue(value: Blob | ImageData) {
        const bitmap = await createImageBitmap(value).catch(() => null);
        if (bitmap) {
            this.update(bitmap);
        }
    }
    toFormValue() {
        const nodeWidth = this.nodeWidth.value;
        if (nodeWidth instanceof HTMLInputElement) {
            nodeWidth.value = String(this.value.width);
        }
        const nodeHeight = this.nodeHeight.value;
        if (nodeHeight instanceof HTMLInputElement) {
            nodeHeight.value = String(this.value.height);
        }
    }
    fromFormValue() {}
    override update(value: ImageBitmap, options?: UpdateOptions) {
        super.update(value, options);
        this.toFormValue();
    }
    override async handleUploadedValue(file: File) {
        const bitmap = await globalThis
            .createImageBitmap(file, { colorSpaceConversion: 'none' })
            .catch(() => null);
        if (bitmap) {
            this.update(bitmap);
        } else {
            messageStack.displayWarning(
                'The selected file cannot be decoded as an image.',
            );
        }
    }
    override toSourceValue(expanded: boolean): string {
        if (!expanded) return 'return value;';
        let source = '';
        if (this.value instanceof ImageBitmap) {
            const { width, height } = this.value;
            source = `return createImageBitmap(value, 0, 0, ${width}, ${height});`;
        }
        return source;
    }
}
