/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { RecordOf, UnknownRecord } from '#types';

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

export const plural = (count: number): string => (count > 1 ? 's' : '');

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

export const getDifference = (a: UnknownRecord, b: UnknownRecord): UnknownRecord =>
    Object.fromEntries(
        Object.entries(b).filter(([key, val]) => key in a && a[key] !== val),
    );

/*
 * resolvePath({a:{b:{c:1}}}, 'a.b.c') => 1
 * from https://stackoverflow.com/a/43849204
 */
export const resolvePath = (
    object: UnknownRecord,
    path: string,
    defaultValue: any = undefined,
): any => path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);

/*
 * setPath({}, 'a.b.c', 1) => {a:{b:{c:1}}}
 */
export const setPath = (obj: UnknownRecord, path: string, value: any): UnknownRecord => {
    const parts = path.split('.');
    parts.reduce((o, p, i) => (o[p] = parts.length === i + 1 ? value : o[p] || {}), obj);
    return obj;
};

export const addNestedValues = (row: UnknownRecord, paths: string[]) => {
    paths.forEach((path: string) => {
        row[path] = resolvePath(row, path);
    });
};

export const removeNestedValues = (row: UnknownRecord, paths: string[]) => {
    paths.forEach((path) => {
        delete row[path];
    });
};

/*
 * zipObject(['a', 'b', 'c'], [1, 2, 3]);  // {a: 1, b: 2, c: 3}
 */
export const zipObject = (props: string[], values: any[]): UnknownRecord =>
    props.reduce(
        (obj: UnknownRecord, prop, index) => ((obj[prop] = values[index]), obj),
        {},
    );

export const pickProperties = <T extends object, K extends keyof T>(
    obj: T,
    props: K[],
): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    for (const key of props) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
};

export const pickByKeys = <T extends object, S extends object>(
    obj: T,
    source: S,
): Pick<T, Extract<keyof T, keyof S>> => {
    const result = {} as any;
    for (const key in source) {
        if (key in obj) {
            result[key] = obj[key as unknown as keyof T];
        }
    }
    return result;
};

export const selfMap = (arr: readonly string[]): RecordOf<string> =>
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

export const rowIndex = (node: HTMLElement) => {
    const tr = node.closest('tr');
    return tr && tr.rowIndex !== -1 ? tr.rowIndex - 1 : -1;
};
