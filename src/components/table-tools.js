/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import configLayer from './configlayer.js';
import Database from './database.js';
import exporter from './exporter.js';
import importer from './importer.js';
import messageStack from './messagestack.js';
import appStore from '../lib/app-store.js';
import { getConnection } from '../lib/connection.js';
import messenger from '../lib/messenger.js';
import svgIcon from '../lib/svgicon.js';
import { isDatabase } from '../lib/utils.js';

let target;

const summon = async (tableIdx, anchorId) => {
    target = appStore.target();
    if (isDatabase(target)) {
        target.table = appStore.table(tableIdx).name;
    }
    await exporter.init({
        usage: 'table',
        target,
        dexieExportFilter: (table) => table === target.table,
    });
    await importer.init({
        usage: 'table',
        target,
        dexieImportFilter: (table) => table === target.table,
    });
    configLayer.show({
        view,
        anchorId,
        confirmed: {
            empty: emptyTable,
            drop: dropTable,
        },
        buttons: [
            {
                label: 'close',
                handler: configLayer.handleButtonVisibility(anchorId),
                isClose: true,
            },
        ],
    });
};

const emptyTable = async () => {
    try {
        appStore.update({ loading: true, loadingMsg: `clearing table: ${target.table}` });
        const dbHandle = await getConnection(target.database);
        const table = dbHandle.table(target.table);
        await table.clear();
        configLayer.close();
    } catch (error) {
        messageStack.displayError(`${error.name}: ${error.message}`);
    }
    appStore.update({ tables: true, loading: false });
};

const dropTable = async () => {
    try {
        appStore.update({ loading: true, loadingMsg: `droping table: ${target.table}` });
        const tables = await Database.getTables(target.database);
        const schema = Database.schema(tables);
        schema[target.table] = null;
        await Database.changeSchema(target.database, schema);
        Database.init(appStore.state.selectedDB);
        configLayer.close();
    } catch (error) {
        messageStack.displayError(`${error.name}: ${error.message}`);
    }
    appStore.update({ loading: false, loadingMsg: '' });
    messenger.post({ type: 'tableDropped', target });
};

const view = () => {
    const loading = appStore.state.loading;
    const topic = configLayer.fromState('topic');
    return html`
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="import">
                ${svgIcon('tabler-download')}
                <label>import data</label>
            </a>
            ${topic == 'import' ? importer.panel() : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="export">
                ${svgIcon('tabler-upload')}
                <label>export data</label>
            </a>
            ${topic == 'export' ? exporter.panel() : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="empty">
                ${svgIcon('tabler-eraser')}
                <label>empty table</label>
            </a>
            ${topic == 'empty'
                ? configLayer.confirmOption(
                      'Delete all data from table',
                      target.table,
                      loading,
                  )
                : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="drop">
                ${svgIcon('tabler-trash')}
                <label>drop table</label>
            </a>
            ${topic === 'drop'
                ? configLayer.confirmOption('Drop table', target.table, loading)
                : ''}
        </p>
    `;
};

const TableTools = {
    summon,
};

export default TableTools;
