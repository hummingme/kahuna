/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { AllowedType } from '#lib/value-formatter';
import env from '#lib/environment';

export const fieldUploadMethods = [
    'file-upload',
    'string-upload',
    'csv-upload',
    'json-upload',
    'image-upload',
] as const;

export const fieldInputMethods = [
    'code',
    'form',
    'ts',
    'ts/1000',
    ...fieldUploadMethods,
] as const;

export type FieldUploadMethod = (typeof fieldUploadMethods)[number];
export type FieldInputMethod = (typeof fieldInputMethods)[number];
export type FieldInputMethods = { [K in FieldInputMethod]?: string };

type DatatypeAttributes = {
    name: string;
    group: 'base' | 'more' | 'array';
    inputMethods: Set<FieldInputMethod>;
    itemsPerLine?: number;
    isLarge?: number;
    compactedFrom?: number;
    compactedOnly?: boolean;
    containsStrings?: boolean;
};

type DatatypeAttributesMap = {
    [K in AllowedType]?: DatatypeAttributes;
};

const CODE: Set<FieldInputMethod> = new Set(['code']);
const FORM_CODE: Set<FieldInputMethod> = new Set(['form', 'code']);
const FORM_CODE_CSV: Set<FieldInputMethod> = new Set(['form', 'code', 'csv-upload']);
const CODE_FORM_FILE: Set<FieldInputMethod> = new Set(['code', 'form', 'file-upload']);
const FILE_FORM_CODE: Set<FieldInputMethod> = new Set(['file-upload', 'form', 'code']);

