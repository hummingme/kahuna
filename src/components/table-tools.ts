/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import configLayer from '#components/configlayer';
import Database from '#components/database';
import datatable from '#components/datatable';
import exporter from '#components/exporter';
import importer from '#components/importer';
import messageStack from '#components/messagestack';
import checkbox from '#components/parts/checkbox';
import { labeledSelectbox } from '#components/parts/selectbox';
import textinput from '#components/parts/textinput';
import { toolEntry, focusButton } from '#components/parts/tool-entry';
import appStore from '#lib/app-store';
import { globalTarget, isDatabase } from '#lib/app-target';
import { getConnection } from '#lib/connection';
import { copyTableData, tableIndexesSpec } from '#lib/dexie-utils';
import { print, escapeUnicode, unescapeString } from '#lib/escape-string';
import messenger from '#lib/messenger';
import { camelize, selfMap, uniqueName } from '#lib/utils';
import type { AppTarget, KTable } from '#types';

type TableToolsState = {
    target: AppTarget;
    copyTableName: string;
    copyTargetDb: string;
    copyData: boolean;
    copyDisplayAfterwards: true;
};

const state = Symbol('table-tools state');

const TableTools = class {
    [state]: TableToolsState;
    constructor() {
        this[state] = {
            target: globalTarget,
            copyTableName: '',
            copyTargetDb: '',
            copyData: true,
            copyDisplayAfterwards: true,
        };
    }
    async summon(tableIdx: number, anchorId: string): Promise<void> {
        const target = appStore.target();
        const table = appStore.table(tableIdx);
        if (!table) {
            throw new Error(
                `Invalid invocation of TableTools, tableIdx ${tableIdx} not found!`,
            );
        }
        if (isDatabase(target)) {
            target.table = table.name;
        }
        this[state] = {
            ...this[state],
            target,
            copyTableName: this.uniqueTablename(target.table),
            copyTargetDb: target.database,
        };
        await exporter.init({
            usage: 'table',
            target,
            dexieExportFilter: (table: string) => table === target.table,
        });
        await importer.init({
            usage: 'table',
            target,
            dexieImportFilter: (table: string) => table === target.table,
        });
        configLayer.show({
            view: this.view.bind(this),
            anchorId,
            confirmed: {
                empty: this.emptyTable.bind(this),
                drop: this.dropTable.bind(this),
            },
            buttons: [
                {
                    label: 'close',
                    handler: configLayer.handleButtonVisibility(anchorId),
                    isClose: true,
                },
            ],
        });
    }
    view() {
        const topic = configLayer.topic;
        const tablename = print(this[state].target.table);
        const loading = appStore.state.loading;
        return html`
            ${toolEntry({
                label: 'import data',
                topic: 'import',
                panelOpen: topic === 'import',
                iconName: 'tabler-download',
                panelView: () => importer.panel(),
                refVar: focusButton,
            })}
            ${toolEntry({
                label: 'export data',
                topic: 'export',
                panelOpen: topic === 'export',
                iconName: 'tabler-upload',
                panelView: () => exporter.panel(),
            })}
            ${toolEntry({
                label: 'copy table',
                topic: 'copy',
                panelOpen: topic === 'copy',
                iconName: 'tabler-a-b-2',
                panelView: () => this.copyPanel(),
            })}
            ${toolEntry({
                label: 'empty table',
                topic: 'empty',
                panelOpen: topic === 'empty',
                iconName: 'tabler-eraser',
                panelView: () =>
                    configLayer.confirmOption(
                        'Delete all data from table',
                        tablename,
                        loading,
                    ),
            })}
            ${toolEntry({
                label: 'drop table',
                topic: 'drop',
                panelOpen: topic === 'drop',
                iconName: 'tabler-trash',
                panelView: () =>
                    configLayer.confirmOption('Drop table', tablename, loading),
            })}
        `;
    }
    copyPanel() {
        const targetDBs = selfMap(appStore.state.databases.map((db) => print(db.name)));
        const content = html`
            <div class="form-grid">
                <label for="copy-table-name">table name</label>
                ${textinput({
                    id: 'copy-table-name',
                    classes: ['resizable'],
                    required: true,
                    '.value': escapeUnicode(this[state].copyTableName),
                    '@change': this.optionChanged.bind(this),
                }).view()}
                ${labeledSelectbox({
                    label: 'target database',
                    id: 'copy-target-db',
                    options: targetDBs,
                    selected: this[state].target.database,
                    required: true,
                    '.value': escapeUnicode(this[state].copyTargetDb),
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
        `;
        const button = { label: 'execute', handler: this.copyTable.bind(this) };
        return configLayer.panel(content, button);
    }
    optionChanged(event: Event): void {
        const target = event.target as HTMLInputElement;
        const option = camelize(target.id);
        if (
            [
                'copyTableName',
                'copyTargetDb',
                'copyData',
                'copyDisplayAfterwards',
            ].includes(option)
        ) {
            const value = ['copyTableName', 'copyTargetDb'].includes(option)
                ? unescapeString(target.value.trim())
                : target.checked;
            this[state] = { ...this[state], [option]: value };
        }
    }
    async emptyTable(): Promise<void> {
        const { database, table: tablename } = this[state].target;
        try {
            appStore.update({
                loading: true,
                loadingMsg: `clearing table: ${tablename}`,
            });
            const dbHandle = await getConnection(database);
            const table = dbHandle.table(tablename);
            await table.clear();
            configLayer.close();
        } catch (error) {
            messageStack.displayError(error);
        }
        appStore.update({ loading: false }, { loadTables: true });
    }
    async dropTable(): Promise<void> {
        const { database, table } = this[state].target;
        appStore.update({
            loading: true,
            loadingMsg: `droping table: ${table}`,
        });
        try {
            const tables = await Database.getTables(database);
            const schema = Database.schema(tables);
            schema[table] = null;
            await Database.changeSchema(database, schema);
            Database.init(appStore.databaseIdx(database));
            configLayer.close();
        } catch (error) {
            messageStack.displayError(error);
        }
        appStore.update({ loading: false, loadingMsg: '' });
        messenger.post({ type: 'tableDropped', target: this[state].target });
    }
    async copyTable(): Promise<void> {
        const { database: sourceDb, table: sourceTable } = this[state].target;
        const {
            copyTableName: targetTable,
            copyTargetDb: targetDb,
            copyData,
            copyDisplayAfterwards,
        } = this[state];
        const error = await this.validateCopyTableName(targetTable, targetDb);
        if (typeof error === 'object') {
            messageStack.display(error);
            return;
        }
        appStore.update({
            loading: true,
            loadingMsg: `copying table, source: ${print(sourceTable)}, target: ${print(targetTable)}`,
        });
        configLayer.close();
        try {
            const table = appStore.table(sourceTable) as KTable;
            const indexes = tableIndexesSpec(table);
            await Database.addTable(targetDb, targetTable, indexes);
            if (copyData) {
                await copyTableData(
                    { table: sourceTable, database: sourceDb },
                    { table: targetTable, database: targetDb },
                );
            }
        } catch (error) {
            messageStack.displayError(error);
            return;
        } finally {
            await appStore.update(
                { loading: false, loadingMsg: '' },
                { loadTables: true },
            );
        }
        if (copyDisplayAfterwards) {
            if (sourceDb === targetDb) {
                const tableIdx = appStore.tableIdx(targetTable);
                datatable.summon(tableIdx);
            } else {
                appStore.update(
                    await appStore.initTargetValues({
                        database: targetDb,
                        table: targetTable,
                    }),
                );
                await datatable.summon(appStore.tableIdx(targetTable));
            }
        } else if (isDatabase(appStore.target())) {
            Database.init(appStore.databaseIdx(sourceDb));
        }
        messageStack.displaySuccess(
            `Table copied! (source: ${print(sourceTable)}, target: ${print(targetTable)}${targetDb !== sourceDb ? ` in database: ${targetDb}` : ''})`,
        );
    }
    async validateCopyTableName(
        tablename: string,
        databaseName: string,
    ): Promise<object | undefined> {
        if (tablename.length === 0) {
            return {
                type: 'warn',
                content: 'Please provide a name for the copied table!',
            };
        }
        const targetTables = await Database.databaseTables(databaseName);
        if (targetTables.filter((table) => table.name === tablename).length > 0) {
            return {
                type: 'error',
                content: `Cannot copy to ${tablename}, this table already exists!`,
            };
        }
        return;
    }
    uniqueTablename(tablename: string): string {
        const existingNames = appStore.state.tables.map((table) => table.name);
        return uniqueName(tablename, existingNames);
    }
};

const tableTools = new TableTools();

export default tableTools;
