/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import appStore from '../lib/app-store.ts';
import configLayer from './configlayer.ts';
import databaseTools from './database-tools.ts';
import datatable from './datatable.ts';
import messageStack from './messagestack.ts';
import tableTools from './table-tools.ts';
import displayConfigControl from './config/config-control.ts';
import { symbolButton } from '../lib/button.ts';
import { closeDB, getDB, getConnection } from '../lib/connection.ts';
import { shallowEqual } from '../lib/datatypes.ts';
import { tableIndexesSpec } from '../lib/dexie-utils.ts';
import type { KTable, PlainObject } from '../lib/types/common.ts';

interface DBState {
    dbname: string;
    selectedDB: number;
}

let dbstate: DBState;

/**
 * action to force the Database.view to get displayed
 */
const summon = async (databaseIdx: number) => {
    init(databaseIdx);
};

const init = async (selectedDB: number) => {
    const state = appStore.state;
    if (state.selectedTable !== undefined) {
        datatable.release();
    }
    const dbname = state.databases[selectedDB].name;
    dbstate = { dbname, selectedDB };

    appStore.update({
        loading: true,
        loadingMsg: 'loading tables...',
        selectedDB: dbstate.selectedDB,
        selectedTable: undefined,
    });
    const tables = await getTables(dbstate.dbname);
    appStore.update({ tables, loading: false });
};

async function getTables(databaseName: string): Promise<KTable[]> {
    const handle = await getConnection(databaseName);
    const tables = [];
    for (const dexieTable of handle.tables) {
        tables.push({
            name: dexieTable.name,
            indexes: dexieTable.schema.indexes,
            primKey: dexieTable.schema.primKey,
            count: await dexieTable.count(),
        });
    }
    tables.sort((a, b) => a.name.localeCompare(b.name));
    return tables;
}

async function getTable(databaseName: string, tableName: string): Promise<KTable> {
    const handle = await getConnection(databaseName);
    const dexieTable = handle.table(tableName);
    const table = {
        name: dexieTable.name,
        indexes: dexieTable.schema.indexes,
        primKey: dexieTable.schema.primKey,
        count: await dexieTable.count(),
    };
    return table;
}

const template = function (tables: KTable[]): TemplateResult {
    const cnt = tables.length;
    if (cnt > 0) {
        const notation = cnt == 1 ? 'table' : 'tables';
        return html`
            <h1 class="precis">
                Database
                <i>${dbstate.dbname}</i>
                contains ${cnt} ${notation}:
            </h1>
            ${tablesTableTemplate(tables)}
        `;
    } else if (appStore.loading === true) {
        return html`
            <div class="lonely">
                Please be patient while the tables from
                <i>${dbstate.dbname}</i>
                are loaded!
            </div>
        `;
    } else {
        return html`
            <div class="lonely">
                There are no tables in the database
                <i>${dbstate.dbname}</i>
                !
            </div>
            <div class="lonely">
                However, you could
                <a @click=${createClicked}>create</a>
                a new one.
            </div>
        `;
    }
};

const tablesTableTemplate = function (tables: KTable[]): TemplateResult {
    const rows: TemplateResult[] = [];

    tables.forEach((table, idx) => {
        const idxstr = table.indexes.map((i) => i.src).join(', ');
        rows.push(html`
            <tr data-tableindex=${idx} title="click to load the table ${table.name}">
                <td>${table.name}</td>
                <td class="center">${table.primKey.src}</td>
                <td class="wrap">${idxstr}</td>
                <td class="center">${table.count}</td>
                <td class="row-icons">
                    ${symbolButton({
                        icon: 'tabler-settings',
                        title: 'table tools / import / export',
                        id: `${tableToolsButtonId}-${idx}`,
                    })}
                </td>
            </tr>
        `);
    });

    return html`
        <table class="databasetable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Primary Key</th>
                    <th>Indexes</th>
                    <th># Records</th>
                    <th class="icon-col">&nbsp;</th>
                </tr>
            </thead>
            <tbody @click=${onTbodyClicked}>${rows}</tbody>
        </table>
    `;
};

