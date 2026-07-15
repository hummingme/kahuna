/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import {
    getType,
    isTypedArrayType,
    maybeQuotedProperty,
    type TypedArrayType,
} from '#lib/datatypes';
import {
    escapeCR,
    escapeLF,
    escapeUnicode,
    escapeUnicodeForJson,
} from '#lib/escape-unicode';
import quotedString from '#lib/quoted-string';
import type { UnknownRecord } from '#types';

type ValueFormatterMethodNames = {
    [K in keyof ValueFormatter]: ValueFormatter[K] extends (...args: any[]) => any
        ? K
        : never;
}[keyof ValueFormatter];

type ToStringType = Exclude<ValueFormatterMethodNames, 'render'>;

export type AllowedType = TypedArrayType | ToStringType | 'arraybuffer';

export type FormatterOptions = {
    expanded: boolean;
    perLine: number;
    ident: number;
    offset: number;
    valign: boolean;
    escapeNonCharacters: boolean;
    unescapedLineFeeds: boolean;
    escapeForJson: boolean;
    trimLength: number;
};

const defaultFormatterOptions: FormatterOptions = {
    expanded: true,
    perLine: Infinity,
    ident: 2,
    offset: 0,
    valign: true,
    escapeNonCharacters: false,
    unescapedLineFeeds: true,
    escapeForJson: false,
    trimLength: 0,
} as const;

export function formatterOptions(
    options: Partial<FormatterOptions> = {},
): FormatterOptions {
    return { ...defaultFormatterOptions, ...options };
}

type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float16Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

