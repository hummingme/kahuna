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
import appStore from '#lib/app-store';
import { globalTarget, isDatabase } from '#lib/app-target';
import checkbox from '#lib/checkbox';
import { getConnection } from '#lib/connection';
import { copyTableData, tableIndexesSpec } from '#lib/dexie-utils';
import { escapeUnicode, unescapeUnicode } from '#lib/escape-unicode';
import messenger from '#lib/messenger';
import { labeledSelectbox } from '#lib/selectbox';
import svgIcon from '#lib/svgicon';
import textinput from '#lib/textinput';
import { camelize, selfMap, uniqueName } from '#lib/utils';
import type { AppTarget, KTable } from '#types';

interface TableToolsState {
    target: AppTarget;
    copyTablename: string;
    copyTargetDb: string;
    copyData: boolean;
    copyDisplayAfterwards: true;
}

const state = Symbol('table-tools state');

const TableTools = class {
    [state]: TableToolsState;
    constructor() {
        this[state] = {
            target: globalTarget,
            copyTablename: '',
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
            copyTablename: this.uniqueTablename(target.table),
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
        const loading = appStore.state.loading;
        const topic = configLayer.topic;
        const tablename = this[state].target.table;
        return html`
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="import">
                    ${svgIcon('tabler-download')}
                    <label>import data</label>
                </a>
                ${topic == 'import' ? importer.panel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="export">
                    ${svgIcon('tabler-upload')}
                    <label>export data</label>
                </a>
                ${topic == 'export' ? exporter.panel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="copy">
                    ${svgIcon('tabler-a-b-2')}
                    <label>copy table</label>
                </a>
                ${topic == 'copy' ? this.copyPanel() : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="empty">
                    ${svgIcon('tabler-eraser')}
                    <label>empty table</label>
                </a>
                ${topic == 'empty'
                    ? configLayer.confirmOption(
                          'Delete all data from table',
                          tablename,
                          loading,
                      )
                    : ''}
            </p>
            <p>
                <a @click=${configLayer.onTopicClicked} data-topic="drop">
                    ${svgIcon('tabler-trash')}
                    <label>drop table</label>
                </a>
                ${topic === 'drop'
                    ? configLayer.confirmOption('Drop table', tablename, loading)
                    : ''}
            </p>
        `;
    }
    copyPanel() {
        const targetDBs = selfMap(
            appStore.state.databases.map((db) => escapeUnicode(db.name)),
        );
        const content = html`
            <div>
                <div>
                    <label for="copy-tablename">table name</label>
                    ${textinput({
                        id: 'copy-tablename',
                        size: 15,
                        required: true,
                        '.value': escapeUnicode(this[state].copyTablename),
                        '@change': this.optionChanged.bind(this),
                    })}
                </div>
                <div>
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
                'copyTablename',
                'copyTargetDb',
                'copyData',
                'copyDisplayAfterwards',
            ].includes(option)
        ) {
            const value = ['copyTablename', 'copyTargetDb'].includes(option)
                ? unescapeUnicode(target.value.trim())
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
            copyTablename: targetTable,
            copyTargetDb: targetDb,
            copyData,
            copyDisplayAfterwards,
        } = this[state];
        const error = await this.validateCopyTablename(targetTable, targetDb);
        if (typeof error === 'object') {
            messageStack.display(error);
            return;
        }
        appStore.update({
            loading: true,
            loadingMsg: `copying table, source: ${escapeUnicode(sourceTable)}, target: ${escapeUnicode(targetTable)}`,
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
            `Table copied! (source: ${escapeUnicode(sourceTable)}, target: ${escapeUnicode(targetTable)}${targetDb !== sourceDb ? ` in database: ${targetDb}` : ''})`,
        );
    }
    async validateCopyTablename(
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
