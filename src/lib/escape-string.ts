/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { formatterOptions, type FormatterOptions } from '#lib/value-formatter';

export function escapeUnicode(input: string, escapeLf = false, escapeCr = false) {
    const rx = /\p{C}|\p{Z}/u; // unicode categories Separator and Other
    return escapeString(
        input,
        (ch, cp) =>
            cp === 0x20 ||
            (!escapeLf && cp === 0x0a) ||
            (!escapeCr && cp === 0x0d) ||
            !rx.test(ch),
    );
}

export function escapeAscii(input: string, escapeLf = false, escapeCr = false) {
    return escapeString(
        input,
        (_, cp) =>
            (cp >= 0x20 && cp <= 0x7e) ||
            (!escapeLf && cp === 0x0a) ||
            (!escapeCr && cp === 0x0d),
    );
}

export function escapeJsonString(
    input: string,
    escapeNonCharacters: boolean,
    escapeNonAscii: boolean,
): string {
    const rx = /\p{C}|\p{Z}/u;
    return escapeString(
        input,
        (ch, cp) =>
            !jsonShortEscapesMap.has(ch) &&
            cp > 0x1f &&
            (!escapeNonCharacters || cp === 0x20 || !rx.test(ch)) &&
            (!escapeNonAscii || cp <= 0x7e),
        jsonShortEscapesMap,
        escapeJsonCodePoint,
    );
}

function escapeString(
    input: string,
    keepUnescaped: (ch: string, cp: number) => boolean,
    shortEscMap: Map<string, string> = shortEscapesMap,
    escaper: (cp: number) => string = escapeCodePoint,
): string {
    let out = '';
    for (const ch of input) {
        const cp = ch.codePointAt(0)!;
        if (keepUnescaped(ch, cp)) {
            out += ch;
            continue;
        }
        const short = shortEscMap.get(ch);
        if (short !== undefined) {
            out += short;
            continue;
        }
        out += escaper(cp);
    }
    return out;
}

function escapeCodePoint(cp: number): string {
    return cp <= 0xff
        ? '\\x' + cp.toString(16).padStart(2, '0')
        : cp <= 0xffff
          ? '\\u' + cp.toString(16).padStart(4, '0')
          : '\\u{' + cp.toString(16) + '}';
}

function escapeJsonCodePoint(cp: number): string {
    if (cp <= 0xffff) {
        return '\\u' + cp.toString(16).padStart(4, '0');
    }
    const v = cp - 0x10000;
    const hi = 0xd800 + (v >> 10);
    const lo = 0xdc00 + (v & 0x3ff);
    return (
        '\\u' +
        hi.toString(16).padStart(4, '0') +
        '\\u' +
        lo.toString(16).padStart(4, '0')
    );
}

export function escapeLfCr(input: string) {
    return input.replace(/[\r\n]/g, (match) => (match === '\n' ? '\\n' : '\\r'));
}

export function escapeLF(input: string): string {
    return input.replaceAll('\n', '\\n');
}

export function escapeCR(input: string) {
    return input.replaceAll('\r', '\\r');
}

export function escapeBackslashes(input: string) {
    return input.replaceAll('\\', '\\\\');
}

const shortEscapes: Record<'0' | 'b' | 't' | 'n' | 'v' | 'f' | 'r' | '\\', string> = {
    '0': '\0',
    b: '\b',
    t: '\t',
    n: '\n',
    v: '\v',
    f: '\f',
    r: '\r',
    '\\': '\\',
};

const shortEscapesMap = toShortEscapesMap(shortEscapes);

const jsonShortEscapes: Record<'b' | 't' | 'n' | 'f' | 'r' | '\\' | '"', string> = {
    b: '\b',
    t: '\t',
    n: '\n',
    f: '\f',
    r: '\r',
    '\\': '\\',
    '"': '"',
};

const jsonShortEscapesMap = toShortEscapesMap(jsonShortEscapes);

function toShortEscapesMap(escapes: Record<string, string>): Map<string, string> {
    return new Map(
        Object.entries(escapes).map(([k, v]: [string, string]) => [v, '\\' + k]),
    );
}

export function escapeByOptions(str: string, options: FormatterOptions): string {
    const { escapeBackslash, escapeNonAscii, escapeNonCharacters, escapeCr, escapeLf } =
        options;
    if (escapeBackslash) {
        str = escapeBackslashes(str);
    }
    if (escapeNonAscii) {
        return escapeAscii(str, escapeLf, escapeCr);
    }
    if (escapeNonCharacters) {
        return escapeUnicode(str, escapeLf, escapeCr);
    }
    if (escapeLf && escapeCr) {
        return escapeLfCr(str);
    }
    if (escapeLf) {
        return escapeLF(str);
    }
    if (escapeCr) {
        return escapeCR(str);
    }
    return str;
}

export function print(str: string): string {
    return escapeByOptions(str, {
        ...formatterOptions({
            escapeNonCharacters: true,
            escapeLf: true,
            escapeCr: true,
            escapeBackslash: true,
        }),
    });
}

export function unescapeString(input: string): string {
    return input.replace(
        /\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]+)\}|([0btnvfr\\]))/g,
        (_, hex2, hex4, hexBrace, esc) => {
            if (hex2 !== undefined) {
                return String.fromCharCode(parseInt(hex2, 16));
            }
            if (hex4 !== undefined) {
                return String.fromCharCode(parseInt(hex4, 16));
            }
            if (hexBrace !== undefined) {
                return String.fromCodePoint(parseInt(hexBrace, 16));
            }
            return shortEscapes[esc as keyof typeof shortEscapes];
        },
    );
}
