/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { PlainObject } from './types/common.ts';
import {
    getType,
    maybeQuotedProperty,
    quotedString,
    typedarrayTypes,
    type TypedArrayType,
} from './datatypes.ts';

type ValueFormatterMethodNames = {
    [K in keyof ValueFormatter]: ValueFormatter[K] extends (...args: any[]) => any
        ? K
        : never;
}[keyof ValueFormatter];

type ToStringType = Exclude<ValueFormatterMethodNames, 'render'>;
export type AllowedType = TypedArrayType | ToStringType;

type ViewStyle = 'short' | 'definite';

type TypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array;

class ValueFormatter {
    #purpose;
    constructor(purpose: 'string' | 'source' = 'string') {
        this.#purpose = purpose;
    }
    /**
     * return a string representation of the given value of type
     *
     * all types that can be stored in IndexedDb are supported
     * see: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
     */
    render(value: unknown, type: AllowedType, view: ViewStyle = 'short') {
        return this.#purpose === 'string'
            ? this.#valueToString(value, type, view)
            : this.#valueToSource(value, type);
    }
    #valueToString(value: unknown, type: AllowedType, view: ViewStyle = 'short'): string {
        if (value === undefined && type !== 'undefined') {
            return '';
        }
        if (type in this) {
            return this[type as ToStringType](value as never);
        }
        if (typedarrayTypes.includes(type as TypedArrayType)) {
            return this.#typedArrayToString(
                value as TypedArray,
                type as TypedArrayType,
                view,
            );
        }
        return 'unidentified object';
    }
    #typedArrayToString(value: TypedArray, type: TypedArrayType, view: ViewStyle) {
        let param = '';
        if (view === 'definite' || (view === 'short' && value.length <= 10)) {
            param = `[${value.toString()}]`;
            if (['bigint64array', 'biguint64array'].includes(type)) {
                param = param.replaceAll(',', 'n,').replace(']', 'n]');
            }
        } else {
            param = `${value.length}`;
        }
        return `${value.constructor.name}(${param})`;
    }
    #valueToSource(value: unknown, type: AllowedType) {
        if (typeof value === 'string') {
            return quotedString(value);
        }
        if (typedarrayTypes.includes(type as TypedArrayType)) {
            return `new ${this.#valueToString(value, type, 'definite')}`;
        }
        if (['date', 'set', 'map'].includes(type) || type.startsWith('dom')) {
            return `new ${this.#valueToString(value, type)}`;
        }
        return this.#valueToString(value, type);
    }
    #quotedStringOrValue(val: unknown) {
        const type = getType(val) as AllowedType;
        return typeof val === 'string'
            ? quotedString(val)
            : this.#purpose === 'string'
              ? this.#valueToString(val, type)
              : this.#valueToSource(val, type);
    }
    string(val: string) {
        return val;
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
    undefined(_val: undefined) {
        return 'undefined';
    }
    null(_val: object) {
        return 'null';
    }
    array(val: unknown[]) {
        const parts: string[] = [];
        val.forEach((element) => parts.push(this.#quotedStringOrValue(element)));
        return `[${parts.join(', ')}]`;
    }
    object(val: PlainObject) {
        const parts: string[] = [];
        const entries = Object.entries(val);
        entries.forEach((entry) =>
            parts.push(
                `${maybeQuotedProperty(entry[0])}: ${this.#quotedStringOrValue(entry[1] as unknown)}`,
            ),
        );
        return `{${parts.join(', ')}}`;
    }
    date(val: Date) {
        return val?.toISOString && `Date('${val.toISOString()}')`;
    }
    arraybuffer(val: ArrayBufferLike) {
        const option_str = val.maxByteLength
            ? `, {maxByteLength:${val.maxByteLength}}`
            : '';
        return `ArrayBuffer(${val.byteLength}${option_str})`;
    }
    sharedarraybuffer(val: ArrayBufferLike) {
        return `Shared${this.arraybuffer(val)}`;
    }
    dataview(val: DataView) {
        const bufferType = getType(val.buffer as unknown) as
            | 'arraybuffer'
            | 'sharedarraybuffer';
        const buffer: string = this[bufferType](val.buffer);
        let param_str = '';
        if (val.byteLength !== val.buffer.byteLength) {
            param_str = `, ${val.byteOffset}, ${val.byteLength}`;
        }
        return `DataView(${buffer}${param_str})`;
    }
    set(val: Set<unknown>) {
        const parts: string[] = [];
        // structuredClone is necessary for Firefox to iterate a Set sent by webworker
        structuredClone(val).forEach((v) => parts.push(this.#quotedStringOrValue(v)));
        return `Set([${parts.join(', ')}])`;
    }
    map(val: Map<unknown, unknown>) {
        const parts: string[] = [];
        // structuredClone is necessary for Firefox to iterate a Map sent by webworker
        structuredClone(val).forEach((e, k) => {
            parts.push(
                `[${this.#quotedStringOrValue(k)}, ${this.#quotedStringOrValue(e)}]`,
            );
        });
        return `Map([${parts.join(', ')}])`;
    }
    regexp(val: RegExp) {
        const flags = val.flags !== '' ? `, ${val.flags}` : '';
        return `RegExp(/${val.source}/${flags})`;
    }
    error(val: Error) {
        const option_str = val.cause ? `, {cause: ${val.cause}}` : '';
        new DOMPoint();
        return `${val.name}("${val.message}"${option_str})`;
    }
    dompoint(val: DOMPoint) {
        return `DOMPoint(${this.#dompointArgs(val)})`;
    }
    dompointreadonly(val: DOMPointReadOnly) {
        return `DOMPointReadOnly(${this.#dompointArgs(val)})`;
    }
    domrect(val: DOMRect) {
        return `DOMRect(${this.#domrectArgs(val)})`;
    }
    domrectreadonly(val: DOMRectReadOnly) {
        return `DOMRectReadOnly(${this.#domrectArgs(val)})`;
    }
    dommatrix(val: DOMMatrix) {
        const matrix: DOMMatrixReadOnly = val;
        return `DOMMatrix(${this.#dommatrixArgs(matrix)})`;
    }
    dommatrixreadonly(val: DOMMatrixReadOnly) {
        return `DOMMatrixReadOnly(${this.#dommatrixArgs(val)})`;
    }
    domquad(val: DOMQuad) {
        const points: string[] = [];
        for (const p of ['p1', 'p2', 'p3', 'p4'] as const) {
            const point: DOMPoint = val[p];
            points.push(this.dompoint(point));
        }
        return `DOMQuad(${points.join(', ')})`;
    }
    blob(val: Blob) {
        const type_str = val.type !== '' ? `, type: "${val.type}"` : '';
        return `Blob { size:${val.size}${type_str} }`;
    }
    rtccertificate(val: RTCCertificate) {
        const expires = new Date(val.expires).toISOString();
        return `RTCCertificate { expires: "${expires}" }`;
    }
    imagedata(val: ImageData) {
        const properties = [
            `width: ${val.width}`,
            `height: ${val.height}`,
            `data: ${this.#valueToString(val.data as unknown, 'uint8clampedarray')}`,
        ];
        if (val.colorSpace) {
            properties.push(`colorSpace: ${val.colorSpace}`);
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
            properties.splice(2, 0, `type: "${val.type}"`);
        }
        return `File { ${properties.join(' ,')} }`;
    }
    filelist(val: FileList) {
        return `FileList(${val.length})`; // TODO: list included files
    }
    filesystemdirectoryhandle(val: FileSystemDirectoryHandle) {
        return `FileSystemDirectoryHandle { name: ${val.name} }`;
    }
    filesystemfilehandle(val: FileSystemFileHandle) {
        return `FileSystemFileHandle { name: ${val.name} }`;
    }
    domexception(val: DOMException) {
        const message_str =
            val.message !== '' || val.name !== 'Error' ? `"${val.message}"` : '';
        const name_str = val.name !== 'Error' ? `, "${val.name}"` : '';
        return `DOMException(${message_str}${name_str})`;
    }
    /* types below are untested */
    gpucompilationmessage(val: { type: string; message: string }) {
        return `GPUCompilationMessage { type: "${val.type}", "message: "${val.message}" }`;
    }
    gpucompilationinfo(val: { messages: string[] }) {
        return `GPUCompilationInfo { messages: Array(${val.messages.length})}`;
    }
    cryptokey(val: CryptoKey) {
        return `CryptoKey { type: "${val.type}", algorithm: ${this.object(val.algorithm)} }`;
    }
    videoframe(val: VideoFrame) {
        return `VideoFrame { format: "${val.format}" }`;
    }
    audiodata(val: AudioData) {
        return `AudioData { format: "${val.format}" }`;
    }
    croptarget(_val: object) {
        return `CropTarget()`;
    }
    #dompointArgs(val: DOMPoint) {
        const points = [val.x, val.y];
        if (val.z !== 0 || val.w !== 1) {
            points.push(val.z);
            if (val.w !== 1) {
                points.push(val.w);
            }
        }
        return points.join(', ');
    }
    #domrectArgs(val: DOMRect) {
        return `${val.x}, ${val.y}, ${val.width}, ${val.height}`;
    }
    #dommatrixArgs(matrix: DOMMatrixReadOnly) {
        // prettier-ignore
        const props = this.#dommatrixIs2D(matrix)
        ? ["a", "b", "c", "d", "e", "f"] as const
        : [
              "m11", "m12", "m13", "m14",
              "m21", "m22", "m23", "m24",
              "m31", "m32", "m33", "m34",
              "m41", "m42", "m43", "m44",
        ] as const;
        return `[${props.map((prop) => matrix[prop]).join(', ')}]`;
    }
    #dommatrixIs2D(matrix: DOMMatrix | DOMMatrixReadOnly) {
        return (
            matrix.is2D &&
            this.#checkPropertiesValue(matrix, ['m33', 'm44'], 1) &&
            this.#checkPropertiesValue(
                matrix,
                ['m13', 'm14', 'm23', 'm24', 'm31', 'm32', 'm34', 'm43'],
                0,
            )
        );
    }
    #checkPropertiesValue(obj: PlainObject, props: string[], val: unknown) {
        for (const prop of props) {
            if (obj[prop] !== val) return false;
        }
        return true;
    }
}

export const stringFormatter = new ValueFormatter();
export const sourceFormatter = new ValueFormatter('source');
