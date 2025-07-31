/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import Database from '../components/database.ts';
import datatable from '../components/datatable.ts';
import type { LoadingViewParams } from '../components/loadingpanel.ts';
import Origin from '../components/origin.ts';
import { type AppTarget, isGlobal } from './app-target.ts';
import messenger from './messenger.ts';
import settings from './settings.ts';
import type { KDatabase, KTable } from './types/common.ts';

export interface AppState extends LoadingViewParams {
    databases: KDatabase[];
    selectedDB?: number;
    tables: KTable[];
    selectedTable?: number;
    aboutVisible: boolean;
    updateInfoVisible: boolean;
}

const AppStore = class {
    #state: AppState;
    constructor() {
        this.#state = this.emptyState;
    }
    async init() {
        this.#state = await this.initialState();
        const { selectedTable, selectedDB } = this.#state;
        if (typeof selectedTable === 'number') {
            await datatable.summon(selectedTable);
        } else if (typeof selectedDB === 'number') {
            await Database.init(selectedDB);
        } else {
            this.#changed();
        }
    }
    async update(
        changes: Partial<AppState>,
        options?: { loadTables?: boolean; loadTable?: string },
    ) {
        const { databases, tables, selectedDB } = this.#state;
        if (options && typeof selectedDB === 'number') {
            const dbname = databases[selectedDB].name;
            if (options.loadTables === true) {
                changes.tables = await Database.getTables(dbname);
            } else if (options.loadTable) {
                const tableIdx = this.tableIdx(options.loadTable);
                tables[tableIdx] = await Database.getTable(dbname, options.loadTable);
                changes.tables = tables;
            }
        }
        this.#state = { ...this.#state, ...changes };
        this.#changed();
    }
    rerender(changes: Partial<AppState> = {}) {
        this.update(changes);
    }
    #changed() {
        messenger.post({ type: 'rerenderApp' });
    }
    get state() {
        return { ...this.#state };
    }
    /*
     * get dexie table by selectedTable-index or by name
     */
    table(tableRef: number | string): KTable | undefined {
        const tables = this.#state.tables;
        return typeof tableRef === 'number' && tables[tableRef]
            ? tables[tableRef]
            : tables.find((table) => table.name === tableRef);
    }
    tableIdx(name: string) {
        return this.#state.tables.findIndex((table) => table.name === name);
    }
    databaseIdx(name: string) {
        return this.#state.databases.findIndex((db) => db.name === name);
    }
    target(selectedTable?: number): AppTarget {
        const { databases, tables, selectedDB } = this.#state;
        const database = typeof selectedDB === 'number' ? databases[selectedDB] : null;
        const table =
            database && typeof selectedTable === 'number'
                ? tables[selectedTable]
                : typeof this.#state.selectedTable === 'number'
                  ? tables[this.#state.selectedTable]
                  : null;
        return {
            database: database?.name || '*',
            table: table?.name || '*',
        };
    }
    get isGlobal() {
        return isGlobal(this.target());
    }
    get loading() {
        return this.#state.loading;
    }
    async initialState(): Promise<AppState> {
        const onLoadTarget = settings.global('onLoadTarget');
        const targetValues = await this.initTargetValues(onLoadTarget);
        return {
            ...this.emptyState,
            ...targetValues,
        };
    }
    async initTargetValues(target: AppTarget) {
        const databases = await Origin.getDatabases();
        let selectedDB,
            selectedTable,
            tables: KTable[] = [];

        if (target.database !== '*') {
            selectedDB = databases.findIndex((db) => db.name == target.database);
            if (selectedDB === -1) {
                selectedDB = undefined;
            } else {
                tables = await Database.getTables(target.database);
                selectedTable = tables.findIndex((table) => table.name === target.table);
                if (selectedTable === -1) {
                    selectedTable = undefined;
                }
            }
        }
        return {
            databases,
            selectedDB,
            tables,
            selectedTable,
        };
    }
    get emptyState(): AppState {
        return {
            databases: [],
            selectedDB: undefined,
            tables: [],
            selectedTable: undefined,
            aboutVisible: false,
            updateInfoVisible: false,
            loading: false,
            loadingMsg: '',
            loadingStop: null,
        };
    }
};

export default new AppStore();
