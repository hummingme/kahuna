/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */
import { type Table } from 'dexie';
import { isPrimKeyNamed, isPrimKeyCompound } from '../lib/dexie-utils.ts';
import { replacer, reviver } from './json-wrapper.ts';
import type { PlainObject } from './types/common.ts';

/*
 * return array of fields to uniquely identify rows
 */
export const rowSelectorFields = (table: Table): string[] => {
    const primKey = table.schema.primKey;
    if (isPrimKeyCompound(primKey) && Array.isArray(primKey.keyPath)) {
        return primKey.keyPath;
    } else if (isPrimKeyNamed(primKey)) {
        return [primKey.name];
    } else {
        return ['*key*'];
    }
};

/**
 * returns a number or a string that uniquely identifies a data row
 */
export const rowSelector = (
    selectorFields: string[],
    rowData: PlainObject,
): number | string => {
    const pk = rowSelectorPrimKey(selectorFields, rowData);
    return typeof pk === 'number' ? pk : JSON.stringify(pk, replacer);
};

/**
 * returns the valu or array of values sfrom rowData of the primaryKey
 */
export const rowSelectorPrimKey = (
    selectorFields: string[],
    rowData: PlainObject,
): any | any[] => {
    return selectorFields.length === 1
        ? rowData[selectorFields[0]]
        : selectorFields.map((field) => rowData[field]);
};

/*
 * transform selected and selectorFields from datatable.state
 * to idx and key values for usage in a call of table.where(idx).anyOf(keys)
 **/
export const selectedPrimKeys = ({
    selected,
    selectorFields,
}: {
    selected: Set<number | string>;
    selectorFields: string[];
}) => {
    let idx =
        selectorFields.length === 1 ? selectorFields[0] : `[${selectorFields.join('+')}]`;
    if (idx === '*key*') idx = ':id';
    const keys = [...selected.values()].map((value) =>
        typeof value === 'number' ? value : JSON.parse(value, reviver),
    );
    return { idx, keys };
};
