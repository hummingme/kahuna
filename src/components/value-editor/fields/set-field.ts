/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { csvFormatHint, jsonHint } from '#components/value-editor/hints';
import { arrayToFieldValue, stringToArray } from '#components/value-editor/converter';
import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import CsvReader from '#lib/csvreader';
import { hasValuesIterator, isNumber } from '#lib/datatypes';
import { decodeFromFile } from '#lib/decode-string';
import { requiredArguments } from '#lib/value-formatter';

export default class SetField extends Field {
    view() {
        return valueControlsTextareaView(this);
    }
    set value(value: unknown) {
        let result: Set<unknown> = new Set();
        if (value instanceof Set) {
            result = value;
        } else if (hasValuesIterator(value)) {
            result = new Set([...value.values()]);
        } else if (typeof value === 'string') {
            result = new Set(stringToArray(value));
        } else if (isNumber(value)) {
            result = new Set([Number(value)]);
        } else if (value instanceof DOMPointReadOnly) {
            const args = requiredArguments(
                [value.x, value.y, value.z, value.w],
                [0, 0, 0, 1],
            );
            result = new Set(args);
        } else if (value instanceof DOMRectReadOnly) {
            const args = requiredArguments(
                [value.x, value.y, value.width, value.height],
                [0, 0, 0, 0],
            );
            result = new Set(args);
        }
        this.state.value = result;
    }
    get value(): Set<unknown> {
        return this.state.value as Set<unknown>;
    }
    toFormValue(): string {
        const options = this.formOptions();
        return this.state.inputMethod === 'form' && options.expanded
            ? arrayToFieldValue(
                  [...this.value.values()],
                  this,
                  Object.assign(options, { escapeForJson: true }),
              )
            : this.stringFormatter.render(this.value, 'set', options);
    }
    fromFormValue(): Set<unknown> | undefined {
        if (this.state.inputMethod === 'form') {
            const textarea = this.node.value;
            if (textarea instanceof HTMLTextAreaElement) {
                let value = new Set();
                try {
                    const parsed = JSON.parse(textarea.value);
                    if (Array.isArray(parsed)) {
                        value = new Set(parsed);
                    }
                } catch {} // eslint-disable-line no-empty
                return value;
            }
        }
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
        const result = data.length > 0 ? new Set(data[0]) : new Set();
        this.update(result);
    }
    hints = {
        form: jsonHint('Set', '["one", -1.7, false]'),
        'csv-upload': () => `The values from the first line of the file are used.

${csvFormatHint()}

A ${this.uploadCharset} encoded file is expected.
`,
    };
}
