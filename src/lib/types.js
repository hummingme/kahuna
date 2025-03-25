/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

/**
 * get type of value as lowercase string
 */
const objectRegexp = /^\[object (\S+)\]$/;
export const getType = (val) => {
    const type = typeof val;
    // all primitives and function
    if (type !== 'object') {
        return type;
    }
    // everything else
    return Object.prototype.toString.call(val).replace(objectRegexp, '$1').toLowerCase();
};

/**
 * compare values of types that are supported as index
 * https://dexie.org/docs/Indexable-Type
 */
export const compareIndexValues = (a, b) => {
    const ta = getType(a);
    const tb = getType(b);
    if (ta !== tb) {
        return false;
    }
    if (['number', 'string'].includes(ta)) {
        return a === b;
    }
    if (['array', 'date', 'arraybuffer'].includes(ta) || typedarrayTypes.includes(ta)) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
};

/**
 * return a string representation of the given value of type
 *
 * all types that can be stored in IndexedDb are supported
 * see: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 *
 * @param value  any
 * @param type  string
 * @param view  one of 'short'|'definite'
 * @return string
 */
export const valueToString = (value, type, view = 'short') => {
    if (value === undefined && type !== 'undefined') {
        return '';
    }
    if (toString[type]) {
        return toString[type](value);
    }
    if (typedarrayTypes.includes(type)) {
        return typedArrayToString(value, type, view);
    }
    return value?.toString();
};

const toString = {
    string: (val) => val,
    number: (val) => val.toString(),
    boolean: (val) => val.toString(),
    bigint: (val) => `${val}n`,
    undefined: () => 'undefined',
    null: () => 'null',
    array: (val) => {
        const str = [];
        val.forEach((elem) => str.push(maybeQuotedValue(elem)));
        return `[${str.join(', ')}]`;
    },
    object: (val) => {
        const str = [];
        const entries = Object.entries(val);
        entries.forEach((entry) =>
            str.push(`${maybeQuotedProperty(entry[0])}: ${maybeQuotedValue(entry[1])}`),
        );
        return `{${str.join(', ')}}`;
    },
    date: (val) => val?.toISOString && `Date('${val.toISOString()}')`,
    arraybuffer: (val) => {
        const option_str = val.maxByteLength
            ? `, {maxByteLength:${val.maxByteLength}}}`
            : '';
        return `ArrayBuffer(${val.byteLength}${option_str})`;
    },
    sharedarraybuffer: (val) => `Shared${toString.arraybuffer(val)}`,
    dataview: (val) => {
        const buffer = toString[getType(val.buffer)](val.buffer);
        let param_str = '';
        if (val.byteLength !== val.buffer.byteLength) {
            param_str = `, ${val.byteOffset}, ${val.byteLength}`;
        }
        return `DataView(${buffer}${param_str})`;
    },
    set: (val) => {
        const str = [];
        val.forEach((v) => str.push(maybeQuotedValue(v)));
        return `Set([${str.join(', ')}])`;
    },
    map: (val) => {
        const str = [];
        val.forEach((e, k) => {
            str.push(`[${maybeQuotedValue(k)}, ${maybeQuotedValue(e)}]`);
        });
        return `Map([${str.join(', ')}])`;
    },
    regexp: (val) => {
        const flags = val.flags !== '' ? `, ${val.flags}` : '';
        return `RegExp(/${val.source}/${flags})`;
    },
    error: (val) => {
        const option_str = val.cause ? `, {cause: ${val.cause}}` : '';
        return `${val.name}("${val.message}"${option_str})`;
    },
    dompoint: (val) => `DOMPoint(${dompointArgs(val)})`,
    dompointreadonly: (val) => `DOMPointReadOnly(${dompointArgs(val)})`,
    domrect: (val) => `DOMRect(${domrectArgs(val)})`,
    domrectreadonly: (val) => `DOMRectReadOnly(${domrectArgs(val)})`,
    dommatrix: (val) => `DOMMatrix(${dommatrixArgs(val)})`,
    dommatrixreadonly: (val) => `DOMMatrixReadOnly(${dommatrixArgs(val)})`,
    domquad: (val) => {
        const points = [];
        for (const p of ['p1', 'p2', 'p3', 'p4']) {
            points.push(toString.dompoint(val[p]));
        }
        return `DOMQuad(${points.join(', ')})`;
    },
    blob: (val) => {
        const type_str = val.type !== '' ? `, type: "${val.type}"` : '';
        return `Blob { size:${val.size}${type_str} }`;
    },
    rtccertificate: (val) => {
        const expires = new Date(val.expires).toISOString();
        return `RTCCertificate { expires: "${expires}" }`;
    },
    imagedata: (val) => {
        const properties = [
            `width: ${val.width}`,
            `height: ${val.height}`,
            `data: ${valueToString(val.data, 'uint8clampedarray')}`,
        ];
        if (val.colorSpace) {
            properties.push(`colorSpace: ${val.colorSpace}`);
        }
        return `ImageData { ${properties.join(', ')} }`;
    },
    imagebitmap: (val) => `ImageBitmap { width: ${val.width}, height: ${val.height} }`,
    file: (val) => {
        const properties = [
            `name: "${val.name}"`,
            `size: ${val.size}`,
            `lastModified: "${new Date(val.lastModified).toISOString()}"`,
        ];
        if (val.type !== '') {
            properties.splice(2, 0, `type: "${val.type}"`);
        }
        return `File { ${properties.join(' ,')} }`;
    },
    filelist: (val) => {
        return `FileList(${val.length})`; // TODO: list included files, maybe in a vieww tooltip
    },
    filesystemdirectoryhandle: (val) => `FileSystemDirectoryHandle { name: ${val.name} }`,
    filesystemfilehandle: (val) => `FileSystemFileHandle { name: ${val.name} }`,
    domexception: (val) => {
        const message_str =
            val.message !== '' || val.name !== 'Error' ? `"${val.message}"` : '';
        const name_str = val.name !== 'Error' ? `, "${val.name}"` : '';
        return `DOMException(${message_str}${name_str})`;
    },
    /* types below are untested */
    gpucompilationmessage: (val) =>
        `GPUCompilationMessage { type: "${val.type}", "message: "${val.message}" }`,
    gpucompilationinfo: (val) =>
        `GPUCompilationInfo { messages: Array(${val.messages.length})}`,
    cryptokey: (val) =>
        `CryptoKey { type: "$val.type", algorithm: ${toString.object(val.algorithm)} }`,
    videoframe: (val) => `VideoFrame { format: "${val.format}" }`,
    audiodata: (val) => `AudioData { format: "${val.format}" }`,
    croptarget: () => `CropTarget()`,
};

