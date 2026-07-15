/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */
import { type IndexableType, Table } from 'dexie';

import { isPrimKeyNamed, isPrimKeyCompound } from '#lib/dexie-utils';
import { replacer, reviver } from '#lib/json-wrapper';
import type { UnknownRecord } from '#types';

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
    rowData: UnknownRecord,
): number | string => {
    const pk = rowSelectorPrimKey(selectorFields, rowData);
    return typeof pk === 'number' ? pk : JSON.stringify(pk, replacer);
};

/**
 * returns the value or array of values from rowData of the primaryKey
 */
export const rowSelectorPrimKey = (
    selectorFields: string[],
    rowData: UnknownRecord,
): IndexableType => {
    return selectorFields.length === 1
        ? (rowData[selectorFields[0]] as IndexableType)
        : (selectorFields.map((field) => rowData[field]) as IndexableType);
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
