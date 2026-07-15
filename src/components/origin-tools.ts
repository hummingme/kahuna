/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import Origin from '#components/origin';
import importer from '#components/importer';
import configLayer from '#components/configlayer';
import messageStack from '#components/messagestack';
import appStore from '#lib/app-store';
import { getConnection, getDB } from '#lib/connection';
import { unescapeUnicode } from '#lib/escape-unicode';
import messenger from '#lib/messenger';
import svgIcon from '#lib/svgicon';
import { PlainObject } from '#types';

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
    const dbnameInput = node.querySelector<HTMLInputElement>('#create-dbname');
    const tablenameInput = node.querySelector<HTMLInputElement>('#create-tablename');
    const indexesInput = node.querySelector<HTMLInputElement>('#create-indexes');
    if (!dbnameInput || !tablenameInput || !indexesInput) return;

    const dbname = unescapeUnicode(dbnameInput.value.trim());
    if (dbname.length === 0) return;

    const tablename = unescapeUnicode(tablenameInput.value.trim());
    const indexes = indexesInput.value.trim();
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
};

const OriginTools = {
    summon,
};

export default OriginTools;
