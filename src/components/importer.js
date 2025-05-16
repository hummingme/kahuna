/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { importDB } from 'dexie-export-import';

import configLayer from './configlayer.js';
import ImporterExporter from './importer-exporter.js';
import Origin from './origin.js';
import ImportConfig from './config/import-config.js';

import appStore from '../lib/app-store.js';
import { getConnection } from '../lib/connection.js';
import CsvReader from '../lib/csvreader.js';
import { isPrimKeyNamed, isPrimKeyUnnamed } from '../lib/dexie-utils.js';
import messenger from '../lib/messenger.js';
import { capitalize, isTable, zipObject } from '../lib/utils.js';

const state = Symbol('importer state');

const Importer = class {
    async init(args /* { usage, target, dexieImportFilter } */) {
        this[state] = await this.initialState(args);
        messenger.register('refreshImporter', this.refreshSettings.bind(this));
    }
    async initialState(args) {
        const settings = await this.getSettings(args.target);
        const table = ['table', 'selection'].includes(args.usage)
            ? appStore.table(args.target.table)
            : null;
        return {
            table,
            importedCsvHeads: this.importedCsvHeads,
            ...settings,
            ...args,
        };
    }
    update(changes) {
        this[state] = { ...this[state], ...changes };
    }
    async getSettings(target) {
        const { values, defaults } = await ImportConfig.getSettings(target);
        if (isTable(target) === false) {
            values.dataImportFormat = 'dexie';
        }
        return { defaults, ...values };
    }
    async refreshSettings() {
        this.update(await this.getSettings(this[state].target));
        configLayer.update({});
    }
    get format() {
        return this[state].dataImportFormat;
    }
    get formats() {
        return this[state].usage === 'table' ? ['dexie', 'json', 'csv'] : ['dexie'];
    }
    get importedCsvHeads() {
        return this[state] ? this[state].importedCsvHeads : new Map();
    }
    async import() {
        try {
            const format = this[state].dataImportFormat;
            if (!this.formats.includes(format)) {
                throw Error(`unsupported import format "${format}"`);
            }
            const file = configLayer.node.querySelector('input#import-file').files[0];
            this.validateFile(file, format);
            appStore.update({
                loading: true,
                loadingMsg: 'importing data...',
                loadingStop: null,
            });
            const importFunction = `import${capitalize(format)}`;
            await this[importFunction](file);
            this.importReady();
        } catch (error) {
            this.importReady();
            this.handleError(error);
        }
    }
    async importReady() {
        configLayer.close();
        if (this[state].usage === 'origin') {
            messenger.post({ type: 'changedDatabases' });
        }
        appStore.update({
            databases: await Origin.getDatabases(),
            tables: this[state].usage === 'origin' ? [] : true,
            loading: false,
        });
        const { selectedTable, datatable } = appStore.state;
        if (selectedTable !== null) {
            await datatable.updateDatatable({ firstrun: true });
        }
    }
    validateFile(file, format) {
        let err;
        if (file.size === 0) {
            err = 'file is empty';
        }
        if (format === 'json' && file.type !== 'application/json') {
            err = 'json format expected';
        }
        if (format === 'csv' && file.type !== 'text/csv') {
            err = 'csv format expected';
        }
        if (err) throw Error(`invalid import file: ${err}`);
    }
    async importDexie(file) {
        const options = { filter: this[state].dexieImportFilter };
        for (const opt of this.dexieOptions) {
            options[opt] = this[state][opt];
        }
        if (this[state].usage === 'origin') {
            await importDB(file, options);
        } else if (['database', 'table'].includes(this[state].usage)) {
            const dbHandle = await getConnection(this[state].target.database);
            await dbHandle.import(file, options);
        }
    }
    dexieOptions = [
        'acceptNameDiff',
        'acceptVersionDiff',
        'acceptChangedPrimaryKey',
        'acceptMissingTables',
        'clearTablesBeforeImport',
        'noTransaction',
        'overwriteValues',
    ];
    async importJson(file) {
        if (this[state].usage !== 'table') {
            throw Error(
                `json format is not supported for import into ${this[state].usage}`,
            );
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const { database: dbname, table: tablename } = this[state].target;
                const data = JSON.parse(event.target.result);
                const keys = this.keyValues(data);
                const dataObjects = this.dataObjectsFromJson(data);
                const dbHandle = await getConnection(dbname);
                if (this[state].clearTablesBeforeImport) {
                    await dbHandle.table(tablename).clear();
                }
                const addFunc = this[state].overwriteValues ? 'bulkPut' : 'bulkAdd';
                dbHandle.table(tablename)[addFunc](dataObjects, keys);
            } catch (error) {
                this.handleError(error);
            }
        };
        reader.onerror = () => {
            this.handleError(`error reading file ${file}`);
        };
        reader.readAsText(file);
    }

    async importCsv(file) {
        if (this[state].usage !== 'table') {
            throw Error(
                `csv format is not supported for import into ${this[state].usage}`,
            );
        }
        const csv = new CsvReader();
        await csv.init(file);
        const heads = csv.getHeads();
        if (this.keyValuesNeeded() && !heads.includes(this[state].primaryKeyName)) {
            throw Error(
                `Column "${this[state].primaryKeyName}", which is specified for the primary keys, does not exist in the data`,
            );
        }
        if (
            this.directValuesPossible() &&
            !heads.includes(this[state].directValuesName)
        ) {
            throw Error(
                `Column "${this[state].directValuesName}", which is specified for direct values, does not exist in the data`,
            );
        }
        const primKey = this[state].table.primKey;
        if (isPrimKeyNamed(primKey) && heads.includes(primKey.name) === false) {
            throw Error(
                `The file '${file.name}' does not contain data for the primary key '${primKey.name}'`,
            );
        }
        const data = csv.getData();
        const keys = this.keyValues(data, heads);
        const dataObjects = this.dataObjectsFromCsv(heads, data);
        const { database: dbname, table: tablename } = this[state].target;
        const dbHandle = await getConnection(dbname);
        if (this[state].clearTablesBeforeImport) {
            await dbHandle.table(tablename).clear();
        }
        const addFunc = this[state].overwriteValues ? 'bulkPut' : 'bulkAdd';
        dbHandle.table(tablename)[addFunc](dataObjects, keys);
        this[state].importedCsvHeads.set(tablename, heads);
    }
    keyValuesNeeded() {
        return (
            isPrimKeyUnnamed(this[state].table.primKey) &&
            this[state].primaryKeyName.length !== 0
        );
    }
    directValuesPossible() {
        return (
            isPrimKeyUnnamed(this[state].table.primKey) &&
            this[state].importDirectValues &&
            this[state].directValuesName.length !== 0
        );
    }
    keyValues(data, heads) {
        if (this.keyValuesNeeded()) {
            if (this[state].dataImportFormat === 'csv') {
                return this.keyValuesFromCsv(data, heads);
            } else if (this[state].dataImportFormat === 'json') {
                return this.keyValuesFromJson(data);
            }
        }
        return;
    }
    keyValuesFromCsv(data, heads) {
        const kidx = heads.indexOf(this[state].primaryKeyName);
        return this[state].table.primKey.auto
            ? data.map((r) => parseInt(r[kidx]))
            : data.map((r) => r[kidx]);
    }
    keyValuesFromJson(data) {
        return data.map((r) => r[this[state].primaryKeyName]);
    }
    dataObjectsFromCsv(heads, data) {
        if (this.keyValuesNeeded()) {
            const kidx = heads.indexOf(this[state].primaryKeyName);
            heads.splice(kidx, 1);
            data = data.map((row) => row.toSpliced(kidx, 1));
        }
        if (this.directValuesPossible()) {
            const vidx = heads.indexOf(this[state].directValuesName);
            heads.splice(vidx, 1);
            data = data.map((row) =>
                row[vidx] === '' ? row.toSpliced(vidx, 1) : row[vidx],
            );
        }
        return data.map(
            (row) => (Array.isArray(row) ? this.zipRow([...heads], row) : row), // actually a direct value
        );
    }
    dataObjectsFromJson(data) {
        if (this.keyValuesNeeded()) {
            data = data.map((row) => {
                delete row[this[state].primaryKeyName];
                return row;
            });
        }
        if (this.directValuesPossible()) {
            data = data.map((row) =>
                Object.hasOwn(row, this[state].directValuesName)
                    ? row[this[state].directValuesName]
                    : row,
            );
        }
        return data;
    }
    zipRow(heads, row) {
        const undef = [];
        row = row.map((val, idx) => {
            if (
                (typeof val === 'string' && val.length > 0) ||
                typeof val === 'number' ||
                typeof val === 'boolean' ||
                val === null
            ) {
                return val;
            } else if (this[state].importEmptyAs === 'exclude') {
                undef.push(idx);
                return;
            } else if (this[state].importEmptyAs === 'undefined') {
                return undefined;
            } else if (this[state].importEmptyAs === 'null') {
                return null;
            } else {
                return '';
            }
        });
        undef.reverse().forEach((idx) => {
            heads.splice(idx, 1);
            row.splice(idx, 1);
        });
        return zipObject(heads, row);
    }
    panel() {
        const content = html`
            <div>
                <div>
                    <span>
                        ${this.formatSelect({
                            id: 'import-format',
                            onchange: this.changeImportFormat.bind(this),
                            selected: this[state].dataImportFormat,
                        })}
                    </span>
                    ${this.infoTooltipIcon()}
                </div>
            </div>
        `;
        const button = {
            click: this.clickFileInput,
            text: html`
                <label>select file</label>
                <input
                    type="file"
                    id="import-file"
                    @change=${this.import.bind(this)}
                    accept=".${this[state].dataImportFormat}"
                    class="hidden"
                />
            `,
        };
        return configLayer.panel(content, button);
    }
    settingsTooltipView() {
        const { usage, table, primaryKeyName } = this[state];
        const annotateFunc = ImportConfig.primaryKeyNameInfo;
        let settingInfos = [this.pkNameInfo(usage, table, primaryKeyName, annotateFunc)];
        this[state].clearTablesBeforeImport
            ? settingInfos.push(
                  this.settingInfo(
                      'clear table(s) before',
                      this[state].clearTablesBeforeImport,
                  ),
              )
            : settingInfos.push(
                  this.settingInfo(
                      'overwrite values if primary key exists',
                      this[state].overwriteValues,
                  ),
              );
        if (this[state].dataImportFormat === 'dexie') {
            settingInfos = settingInfos.concat([
                this.settingInfo('no transaction', this[state].noTransaction),
                this.settingInfo('accept name diff', this[state].acceptNameDiff),
                this.settingInfo('accept version diff', this[state].acceptVersionDiff),
                this.settingInfo(
                    'accept changed primary key',
                    this[state].acceptChangedPrimaryKey,
                ),
            ]);
            if (['origin', 'database'].includes(usage)) {
                settingInfos.push(
                    this.settingInfo(
                        'accept missing tables',
                        this[state].acceptMissingTables,
                    ),
                );
            }
        }
        if (this[state].dataImportFormat === 'csv') {
            settingInfos.push(
                this.settingInfo('import empty values as', this[state].importEmptyAs),
            );
        }
        if (
            ['csv', 'json'].includes(this[state].dataImportFormat) &&
            isPrimKeyUnnamed(table.primKey) &&
            this[state].directValuesName.length > 0
        ) {
            settingInfos.push(
                this.settingInfo('import direct values', this[state].importDirectValues),
            );
            if (this[state].importDirectValues) {
                settingInfos.push(
                    this.settingInfo(
                        'name for direct values',
                        this[state].directValuesName,
                        ImportConfig.directValuesNameInfo(),
                    ),
                );
            }
        }
        return html`
            <h2>
                applied import settings:
                ${this.changeSettingsIcon('import', this[state].target)}
            </h2>
            ${settingInfos}
        `;
    }
    changeImportFormat(event) {
        const dataImportFormat = event.target.value;
        this.update({ dataImportFormat });
        this.updateSettings('import', state);
        configLayer.update({});
    }
    clickFileInput(event) {
        const input = event.target.closest('button').querySelector('input');
        input && input.click();
    }
};
Object.assign(Importer.prototype, ImporterExporter);

const importer = new Importer();

export default importer;
