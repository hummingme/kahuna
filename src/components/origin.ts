/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { map } from 'lit/directives/map.js';
import { Dexie } from 'dexie';

import configLayer from '#components/configlayer';
import Database from '#components/database';
import databaseTools from '#components/database-tools';
import datatable from '#components/datatable';
import OriginTools from '#components/origin-tools';
import { symbolButton } from '#components/parts/button';
import JsConsoleIcon from '#components/parts/js-console-icon';
import SettingsIcon from '#components/parts/settings-icon';
import appStore from '#lib/app-store';
import { getConnection } from '#lib/connection';
import env from '#lib/environment';
import { print } from '#lib/escape-string';
import messenger from '#lib/messenger';
import settings from '#lib/settings';
import { rowIndex } from '#lib/utils';
import type { KDatabase, SymbolButtonProps } from '#types';

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
    databases.sort((a, b) => a.name.localeCompare(b.name));
    return databases;
}

const originToolsClicked = () => {
    OriginTools.summon(originToolsButtonId);
};

const originToolsButtonId = 'origin-tools-button-id';
const databaseToolsButtonId = 'database-tools-button-id';

const toolbarIcons = () => {
    const icons: SymbolButtonProps[] = [
        {
            title: 'origin tools',
            id: originToolsButtonId,
            '@click': originToolsClicked,
            aria: {
                haspopup: true,
                expanded: false,
                label: 'origin tools',
            },
            icon: 'tabler-settings',
        },
        new SettingsIcon().props(appStore.target()),
    ];
    if (env.codeExecution) {
        icons.push(
            new JsConsoleIcon().props({
                user: 'origin',
                target: appStore.target(),
                executed: () => summon(),
            }),
        );
    }

    return icons;
};

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
                              <tr title="click to load the database ${print(db.name)}">
                                  <td>${print(db.name)}</td>
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
    toolbarIcons,
};

export default Origin;
