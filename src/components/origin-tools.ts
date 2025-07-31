/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import Origin from './origin.ts';
import importer from './importer.ts';
import configLayer from './configlayer.ts';
import messageStack from './messagestack.ts';
import appStore from '../lib/app-store.ts';
import { getConnection, getDB } from '../lib/connection.ts';
import messenger from '../lib/messenger.ts';
import svgIcon from '../lib/svgicon.ts';
import { PlainObject } from '../lib/types/common.ts';

const summon = async (anchorId: string) => {
    await importer.init({
        usage: 'origin',
        target: { database: '*', table: '*' },
    });
    configLayer.show({ view, anchorId });
};

const view = (): TemplateResult => {
    const topic = configLayer.topic;
    return html`
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="import">
                ${svgIcon('tabler-download')}
                <label>import database</label>
            </a>
            ${topic === 'import' ? importer.panel() : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="create">
                ${svgIcon('tabler-square-rounded-plus')}
                <label>create database</label>
            </a>
            ${topic === 'create' ? createPanel() : ''}
        </p>
    `;
};

const createPanel = (): TemplateResult => {
    const content = html`
        <div>
            <div>
                <label for="create-dbname">database name</label>
                <input type="text" id="create-dbname" class="right" size="15" />
            </div>
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

    const button = { label: 'create', handler: createDatabase };

    return configLayer.panel(content, button);
};

const createDatabase = async () => {
    const node = configLayer.getNode();
    if (node === undefined) return;
    const dbnameInput = node.querySelector('#create-dbname') as HTMLInputElement;
    const dbname = dbnameInput.value.trim();
    const tablenameInput = node.querySelector('#create-tablename') as HTMLInputElement;
    const tablename = tablenameInput.value.trim();
    const indexesInput = node.querySelector('#create-indexes') as HTMLInputElement;
    const indexes = indexesInput.value.trim();
    if (dbname.length > 0) {
        try {
            const db = getDB(dbname);
            const stores: PlainObject = {};
            if (tablename.length > 0) {
                stores[tablename] = indexes;
            }
            db.version(0.1).stores(stores);
            await getConnection(dbname);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            messageStack.displayError(`Error creating database: ${message}`);
        }
        const databases = await Origin.getDatabases();
        appStore.update({
            loading: false,
            databases,
        });
        messenger.post({ type: 'changedDatabases' });
        configLayer.close();
    }
};

const OriginTools = {
    summon,
};

export default OriginTools;
