/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Dexie from 'dexie';

import configLayer from './configlayer.js';
import Database from './database.js';
import exporter from './exporter.js';
import importer from './importer.js';
import messageStack from './messagestack.js';
import Origin from './origin.js';
import appStore from '../lib/app-store.js';
import jsCodearea from './js-codearea.js';
import messenger from '../lib/messenger.js';
import svgIcon from '../lib/svgicon.js';

let dbname;

const summon = async (databaseIdx, anchorId) => {
    dbname = appStore.state.databases[databaseIdx].name;
    await exporter.init({
        usage: 'database',
        target: { database: dbname, table: '*' },
    });
    await importer.init({
        usage: 'database',
        target: { database: dbname, table: '*' },
    });
    configLayer.show({
        view,
        anchorId,
        confirmed: { delete: deleteDatabase },
        buttons: [
            {
                label: 'close',
                handler: configLayer.handleButtonVisibility(anchorId),
                isClose: true,
            },
        ],
    });
};

const view = () => {
    const topic = configLayer.fromState('topic');
    return html`
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="export">
                ${svgIcon('tabler-upload')}
                <label>export database</label>
            </a>
            ${topic == 'export' ? exporter.panel() : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="import">
                ${svgIcon('tabler-download')}
                <label>import data</label>
            </a>
            ${topic === 'import' ? importer.panel() : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="create">
                ${svgIcon('tabler-square-rounded-plus')}
                <label>create table</label>
            </a>
            ${topic === 'create' ? createTablePanel() : ''}
        </p>
        <p>
            <a @click=${editDatabase.bind(null, dbname)} data-topic="edit">
                ${svgIcon('tabler-edit')}
                <label>edit database schema</label>
            </a>
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="delete">
                ${svgIcon('tabler-trash')}
                <label>delete database</label>
            </a>
            ${topic === 'delete'
                ? configLayer.confirmOption(
                      'Are you sure to delete the database',
                      dbname,
                      appStore.state.loading,
                  )
                : ''}
        </p>
    `;
};

const createTablePanel = () => {
    const content = html`
        <div>
            <div>
                <label for="create-tablename">table name</label>
                <input type="text" id="create-tablename" class="right" size="15" />
            </div>
            <div>
                <label for="create-indexes">indexes</label>
                <input type="text" id="create-indexes" class="right" size="15" />
            </div>
        </div>
    `;

    const button = { click: createTable, text: 'create' };

    return configLayer.panel(content, button);
};

const createTable = async () => {
    const tablename = configLayer.node.querySelector('#create-tablename').value.trim();
    const indexes = configLayer.node.querySelector('#create-indexes').value.trim();
    if (tablename.length > 0) {
        appStore.update({ loading: true, loadingMsg: `creating table: ${tablename}` });
        const { databases, tables } = appStore.state;
        const schema = Database.schema(tables);
        schema[tablename] = indexes;
        try {
            await Database.changeSchema(dbname, schema);
            const selectedDB = databases.findIndex((db) => db.name === dbname);
            Database.init(selectedDB);
            configLayer.close();
        } catch (error) {
            messageStack.displayError(`${error.name}: ${error.message}`);
        }
        appStore.update({ loading: false, loadingMsg: '' });
    }
};

const deleteDatabase = async () => {
    appStore.update({
        loading: true,
        loadingMsg: 'deleting database',
    });
    await Dexie.delete(dbname);

    appStore.update({
        databases: await Origin.getDatabases(),
        selectedDB: null,
        loading: false,
    });
    messenger.post({ type: 'changedDatabases' });
    messenger.post({ type: 'databaseDropped', target: { database: dbname, table: '*' } });
    configLayer.close();
};

const editDatabase = async (dbname) => {
    Origin.codeareaOptions.dbname = dbname;
    await jsCodearea.init(Origin.codeareaOptions);
    const tables = await Database.getTables(dbname);
    const code = Database.schemaCode(tables);
    jsCodearea.update({ code });
    configLayer.close();
    appStore.rerender();
};

const DatabaseTools = {
    summon,
    editDatabase,
};

export default DatabaseTools;
