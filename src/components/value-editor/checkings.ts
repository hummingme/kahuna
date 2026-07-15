/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { sizeOrLength } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';

export function isNumbersArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((val) => Number.isFinite(val));
}

export function isArgsNumbersArray(value: unknown, max: number): value is number[] {
    return isNumbersArray(value) && value.length <= max;
}

export function isArgsNumbersList(value: string, max: number) {
    const args = value.split(',').map((arg) => Number(arg));
    return isArgsNumbersArray(args, max);
}

export function isFileBufferSource(value: unknown): value is BufferSource {
    return (
        (value instanceof ArrayBuffer && value.resizable !== true) ||
        (ArrayBuffer.isView(value) &&
            value.buffer instanceof ArrayBuffer &&
            value.buffer.resizable !== true)
    );
}

export function isBlobPart(value: unknown): value is BlobPart {
    return (
        typeof value === 'string' || value instanceof Blob || isFileBufferSource(value)
    );
}

export function isFileBits(value: unknown): value is BlobPart[] {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every(isBlobPart);
}

export function isLargeValue(field: Field): boolean {
    const { value, type } = field.state;
    if ('isLarge' in field && typeof field['isLarge'] === 'function') {
        return field['isLarge']();
    }
    const size = sizeOrLength(value);
    if (size !== undefined) {
        return size >= isLarge(type);
    }
    return false;
}
