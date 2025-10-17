/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { getConnection } from './connection.ts';
import { getCollection } from './dexie-utils.ts';
import { ExecuteCodePayload } from './types/messages.ts';

const initVariables = async (load: ExecuteCodePayload) => {
    const { database, table: tablename, selectorFields, selected, row } = load;
    const db = await getConnection(database);
    const table = db.table(tablename);
    const selection = getCollection({ dexieTable: table, selected, selectorFields });
    return {
        row,
        db,
        table,
        selection,
    };
};

const executeCode = async (load: ExecuteCodePayload) => {
    const vars = await initVariables(load);
    const varNames = Object.keys(vars);
    const varsList = varNames.join(', ');
    const asyncCode = `async function f(${varsList}) { ${load.code}; }; return f(${varsList})`;
    const jsFunc = new Function(...varNames, asyncCode);
    await jsFunc(...Object.values(vars));
};

export default executeCode;
