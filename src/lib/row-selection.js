/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { isPrimKeyNamed, isPrimKeyCompound } from '../lib/dexie-utils.js';
import { replacer, reviver } from './json-wrapper.js';

/*
 * return array of fields to uniquely identify rows
 */
export const rowSelectorFields = (table) => {
    if (isPrimKeyCompound(table.primKey)) {
        return table.primKey.keyPath;
    } else if (isPrimKeyNamed(table.primKey)) {
        return [table.primKey.name];
    } else {
        return ['*key*'];
    }
};

/**
 * returns a number or a string that uniquely identifies a data row
 */
export const rowSelector = (selectorFields, rowData) => {
    const pk = rowSelectorPrimKey(selectorFields, rowData);
    return typeof pk === 'number' ? pk : JSON.stringify(pk, replacer);
};

/**
 * returns the valu or array of values sfrom rowData of the primaryKey
 */
export const rowSelectorPrimKey = (selectorFields, rowData) => {
    return selectorFields.length === 1
        ? rowData[selectorFields[0]]
        : selectorFields.map((field) => rowData[field]);
};

/*
 * transform selected and selectorFields from datatable.state
 * to idx and key values for usage in a call of table.where(idx).anyOf(keys)
 **/
export const selectedPrimKeys = ({ selected, selectorFields }) => {
    const idx =
        selectorFields.length === 1 ? selectorFields[0] : `[${selectorFields.join('+')}]`;
    const keys = [...selected.values()].map((value) =>
        typeof value === 'number' ? value : JSON.parse(value, reviver),
    );
    return { idx, keys };
};
