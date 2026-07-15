/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field, { type ValueFieldArgs } from '#components/value-editor/fields/field';
import { arrayToFieldValue, stringToArray } from '#components/value-editor/converter';
import { csvFormatHint, jsonHint } from '#components/value-editor/hints';
import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import CsvReader from '#lib/csvreader';
import {
    hasValuesIterator,
    isArrayBuffer,
    isJsonSerializableArray,
    isNumber,
} from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import { decodeFromFile } from '#lib/decode-string';
import { requiredArguments } from '#lib/value-formatter';

export default class ArrayField extends Field {
    constructor(args: ValueFieldArgs) {
        super(args);
        if (this.isFormEditable(args.value)) {
            this.state.inputMethod = 'form';
        }
    }
    view() {
        return valueControlsTextareaView(this);
    }
    get value(): unknown[] {
        return this.state.value as [];
    }
    set value(value: unknown) {
        let result: unknown[] = [];
        if (Array.isArray(value)) {
            result = value;
        } else if (value instanceof Map) {
            result = [...value.entries()];
        } else if (hasValuesIterator(value)) {
            result = Array.from([...value.values()]);
        } else if (typeof value === 'string') {
            result = stringToArray(value);
        } else if (isNumber(value)) {
            result = [Number(value)];
        } else if (isArrayBuffer(value)) {
            const view = new Uint8Array(value);
            result = Array.from([...view.values()]);
        } else if (value instanceof DOMPointReadOnly) {
            result = requiredArguments(
                [value.x, value.y, value.z, value.w],
                [0, 0, 0, 1],
            );
        } else if (value instanceof DOMRectReadOnly) {
            result = requiredArguments(
                [value.x, value.y, value.width, value.height],
                [0, 0, 0, 0],
            );
        } else if (value instanceof DOMMatrixReadOnly) {
            result = Array.from(value.toFloat64Array());
        }
        this.state.value = result;
    }
    toFormValue(): string {
        const options = this.formOptions();
        if (this.state.inputMethod === 'form' && options.expanded) {
            return arrayToFieldValue(this.value, this, {
                ...options,
                escapeForJson: true,
            });
        } else {
            return this.stringFormatter.render(this.value, 'array', options);
        }
    }
    fromFormValue(): unknown[] | undefined {
        const textarea = this.node.value;
        if (textarea instanceof HTMLTextAreaElement) {
            let value = [];
            try {
                const parsed = JSON.parse(textarea.value);
                if (Array.isArray(parsed)) {
                    value = parsed;
                }
            } catch {} // eslint-disable-line no-empty
            return value;
        }
    }
    isFormEditable(value: unknown) {
        return !Array.isArray(value) || isJsonSerializableArray(value);
    }
    validateTextareaValue(value: string) {
        return Array.isArray(JSON.parse(value));
    }
    invalidTextareaHint = 'The form value must be an array in json syntax!';
    override async handleUploadedValue(file: File) {
        const content = await decodeFromFile(file, this.state.uploadCharset);
        const csv = new CsvReader();
        await csv.init(content);
        const data = csv.getData();
        const value = data.length === 1 ? data[0] : data;
        this.state.formOptions.expanded = this.state.formOptions.expanded =
            value.length < isLarge('array');
        this.update(value);
    }
    hints = {
        form: jsonHint('Array', '["a string", null, true, 123]'),
        'csv-upload': () => `Single-line files are imported as one-dimensional
arrays; multi-line files as two-dimensional arrays.

${csvFormatHint()}

A ${this.uploadCharset} encoded file is expected.`,
    };
}