const onTbodyClicked = (event: Event) => {
    const target = event.target as HTMLElement;
    const td = target.closest('td');
    const tr = target.closest('tr');
    if (tr?.dataset?.tableindex) {
        const tableIdx = parseInt(tr.dataset.tableindex);
        if (td?.firstElementChild && td.classList.contains('row-icons')) {
            const anchorId = td.firstElementChild.id;
            tableTools.summon(tableIdx, anchorId);
        } else {
            datatable.summon(tableIdx);
        }
    }
};

const createClicked = async () => {
    await databaseTools.summon(dbstate.selectedDB, databaseToolsButtonId);
    configLayer.toggleTopic('create');
};

const schema = (tables: KTable[]): PlainObject => {
    return tables.reduce((result, table) => {
        result[table.name] = tableIndexesSpec(table);
        return result;
    }, {} as PlainObject);
};

const databaseTables = async (databaseName: string) => {
    const { databases, selectedDB, tables } = appStore.state;
    return selectedDB && databaseName === databases[selectedDB].name
        ? tables
        : await getTables(databaseName);
};

const addTable = async (databaseName: string, tableName: string, indexes: string) => {
    const tables = await databaseTables(databaseName);
    const dbSchema = schema(tables);
    dbSchema[tableName] = indexes;
    await changeSchema(databaseName, dbSchema);
};

const changeSchema = async (databaseName: string, newSchema: PlainObject) => {
    const dbHandle = await getConnection(databaseName);
    const tablesCount = dbHandle.tables.length;
    const version = dbHandle.verno;
    closeDB(databaseName);

    // if database has no tables, it needs to be recreated
    if (tablesCount === 0) {
        await dbHandle.delete();
        try {
            const newdb = getDB(databaseName);
            newdb.version(0.1).stores(newSchema);
            await getConnection(databaseName);
        } catch (error) {
            closeDB(databaseName);
            const newdb = getDB(databaseName);
            newdb.version(0.1).stores({});
            await getConnection(databaseName);
            throw error;
        } finally {
            closeDB(databaseName);
        }
        return true;
    }
    try {
        const newdb = getDB(databaseName);
        const currentSchema = schema(
            dbHandle.tables.map((table) => ({
                name: table.schema.name,
                indexes: table.schema.indexes,
                primKey: table.schema.primKey,
                count: 0,
            })),
        );
        if (
            !shallowEqual(currentSchema, newSchema) &&
            Object.keys(newSchema).length > 0
        ) {
            newdb.version(version).stores(currentSchema);
            newdb.version(version + 0.1).stores(newSchema);
            await getConnection(databaseName);
        } else {
            messageStack.displayInfo('Database schema is unmodified.');
        }
    } finally {
        closeDB(databaseName);
    }
    return true;
};

const databaseToolsClicked = (event: Event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (button && button.dataset.databaseidx) {
        const databaseIdx = parseInt(button.dataset.databaseidx);
        const anchorId = button.id;
        databaseTools.summon(databaseIdx, anchorId);
    }
};

const settingsConfigClicked = () => {
    displayConfigControl({
        target: appStore.target(),
        realm: 'behavior',
        anchorId: 'settings-config',
    });
};

const tableToolsButtonId = 'table-tools-button-id';
const databaseToolsButtonId = 'database-tools-button-id';

const breadcrumbIcons = () => [
    {
        icon: 'tabler-settings',
        '@click': databaseToolsClicked,
        title: 'database tools',
        id: databaseToolsButtonId,
        'data-databaseidx': dbstate.selectedDB,
    },
    {
        icon: 'tabler-adjustments',
        title: 'database settings and configuration',
        '@click': settingsConfigClicked,
        id: 'settings-config',
    },
];

const Database = {
    summon,
    init,
    template,
    getTables,
    getTable,
    addTable,
    databaseTables,
    schema,
    changeSchema,
    breadcrumbIcons,
};

export default Database;
