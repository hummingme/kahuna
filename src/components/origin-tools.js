/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Origin from './origin.js';
import importer from './importer.js';
import configLayer from './configlayer.js';
import messageStack from './messagestack.js';
import appStore from '../lib/app-store.js';
import { getConnection, getDB } from '../lib/connection.js';
import messenger from '../lib/messenger.js';
import svgIcon from '../lib/svgicon.js';

const summon = async (anchorId) => {
    await importer.init({
        usage: 'origin',
        target: { database: '*', table: '*' },
    });
    configLayer.show({ view, anchorId });
};

const view = () => {
    const topic = configLayer.fromState('topic');
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

const createPanel = () => {
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

    const button = { click: createDatabase, text: 'create' };

    return configLayer.panel(content, button);
};

const createDatabase = async () => {
    const dbname = configLayer.node.querySelector('#create-dbname').value.trim();
    const tablename = configLayer.node.querySelector('#create-tablename').value.trim();
    const indexes = configLayer.node.querySelector('#create-indexes').value.trim();
    if (dbname.length > 0) {
        try {
            const db = getDB(dbname);
            const stores = {};
            if (tablename.length > 0) {
                stores[tablename] = indexes;
            }
            db.version(0.1).stores(stores);
            await getConnection(dbname);
        } catch (error) {
            messageStack.displayError(`Error creating database: ${error.message}`);
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
