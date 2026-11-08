/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { subTimezoneOffset } from './timezone';
import {
    Column,
    ColumnFormat,
    DatepickerType,
    Datespan,
    DateSearchVal,
    Filter,
    PreparedFilter,
} from '#types';

export const toIsoString = (str: string): string => {
    // extract sign if present, default to positive '+'
    let sign = '+';
    if (str.startsWith('+') || str.startsWith('-')) {
        sign = str[0];
        str = str.slice(1);
    }

    // split components by standard date/time delimiters
    const parts = str.split(/[-T:.Z]/);

    const year = (parts[0] || '0').padStart(6, '0');
    const month = (parts[1] || '1').padStart(2, '0');
    const day = (parts[2] || '1').padStart(2, '0');
    const hour = (parts[3] || '0').padStart(2, '0');
    const minute = (parts[4] || '0').padStart(2, '0');
    const second = (parts[5] || '0').padStart(2, '0');
    const millisecond = (parts[6] || '0').padEnd(3, '0').slice(0, 3);

    return `${sign}${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}Z`;
};

export const datespanSearchValues = (
    start: DateSearchVal,
    filter: PreparedFilter,
    column: Column,
    useLocalTimezone: boolean,
) => {
    const { datespan } = filter;
    const end = addDatespan(start, datespan, column.format, useLocalTimezone);
    return { above: start, below: end };
};

type DateOps = {
    addYears: (d: Date, n: number) => void;
    addMonths: (d: Date, n: number) => void;
    addDays: (d: Date, n: number) => void;
    startOfDay: (d: Date) => void;
};

const utcOps: DateOps = {
    addYears: (d, n) => d.setUTCFullYear(d.getUTCFullYear() + n),
    addMonths: (d, n) => d.setUTCMonth(d.getUTCMonth() + n),
    addDays: (d, n) => d.setUTCDate(d.getUTCDate() + n),
    startOfDay: (d) => d.setUTCHours(0, 0, 0, 0),
};

const localOps: DateOps = {
    addYears: (d, n) => d.setFullYear(d.getFullYear() + n),
    addMonths: (d, n) => d.setMonth(d.getMonth() + n),
    addDays: (d, n) => d.setDate(d.getDate() + n),
    startOfDay: (d) => d.setHours(0, 0, 0, 0),
};

const getDateOps = (useLocalTimezone: boolean): DateOps =>
    useLocalTimezone ? localOps : utcOps;

const ISO_PARTS = /^([+-])(\d{6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

export const parseSearchDate = (search: string, useLocalTimezone: boolean): Date => {
    const iso = toIsoString(search);
    if (!useLocalTimezone) return new Date(iso);

    const matches = ISO_PARTS.exec(iso);
    if (!matches) return new Date(iso);

    const [, sign, y, mo, d, h, mi, s, ms] = matches;
    const date = new Date(2000, 0, 1); // avoids the two-digit-year quirk of the Date constructor
    date.setFullYear(Number(sign + y), Number(mo) - 1, Number(d));
    date.setHours(Number(h), Number(mi), Number(s), Number(ms));
    return date;
};

export const increaseDateValue = (
    date: Date,
    period: DatepickerType,
    useLocalTimezone: boolean,
) => {
    const ops = getDateOps(useLocalTimezone);
    switch (period) {
        case 'year':
            ops.addYears(date, 1);
            break;
        case 'month':
            ops.addMonths(date, 1);
            break;
        case 'date':
            ops.addDays(date, 1);
            break;
        case 'datetime':
            date.setTime(date.getTime() + 1000);
            break;
        case 'millisecond':
            date.setTime(date.getTime() + 1);
            break;
    }
    return date;
};

export const decreaseDateValue = (
    date: Date,
    period: DatepickerType,
    useLocalTimezone: boolean,
) => {
    const ops = getDateOps(useLocalTimezone);
    switch (period) {
        case 'year':
            ops.addYears(date, -1);
            break;
        case 'month':
            ops.addMonths(date, -1);
            break;
        case 'date':
            ops.addDays(date, -1);
            break;
        case 'datetime':
            date.setTime(date.getTime() + 1000);
            break;
        case 'millisecond':
            date.setTime(date.getTime() - 1);
            break;
    }
    return date;
};

export const datepickerSearchValue = (
    filter: Filter,
    useLocalTimezone: boolean,
): Date => {
    const { datepicker, includeBounds, method, search } = filter;
    const baseDate = parseSearchDate(search, useLocalTimezone);
    if (!datepicker) return baseDate;

    if (method === 'below' && includeBounds) {
        increaseDateValue(baseDate, datepicker, useLocalTimezone);
    } else if (method === 'above' && !includeBounds) {
        increaseDateValue(baseDate, datepicker, useLocalTimezone);
        baseDate.setTime(baseDate.getTime() - 1);
    }
    return baseDate;
};

// returns the exclusive end of the span (start of the next period)
export function addDatespan(
    value: DateSearchVal,
    datespan: Datespan,
    format: ColumnFormat,
    useLocalTimezone: boolean,
): DateSearchVal {
    if (!datespan) return value;
    const isTimestamp = typeof value === 'number';
    const date = new Date(isTimestamp && format === 'date/1000' ? value * 1000 : value);
    const ops = getDateOps(useLocalTimezone);

    switch (datespan) {
        case 'year':
            if (useLocalTimezone) {
                date.setMonth(0, 1);
            } else {
                date.setUTCMonth(0, 1);
            }
            ops.addYears(date, 1);
            ops.startOfDay(date);
            break;
        case 'month':
            if (useLocalTimezone) {
                date.setDate(1);
            } else {
                date.setUTCDate(1);
            }
            ops.addMonths(date, 1);
            ops.startOfDay(date);
            break;
        case 'day':
            ops.addDays(date, 1);
            ops.startOfDay(date);
            break;
    }
    return isTimestamp
        ? format === 'date/1000'
            ? date.getTime() / 1000
            : date.getTime()
        : date;
}

export function toDatepickerValue(
    date: Date,
    period: DatepickerType,
    useLocalTimezone: boolean,
) {
    // adjust so the UTC fields hold the local wall-clock components
    const adjusted = useLocalTimezone ? subTimezoneOffset(date) : date;
    let str = adjusted.toISOString();
    switch (period) {
        case 'year': {
            if (str.length === 24) {
                str = `+00${str}`;
            }
            const sign = str[0];
            const trimmedYear = str.substring(1, 7).replace(/^0+/, '');
            const finalYear = trimmedYear === '' ? '0' : trimmedYear;
            return sign === '-' ? `-${finalYear}` : finalYear;
        }
        case 'month':
            return str.substring(0, 7); // YYYY-MM
        case 'date':
            return str.substring(0, 10); // YYYY-MM-DD
        case 'datetime':
            return str.substring(0, 19); // YYYY-MM-DDTHH:mm:ss
        case 'millisecond':
            return str.substring(0, 23); // YYYY-MM-DDTHH:mm:ss.sss
    }
}
