/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { type TypedArrayType, getType, typedarrayTypes } from './datatypes.ts';

type WrappedType = 'date' | 'bigint64array' | 'biguint64array' | 'arraybuffer' | 'bigint';

interface WrappedValue {
    idxdbmType: WrappedType;
    value: string;
}

/**
 * replacer function for JSON.stringify(value, replacer) with support for
 * index datatypes not natively supported (Date, ArrayBuffer, TypedArrays)
 * and BigInt64Array/BigUint64Array as needed by encodeQueryResult()
 */
export function replacer(_key: unknown, value: any): object | WrappedValue {
    if (typeof value !== 'object') {
        return value;
    }
    const type = getType(value);
    if (type === 'date') {
        return {
            idxdbmType: 'date',
            value: JSON.stringify(value),
        };
    }
    if (typedarrayTypes.includes(type as TypedArrayType)) {
        let val = [...value.values()];
        if (['bigint64array', 'biguint64array'].includes(type)) {
            val = val.map((v) => v.toString());
        }
        return {
            idxdbmType: type,
            value: val,
        };
    }
    if (type === 'arraybuffer') {
        return {
            idxdbmType: 'arraybuffer',
            value: new Int8Array(value),
        };
    }
    if (type === 'bigint') {
        return {
            idxdbmType: 'bigint',
            value: value.toString(),
        };
    }
    return value;
}

export const reviver = (_key: string, value: WrappedValue | any): any => {
    if (typeof value === 'object' && value !== null && 'idxdbmType' in value) {
        if (value.idxdbmType === 'date') {
            return new Date(value.value);
        }
        if (typedarrayTypes.includes(value.idxdbmType)) {
            if (value.idxdbmType === 'bigint64array') {
                return new BigInt64Array(value.value.map((val: string) => BigInt(val)));
            }
            if (value.idxdbmType === 'biguint64array') {
                return new BigUint64Array(value.value.map((val: string) => BigInt(val)));
            }
        }
    }
    return value;
};
