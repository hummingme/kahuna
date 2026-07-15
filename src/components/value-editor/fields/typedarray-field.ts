/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import Field from '#components/value-editor/fields/field';
import { isLargeValue } from '#components/value-editor/checkings';
import {
    stringToArrayOfFloats,
    stringToArrayOfNumbers,
} from '#components/value-editor/converter';
import type { RequiredVariables } from '#components/js-codearea';
import CsvReader from '#lib/csvreader';
import { getType, hasValuesIterator, isArrayBuffer } from '#lib/datatypes';
import { inputMethods, isLarge, itemsPerLine } from '#lib/datatype-attributes';
import { formattedNumericArray, formatterOptions } from '#lib/value-formatter';

type TypedArrayFieldTypes =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float16Array
    | Float32Array
    | Float64Array;

interface TypedArrayConstructor<T extends TypedArrayFieldTypes> {
    new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T;
    readonly BYTES_PER_ELEMENT: number;
}

export default abstract class TypedArrayField extends Field {
    override async init(requireVariables: () => RequiredVariables) {
        const { value, type } = this.state;
        if (value instanceof Blob) {
            // async preparation of the value
            // before using the synchronous setter in super.init()
            this.state.value = await value.arrayBuffer();
        }
        await super.init(requireVariables);
        if (isLargeValue(this) && inputMethods(type).includes('code')) {
            this.inputMethod = 'code';
        }
    }
    view() {
        return valueControlsTextareaView(this);
    }
    abstract override get value(): TypedArrayFieldTypes;
    abstract override set value(value: unknown);
    abstract typeConstructor(): TypedArrayConstructor<TypedArrayFieldTypes>;

    /* used in the value setters of the derived classes */
    toArray(value: unknown): number[] {
        let result: number[] = [];
        if (hasValuesIterator(value)) {
            try {
                result = [...value.values()].map(Number);
            } catch {} // eslint-disable-line no-empty
        } else if (isArrayBuffer(value)) {
            const constructor = this.typeConstructor();
            const length = Math.floor(value.byteLength / constructor.BYTES_PER_ELEMENT);
            const view = new constructor(value, 0, length);
            result = Array.from([...view.values()]);
        } else if (typeof value === 'number') {
            result = [value];
        } else if (typeof value === 'string') {
            result = this.stringToArray(value);
        }
        return result;
    }
    toFormValue(): string {
        const value = this.value;
        const type = this.state.type;
        const perLine = itemsPerLine(type);
        const options = formatterOptions({ perLine });
        return this.state.inputMethod === 'form' && options.expanded
            ? formattedNumericArray(value, type, options)
            : this.stringFormatter.render(value, getType(value), options);
    }
    fromFormValue(): unknown | undefined {
        const textarea = this.node.value;
        if (textarea instanceof HTMLTextAreaElement) {
            const value = this.stringToArray(textarea.value);
            return value;
        }
    }
    validateTextareaValue(value: string) {
        return (
            value.trim().length === 0 ||
            this.stringToArray(value).length > 0 ||
            value.replaceAll(' ', '') === '[]'
        );
    }
    stringToArray(str: string) {
        return this.state.type.startsWith('float')
            ? stringToArrayOfFloats(str)
            : stringToArrayOfNumbers(str);
    }
    invalidTextareaHint =
        'The form value must be an array of numbers or a list of numbers, separated by commas, semicolons, or bars!';
    override async handleUploadedValue(file: File) {
        if (!this.textarea || !this.codearea) return;
        const csv = new CsvReader();
        await csv.init(file);
        const data = csv.getData();
        const value =
            data.length === 1 ? data[0].map((val) => val) : data.map((row) => row[0]);
        this.state.formOptions.expanded = this.state.codeOptions.expanded =
            value.length < isLarge(this.state.type);
        this.update(value);
    }
}
