/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { type EncodableCharset, isSBCS } from './charsets';
import { type SBCSCharset } from '#lib/charsets';

export function encodeString(
    str: string,
    label: EncodableCharset,
): Uint8Array<ArrayBuffer> {
    if (label === 'utf-8') {
        return new TextEncoder().encode(str);
    } else if (isSBCS(label)) {
        return encodeSbcs(str, label);
    } else if (label === 'utf-16be' || label === 'utf-16le') {
        const isLittle = label === 'utf-16le';
        return encodeUTF16(str, isLittle);
    } else {
        throw new Error(`encodeString() called withs unsupportet charset ${label}`);
    }
}

const sbcsEncoderCache = new Map<string, Uint16Array>();

function getSbcsEncoderTable(label: SBCSCharset): Uint16Array {
    let table = sbcsEncoderCache.get(label);
    if (table) return table;

    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const decoded = new TextDecoder(label).decode(bytes);
    table = new Uint16Array(65536);
    table.fill(0xffff);
    for (let b = 0; b < decoded.length; b++) {
        const cp = decoded.charCodeAt(b);
        if (table[cp] === 0xffff) table[cp] = b;
    }
    sbcsEncoderCache.set(label, table);
    return table;
}

function encodeSbcs(str: string, label: SBCSCharset): Uint8Array<ArrayBuffer> {
    const table = getSbcsEncoderTable(label);
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        const cp = str.charCodeAt(i);
        const b = table[cp];
        out[i] = b === 0xffff ? 0x3f : b; // '?' fallback
    }
    return out;
}

function encodeUTF16(str: string, isLittle: boolean): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(str.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < str.length; i++) {
        view.setUint16(i * 2, str.charCodeAt(i), isLittle);
    }
    return out;
}
