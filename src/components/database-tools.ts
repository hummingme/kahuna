/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { Dexie } from 'dexie';

import configLayer from './configlayer.ts';
import Database from './database.ts';
import exporter from './exporter.ts';
import importer from './importer.ts';
import messageStack from './messagestack.ts';
import Origin from './origin.ts';
import schemaEditor from './schema-editor.ts';
import appStore from '../lib/app-store.ts';
import { isGlobal } from '../lib/app-target.ts';
import checkbox from '../lib/checkbox.ts';
import { getConnection, getDB } from '../lib/connection.ts';
import messenger from '../lib/messenger.ts';
import svgIcon from '../lib/svgicon.ts';
import textinput from '../lib/textinput.ts';
import { camelize, uniqueName } from '../lib/utils.ts';
import { KDatabase } from '../lib/types/common.ts';
import { copyTableData } from '../lib/dexie-utils.ts';

interface DatabaseToolsState {
    dbname: string;
    copyDatabaseName: string;
    copyVersion: string;
    copyData: boolean;
    copyDisplayAfterwards: boolean;
}

const state = Symbol('database-tools state');

const DatabaseTools = class {
    [state]: DatabaseToolsState;
    constructor() {
        this[state] = {
            dbname: '',
            copyDatabaseName: '',
            copyVersion: '1',
            copyData: true,
            copyDisplayAfterwards: true,
        };
    }
    async summon(databaseIdx: number, anchorId: string) {
        const dbname = appStore.state.databases[databaseIdx].name;
        const version = String(appStore.state.databases[databaseIdx].version);
        this[state] = {
            ...this[state],
            dbname,
            copyDatabaseName: this.uniqueDatabaseName(dbname),
            copyVersion: version,
        };
        await exporter.init({
            usage: 'database',
            target: { database: this[state].dbname, table: '*' },
        });
        await importer.init({
            usage: 'database',
            target: { database: this[state].dbname, table: '*' },
        });
        configLayer.show({
            view: this.view.bind(this),
            anchorId,
            confirmed: { delete: this.deleteDatabase.bind(this) },
            buttons: [
                {
                    label: 'close',
                    handler: configLayer.handleButtonVisibility(anchorId),
                    isClose: true,
                },
            ],
        });
    }
    view(): TemplateResult {
        const topic = configLayer.topic;
        return html`
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="export">
                    ${svgIcon('tabler-upload')}
                    <label>export database</label>
                </a>
                ${topic == 'export' ? exporter.panel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="copy">
                    ${svgIcon('tabler-a-b-2')}
                    <label>copy database</label>
                </a>
                ${topic == 'copy' ? this.copyPanel() : ''}
            </p>
            <p>
                <a
                    @click=${this.editDatabase.bind(null, this[state].dbname)}
                    data-topic="edit"
                >
                    ${svgIcon('tabler-edit')}
                    <label>edit schema</label>
                </a>
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="create">
                    ${svgIcon('tabler-square-rounded-plus')}
                    <label>create table</label>
                </a>
                ${topic === 'create' ? this.createTablePanel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="import">
                    ${svgIcon('tabler-download')}
                    <label>import data</label>
                </a>
                ${topic === 'import' ? importer.panel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="delete">
                    ${svgIcon('tabler-trash')}
                    <label>delete database</label>
                </a>
                ${topic === 'delete'
                    ? configLayer.confirmOption(
                          'Are you sure to delete the database',
                          this[state].dbname,
                          appStore.state.loading,
                      )
                    : ''}
            </p>
        `;
    }
    copyPanel(): TemplateResult {
        const content = html`
            <div>
                <div>
                    <label for="copy-database-name">database name</label>
                    ${textinput({
                        id: 'copy-database-name',
                        size: 15,
                        class: 'right',
                        required: true,
                        '.value': this[state].copyDatabaseName,
                        '@change': this.optionChanged.bind(this),
                    })}
                </div>
                <div>
                    <label for="copy-version">database version</label>
                    ${textinput({
                        id: 'copy-version',
                        size: 5,
                        type: 'number',
                        min: 1,
                        '.value': this[state].copyVersion,
                        '@change': this.optionChanged.bind(this),
                    })}
                </div>
                <div>
                    ${checkbox({
                        id: 'copy-data',
                        label: 'copy data',
                        checked: this[state].copyData,
                        '@change': this.optionChanged.bind(this),
                    })}
                </div>
                <div>
                    ${checkbox({
                        id: 'copy-display-afterwards',
                        label: 'afterwards, display the copy',
                        checked: this[state].copyDisplayAfterwards,
                        '@change': this.optionChanged.bind(this),
                    })}
                </div>
            </div>
        `;
        const button = { label: 'execute', handler: this.copyDatabase.bind(this) };
        return configLayer.panel(content, button);
    }
    createTablePanel(): TemplateResult {
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
        const button = { label: 'create', handler: this.createTable.bind(this) };
        return configLayer.panel(content, button);
    }
    optionChanged(event: Event) {
        const target = event.target as HTMLInputElement;
        const option = camelize(target.id);
        if (
            [
                'copyDatabaseName',
                'copyData',
                'copyDisplayAfterwards',
                'copyVersion',
            ].includes(option)
        ) {
            const value = ['copyData', 'copyDisplayAfterwards'].includes(option)
                ? target.checked
                : target.value.trim();
            this[state] = { ...this[state], [option]: value };
        }
    }
    async copyDatabase(): Promise<void> {
        const { dbname: source, copyDatabaseName: target } = this[state];
        const { copyVersion, copyData, copyDisplayAfterwards } = this[state];
        const error = this.validateCopyOptions(target, copyVersion);
        if (typeof error === 'object') {
            messageStack.display(error);
            return;
        }
        appStore.update({
            loading: true,
            loadingMsg: `copying database, source: ${source}, target: ${target}`,
        });
        configLayer.close();
        try {
            const schema = Database.schema(await Database.getTables(source));
            const db = getDB(target);
            db.version(parseInt(copyVersion) / 10).stores(schema);
            const dbhandle = await getConnection(target);
            if (copyData) {
                for (const table of dbhandle.tables) {
                    await copyTableData(
                        { table: table.name, database: source },
                        { table: table.name, database: target },
                    );
                }
            }
        } catch (error) {
            messageStack.displayError(error);
            return;
        } finally {
            appStore.update({ loading: false, loadingMsg: '' });
        }
        if (copyDisplayAfterwards) {
            appStore.update({ databases: await Origin.getDatabases() });
            Database.summon(appStore.databaseIdx(target));
        } else if (isGlobal(appStore.target())) {
            Origin.summon();
        }
        messageStack.displaySuccess(
            `Database copied! (source: ${source}, target: ${target})`,
        );
    }
    validateCopyOptions(databaseName: string, version: string): object | undefined {
        if (databaseName.length === 0) {
            return {
                type: 'warn',
                content: 'Please provide a name for the copied database!',
            };
        }
        if (
            appStore.state.databases.filter((db) => db.name === databaseName).length > 0
        ) {
            return {
                type: 'error',
                content: `Cannot copy to ${databaseName}, this database already exists!`,
            };
        }
        if (/^[0-9]{1,}$/.test(version) === false || version === '0') {
            return {
                type: 'warn',
                content: 'Please provide a valid version number for the copied database!',
            };
        }
        return;
    }
    uniqueDatabaseName(databaseName: string): string {
        const existingNames = appStore.state.databases.map((db) => db.name);
        return uniqueName(databaseName, existingNames);
    }
    async createTable() {
        const node = configLayer.getNode();
        if (node === undefined) return;
        const tablenameInput = node.querySelector(
            '#create-tablename',
        ) as HTMLInputElement;
        const tablename = tablenameInput.value.trim();
        const indexesInput = node.querySelector('#create-indexes') as HTMLInputElement;
        const indexes = indexesInput.value.trim();
        if (tablename.length > 0) {
            appStore.update({
                loading: true,
                loadingMsg: `creating table: ${tablename}`,
            });
            try {
                await Database.addTable(this[state].dbname, tablename, indexes);
                const selectedDB = appStore.state.databases.findIndex(
                    (db: KDatabase) => db.name === this[state].dbname,
                );
                Database.init(selectedDB);
                configLayer.close();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown error';
                messageStack.displayError(`Error creating table: ${message}`);
            }
            appStore.update({ loading: false, loadingMsg: '' });
        }
    }
    async deleteDatabase() {
        appStore.update({
            loading: true,
            loadingMsg: 'deleting database',
        });
        await Dexie.delete(this[state].dbname);

        appStore.update({
            databases: await Origin.getDatabases(),
            selectedDB: undefined,
            loading: false,
        });
        messenger.post({ type: 'changedDatabases' });
        messenger.post({
            type: 'databaseDropped',
            target: { database: this[state].dbname, table: '*' },
        });
        configLayer.close();
    }
    async editDatabase(dbname: string) {
        configLayer.close();
        schemaEditor.show({ database: dbname, table: '*' });
    }
};

const databaseTools = new DatabaseTools();

export default databaseTools;
