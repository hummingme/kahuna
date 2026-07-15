/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export function escapeUnicode(input: string, unescapedLineFeeds = false) {
    let out = '';
    const rx = /\p{C}|\p{Z}|\\/u; // unicode categories Separator and Other
    for (const ch of input) {
        const cp = ch.codePointAt(0)!;
        const keepUnescaped = cp === 0x20 || (unescapedLineFeeds && cp === 0x0a);
        if (keepUnescaped || !rx.test(ch)) {
            out += ch;
            continue;
        }
        const short = shortEscapesMap.get(ch);
        if (short !== undefined) {
            out += short;
            continue;
        }
        out +=
            cp <= 0xff
                ? '\\x' + cp.toString(16).padStart(2, '0')
                : cp <= 0xffff
                  ? '\\u' + cp.toString(16).padStart(4, '0')
                  : '\\u{' + cp.toString(16) + '}';
    }
    return out;
}

export function escapeLF(input: string): string {
    return input.replaceAll('\n', '\\n');
}

export function escapeCR(input: string) {
    return input.replaceAll('\r', '\\r');
}

export function unescapeUnicode(input: string): string {
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

export function escapeUnicodeForJson(
    input: string,
    escapeNonCharacters: boolean,
): string {
    let out = '';
    const rx = /\p{C}|\p{Z}/u; // unicode categories Separator and Other
    for (const ch of input) {
        const short = jsonShortEscapesMap.get(ch);
        if (short !== undefined) {
            out += short;
            continue;
        }
        const cp = ch.codePointAt(0)!;
        if (cp <= 0x1f) {
            out += '\\u' + cp.toString(16).padStart(4, '0');
            continue;
        }
        if (escapeNonCharacters && cp !== 0x20 && rx.test(ch)) {
            if (cp <= 0xffff) {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            } else {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out +=
                    '\\u' +
                    hi.toString(16).padStart(4, '0') +
                    '\\u' +
                    lo.toString(16).padStart(4, '0');
            }
            continue;
        }
        out += ch;
    }
    return out;
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

function toShortEscapesMap(escapes: Record<string, string>): Map<string, string> {
    return new Map(
        Object.entries(escapes).map(([k, v]: [string, string]) => [v, '\\' + k]),
    );
}
