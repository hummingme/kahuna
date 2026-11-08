/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import Origin from '#components/origin';
import importer from '#components/importer';
import configLayer from '#components/configlayer';
import messageStack from '#components/messagestack';
import textinput from '#components/parts/textinput';
import { toolEntry, focusButton } from '#components/parts/tool-entry';
import appStore from '#lib/app-store';
import { getConnection, getDB } from '#lib/connection';
import { print, unescapeString } from '#lib/escape-string';
import messenger from '#lib/messenger';
import { validateIndexesString } from '#lib/validations';
import { PlainObject, Textinput } from '#types';

const summon = async (anchorId: string) => {
    await importer.init({
        usage: 'origin',
        target: { database: '*', table: '*' },
    });
    configLayer.show({
        view,
        anchorId,
        onReady: configlayerReady,
    });
};
const configlayerReady = (_layer: HTMLDivElement) => {
    if (dbNameInput) {
        dbNameInput.setCustomValidity(getDatabaseNameError(''));
        updateCreateButtonState();
    }
};

const view = (): TemplateResult => {
    const topic = configLayer.topic;
    return html`
        ${toolEntry({
            label: 'import database',
            topic: 'import',
            panelOpen: topic === 'import',
            iconName: 'tabler-download',
            panelView: importer.panel.bind(importer),
            refVar: focusButton,
        })}
        ${toolEntry({
            label: 'create database',
            topic: 'create',
            panelOpen: topic === 'create',
            iconName: 'tabler-square-rounded-plus',
            panelView: createPanel,
        })}
    `;
};

let dbNameInput: Textinput | undefined;

const createPanel = (): TemplateResult => {
    dbNameInput = textinput({
        id: 'create-db-name',
        classes: ['resizable'],
        '@input': onDatabaseNameInput,
    });
    const content = html`
        <form>
            <div class="form-grid">
                <label for="create-db-name">database name</label>
                ${dbNameInput.view()}
                <label for="create-db-tablename">table name</label>
                ${textinput({ id: 'create-db-tablename', classes: ['resizable'] }).view()}
                <label for="create-db-indexes">indexes</label>
                ${textinput({
                    id: 'create-db-indexes',
                    classes: ['resizable'],
                    '@input': onTableIndexesInput,
                }).view()}
            </div>
        </form>
    `;
    const button = {
        label: 'create',
        handler: createDatabase,
        id: 'create_db_button',
    };

    return configLayer.panel(content, button);
};

const onDatabaseNameInput = (input: Textinput): void => {
    const name = input.node.value.trim();
    const message = getDatabaseNameError(name);
    input.node.setCustomValidity(message);
    updateCreateButtonState();
};

const getDatabaseNameError = (name: string): string => {
    if (name.length === 0) return 'enter a name for the new database';
    if (appStore.state.databases.some((db) => db.name === name)) {
        return `the database ${print(name)} already exists`;
    }
    return '';
};

const onTableIndexesInput = (input: Textinput): void => {
    const indexes = input.node.value.trim();
    input.node.setCustomValidity(getTableIndexesError(indexes));
    updateCreateButtonState();
};

const getTableIndexesError = (indexes: string): string => {
    return validateIndexesString(indexes) ? '' : 'invalid index specification';
};

const updateCreateButtonState = () => {
    const layer = configLayer.getNode();
    if (!layer) return;
    const form = layer.querySelector<HTMLFormElement>('form');
    const button = layer.querySelector<HTMLButtonElement>('#create_db_button');
    if (form && button) {
        button.disabled = !form.checkValidity();
    }
};

const createDatabase = async () => {
    const node = configLayer.getNode();
    if (!node) return;
    const dbnameInput = node.querySelector<HTMLInputElement>('#create-db-name');
    const tablenameInput = node.querySelector<HTMLInputElement>('#create-db-tablename');
    const indexesInput = node.querySelector<HTMLInputElement>('#create-db-indexes');
    if (!dbnameInput || !tablenameInput || !indexesInput) return;

    const dbname = unescapeString(dbnameInput.value.trim());
    if (dbname.length === 0) return;

    const tablename = unescapeString(tablenameInput.value.trim());
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
