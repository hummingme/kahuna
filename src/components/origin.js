/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { map } from 'lit/directives/map.js';
import Dexie from 'dexie';
import Database from './database.js';
import DatabaseTools from './database-tools.js';
import OriginTools from './origin-tools.js';
import jsCodearea from './js-codearea.js';
import configLayer from './configlayer.js';
import displayConfigControl from './config/config-control.js';
import appStore from '../lib/app-store.js';
import { symbolButton } from '../lib/button.js';
import { getConnection } from '../lib/connection.js';
import messenger from '../lib/messenger.js';
import settings from '../lib/settings.js';

/**
 * action to force the Origin.template to get displayed
 */
const summon = async () => {
    if (appStore.state.selectedTable !== null) {
        appStore.state.datatable.release();
    }
    appStore.update({
        selectedDB: null,
        selectedTable: null,
        databases: await getDatabases(),
        tables: [],
        columns: [],
        rows: [],
    });
};

async function getDatabases() {
    const dbnames = await Dexie.getDatabaseNames();
    const databases = [];
    for (const dbname of dbnames) {
        if (settings.global('ignoreDatabases').includes(dbname)) {
            continue;
        }
        const dbHandle = await getConnection(dbname);
        databases.push({
            name: dbname,
            version: dbHandle.verno * 10,
            tables: dbHandle.tables.map((table) => table.name),
        });
    }
    return databases;
}

const codeareaOptions = {
    target: { database: '*', table: '*' },
    dbname: null,
    exposedVariables: () => ({}),
    execute: async (code) => {
        const newSchema = Database.schemaFromCode(code);
        await Database.changeSchema(codeareaOptions.dbname, newSchema);
    },
    executed: () => {
        appStore.update({ loading: false });
        codeareaOptions.dbname = null;
        const { selectedDB } = appStore.state;
        selectedDB === null ? summon() : Database.summon(selectedDB);
    },
};

const originToolsClicked = () => {
    OriginTools.summon(originToolsButtonId);
};

const settingsConfigClicked = () => {
    displayConfigControl({
        target: appStore.target(),
        anchorId: 'settings-config',
    });
};

const originToolsButtonId = 'origin-tools-button-id';
const databaseToolsButtonId = 'database-tools-button-id';

const breadcrumbIcons = [
    {
        icon: 'tabler-settings',
        '@click': originToolsClicked,
        title: 'origin tools',
        id: originToolsButtonId,
    },
    {
        icon: 'tabler-adjustments',
        title: 'origin settings and configuration',
        '@click': settingsConfigClicked,
        id: 'settings-config',
    },
];

const template = (state) => {
    let idx = 0;

    const jscodearea =
        codeareaOptions.dbname !== null
            ? html`
                  <div>${jsCodearea.view()}</div>
              `
            : '';
    const cnt = state.databases.length;
    return cnt > 0
        ? html`
              <h1 class="precis">
                  Origin
                  <i>${window.location.origin}</i>
                  has ${cnt} database${cnt === 1 ? '' : 's'}:
              </h1>
              <table class="origintable">
                  <thead>
                      <tr>
                          <th>Name</th>
                          <th>Version</th>
                          <th>Tables</th>
                          <th class="icon-col"></th>
                      </tr>
                  </thead>
                  <tbody @click=${onTbodyClicked}>
                      ${map(
                          state.databases,
                          (db, idx) => html`
                              <tr
                                  data-dbindex=${idx++}
                                  title="click to load the database ${db.name}"
                              >
                                  <td>${db.name}</td>
                                  <td class="center">${db.version}</td>
                                  <td class="center">${db.tables.length}</td>
                                  <td class="row-icons">
                                      ${symbolButton({
                                          icon: 'tabler-settings',
                                          title: 'database tools / import / export',
                                          id: `${databaseToolsButtonId}-${idx}`,
                                      })}
                                  </td>
                              </tr>
                          `,
                      )}
                  </tbody>
              </table>
              ${jscodearea}
          `
        : html`
              <div class="lonely">
                  No IndexedDB databases were found for
                  <i>${window.location.origin}</i>
                  !
              </div>
              <div class="lonely">
                  However, you could
                  <a @click=${createClicked}>create</a>
                  or
                  <a @click=${importClicked}>import</a>
                  a database.
              </div>
          `;
};

const onTbodyClicked = (ev) => {
    const td = ev.target.closest('td');
    const tr = ev.target.closest('tr');
    const databaseIdx = parseInt(tr.dataset.dbindex);
    if (td.classList.contains('row-icons')) {
        const anchorId = td.firstElementChild.id;
        DatabaseTools.summon(databaseIdx, anchorId);
    } else {
        Database.summon(databaseIdx);
    }
};

const createClicked = async () => {
    await OriginTools.summon(originToolsButtonId);
    configLayer.toggleTopic('create');
};
const importClicked = async () => {
    await OriginTools.summon(originToolsButtonId);
    configLayer.toggleTopic('import');
};

messenger.register('reloadOrigin', summon);

const Origin = {
    summon,
    template,
    getDatabases,
    codeareaOptions,
    breadcrumbIcons,
};

export default Origin;
