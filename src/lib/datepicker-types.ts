/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import env from '#lib/environment';
import { DatepickerType } from '#types';

export const datepickerTypeOptions = [
    'year',
    'month',
    'date',
    'datetime',
    'millisecond',
] as const;

export function isDatepickerTypeOption(val: string): val is DatepickerType {
    return datepickerTypeOptions.includes(val as DatepickerType);
}

export function datepickerAttributes(type: DatepickerType) {
    const attributesMap = {
        year: {
            type: 'number',
            min: '-271821',
            max: '275760',
            step: '1',
            style: 'width: 7ch',
        },
        month: env.isFirefox
            ? { type: 'text', pattern: '\\d{4}-(0[1-9]|1[0-2])', style: 'width: 8ch' }
            : { type: 'month' },
        date: { type: 'date' },
        datetime: { type: 'datetime-local', step: '1' },
        millisecond: { type: 'datetime-local', step: '0.001' },
    };
    return attributesMap[type] ?? {};
}