export class ValueFormatter {
    #purpose;
    constructor(purpose: 'string' | 'source') {
        this.#purpose = purpose;
    }
    /**
     * return a string representation of the given value of type
     *
     * all types that can be stored in IndexedDb are supported
     * see: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
     */
    render(value: unknown, type: AllowedType, options: Partial<FormatterOptions> = {}) {
        const opts: FormatterOptions = Object.assign(
            { ...defaultFormatterOptions },
            options,
        );
        return this.#purpose === 'string'
            ? this.#valueToString(value, type, opts)
            : this.#valueToSource(value, type, opts);
    }
    #valueToString(
        value: unknown,
        type: AllowedType,
        options: FormatterOptions = defaultFormatterOptions,
    ): string {
        if (value === undefined && type !== 'undefined') {
            return '';
        } else if (type in this) {
            return this[type as ToStringType](value as never, options);
        } else if (isTypedArrayType(type)) {
            return typedArrayToString(
                value as TypedArray,
                type as TypedArrayType,
                options,
            );
        }
        return 'unidentified object';
    }
    #valueToSource(
        value: unknown,
        type: AllowedType,
        options: FormatterOptions = defaultFormatterOptions,
    ) {
        if (typeof value === 'string') {
            return this.#valueToString(quotedString(value), type, options);
        } else if (isTypedArrayType(type)) {
            return `new ${this.#valueToString(value, type, options)}`;
        } else if (['date', 'set', 'map'].includes(type) || type.startsWith('dom')) {
            return `new ${this.#valueToString(value, type, options)}`;
        }
        return this.#valueToString(value, type, options);
    }
    #quotedStringOrValue(
        val: unknown,
        options: FormatterOptions = defaultFormatterOptions,
    ) {
        const type = getType(val);
        if (typeof val === 'string') {
            let str = val;
            const { escapeForJson, escapeNonCharacters, unescapedLineFeeds } = options;
            if (escapeForJson) {
                return `"${escapeUnicodeForJson(str, escapeNonCharacters)}"`;
            }
            if (this.#purpose === 'source' && !escapeNonCharacters) {
                str = str.replaceAll('\\', '\\\\') as string;
            }
            if (escapeNonCharacters) {
                return escapeUnicode(quotedString(str), unescapedLineFeeds);
            } else {
                if (unescapedLineFeeds === false) {
                    return escapeCR(escapeLF(quotedString(str)));
                } else {
                    return escapeCR(quotedString(str));
                }
            }
        } else {
            return this.#purpose === 'string'
                ? this.#valueToString(val, type, options)
                : this.#valueToSource(val, type, options);
        }
    }
    string(val: string, options: FormatterOptions) {
        const {
            expanded,
            trimLength,
            escapeForJson,
            escapeNonCharacters,
            unescapedLineFeeds,
        } = options;
        if (expanded === false) {
            return `String({ length: ${val.length} })`;
        }
        if (escapeForJson) {
            val = escapeUnicodeForJson(val, escapeNonCharacters);
        } else if (escapeNonCharacters) {
            val = escapeUnicode(val, unescapedLineFeeds);
        } else {
            val = escapeCR(val);
            if (unescapedLineFeeds === false) {
                val = escapeLF(val);
            }
        }
        const trimmed = trimLength > 0 && val.length > trimLength;
        return trimmed ? `${val.substring(0, trimLength)}…` : val;
    }
    number(val: number) {
        return val.toString();
    }
    boolean(val: boolean) {
        return val.toString();
    }
    bigint(val: bigint) {
        return `${val}n`;
    }
    undefined() {
        return 'undefined';
    }
    null() {
        return 'null';
    }
    array(val: unknown[], options: FormatterOptions) {
        if (options.expanded === false) {
            return `Array(${val.length})`;
        }
        if (val.length > 0 && Object.keys(val).length === 0) {
            return `Array(${val.length} /* all slots empty */)`;
        }
        const isNumeric = val.every((v) => Number.isFinite(v));
        if (isNumeric) {
            return formattedNumericArray(val as number[], 'array', options);
        } else {
            const parts: string[] = [];
            for (let idx = 0; idx < val.length; idx++) {
                if (idx in val) {
                    parts.push(this.#quotedStringOrValue(val[idx], options));
                } else {
                    parts.push('');
                }
            }
            return `[${formattedMultilineArray(parts, 'array', options)}]`;
        }
    }
    object(val: UnknownRecord, options: FormatterOptions = defaultFormatterOptions) {
        const parts: string[] = [];
        const entries = Object.entries(val);
        entries.forEach((entry) => {
            const property = options.escapeForJson
                ? `"${escapeUnicodeForJson(entry[0], options.escapeNonCharacters)}"`
                : maybeQuotedProperty(entry[0]);
            parts.push(`${property}: ${this.#quotedStringOrValue(entry[1], options)}`);
        });
        return `{${parts.join(', ')}}`;
    }
    date(val: Date) {
        return val?.toISOString && `Date('${val.toISOString()}')`;
    }
    arraybuffer(
        val: ArrayBufferLike,
        options: FormatterOptions = defaultFormatterOptions,
    ) {
        const option_str =
            val.maxByteLength !== val.byteLength
                ? `, {maxByteLength:${val.maxByteLength}}`
                : '';
        const contentEnd =
            options.expanded === false && val.byteLength > 3 ? 3 : val.byteLength;
        const contentView = new Uint8Array(val).subarray(0, contentEnd);
        const dots = options.expanded === false && val.byteLength > 3 ? ',...' : '';
        const content = `[${contentView.toString()}${dots}]`;

        return `ArrayBuffer(${val.byteLength}${option_str})${content}`;
    }
    dataview(val: DataView, options: FormatterOptions = defaultFormatterOptions) {
        const buffer: string = this.arraybuffer(val.buffer, options);
        let param_str = '';
        if (val.byteLength !== val.buffer.byteLength) {
            param_str = `, ${val.byteOffset}, ${val.byteLength}`;
        }
        return `DataView(${buffer}${param_str})`;
    }
    set(val: Set<unknown>, options: FormatterOptions) {
        if (options.expanded === false) {
            return `Set({ size: ${val.size} })`;
        }
        const parts: string[] = [];
        val.forEach((v) => parts.push(this.#quotedStringOrValue(v, options)));
        return `Set([${formattedMultilineArray(parts, 'array', options)}])`;
    }
    map(val: Map<unknown, unknown>, options: FormatterOptions) {
        if (options.expanded === false) {
            return `Map({ size: ${val.size} })`;
        }
        const parts: string[] = [];
        val.forEach((e, k) => {
            parts.push(
                `[${this.#quotedStringOrValue(k, options)}, ${this.#quotedStringOrValue(e, options)}]`,
            );
        });
        return `Map([${formattedMultilineArray(parts, 'array', options)}])`;
    }
    regexp(val: RegExp) {
        const flags = val.flags !== '' ? `, '${val.flags}'` : '';
        return `RegExp(/${val.source}/${flags})`;
    }
    error(val: Error, options: FormatterOptions = defaultFormatterOptions) {
        let option_str = '';
        if ('cause' in val && val.cause !== undefined) {
            const type = getType(val.cause);
            const cause =
                this.#purpose === 'string'
                    ? type === 'string'
                        ? this.#quotedStringOrValue(val.cause, options)
                        : this.#valueToString(val.cause, type, options)
                    : this.#valueToSource(val.cause, type, options);
            option_str = `, {cause: ${cause}}`;
        }
        const quotedMessage = this.#quotedStringOrValue(val.message, options);
        return `${val.name}(${quotedMessage}${option_str})`;
    }
    domexception(val: DOMException, options: FormatterOptions = defaultFormatterOptions) {
        const quotedMessage = this.#quotedStringOrValue(val.message, options);
        const quotedName = this.#quotedStringOrValue(val.name, options);
        const message_str =
            val.message !== '' || val.name !== 'Error' ? quotedMessage : '';
        const name_str = val.name !== 'Error' ? `, ${quotedName}` : '';
        return `DOMException(${message_str}${name_str})`;
    }
    dompoint(val: DOMPoint) {
        return `DOMPoint(${dompointArgs(val)})`;
    }
    dompointreadonly(val: DOMPointReadOnly) {
        return `DOMPointReadOnly(${dompointArgs(val)})`;
    }
    domrect(val: DOMRect) {
        return `DOMRect(${domrectArgs(val)})`;
    }
    domrectreadonly(val: DOMRectReadOnly) {
        return `DOMRectReadOnly(${domrectArgs(val)})`;
    }
    dommatrix(val: DOMMatrix) {
        return `DOMMatrix(${dommatrixArg(val)})`;
    }
    dommatrixreadonly(val: DOMMatrixReadOnly) {
        return `DOMMatrixReadOnly(${dommatrixArg(val)})`;
    }
    domquad(val: DOMQuad) {
        const points: string[] = [];
        const newStr = this.#purpose === 'source' ? 'new ' : '';
        for (const p of ['p1', 'p2', 'p3', 'p4'] as const) {
            const point: DOMPoint = val[p];
            points.push(`${newStr}${this.dompoint(point)}`);
        }
        return `DOMQuad(${points.join(', ')})`;
    }
    blob(val: Blob) {
        const type_str = val.type !== '' ? `type: '${val.type}, '` : '';
        return `Blob { ${type_str}size:${val.size} }`;
    }
    rtccertificate(val: RTCCertificate) {
        const expires = new Date(val.expires).toISOString();
        return `RTCCertificate { expires: '${expires}' }`;
    }
    imagedata(val: ImageData, options: FormatterOptions) {
        const properties = [
            `width: ${val.width}`,
            `height: ${val.height}`,
            `data: ${this.#valueToString(val.data as unknown, 'uint8clampedarray', options)}`,
        ];
        if (val.colorSpace) {
            properties.push(`colorSpace: '${val.colorSpace}'`);
        }
        return `ImageData { ${properties.join(', ')} }`;
    }
    imagebitmap(val: ImageBitmap) {
        return `ImageBitmap { width: ${val.width}, height: ${val.height} }`;
    }
    file(val: File) {
        const properties = [
            `name: "${val.name}"`,
            `size: ${val.size}`,
            `lastModified: "${new Date(val.lastModified).toISOString()}"`,
        ];
        if (val.type !== '') {
            properties.splice(1, 0, `type: "${val.type}"`);
        }
        return `File { ${properties.join(', ')} }`;
    }
    filelist(val: FileList) {
        return `FileList(${val.length})`; // TODO: list included files
    }
    filesystemdirectoryhandle(val: FileSystemDirectoryHandle) {
        return `FileSystemDirectoryHandle { name: '${val.name}' }`;
    }
    filesystemfilehandle(val: FileSystemFileHandle) {
        return `FileSystemFileHandle { name: '${val.name}' }`;
    }
    cryptokey(val: CryptoKey) {
        const typeString = val.type ? `"${val.type}"` : '';
        const algorithmString =
            typeof val.algorithm === 'object'
                ? ` , algorithm: ${this.object(Object.fromEntries(Object.entries(val.algorithm)))}`
                : '';
        return `CryptoKey { ${typeString}${algorithmString} }`;
    }
}

function typedArrayToString(
    value: TypedArray,
    type: TypedArrayType,
    options: FormatterOptions,
) {
    const typeName = value.constructor.name;
    if (options.expanded) {
        return `${typeName}(${formattedNumericArray(value, type, options)})`;
    } else {
        return `${typeName}(${value.length})`;
    }
}

export function formattedNumericArray(
    value: ArrayLike<number | bigint>,
    type: AllowedType,
    options: FormatterOptions,
) {
    let preparedValue: (number | string)[] = [];
    if (type === 'bigint64array' || type === 'biguint64array') {
        preparedValue = Array.from(value, (v) => v + 'n');
    } else {
        for (let idx = 0; idx < value.length; idx++) {
            // handle empty array slots
            preparedValue[idx] = idx in value ? (value[idx] as number) : '';
        }
    }
    const { perLine, valign, offset } = options;
    const len = value.length;
    if (len === 0) return '[]';
    if (perLine <= 0) throw new Error('perLine must be > 0');

    const multiline = len > perLine;
    if (!multiline) {
        return type.startsWith('float')
            ? floatArrayToString(preparedValue as number[])
            : `[${preparedValue.toString()}]`;
    }
    const offsetStr = ' '.repeat(offset);
    return `[${
        valign
            ? formattedValignedArray(preparedValue, type, options)
            : formattedMultilineArray(preparedValue, type, options)
    }${offsetStr}]`;
}

function formattedMultilineArray(
    value: ArrayLike<number | bigint | string>,
    type: AllowedType,
    options: FormatterOptions,
) {
    const { perLine, ident, offset } = options;
    const isMultiline = value.length > perLine;
    const indentStr = ' '.repeat(ident + offset);
    const toString = type.startsWith('float') ? floatArrayEntry : String;
    const parts: string[] = isMultiline ? ['\n'] : [];
    const len = value.length;
    let idx = 0;
    while (idx < len) {
        if (idx % perLine === 0 && isMultiline) {
            parts.push(indentStr);
        }
        parts.push(toString(value[idx++]));
        if (idx < len) {
            parts.push(', ');
            if (idx % perLine === 0) {
                parts.push('\n');
            }
        }
    }
    if (isMultiline) {
        parts.push('\n');
    }
    return parts.join('');
}

function formattedValignedArray(
    value: ArrayLike<number | bigint | string>,
    type: AllowedType,
    options: FormatterOptions,
) {
    const { perLine, ident, offset } = options;
    const indentStr = ' '.repeat(ident + offset);
    const toString = type.startsWith('float') ? floatArrayEntry : String;
    const parts: string[] = ['\n'];
    const len = value.length;
    const colWidths = new Array(perLine).fill(0);
    for (let idx = 0; idx < len; idx++) {
        const col = idx % perLine;
        const width = String(value[idx]).length;
        if (width > colWidths[col]) {
            colWidths[col] = width;
        }
    }
    for (let idx = 0; idx < len; idx++) {
        if (idx % perLine === 0) {
            parts.push(indentStr);
        }
        const col = idx % perLine;
        const str = toString(value[idx]);
        parts.push(str.padStart(colWidths[col]));
        if (idx < len - 1) {
            parts.push(', ');
        }
        if ((idx + 1) % perLine === 0 && idx < len - 1) {
            parts.push('\n');
        }
    }
    parts.push('\n');
    return parts.join('');
}

function floatArrayToString(val: number[]) {
    const parts = [];
    for (let idx = 0; idx < val.length; idx++) {
        parts.push(floatArrayEntry(val[idx]));
    }
    return `[${parts.join(', ')}]`;
}

function floatArrayEntry(val: string | number | bigint) {
    return Object.is(val, -0) ? '-0' : String(val);
}

export function requiredArgumentsList(values: unknown[], defaults: unknown[]) {
    return requiredArguments(values, defaults).join(', ');
}

export function requiredArguments(values: unknown[], defaults: unknown[]) {
    let last = -1;
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== defaults[i]) {
            last = i;
            break;
        }
    }
    return values.slice(0, last + 1);
}

function dommatrixArg(matrix: DOMMatrixReadOnly) {
    return matrix.isIdentity ? '' : `[${dommatrixArgsList(matrix)}]`;
}

export function dommatrixArgsList(matrix: DOMMatrixReadOnly) {
    // prettier-ignore
    const props = matrix.is2D
        ? ["a", "b", "c", "d", "e", "f"] as const
        : [
              "m11", "m12", "m13", "m14",
              "m21", "m22", "m23", "m24",
              "m31", "m32", "m33", "m34",
              "m41", "m42", "m43", "m44",
        ] as const;
    return props.map((prop) => matrix[prop]).join(', ');
}

function dompointArgs(val: DOMPoint) {
    return requiredArgumentsList([val.x, val.y, val.z, val.w], [0, 0, 0, 1]);
}

function domrectArgs(val: DOMRect) {
    return requiredArgumentsList([val.x, val.y, val.width, val.height], [0, 0, 0, 0]);
}