const typedArrayToString = (value, type, view) => {
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
};

export const valueToSource = (value, type) => {
    type ??= getType(value);
    if (toSource[type]) {
        return toSource[type](value);
    }
    if (typedarrayTypes.includes(type)) {
        return `new ${valueToString(value, type, 'definite')}`;
    }
    if (['date', 'set'].includes(type) || type.startsWith('dom')) {
        return `new ${valueToString(value, type)}`;
    }
    return valueToString(value, type);
};

const toSource = {
    string: (val) => quotedString(val),
    map: (val) => {
        const str = [];
        val.forEach((e, k) => {
            const key = valueToSource(k);
            const entry = valueToSource(e);
            str.push(`[${key}, ${entry}]`);
        });
        return `new Map([${str.join(', ')}])`;
    },
};

const maybeQuotedValue = (val, type) => {
    type ??= getType(val);
    return type === 'string' ? quotedString(val) : valueToString(val, type);
};

const unquotedStringProperties = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/u;

export const maybeQuotedProperty = (prop) => {
    return isNaN(prop) === false || unquotedStringProperties.test(prop)
        ? prop
        : quotedString(prop);
};

export const isUnquotedPropertyName = (name) => unquotedStringProperties.test(name);

const quotedString = (val) => {
    if (val.includes("'")) {
        if (val.includes('"')) {
            return `"${val.replaceAll('"', '\\"')}"`;
        } else {
            return `"${val}"`;
        }
    } else {
        return `'${val}'`;
    }
};

const dompointArgs = (val) => {
    const points = [val.x, val.y];
    if (val.z !== 0 || val.w !== 1) {
        points.push(val.z);
        if (val.w !== 1) {
            points.push(val.w);
        }
    }
    return points.join(', ');
};

const dommatrixArgs = (matrix) => {
    // prettier-ignore
    const props = dommatrixIs2D(matrix)
        ? ["a", "b", "c", "d", "e", "f"]
        : [
              "m11", "m12", "m13", "m14",
              "m21", "m22", "m23", "m24",
              "m31", "m32", "m33", "m34",
              "m41", "m42", "m43", "m44",
        ];
    return `[${props.map((prop) => matrix[prop]).join(', ')}]`;
};

const dommatrixIs2D = (matrix) => {
    return (
        matrix.is2D &&
        checkPropertiesValue(matrix, ['m33', 'm44'], 1) &&
        checkPropertiesValue(
            matrix,
            ['m13', 'm14', 'm23', 'm24', 'm31', 'm32', 'm34', 'm43'],
            0,
        )
    );
};

const checkPropertiesValue = (obj, props, val) => {
    for (const prop of props) {
        if (obj[prop] !== val) return false;
    }
    return true;
};

const domrectArgs = (val) => `${val.x}, ${val.y}, ${val.width}, ${val.height}`;

export const typedarrayTypes = [
    'int8array',
    'int16array',
    'int32array',
    'uint8array',
    'uint16array',
    'uint32array',
    'uint8clampedarray',
    'bigint64array',
    'biguint64array',
    'float32array',
    'float64array',
];

/*
 * Data types for which the old row.prop value is used in datatable.editRow()
 * instead of representing the value as code generated by valueToSource()
 */
export const typesFromRow = [
    'blob',
    'dataview',
    'rtccertificate',
    'imagedata',
    'imagebitmap',
    'file',
    'filelist',
    'filesystemdirectoryhandle',
    'filesystemfilehandle',
    'gpucompilationmessage',
    'gpucompilationinfo',
    'cryptokey',
    'videoframe',
    'audiodata',
    'croptarget',
];

export const shallowEqual = (object1, object2) => {
    if (!isPlainObject(object1) || !isPlainObject(object2)) {
        return false;
    }
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (object1[key] !== object2[key]) {
            return false;
        }
    }

    return true;
};

export const isPlainObject = (value) => value?.constructor === Object;

export const isEmptyObject = (value) => {
    if (!isPlainObject(value)) return false;
    for (var property in value) {
        if (Object.hasOwn(value, property)) return false;
    }
    return true;
};

export const isArrayBuffer = (value) => value instanceof ArrayBuffer;
