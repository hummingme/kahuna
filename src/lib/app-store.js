/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import Origin from '../components/origin.js';
import Database from '../components/database.js';
import datatable from '../components/datatable.js';
import settings from './settings.js';
import { isGlobal } from './utils.js';

const AppStore = class extends EventTarget {
    #state;

    constructor() {
        super();
    }
    async init() {
        this.#state = await initialState();
        const { selectedTable, selectedDB } = this.#state;
        if (selectedTable !== null) {
            await datatable.summon(selectedTable);
        } else if (selectedDB !== null) {
            await Database.init(selectedDB);
        } else {
            this.#changed('AppStore.init');
        }
    }
    async update(changes, caller) {
        if (Object.hasOwn(changes, 'tables') && this.#state.selectedDB !== null) {
            const dbname = this.#state.databases[this.#state.selectedDB].name;
            if (changes.tables === true) {
                changes.tables = await Database.getTables(dbname);
            } else if (typeof changes.tables === 'string') {
                const tables = this.#state.tables;
                const tidx = tables.findIndex((t) => t.name === changes.tables);
                tables[tidx] = await Database.getTable(dbname, changes.tables);
                changes.tables = tables;
            }
        }
        this.#state = { ...this.#state, ...changes };
        this.#changed(caller);
    }
    rerender(changes = {}, caller) {
        this.update(changes, caller);
    }
    get state() {
        return { ...this.#state };
    }

    /*
     * get dexie table by selectedTable-index or by name
     */
    table(tid) {
        const tables = this.#state.tables;
        return typeof tid === 'number'
            ? tables[tid]
            : tables.find((table) => table.name === tid);
    }
    target(selectedTable) {
        const database = this.#state.databases[this.#state.selectedDB];
        const table = database
            ? this.#state.tables[selectedTable ?? this.#state.selectedTable]
            : null;
        return {
            database: database?.name || '*',
            table: table?.name || '*',
        };
    }
    get isGlobal() {
        return isGlobal(this.target());
    }
    #changed(caller) {
        const ev = new CustomEvent('change', {
            detail: {
                state: { ...this.#state },
                caller,
            },
        });
        this.dispatchEvent(ev);
    }
    get loading() {
        return this.#state.loading;
    }
};

const initialState = async () => {
    const databases = await Origin.getDatabases();
    const onLoadTarget = settings.global('onLoadTarget');
    let selectedDB = null,
        selectedTable = null,
        tables = [];

    if (onLoadTarget.database !== '*') {
        selectedDB = databases.findIndex((db) => db.name == onLoadTarget.database);
        if (selectedDB === -1) {
            selectedDB = null;
        } else {
            tables = await Database.getTables(onLoadTarget.database);
            selectedTable = tables.findIndex(
                (table) => table.name === onLoadTarget.table,
            );
            if (selectedTable === -1) {
                selectedTable = null;
            }
        }
    }

    return {
        databases,
        selectedDB,
        tables,
        selectedTable,
        loading: false,
        loadingMsg: '',
        loadingStop: null,
        datatable, // Datatable object
        settingsRealm: null,
    };
};

export default new AppStore();
