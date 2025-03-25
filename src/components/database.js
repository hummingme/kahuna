/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import appStore from '../lib/app-store.js';
import configLayer from './configlayer.js';
import DatabaseTools from './database-tools.js';
import datatable from './datatable.js';
import jsCodearea from './js-codearea.js';
import messageStack from './messagestack.js';
import Origin from './origin.js';
import TableTools from './table-tools.js';
import displayConfigControl from './config/config-control.js';
import { symbolButton } from '../lib/button.js';
import { closeDB, getDB, getConnection } from '../lib/connection.js';
import { maybeQuotedProperty, shallowEqual } from '../lib/types.js';

let dbstate = {
    dbname: null,
    selectedDB: null,
};

/**
 * action to force the Database.view to get displayed
 */
const summon = async (databaseIdx) => {
    init(databaseIdx);
};

const init = async (selectedDB) => {
    const state = appStore.state;
    if (state.selectedTable !== null) {
        state.datatable.release();
    }
    const dbname = state.databases[selectedDB].name;
    dbstate = { dbname, selectedDB };

    appStore.update({
        loading: true,
        loadingMsg: 'loading tables...',
        selectedDB: dbstate.selectedDB,
        selectedTable: null,
    });
    const tables = await getTables(dbstate.dbname);
    appStore.update({ tables, loading: false });
};

async function getTables(databaseName) {
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

async function getTable(databaseName, tableName) {
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

const template = function (state) {
    const cnt = state.tables.length;
    const codearea =
        Origin.codeareaOptions.dbname !== null
            ? html`
                  <div>${jsCodearea.view()}</div>
              `
            : '';
    if (cnt > 0) {
        const notation = cnt == 1 ? 'table' : 'tables';
        return html`
            <h1 class="precis">
                Database
                <i>${dbstate.dbname}</i>
                contains ${cnt} ${notation}:
            </h1>
            ${tablesTableTemplate(state.tables)} ${codearea}
        `;
    } else if (appStore.loading === true) {
        return html`
            <div class="lonely">
                Please be patient while the databases from
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
            ${codearea}
        `;
    }
};

const tablesTableTemplate = function (tables) {
    const rows = [];

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
                        id: tableToolsButtonId,
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

const onTbodyClicked = (event) => {
    const td = event.target.closest('td');
    const tr = event.target.closest('tr');
    const tableIdx = parseInt(tr.dataset.tableindex);
    if (td.classList.contains('row-icons')) {
        const anchorId = td.firstElementChild.id;
        TableTools.summon(tableIdx, anchorId);
    } else {
        datatable.summon(tableIdx);
    }
};

const createClicked = () => {
    DatabaseTools.summon(dbstate.selectedDB, databaseToolsButtonId);
    configLayer.toggleTopic('create');
};

const schemaCode = (tables) => {
    const entries = Object.entries(schema(tables));
    return `/* modify newSchema and click execute */
const newSchema = {
${entries.map((entry) => `    ${maybeQuotedProperty(entry[0])}:"${entry[1]}"`).join(',\n')}
};`;
};

const schema = (tables) => {
    return tables.reduce((result, table) => {
        result[table.name] = [
            table.primKey.src,
            ...table.indexes.map((idx) => idx.src),
        ].join(',');
        return result;
    }, {});
};

const schemaFromCode = (code) => {
    let lines;
    const start = /const\s*newSchema\s*=\s*{\s+/g.exec(code);
    if (start === null) {
        throw `Error parsing schema, cannot find start: \`const newSchema = {\``;
    }
    const startIndex = start.index + start[0].length;
    const end = /\s*}\s*;/g.exec(code.slice(startIndex));
    if (end === null) {
        throw `Error parsing schema, cannot find end: \`};\``;
    }
    lines = code
        .slice(startIndex, end.index + startIndex)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length === 0) {
        throw `Error parsing schema, no table definitions found`;
    }
    const newSchema = {};
    lines.forEach((line) => {
        const res = line.match(/^(["'])?(.+)\1\s*:\s*((["'])(.*)\4|null),?$/);
        if (
            res === null ||
            res.length !== 6 ||
            (res[5] === undefined && res[3] !== 'null')
        ) {
            throw `Error parsing schema at line: \`${line}\``;
        }
        const tableName = res[1] === undefined ? res[2].trim() : res[2];
        const tableDef = res[3] === 'null' ? null : res[5];
        newSchema[tableName] = tableDef;
    });
    return newSchema;
};

const changeSchema = async (databaseName, newSchema) => {
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
            closeDB(databaseName);
            throw error;
        }
        closeDB(databaseName);
        return;
    }
    try {
        const newdb = getDB(databaseName);
        const currentSchema = schema(dbHandle.tables.map((t) => t.schema));
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
    } catch (error) {
        closeDB(databaseName);
        throw error;
    }
};

const databaseToolsClicked = (event) => {
    const databaseIdx = parseInt(event.target.closest('button').dataset.databaseidx);
    const anchorId = event.target.closest('button').id;
    DatabaseTools.summon(databaseIdx, anchorId);
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
    schema,
    schemaCode,
    schemaFromCode,
    changeSchema,
    breadcrumbIcons,
};

export default Database;
