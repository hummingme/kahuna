/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { Dexie } from 'dexie';

import { getConnection } from '#lib/connection';
import { getCollection } from '#lib/dexie-utils';
import { ExecuteCodePayload } from '#types';

export const executeCode = async (load: ExecuteCodePayload) => {
    const vars = await initVariables(load);
    const varNames = Object.keys(vars);
    const varsList = varNames.join(', ');
    const asyncCode = `async function f(${varsList}) { ${load.code}; }; return f(${varsList})`;
    const jsFunc = new Function(...varNames, asyncCode);
    return await jsFunc(...Object.values(vars));
};

const initVariables = async (load: ExecuteCodePayload) => {
    const { target, selectorFields, selected, row, value } = load;
    const { database, table: tablename } = target;
    const db = await getConnection(database);
    const table = db.table(tablename);
    const selection = getCollection({ dexieTable: table, selected, selectorFields });
    return {
        db,
        table,
        selection,
        row,
        value,
        Dexie,
    };
};
