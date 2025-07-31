/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { PlainObject } from './types/common.ts';

/**
 * return num if it is within min/max,
 * else return min if num is less or max if num is greater
 */
export const clamp = (num: number, min: number, max: number): number => {
    if (min > max) [min, max] = [max, min];
    return Math.min(Math.max(num, min), max);
};

export const between = (num: number, min: number, max: number): boolean =>
    num >= min && num <= max;

export const capitalize = (value: string): string =>
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

export const camelize = (value: string, separator = '-'): string => {
    return value
        .split(separator)
        .map((word, index) =>
            index === 0 ? word : word[0].toUpperCase() + word.slice(1),
        )
        .join('');
};

export const uniqueName = (name: string, existingNames: string[]): string => {
    const regex = new RegExp(`${escapeRegExp(name)}-[\\d]+$`);
    const maxCounter =
        existingNames
            .filter((n: string) => n.startsWith(name) && regex.test(n))
            .map((n: string) => parseInt(n.substring(n.lastIndexOf('-') + 1)))
            .sort((a: number, b: number) => b - a)[0] || 0;
    return `${name}-${maxCounter + 1}`;
};

export const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * return the properties that differ in two objects
 */

export const getDifference = (a: PlainObject, b: PlainObject): PlainObject =>
    Object.fromEntries(
        Object.entries(b).filter(([key, val]) => key in a && a[key] !== val),
    );

/*
 * resolvePath({a:{b:{c:1}}}, 'a.b.c') => 1
 * from https://stackoverflow.com/a/43849204
 */
export const resolvePath = (
    object: PlainObject,
    path: string,
    defaultValue: any = undefined,
): any => path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);

/*
 * setPath({}, 'a.b.c', 1) => {a:{b:{c:1}}}
 */
export const setPath = (object: PlainObject, path: string, value: any): PlainObject =>
    path
        .split('.')
        .reduce(
            (o, p, i) => (o[p] = path.split('.').length === ++i ? value : o[p] || {}),
            object,
        );

export const addNestedValues = (row: PlainObject, paths: string[]) => {
    paths.forEach((path: string) => {
        row[path] = resolvePath(row, path);
    });
    return row;
};

export const removeNestedValues = (row: PlainObject, paths: string[]): PlainObject => {
    paths.forEach((path) => {
        delete row[path];
    });
    return row;
};

/*
 * zipObject(['a', 'b', 'c'], [1, 2, 3]);  // {a: 1, b: 2, c: 3}
 */
export const zipObject = (props: string[], values: any[]): PlainObject =>
    props.reduce(
        (obj: PlainObject, prop, index) => ((obj[prop] = values[index]), obj),
        {},
    );

export const pickProperties = (obj: PlainObject, props: string[]): PlainObject =>
    Object.assign({}, ...props.map((prop) => ({ [prop]: obj[prop] })));

export const selfMap = (arr: string[]): PlainObject =>
    Object.fromEntries(arr.map((f) => [f, f]));

/*
 *  check array of numbers, isSorted([1, 5, 9]) -> true
 */
export const isSorted = (arr: number[]): boolean =>
    arr.slice(1).every((item, i) => arr[i] <= item);

/*
 * replacement for Set.prototype.intersection()
 */
export const hasIntersection = (a: Set<unknown>, b: Set<unknown>): boolean => {
    return [...a].some((item) => b.has(item));
};

export const downloadFile = (bits: BlobPart, filename: string, type = ''): void => {
    const file = new File([bits], filename, { type });
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const suffix = (filename: string): string =>
    filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);

export const fetchFile = async (url: string): Promise<string> => {
    const res = await fetch(url);
    return await res.text();
};

export const uniqueId = (): string => (Math.random() * 1000000 * Date.now()).toString(36);

export const sleep = (delay: number) =>
    new Promise((resolve) => setTimeout(resolve, delay));
