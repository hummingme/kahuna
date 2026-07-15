/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { map } from 'lit/directives/map.js';
import { Dexie } from 'dexie';

import Database from '#components/database';
import databaseTools from '#components/database-tools';
import datatable from '#components/datatable';
import OriginTools from '#components/origin-tools';
import configLayer from '#components/configlayer';
import displayConfigControl from '#components/config/config-control';
import appStore from '#lib/app-store';
import { symbolButton } from '#lib/button';
import { getConnection } from '#lib/connection';
import { escapeUnicode } from '#lib/escape-unicode';
import messenger from '#lib/messenger';
import settings from '#lib/settings';
import { rowIndex } from '#lib/utils';
import type { KDatabase } from '#types';

const summon = async () => {
    if (typeof appStore.state.selectedTable === 'number') {
        datatable.release();
    }
    appStore.update({
        selectedDB: undefined,
        selectedTable: undefined,
        databases: await getDatabases(),
        tables: [],
    });
};

async function getDatabases(): Promise<KDatabase[]> {
    const dbnames = await Dexie.getDatabaseNames();
    const databases: KDatabase[] = [];
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

const template = (databases: KDatabase[]): TemplateResult => {
    const cnt = databases.length;
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
                          databases,
                          (db, idx) => html`
                              <tr
                                  title="click to load the database ${escapeUnicode(
                                      db.name,
                                  )}"
                              >
                                  <td>${escapeUnicode(db.name)}</td>
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

const onTbodyClicked = (event: Event) => {
    const target = event.target as HTMLElement;
    const databaseIdx = rowIndex(target);
    if (databaseIdx !== -1) {
        const td = target.closest('td');
        if (td?.firstElementChild && td.classList.contains('row-icons')) {
            const anchorId = td.firstElementChild.id;
            databaseTools.summon(databaseIdx, anchorId);
        } else {
            Database.summon(databaseIdx);
        }
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
    breadcrumbIcons,
};

export default Origin;
