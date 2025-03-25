/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

/**
 * return num if it is within min/max,
 * else return min if num is less or max if num is greater
 */
export const clamp = (num, min, max) => {
    if (min > max) [min, max] = [max, min];
    return Math.min(Math.max(num, min), max);
};
export const between = (x, min, max) => x >= min && x <= max;

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * return the properties that differ in two objects
 */
export const getDifference = (a, b) =>
    Object.fromEntries(
        Object.entries(b).filter(([key, val]) => key in a && a[key] !== val),
    );

/*
 * resolvePath({a:{b:{c:1}}}, 'a.b.c') => 1
 * from https://stackoverflow.com/a/43849204
 */
export const resolvePath = (object, path, defaultValue) =>
    path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);

/*
 * setPath({}, 'a.b.c', 1) => {a:{b:{c:1}}}
 */
export const setPath = (object, path, value) =>
    path
        .split('.')
        .reduce(
            (o, p, i) => (o[p] = path.split('.').length === ++i ? value : o[p] || {}),
            object,
        );

export const addNestedValues = (row, paths) => {
    paths.forEach((path) => {
        row[path] = resolvePath(row, path);
    });
    return row;
};

export const removeNestedValues = (row, paths) => {
    paths.forEach((path) => {
        delete row[path];
    });
    return row;
};

/*
 * zipObject(['a', 'b', 'c'], [1, 2, 3]);  // {a: 1, b: 2, c: 3}
 */
export const zipObject = (props, values) =>
    props.reduce((obj, prop, index) => ((obj[prop] = values[index]), obj), {});

export const pickProperties = (obj, props) =>
    Object.assign({}, ...props.map((prop) => ({ [prop]: obj[prop] })));

export const selfMap = (arr) => Object.fromEntries(arr.map((f) => [f, f]));

/*
 *  check array of numbers, isSorted([1, 5, 9]) -> true
 */
export const isSorted = (arr) => arr.slice(1).every((item, i) => arr[i] <= item);

export const downloadFile = (bits, filename, type = '') => {
    const file = new File([bits], filename, { type });
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const globalTarget = { database: '*', table: '*' };
export const isGlobal = (target) => target?.table === '*' && target?.database === '*';
export const isDatabase = (target) => target?.table === '*' && target?.database !== '*';
export const isTable = (target) => target?.table !== '*' && target?.database !== '*';
export const equalTarget = (a, b) => a.table === b.table && a.database === b.database;

export const suffix = (filename) =>
    filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);

export const fetchFile = async (url) => {
    const res = await fetch(url);
    return await res.text();
};

export const uniqueId = () => parseInt(Math.random() * 1000000 * Date.now()).toString(36);

export const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
