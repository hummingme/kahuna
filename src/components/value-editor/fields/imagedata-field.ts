/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field, {
    UpdateOptions,
    ValueFieldArgs,
} from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { validatePositiveInteger } from '#components/value-editor/validations';
import messageStack from '#components/messagestack';
import { formattedNumericArray } from '#lib/value-formatter';

export default class ImagedataField extends Field {
    nodeWidth: Ref<HTMLInputElement> = createRef();
    nodeHeight: Ref<HTMLInputElement> = createRef();
    initialData: ImageData;
    constructor(args: ValueFieldArgs) {
        super(args);
        this.initialData = structuredClone(this.value);
    }
    view() {
        const { width, height } = this.value;
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(
                        this,
                        {
                            id: 'bitmap-width',
                            '.value': String(width),
                            size: 10,
                            label: 'width',
                            disabled: this.inputMethod !== 'form',
                            refVar: this.nodeWidth,
                        },
                        true,
                    )}
                    ${textInput(this, {
                        id: 'bitmap-height',
                        '.value': String(height),
                        size: 10,
                        label: 'height',
                        disabled: this.inputMethod !== 'form',
                        refVar: this.nodeHeight,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): ImageData {
        return this.state.value as ImageData;
    }
    set value(value: unknown) {
        let result = new ImageData(1, 1);
        if (value instanceof ImageData) {
            result = value;
        } else if (value instanceof Blob) {
            this.fileToValue(value);
            return;
        }
        this.state.value = result;
    }
    async fileToValue(file: Blob) {
        const imageData = await this.imageToImageData(file);
        if (imageData) {
            this.update(imageData);
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
    fromFormValue() {
        if (
            this.nodeWidth.value instanceof HTMLInputElement &&
            this.nodeHeight.value instanceof HTMLInputElement
        ) {
            const width = Number(this.nodeWidth.value.value);
            const height = Number(this.nodeHeight.value.value);
            if (width === this.initialData.width && height === this.initialData.height) {
                return structuredClone(this.initialData);
            }
            return this.copyImageDataPixels(width, height, this.initialData);
        }
    }
    validate() {
        let valid = false;
        const width = validatePositiveInteger(this.nodeWidth.value, {
            required: true,
            zeroIncluded: false,
        });
        const height = validatePositiveInteger(this.nodeHeight.value, {
            required: true,
            zeroIncluded: false,
        });
        if (typeof width === 'number' && typeof height === 'number') {
            valid = true;
        }
        this.valid = valid;
    }
    override update(value: ImageData, options?: UpdateOptions) {
        super.update(value, options);
        this.toFormValue();
    }
    override async handleUploadedValue(file: File) {
        const { name, type, lastModified } = file;
        if (!(file instanceof File)) {
            file = new File([file], name, { type, lastModified });
        }
        const value = await this.imageToImageData(file);
        if (value) {
            this.update(value);
        }
    }
    override toSourceValue(expanded: boolean): string {
        if (!(this.value instanceof ImageData)) return '';
        if (!expanded) return 'return value;';

        const { width, height, colorSpace } = this.value;
        const isFloat16 =
            'pixelFormat' in this.value && this.value.pixelFormat === 'rgba-float16';
        const data = isFloat16
            ? new Float16Array(this.value.data)
            : new Uint8ClampedArray(this.value.data);
        const arr = formattedNumericArray(
            data,
            isFloat16 ? 'float16array' : 'uint8clampedarray',
            this.formOptions({ expanded, perLine: 16 }),
        );
        const typeName = isFloat16 ? 'Float16Array' : 'Uint8ClampedArray';
        const settings = [`colorSpace: '${colorSpace}'`];
        if (isFloat16) {
            settings.push("pixelFormat: 'rgba-float16'");
        }
        return `return new ImageData(dataArray(), ${width}, ${height}, { ${settings.join(', ')} });

function dataArray() {
    return new ${typeName}(${arr});
}`;
    }

    async imageToImageData(image: ImageBitmapSource): Promise<ImageData | void> {
        const bitmap = await globalThis
            .createImageBitmap(image, {
                colorSpaceConversion: 'none',
            })
            .catch(() => null);
        if (bitmap) {
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
            return structuredClone(imageData);
        } else {
            messageStack.displayWarning(
                'The selected file cannot be decoded as an image.',
            );
        }
    }
    copyImageDataPixels(width: number, height: number, source: ImageData): ImageData {
        const channels = 4;
        const copyWidth = Math.min(width, source.width);
        const copyHeight = Math.min(height, source.height);

        let dataArray: Uint8ClampedArray | Float16Array;
        if (source.data instanceof Float16Array) {
            dataArray = new Float16Array(width * height * channels);
        } else {
            dataArray = new Uint8ClampedArray(width * height * channels);
        }

        for (let y = 0; y < copyHeight; y++) {
            const srcStart = y * source.width * channels;
            const dstStart = y * width * channels;
            dataArray.set(
                source.data.subarray(srcStart, srcStart + copyWidth * channels),
                dstStart,
            );
        }

        if (dataArray instanceof Float16Array) {
            const settings = { pixelFormat: 'rgba-float16' } as ImageDataSettings;
            return new ImageData(
                dataArray as unknown as ImageDataArray,
                width,
                height,
                settings,
            );
        }
        return new ImageData(dataArray as unknown as ImageDataArray, width, height);
    }
    hints = {
        form: `Reducing the width or height crops the ImageBitmap.
Increasing the width or height fills the added area
with transparent pixels.`,
    };
}
