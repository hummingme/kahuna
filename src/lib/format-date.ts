/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

export function formatUTCDatetime(d: Date) {
    if (Number.isNaN(d.getTime())) return 'Date(NaN)';

    const iso = d.toISOString();
    if (iso.endsWith('-01-01T00:00:00.000Z')) {
        return `Date('${iso.slice(0, 4)}')`;
    }
    if (iso.endsWith('-01T00:00:00.000Z')) {
        return `Date('${iso.slice(0, 7)}')`;
    }
    if (iso.endsWith('T00:00:00.000Z')) {
        return `Date('${iso.slice(0, 10)}')`;
    }
    if (iso.endsWith(':00:00.000Z')) {
        return `Date('${iso.slice(0, 16)}Z')`;
    }
    return `Date('${iso}')`;
}

export function formatLocalDatetime(d: Date, abbreviate = true) {
    if (Number.isNaN(d.getTime())) return 'Date(NaN)';

    const year = pad(d.getFullYear(), 4);
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const ms = pad(d.getMilliseconds(), 3);
    const offset = timezoneOffset(d);
    if (abbreviate && h === '00' && m === '00' && s === '00' && ms === '000') {
        if (day === '01' && month === '01') return `Date('${year}')`;
        if (day === '01') return `Date('${year}-${month}')`;
        return `Date('${year}-${month}-${day}')`;
    }
    const datetime = `${year}-${month}-${day}T${h}:${m}`;
    if (abbreviate && s === '00' && ms === '000') {
        return `Date('${datetime}${offset}')`;
    }
    if (abbreviate && ms === '000') {
        return `Date('${datetime}:${s}${offset}')`;
    }
    return `Date('${datetime}:${s}.${ms}${offset}')`;
}

export function timezoneOffset(d: Date) {
    const offsetMinutes = Math.round(d.getTimezoneOffset());
    const sign = offsetMinutes <= 0 ? '+' : '-';
    const absOffsetMinutes = Math.abs(offsetMinutes);
    const hours = pad(Math.floor(absOffsetMinutes / 60));
    const minutes = pad(absOffsetMinutes % 60);
    return `${sign}${hours}:${minutes}`;
}

const pad = (num: number, size = 2) => String(num).padStart(size, '0');

export function isLMTOffset(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const timeZoneStr = parts.find((p) => p.type === 'timeZoneName')?.value || '';

    // check for locales returning "LMT"
    if (timeZoneStr.includes('LMT')) {
        return true;
    }
    // check for seconds in offset ("GMT+0:53:28" -> 2 colons / 3 segments)
    // UTC offsets only produce 0 colons ("GMT+1") or 1 colon ("GMT+5:30")
    return timeZoneStr.split(':').length === 3;
}
