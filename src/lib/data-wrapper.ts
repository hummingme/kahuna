/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { replacer, reviver } from '#lib/json-wrapper';
import { getType } from '#lib/datatypes';
import type { UnknownRecord } from '#types';

export const encodeQueryResult = (data: UnknownRecord[]) => {
    let encoded = false;
    data.map((row) => {
        for (const [key, value] of Object.entries(row)) {
            const type = getType(value);
            if (['bigint64array', 'biguint64array'].includes(type)) {
                row[key] = {
                    idxdbmType: type,
                    value: JSON.stringify(value, replacer),
                };
                encoded = true;
            }
        }
    });
    return { data, encoded };
};

export const encodeValue = (value: unknown) => {
    const type = getType(value);
    return ['bigint64array', 'biguint64array'].includes(type)
        ? {
              idxdbmType: type,
              value: JSON.stringify(value, replacer),
          }
        : value;
};

type EncodedValue = {
    idxdbmType: 'bigint64array' | 'biguint64array';
    value: string;
};

export const decodeQueryResult = (data: UnknownRecord[]) => {
    data = structuredClone(data);
    data.forEach((row, index) => {
        for (const [key, value] of Object.entries(row)) {
            if (isEncoded(value)) {
                row[key] = JSON.parse(value!.value, reviver);
            }
        }
        data[index] = row;
    });
    return data;
};

export const decodeValue = (value: unknown) => {
    let result = structuredClone(value);
    if (isEncoded(result)) {
        result = JSON.parse(result.value, reviver);
    }
    return result;
};

const isEncoded = (value: unknown): value is EncodedValue => {
    return (
        typeof value === 'object' &&
        value !== null &&
        'idxdbmType' in value &&
        typeof value.idxdbmType === 'string' &&
        ['bigint64array', 'biguint64array'].includes(value.idxdbmType) &&
        'value' in value &&
        typeof value.value === 'string'
    );
};
