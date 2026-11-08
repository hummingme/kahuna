/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { Dexie } from 'dexie';

import configLayer from '#components/configlayer';
import Database from '#components/database';
import exporter from '#components/exporter';
import importer from '#components/importer';
import messageStack from '#components/messagestack';
import Origin from '#components/origin';
import schemaEditor from '#components/schema-editor';
import checkbox from '#components/parts/checkbox';
import textinput from '#components/parts/textinput';
import { toolEntry, focusButton } from '#components/parts/tool-entry';
import appStore from '#lib/app-store';
import { isGlobal } from '#lib/app-target';
import { getConnection, getDB } from '#lib/connection';
import { copyTableData } from '#lib/dexie-utils';
import { print, escapeUnicode, unescapeString } from '#lib/escape-string';
import messenger from '#lib/messenger';
import { camelize, uniqueName } from '#lib/utils';
import { validateIndexesString } from '#lib/validations';
import { KDatabase, Textinput } from '#types';

type DatabaseToolsState = {
    dbname: string;
    copyDbName: string;
    copyDbVersion: string;
    copyDbData: boolean;
    copyDbDisplayAfterwards: boolean;
};

const state = Symbol('database-tools state');

const DatabaseTools = class {
    [state]: DatabaseToolsState;
    constructor() {
        this[state] = {
            dbname: '',
            copyDbName: '',
            copyDbVersion: '1',
            copyDbData: true,
            copyDbDisplayAfterwards: true,
        };
    }
    async summon(databaseIdx: number, anchorId: string) {
        const dbname = appStore.state.databases[databaseIdx].name;
        const version = String(appStore.state.databases[databaseIdx].version);
        this[state] = {
            ...this[state],
            dbname,
            copyDbName: this.uniqueDatabaseName(dbname),
            copyDbVersion: version,
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
            ${toolEntry({
                label: 'export database',
                topic: 'export',
                panelOpen: topic === 'export',
                iconName: 'tabler-upload',
                panelView: () => exporter.panel(),
                refVar: focusButton,
            })}
            ${toolEntry({
                label: 'copy database',
                topic: 'copy',
                panelOpen: topic === 'copy',
                iconName: 'tabler-a-b-2',
                panelView: () => this.copyPanel(),
            })}
            ${toolEntry({
                label: 'edit schema',
                topic: 'edit',
                iconName: 'tabler-edit',
                onClick: () => this.editDatabase(this[state].dbname),
                aria: {},
            })}
            ${toolEntry({
                label: 'create table',
                topic: 'create',
                panelOpen: topic === 'create',
                iconName: 'tabler-square-rounded-plus',
                panelView: () => this.createTablePanel(),
            })}
            ${toolEntry({
                label: 'import data',
                topic: 'import',
                panelOpen: topic === 'import',
                iconName: 'tabler-download',
                panelView: () => importer.panel(),
            })}
            ${toolEntry({
                label: 'delete database',
                topic: 'delete',
                panelOpen: topic === 'delete',
                iconName: 'tabler-trash',
                panelView: () =>
                    configLayer.confirmOption(
                        'Are you sure to delete the database',
                        this[state].dbname,
                        appStore.state.loading,
                    ),
            })}
        `;
    }
    copyPanel(): TemplateResult {
        const content = html`
            <div class="form-grid">
                <label for="copy-db-name">database name</label>
                ${textinput({
                    id: 'copy-db-name',
                    classes: ['resizable'],
                    required: true,
                    '.value': escapeUnicode(this[state].copyDbName),
                    '@change': this.optionChanged.bind(this),
                }).view()}
                <label for="copy-db-version">database version</label>
                ${textinput({
                    id: 'copy-db_version',
                    type: 'number',
                    min: 1,
                    '.value': this[state].copyDbVersion,
                    '@change': this.optionChanged.bind(this),
                }).view()}
            </div>
            <div>
                ${checkbox({
                    id: 'copy-db-data',
                    label: 'copy data',
                    checked: this[state].copyDbData,
                    '@change': this.optionChanged.bind(this),
                })}
            </div>
            <div>
                ${checkbox({
                    id: 'copy--db-display-afterwards',
                    label: 'afterwards, display the copy',
                    checked: this[state].copyDbDisplayAfterwards,
                    '@change': this.optionChanged.bind(this),
                })}
            </div>
        `;
        const button = { label: 'execute', handler: this.copyDatabase.bind(this) };
        return configLayer.panel(content, button);
    }
    createTablePanel(): TemplateResult {
        const content = html`
            <div class="form-grid">
                <label for="create-table-name">table name</label>
                ${textinput({
                    id: 'create-table-name',
                    classes: ['resizable'],
                    required: true,
                }).view()}
                <label for="create-indexes">indexes</label>
                ${textinput({
                    id: 'create-table-indexes',
                    classes: ['resizable'],
                    '@input': this.onTableIndexesInput,
                }).view()}
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
                'copyDbDatabaseName',
                'copyDbData',
                'copyDbDisplayAfterwards',
                'copyDbVersion',
            ].includes(option)
        ) {
            const value = ['copyData', 'copyDisplayAfterwards'].includes(option)
                ? target.checked
                : unescapeString(target.value.trim());
            this[state] = { ...this[state], [option]: value };
        }
    }
    onTableIndexesInput(input: Textinput) {
        const indexes = input.node.value.trim();
        input.node.setCustomValidity(
            validateIndexesString(indexes) ? '' : 'invalid index specification',
        );
    }
    async copyDatabase(): Promise<void> {
        const { dbname: source, copyDbName: target } = this[state];
        const { copyDbVersion, copyDbData, copyDbDisplayAfterwards } = this[state];
        const error = this.validateCopyOptions(target, copyDbVersion);
        if (typeof error === 'object') {
            messageStack.display(error);
            return;
        }
        appStore.update({
            loading: true,
            loadingMsg: `copying database, source: ${print(source)}, target: ${print(target)}`,
        });
        configLayer.close();
        try {
            const schema = Database.schema(await Database.getTables(source));
            const db = getDB(target);
            db.version(parseInt(copyDbVersion) / 10).stores(schema);
            const dbhandle = await getConnection(target);
            if (copyDbData) {
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
        if (copyDbDisplayAfterwards) {
            appStore.update({ databases: await Origin.getDatabases() });
            Database.summon(appStore.databaseIdx(target));
        } else if (isGlobal(appStore.target())) {
            Origin.summon();
        }
        messageStack.displaySuccess(
            `Database copied! (source: ${print(source)}, target: ${print(target)})`,
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
            '#create-table-name',
        ) as HTMLInputElement;
        const tablename = unescapeString(tablenameInput.value.trim());
        const indexesInput = node.querySelector(
            '#create-table-indexes',
        ) as HTMLInputElement;
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
