/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */
import { type Charset, isSBCS } from './charsets';
import { type SBCSCharset } from '#lib/charsets';

export async function decodeFromFile(file: File, label: Charset) {
    let buffer = await file.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer)) {
        // this happens in firefox for uploaded files
        buffer = structuredClone(buffer);
    }
    const bytes = new Uint8Array(buffer);
    if (label === 'utf-8') {
        return await file.text();
    } else if (isSBCS(label)) {
        return decodeSbcs(bytes, label);
    } else if (label === 'utf-16be' || label === 'utf-16le') {
        const endian = label === 'utf-16be' ? 'be' : 'le';
        return decodeUtf16(bytes, endian);
    } else {
        return new TextDecoder(label).decode(bytes);
    }
}

function decodeUtf16(bytes: Uint8Array, endian: 'le' | 'be'): string {
    let result = '';
    for (let i = 0; i < bytes.length; i += 2) {
        const codeUnit =
            endian === 'le'
                ? bytes[i] | (bytes[i + 1] << 8)
                : (bytes[i] << 8) | bytes[i + 1];

        result += String.fromCharCode(codeUnit);
    }
    return result;
}

function decodeSbcs(bytes: Uint8Array, charEncoding: SBCSCharset) {
    let result = '';
    const table = getSbcsDecoderTable(charEncoding);
    for (const byte of bytes) {
        const code = table[byte];
        result += String.fromCharCode(code);
    }
    return result;
}

const sbcsDecoderCache = new Map<string, Uint16Array>();

function getSbcsDecoderTable(label: SBCSCharset): Uint16Array {
    let table = sbcsDecoderCache.get(label);
    if (table) return table;

    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const decoded = new TextDecoder(label).decode(bytes);
    table = new Uint16Array(256);
    for (let b = 0; b < decoded.length; b++) {
        table[b] = decoded.charCodeAt(b) === 0xfffd ? b : decoded.charCodeAt(b);
    }
    sbcsDecoderCache.set(label, table);
    return table;
}
