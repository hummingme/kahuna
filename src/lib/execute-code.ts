/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { Collection, Dexie, DexieConstructor, Table } from 'dexie';

import { getConnection } from '#lib/connection';
import { getCollection } from '#lib/dexie-utils';
import { ExecuteCodePayload, UnknownRecord } from '#types';

export const executeCode = async (load: ExecuteCodePayload) => {
    const vars = await initVariables(load);
    const varNames = Object.keys(vars);
    const varsList = varNames.join(', ');
    const asyncCode = `async function f(${varsList}) { ${load.code};\n }; return f(${varsList})`;
    const jsFunc = new Function(...varNames, asyncCode);
    return await jsFunc(...Object.values(vars));
};

type ExecuteCodeVars = {
    Dexie: DexieConstructor;
    db?: Dexie;
    table?: Table;
    selection?: Collection;
    row?: UnknownRecord;
    value?: unknown;
};
const initVariables = async (load: ExecuteCodePayload) => {
    const { user, target, selectorFields, selected, row, value } = load;
    const { database, table: tablename } = target;
    const vars: ExecuteCodeVars = {
        Dexie,
    };

    if (user !== 'origin') {
        vars.db = await getConnection(database);
        if (user !== 'database') {
            vars.table = vars.db.table(tablename);
            vars.selection = getCollection({
                dexieTable: vars.table,
                selected,
                selectorFields,
            });
        }
    }
    if (row && (user === 'editRow' || user === 'editValue')) {
        vars.row = row;
        if (value && user === 'editValue') {
            vars.value = value;
        }
    }

    return vars;
};
