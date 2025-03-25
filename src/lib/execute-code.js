/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { getConnection } from './connection.js';
import { getCollection } from './dexie-utils.js';

const initVariables = async (load) => {
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

const executeCode = async (load) => {
    const jsFunc = new Function(...load.varNames, load.asyncCode);
    const vars = await initVariables(load);
    await jsFunc(...Object.values(vars));
};

export default executeCode;
