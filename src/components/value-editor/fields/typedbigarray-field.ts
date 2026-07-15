/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import Field from '#components/value-editor/fields/field';
import { isLargeValue } from '#components/value-editor/checkings';
import { stringToArrayOfBigInt } from '#components/value-editor/converter';
import type { RequiredVariables } from '#components/js-codearea';
import CsvReader from '#lib/csvreader';
import { getType, hasValuesIterator, isArrayBuffer } from '#lib/datatypes';
import { inputMethods, isLarge, itemsPerLine } from '#lib/datatype-attributes';
import { formattedNumericArray, formatterOptions } from '#lib/value-formatter';

type TypedBigArrayFieldTypes = BigInt64Array | BigUint64Array;

interface TypedBigArrayConstructor<T extends TypedBigArrayFieldTypes> {
    new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T;
    readonly BYTES_PER_ELEMENT: number;
}

export default abstract class TypedBigArrayField extends Field {
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
    abstract override get value(): TypedBigArrayFieldTypes;
    abstract override set value(value: unknown);
    abstract typeConstructor(): TypedBigArrayConstructor<TypedBigArrayFieldTypes>;

    /* used by the value setters of the derived classes */
    toArray(value: unknown): bigint[] {
        let result: bigint[] = [];
        if (hasValuesIterator(value)) {
            try {
                result = [...value.values()].map((val) => BigInt(val as any));
            } catch {} // eslint-disable-line no-empty
        } else if (isArrayBuffer(value)) {
            const constructor = this.typeConstructor();
            const length = Math.floor(value.byteLength / constructor.BYTES_PER_ELEMENT);
            const view = new constructor(structuredClone(value), 0, length);
            result = Array.from([...view.values()]);
        } else if (typeof value === 'number') {
            result = [BigInt(value)];
        } else if (typeof value === 'string') {
            result = stringToArrayOfBigInt(value);
        } else {
            try {
                result = Array.from(value as any);
            } catch {} // eslint-disable-line no-empty
        }
        return result;
    }
    toFormValue(): string {
        const value = this.value;
        const perLine = itemsPerLine(this.state.type);
        const options = formatterOptions({ perLine });
        return this.state.inputMethod === 'form' && options.expanded
            ? formattedNumericArray(value, 'array', options)
            : this.stringFormatter.render(value, getType(value), options);
    }
    invalidTextareaHint =
        'The form value must be a list of integer numbers separated by commas, semicolons, or bars ( , ; | ) !';
    validateTextareaValue(value: string) {
        return (
            value.trim().length === 0 ||
            stringToArrayOfBigInt(value).length > 0 ||
            value.replaceAll(' ', '') === '[]'
        );
    }
    override async handleUploadedValue(file: File) {
        if (!this.textarea || !this.codearea) return;
        const csv = new CsvReader();
        await csv.init(file);
        const data = csv.getData();
        const value = data.length === 1 ? data[0] : data.map((row: unknown[]) => row[0]);
        this.state.formOptions.expanded = this.state.codeOptions.expanded =
            value.length < isLarge(this.state.type);
        this.update(value);
    }
}
