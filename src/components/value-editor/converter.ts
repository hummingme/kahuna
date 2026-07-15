/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { isNumber } from '#lib/datatypes';
import { itemsPerLine } from '#lib/datatype-attributes';
import {
    formattedNumericArray,
    FormatterOptions,
    formatterOptions,
} from '#lib/value-formatter';

export function stringToArray(value: string) {
    let result: (number | string)[] = [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            result = parsed;
        }
    } catch {} // eslint-disable-line no-empty
    if (result.length === 0) {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            value = value.slice(1, value.length - 1);
        }
        const parts = splitString(value);
        result = parts.map((val) => (isNumber(val) ? Number(val) : val));
    }
    return result;
}

export function stringToArrayOfNumbers(value: string): number[] {
    const values = stringToArray(value).map(Number);
    return values.length > 0 && values.every(Number.isFinite) ? values : [];
}
export function stringToArrayOfFloats(value: string) {
    const values = stringToArray(value);
    if (values.length === 0) return [];
    return values.every(checkFloatArrayValue) ? values.map(Number) : [];
}

function checkFloatArrayValue(val: string | number) {
    return (
        Number.isFinite(Number(val)) ||
        val === 'NaN' ||
        val === Infinity ||
        val === -Infinity
    );
}

export function stringToArrayOfBigInt(value: string) {
    let result: bigint[] = [];
    const values = stringToArray(value);
    try {
        result = values.map((val) => BigInt(val));
    } catch {} // eslint-disable-line no-empty
    return result;
}

function splitString(value: string) {
    return value.trim().split(/\s*(?:;|,|\||$)\s*/);
}

export function stringToNameMessage(value: string) {
    let message = value,
        name = '';
    const index = value.indexOf(':');
    if (index !== -1) {
        name = value.slice(0, index).trim();
        message = value.slice(index + 1).trim();
        if (/^[a-zA-Z]+$/.test(name)) {
            return { name, message };
        }
    }
    return { name, message };
}

export function arrayToBigUint64Array(values: bigint[]) {
    const buffer = new ArrayBuffer(8 * values.length);
    const view = new DataView(buffer);
    const result = new BigUint64Array(buffer);
    for (let i = 0; i < values.length; i++) {
        try {
            view.setBigUint64(i * 8, values[i], true);
        } catch (_e) {
            view.setBigUint64(i * 8, 0n, true);
        }
    }
    return result;
}

export function arrayToBigInt64Array(values: bigint[]) {
    const buffer = new ArrayBuffer(8 * values.length);
    const view = new DataView(buffer);
    const result = new BigInt64Array(buffer);
    for (let i = 0; i < values.length; i++) {
        try {
            view.setBigInt64(i * 8, values[i], true);
        } catch (_e) {
            view.setBigInt64(i * 8, 0n, true);
        }
    }
    return result;
}

export function copyArrayBuffer(from: ArrayBuffer, to: ArrayBuffer) {
    const fromView = new DataView(from);
    const toView = new DataView(to);
    for (let i = 0; i < to.byteLength; i++) {
        const byte = i < from.byteLength ? fromView.getUint8(i) : 0;
        toView.setUint8(i, byte);
    }
    return to;
}

export function arrayToFieldValue(
    value: unknown[],
    field: Field,
    opts: Partial<FormatterOptions> = {},
): string {
    const isNumeric = value.every((v) => Number.isFinite(v));
    const expanded = field.state.formOptions.expanded;
    const perLine = itemsPerLine(field.state.type);
    const options = formatterOptions(Object.assign(opts, { expanded, perLine }));
    if (expanded === false) {
        return field.stringFormatter.render(value, 'array', options);
    } else if (isNumeric) {
        return formattedNumericArray(value as number[], 'array', options);
    } else {
        return field.sourceFormatter.render(value, 'array', options);
    }
}