export function datatypeAttributes(): DatatypeAttributesMap {
    const attributes: DatatypeAttributesMap = {
        array: {
            name: 'Array',
            group: 'base',
            inputMethods: new Set(['code', 'form', 'csv-upload']),
            itemsPerLine: 8,
            isLarge: 4000,
            compactedFrom: 100,
            containsStrings: true,
        },
        boolean: {
            name: 'Boolean',
            group: 'base',
            inputMethods: FORM_CODE,
        },
        date: {
            name: 'Date',
            group: 'base',
            inputMethods: new Set(['form', 'ts', 'ts/1000', 'code']),
        },
        map: {
            name: 'Map',
            group: 'base',
            inputMethods: new Set(['code', 'form']),
            itemsPerLine: 4,
            isLarge: 500,
            compactedFrom: 100,
            containsStrings: true,
        },
        null: {
            name: 'Null',
            group: 'base',
            inputMethods: FORM_CODE,
        },
        number: {
            name: 'Number',
            group: 'base',
            inputMethods: FORM_CODE,
        },
        object: {
            name: 'Object',
            group: 'base',
            inputMethods: new Set(['code', 'form', 'json-upload']),
            containsStrings: true,
        },
        set: {
            name: 'Set',
            group: 'base',
            inputMethods: new Set(['code', 'form', 'csv-upload']),
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
            containsStrings: true,
        },
        string: {
            name: 'String',
            group: 'base',
            inputMethods: new Set(['form', 'code', 'string-upload']),
            isLarge: 30000,
            containsStrings: true,
        },
        undefined: {
            name: 'Undefined',
            group: 'base',
            inputMethods: FORM_CODE,
        },

        arraybuffer: {
            name: 'ArrayBuffer',
            group: 'array',
            inputMethods: CODE_FORM_FILE,
            itemsPerLine: 16,
            isLarge: 4000,
            compactedFrom: 100,
        },
        bigint64array: {
            name: 'BigInt64Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        biguint64array: {
            name: 'BigUint64Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        dataview: {
            name: 'DataView',
            group: 'array',
            inputMethods: CODE_FORM_FILE,
            itemsPerLine: 16,
            isLarge: 4000,
            compactedFrom: 100,
        },
        float64array: {
            name: 'Float64Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        float32array: {
            name: 'Float32Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        float16array: {
            name: 'Float16Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 2000,
            compactedFrom: 100,
        },
        int16array: {
            name: 'Int16Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 12,
            isLarge: 2000,
            compactedFrom: 100,
        },
        int32array: {
            name: 'Int32Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        int8array: {
            name: 'Int8Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 16,
            isLarge: 2000,
            compactedFrom: 100,
        },
        uint16array: {
            name: 'Uint16Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 12,
            isLarge: 2000,
            compactedFrom: 100,
        },
        uint32array: {
            name: 'Uint32Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 8,
            isLarge: 1000,
            compactedFrom: 100,
        },
        uint8array: {
            name: 'Uint8Array',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 16,
            isLarge: 2000,
            compactedFrom: 100,
        },
        uint8clampedarray: {
            name: 'Uint8ClampedArray',
            group: 'array',
            inputMethods: FORM_CODE_CSV,
            itemsPerLine: 16,
            isLarge: 2000,
            compactedFrom: 100,
        },

        bigint: {
            name: 'BigInt',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        blob: {
            name: 'Blob',
            group: 'more',
            inputMethods: FILE_FORM_CODE,
            itemsPerLine: 16,
            isLarge: 2000,
            compactedFrom: 50,
        },
        cryptokey: {
            name: 'CryptoKey',
            group: 'more',
            inputMethods: CODE,
            compactedOnly: true,
        },
        domexception: {
            name: 'DOMException',
            group: 'more',
            inputMethods: FORM_CODE,
            containsStrings: true,
        },
        dommatrix: {
            name: 'DOMMatrix',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        dommatrixreadonly: {
            name: 'DOMMatrixReadOnly',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        dompoint: {
            name: 'DOMPoint',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        dompointreadonly: {
            name: 'DOMPointReadOnly',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        domquad: {
            name: 'DOMQuad',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        domrect: {
            name: 'DOMRect',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        domrectreadonly: {
            name: 'DOMRectReadOnly',
            group: 'more',
            inputMethods: FORM_CODE,
        },
        error: {
            name: 'Error',
            group: 'more',
            inputMethods: FORM_CODE,
            containsStrings: true,
        },
        file: {
            name: 'File',
            group: 'more',
            inputMethods: FILE_FORM_CODE,
            itemsPerLine: 16,
            isLarge: 2000,
            compactedFrom: 50,
            containsStrings: true,
        },
        filelist: {
            name: 'FileList',
            group: 'more',
            inputMethods: FORM_CODE,
            compactedOnly: true,
            containsStrings: true,
        },
        filesystemdirectoryhandle: {
            name: 'FileSystemDirectoryHandle',
            group: 'more',
            inputMethods: FORM_CODE,
            compactedOnly: true,
            containsStrings: true,
        },
        filesystemfilehandle: {
            name: 'FileSystemFileHandle',
            group: 'more',
            inputMethods: FORM_CODE,
            compactedOnly: true,
            containsStrings: true,
        },
        imagebitmap: {
            name: 'ImageBitmap',
            group: 'more',
            inputMethods: new Set(['image-upload', 'code']),
        },
        imagedata: {
            name: 'ImageData',
            group: 'more',
            inputMethods: new Set(['image-upload', 'form', 'code']),
        },
        regexp: {
            name: 'RegExp',
            group: 'more',
            inputMethods: FORM_CODE,
            containsStrings: true,
        },
        rtccertificate: {
            name: 'RTCCertificate',
            group: 'more',
            inputMethods: CODE,
            compactedOnly: true,
        },
    };
    if (env.fileSystemApiSupported === false) {
        // this 4 types are supported by chromium, unsupported by firefox
        delete attributes.filesystemdirectoryhandle;
        delete attributes.filesystemfilehandle;
        delete attributes.imagebitmap; // TODO: own env.flag for ImageBitmap support
        delete attributes.float16array; // TODO: own env.flag for indexedDBs Float16Array support
    }

    return attributes;
}

const fieldInputMethodNames: Record<FieldInputMethod, string> = {
    code: 'javascript code',
    form: 'form',
    'file-upload': 'upload',
    'string-upload': 'upload',
    'csv-upload': 'csv upload',
    'json-upload': 'json upload',
    'image-upload': 'image upload',
    ts: 'timestamp',
    'ts/1000': 'timestamp / 1000',
};

export function methodNames(type: AllowedType) {
    const names: { [key: string]: string } = {};
    inputMethods(type).forEach((method) => {
        names[method] = fieldInputMethodNames[method];
    });
    return names;
}

const codePossible = env.codeExecutionMethods.length > 0;

export function inputMethods(type: AllowedType) {
    const attributes = datatypeAttributes()[type];
    if (!attributes) return [];
    const methods = attributes.inputMethods;
    if (!codePossible) {
        methods.delete('code');
    }
    return [...methods.values()];
}

export function preferedInputMethod(type: AllowedType) {
    return inputMethods(type)[0];
}

export function isTypeInputMethod(
    method: string,
    type: AllowedType,
): method is FieldInputMethod {
    return inputMethods(type).includes(method as FieldInputMethod);
}

export function itemsPerLine(type: AllowedType) {
    const attributes = datatypeAttributes()[type];
    return typeof attributes === 'object' && 'itemsPerLine' in attributes
        ? attributes.itemsPerLine
        : 1;
}

export function isExpandable(type: AllowedType) {
    const attributes = datatypeAttributes()[type];
    return typeof attributes === 'object' && !attributes.compactedOnly;
}

export function containsStrings(type: AllowedType) {
    const attributes = datatypeAttributes()[type];
    return typeof attributes === 'object' && !!attributes.containsStrings;
}

export function compactedFrom(type: AllowedType): number {
    const attributes = datatypeAttributes()[type];
    return typeof attributes === 'object' &&
        'compactedFrom' in attributes &&
        typeof attributes.compactedFrom === 'number'
        ? attributes.compactedFrom
        : Infinity;
}

export function isLarge(type: AllowedType): number {
    const attributes = datatypeAttributes()[type];
    return typeof attributes === 'object' &&
        'isLarge' in attributes &&
        typeof attributes.isLarge === 'number'
        ? attributes.isLarge
        : 1;
}
