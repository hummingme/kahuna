/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { replacer, reviver } from './json-wrapper.ts';
import { getType } from './datatypes.ts';
import type { PlainObject } from './types/common.ts';

export const encodeQueryResult = (data: PlainObject[]) => {
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

export const decodeQueryResult = (data: PlainObject[]) => {
    data = structuredClone(data);
    data.forEach((row, index) => {
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'object' && value !== null) {
                if (['bigint64array', 'biguint64array'].includes(value.idxdbmType)) {
                    row[key] = JSON.parse(value.value, reviver);
                }
            }
        }
        data[index] = row;
    });

    return data;
};
