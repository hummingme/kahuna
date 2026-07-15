/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

/**
 * labels of character supported by the TextDecoder api
 * https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings
 */
export const CHARSETS = [
    'utf-8',
    'ibm866',
    'iso-8859-2',
    'iso-8859-3',
    'iso-8859-4',
    'iso-8859-5',
    'iso-8859-6',
    'iso-8859-7',
    'iso-8859-8',
    'iso-8859-8-i',
    'iso-8859-10',
    'iso-8859-13',
    'iso-8859-14',
    'iso-8859-15',
    'iso-8859-16',
    'koi8-r',
    'koi8-u',
    'macintosh',
    'windows-874',
    'windows-1250',
    'windows-1251',
    'windows-1252',
    'windows-1253',
    'windows-1254',
    'windows-1255',
    'windows-1256',
    'windows-1257',
    'windows-1258',
    'x-mac-cyrillic',
    'gbk',
    'gb18030',
    'big5',
    'euc-jp',
    'iso-2022-jp',
    'shift_jis',
    'euc-kr',
    'utf-16be',
    'utf-16le',
] as const;

export type Charset = (typeof CHARSETS)[number];

export function isCharset(label: string): label is Charset {
    return CHARSETS.includes(label as Charset);
}

export function isSBCS(label: string): label is Exclude<Charset, NonSBCS> {
    return !NON_SBCS.includes(label as NonSBCS);
}

const NON_SBCS = [
    'utf-8',
    'utf-16be',
    'utf-16le',
    'gbk',
    'gb18030',
    'big5',
    'euc-jp',
    'iso-2022-jp',
    'shift_jis',
    'euc-kr',
] as const;

type NonSBCS = (typeof NON_SBCS)[number];

const _SBCS = CHARSETS.filter(isSBCS);

export type SBCSCharset = (typeof _SBCS)[number];

const NON_ENCODABLE_CHARSETS = [
    'gbk',
    'gb18030',
    'big5',
    'euc-jp',
    'iso-2022-jp',
    'shift_jis',
    'euc-kr',
] as const;

type NonEncodableCharset = (typeof NON_ENCODABLE_CHARSETS)[number];

export function isEncodableCharset(label: string): label is EncodableCharset {
    return !NON_ENCODABLE_CHARSETS.includes(label as NonEncodableCharset);
}

export type EncodableCharset = Exclude<Charset, NonEncodableCharset>;

export function encodableCharsets(): EncodableCharset[] {
    return CHARSETS.filter(isEncodableCharset);
}
