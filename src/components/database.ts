/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';

import configLayer from '#components/configlayer';
import databaseTools from '#components/database-tools';
import datatable from '#components/datatable';
import { print } from '#lib/escape-string';
import messageStack from '#components/messagestack';
import tableTools from '#components/table-tools';
import { symbolButton } from '#components/parts/button';
import JsConsoleIcon from '#components/parts/js-console-icon';
import SettingsIcon from '#components/parts/settings-icon';
import appStore from '#lib/app-store';
import { closeDB, getDB, getConnection } from '#lib/connection';
import { shallowEqual } from '#lib/datatypes';
import { tableIndexesSpec } from '#lib/dexie-utils';
import env from '#lib/environment';
import { rowIndex } from '#lib/utils';
import type { KTable, Schema, SymbolButtonProps } from '#types';

type DBState = {
    dbname: string;
    selectedDB: number;
};

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
                <i>${print(dbstate.dbname)}</i>
                contains ${cnt} ${notation}:
            </h1>
            ${tablesTableTemplate(tables)}
        `;
    } else if (appStore.loading === true) {
        return html`
            <div class="lonely">
                Please be patient while the tables from
                <i>${print(dbstate.dbname)}</i>
                are loaded!
            </div>
        `;
    } else {
        return html`
            <div class="lonely">
                There are no tables in the database
                <i>${print(dbstate.dbname)}</i>
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
        const tableName = print(table.name);
        rows.push(html`
            <tr title="click to load the table ${tableName}">
                <td>${tableName}</td>
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
    const tableIdx = rowIndex(target);
    if (tableIdx !== -1) {
        const td = target.closest('td');
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

const schema = (tables: KTable[]): Schema => {
    return Object.fromEntries(
        tables.map((table) => [table.name, tableIndexesSpec(table)]),
    );
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

const changeSchema = async (databaseName: string, newSchema: Schema) => {
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

const tableToolsButtonId = 'table-tools-button-id';
const databaseToolsButtonId = 'database-tools-button-id';

const toolbarIcons = () => {
    const icons: SymbolButtonProps[] = [
        {
            title: 'database tools',
            id: databaseToolsButtonId,
            '@click': databaseToolsClicked,
            'data-databaseidx': dbstate.selectedDB,
            aria: {
                haspopup: true,
                expanded: false,
                label: 'database tools',
            },
            icon: 'tabler-settings',
        },
        new SettingsIcon().props(appStore.target()),
    ];
    if (env.codeExecution) {
        icons.push(
            new JsConsoleIcon().props({
                user: 'database',
                target: appStore.target(),
                executed: () => init(dbstate.selectedDB),
            }),
        );
    }

    return icons;
};

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
    toolbarIcons,
};

export default Database;
