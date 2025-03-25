/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { isPlainObject } from './types';
import { selectedPrimKeys } from './row-selection';

export const isPrimKeyUnnamed = (primKey) => primKey.name.length === 0;
export const isPrimKeyNamed = (primKey) => primKey.name.length !== 0;
export const isPrimKeyCompound = (primKey) => primKey.compound === true;

/**
 * convert a dexie collection to an javascript array by callling either
 * collection.toArray() or collection.sortBy()
 */
export const collectionToArray = async (
    collection,
    addUnnamedPk,
    order = '',
    direction = 'asc',
) => {
    let data = addUnnamedPk
        ? await includeUnnamedPkValues(collection)
        : await collection.toArray();
    if (order.length > 0) {
        const up = direction === 'asc' ? 1 : -1;
        const down = -up;
        data.sort((a, b) => {
            if (a[order] === undefined) return down;
            if (b[order] === undefined) return up;
            return a[order] > b[order] ? up : down;
        });
    }
    return data;
};

const includeUnnamedPkValues = async (collection) => {
    const data = [];
    await collection.each((item, cursor) => {
        if (isPlainObject(item)) {
            item['*key*'] = cursor.primaryKey;
        } else {
            item = {
                '*key*': cursor.primaryKey,
                '*value*': item,
            };
        }
        data.push(item);
    });
    return data;
};

export const leadingUnnamedPkValues = async (collection, pkName) => {
    const data = [];
    await collection.each((item, cursor) => {
        if (isPlainObject(item)) {
            item = Object.assign(Object.fromEntries([[pkName, cursor.primaryKey]]), item);
        } else {
            item = {
                [pkName]: cursor.primaryKey,
                '*value*': item,
            };
        }
        data.push(item);
    });
    return data;
};

export const getCollection = ({ dexieTable, selectorFields, selected }) => {
    const { idx, keys } = selectedPrimKeys({ selected, selectorFields });
    return dexieTable.where(idx).anyOf(keys);
};
