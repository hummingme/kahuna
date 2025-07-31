/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { type ImportOptions, importDB } from 'dexie-export-import';

import configLayer from './configlayer.ts';
import ImporterExporter from './importer-exporter.ts';
import Origin from './origin.ts';
import ImportConfig from './config/import-config.ts';

import appStore from '../lib/app-store.ts';
import { type AppTarget, globalTarget, isTable } from '../lib/app-target.ts';
import { getConnection } from '../lib/connection.ts';
import CsvReader from '../lib/csvreader.ts';
import { isPrimKeyNamed, isPrimKeyUnnamed } from '../lib/dexie-utils.ts';
import messenger from '../lib/messenger.ts';
import { capitalize, zipObject } from '../lib/utils.ts';
import {
    type EmptyAsValue,
    type ImportFormat,
    type PlainObject,
    type KTable,
    DATA_FORMATS,
} from '../lib/types/common.ts';

interface ImporterArgs {
    usage: Usage;
    target: AppTarget;
    dexieImportFilter?: ((table: string) => boolean) | undefined;
}
interface ImportDexieOptions {
    clearTablesBeforeImport: boolean;
    overwriteValues: boolean;
    acceptNameDiff: boolean;
    acceptVersionDiff: boolean;
    acceptChangedPrimaryKey: boolean;
    acceptMissingTables: boolean;
    noTransaction: boolean;
}
interface ImportSettings extends ImportDexieOptions {
    dataImportFormat: ImportFormat;
    primaryKeyName: string;
    importDirectValues: boolean;
    directValuesName: string;
    importEmptyAs: EmptyAsValue;
}
interface ImporterState extends ImporterArgs, ImportSettings {
    table: KTable | null;
    importedCsvHeads: Map<string, string[]>;
    defaults: ImportSettings;
}

type Usage = 'origin' | 'database' | 'table';
type ImportFuncName = 'importDexie' | 'importJson' | 'importCsv';

const state = Symbol('importer state');

const Importer = class {
    [state]: ImporterState = this.emptyState;
    #helper: InstanceType<typeof ImporterExporter>;
    constructor() {
        this.#helper = new ImporterExporter();
    }
    async init(args: ImporterArgs) {
        this[state] = await this.initialState(args);
        messenger.register('refreshImporter', this.refreshSettings.bind(this));
    }
    async initialState(args: ImporterArgs): Promise<ImporterState> {
        const { values: settings, defaults } = await this.getSettings(args.target);
        const table = ['table', 'selection'].includes(args.usage)
            ? appStore.table(args.target.table) || null
            : null;
        return {
            table,
            importedCsvHeads: this[state].importedCsvHeads,
            ...settings,
            ...args,
            defaults,
        };
    }
    get emptyState(): ImporterState {
        const defaultSettings = ImportConfig.defaultSettings() as ImportSettings;
        return Object.assign(defaultSettings, {
            usage: 'origin' as Usage,
            target: globalTarget,
            dexieImportFilter: undefined,
            table: null,
            importedCsvHeads: new Map(),
            dataImportFormat: 'dexie' as ImportFormat,
            importEmptyAs: 'empty string' as EmptyAsValue,
            defaults: defaultSettings,
        });
    }
    update(changes: Partial<ImporterState>) {
        this[state] = { ...this[state], ...changes };
    }
    async getSettings(
        target: AppTarget,
    ): Promise<{ values: ImportSettings; defaults: ImportSettings }> {
        const { values, defaults } = (await ImportConfig.getSettings(target)) as {
            values: ImportSettings;
            defaults: ImportSettings;
        };
        if (isTable(target) === false) {
            values.dataImportFormat = 'dexie';
        }
        return { defaults, values };
    }
    async refreshSettings() {
        const settings = await this.getSettings(this[state].target);
        this.update({ ...settings.values, defaults: settings.defaults });
        configLayer.update({});
    }
    get format(): ImportFormat {
        return this[state].dataImportFormat;
    }
    get formats(): ImportFormat[] {
        return this[state].usage === 'table' ? [...DATA_FORMATS] : ['dexie'];
    }
    get importedCsvHeads(): Map<string, string[]> {
        return this[state] ? this[state].importedCsvHeads : new Map();
    }
    async import() {
        try {
            const format = this[state].dataImportFormat;
            if (!this.formats.includes(format)) {
                throw Error(`unsupported import format "${format}"`);
            }
            const file = this.getImportFile();
            if (file) {
                this.validateFile(file, format);
                configLayer.close({ rerenderApp: false });
                appStore.update({
                    loading: true,
                    loadingMsg: 'importing data...',
                    loadingStop: null,
                });
                const importFunction = `import${capitalize(format)}` as ImportFuncName;
                await this[importFunction](file);
            }
        } catch (error) {
            this.#helper.handleError(error as Error);
        } finally {
            this.importReady();
        }
    }
    getImportFile(): File | null {
        const fileElement = configLayer
            .getNode()
            ?.querySelector('input#import-file') as HTMLInputElement;
        const file = fileElement.files && fileElement.files[0];
        return file;
    }

    async importReady() {
        const isOrigin = this[state].usage === 'origin';
        if (isOrigin) {
            messenger.post({ type: 'changedDatabases' });
        }
        else if (isTable(appStore.target())) {
            messenger.post({ type: 'refreshDatatable' });          
        }
        const tables = isOrigin ? [] : appStore.state.tables;
        const options = isOrigin ? {} : { loadTables: true };
        appStore.update(
            {
                databases: await Origin.getDatabases(),
                tables,
                loading: false,
            },
            options,
        );
    }
    validateFile(file: File, format: ImportFormat): void {
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
    async importDexie(file: File): Promise<void> {
        const options: ImportOptions = { filter: this[state].dexieImportFilter };
        for (const opt of this.dexieOptions) {
            const value = this[state][opt as keyof ImportDexieOptions];
            options[opt as keyof ImportDexieOptions] = value;
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
    ] as const;
    async importJson(file: File): Promise<void> {
        if (this[state].usage !== 'table') {
            throw Error(
                `json format is not supported for import into ${this[state].usage}`,
            );
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const { database: dbname, table: tablename } = this[state].target;
                    const result = event.target?.result;
                    if (typeof result !== 'string') {
                        throw Error(`error reading file ${file.name}`);
                    }
                    const data = JSON.parse(result);
                    const keys = this.keyValues(data);
                    const dataObjects = this.dataObjectsFromJson(data);
                    const dbHandle = await getConnection(dbname);
                    if (this[state].clearTablesBeforeImport) {
                        await dbHandle.table(tablename).clear();
                    }
                    const addFunc = this[state].overwriteValues ? 'bulkPut' : 'bulkAdd';
                    await dbHandle.table(tablename)[addFunc](dataObjects, keys);
                    resolve();
                } catch (error) {
                    this.#helper.handleError(error as Error);
                    reject();
                }
            };
            reader.onerror = () => {
                this.#helper.handleError(Error(`error reading file ${file.name}`));
                reject();
            };
            reader.readAsText(file);
        });
    }
    async importCsv(file: File): Promise<void> {
        const {
            table,
            usage,
            primaryKeyName,
            directValuesName,
            clearTablesBeforeImport,
            overwriteValues,
            target: { database: dbname, table: tablename },
        } = this[state];
        if (!table) {
            return;
        }
        if (usage !== 'table') {
            throw Error(`csv format is not supported for import into ${usage}`);
        }
        const csv = new CsvReader();
        await csv.init(file);
        const heads = csv.getHeads();
        if (this.keyValuesNeeded() && !heads.includes(primaryKeyName)) {
            throw Error(
                `Column "${primaryKeyName}", which is specified for the primary keys, does not exist in the data`,
            );
        }
        if (this.directValuesPossible() && !heads.includes(directValuesName)) {
            throw Error(
                `Column "${directValuesName}", which is specified for direct values, does not exist in the data`,
            );
        }
        const primKey = table.primKey;
        if (isPrimKeyNamed(primKey) && heads.includes(primKey.name) === false) {
            throw Error(
                `The file '${file.name}' does not contain data for the primary key '${primKey.name}'`,
            );
        }
        const data = csv.getData();
        const keys = this.keyValues(data, heads);
        const dataObjects = this.dataObjectsFromCsv(heads, data);
        const dbHandle = await getConnection(dbname);
        if (clearTablesBeforeImport) {
            await dbHandle.table(tablename).clear();
        }
        const addFunc = overwriteValues ? 'bulkPut' : 'bulkAdd';
        dbHandle.table(tablename)[addFunc](dataObjects, keys);
        this[state].importedCsvHeads.set(tablename, heads);
    }
    keyValuesNeeded(): boolean {
        return this[state].table &&
            isPrimKeyUnnamed(this[state].table.primKey) &&
            this[state].primaryKeyName.length !== 0
            ? true
            : false;
    }
    directValuesPossible(): boolean {
        return this[state].table &&
            isPrimKeyUnnamed(this[state].table.primKey) &&
            this[state].importDirectValues &&
            this[state].directValuesName.length !== 0
            ? true
            : false;
    }
    keyValues(data: PlainObject[], heads?: string[]): number[] | string[] | undefined {
        if (this.keyValuesNeeded()) {
            if (this[state].dataImportFormat === 'csv' && Array.isArray(heads)) {
                return this.keyValuesFromCsv(data, heads);
            } else if (this[state].dataImportFormat === 'json') {
                return this.keyValuesFromJson(data);
            }
        }
        return;
    }
    keyValuesFromCsv(data: PlainObject[], heads: string[]): number[] | string[] {
        const kidx = heads.indexOf(this[state].primaryKeyName);
        return this[state].table
            ? this[state].table.primKey.auto
                ? data.map((row) => parseInt(row[kidx]))
                : data.map((row) => row[kidx])
            : [];
    }
    keyValuesFromJson(data: PlainObject[]): number[] | string[] {
        return data.map((r) => r[this[state].primaryKeyName]);
    }
    dataObjectsFromCsv(heads: string[], data: PlainObject[]): PlainObject[] {
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
    dataObjectsFromJson(data: PlainObject[]): PlainObject[] {
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
    zipRow(heads: string[], row: any[]): PlainObject {
        const undef: any[] = [];
        row = row.map((val: any, idx: number) => {
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
    panel(): TemplateResult {
        const content = html`
            <div>
                <div>
                    <span>
                        ${this.#helper.formatSelect({
                            id: 'import-format',
                            formats: this.formats,
                            selected: this[state].dataImportFormat,
                            onchange: this.changeImportFormat.bind(this),
                        })}
                    </span>
                    ${this.#helper.infoTooltipIcon(this.settingsTooltipView.bind(this))}
                </div>
            </div>
        `;
        const button = {
            label: html`
                <label>select file</label>
                <input
                    type="file"
                    id="import-file"
                    @change=${this.import.bind(this)}
                    accept=".${this[state].dataImportFormat}"
                    class="hidden"
                />
            `,
            handler: this.clickFileInput,
        };
        return configLayer.panel(content, button);
    }
    settingsTooltipView(): TemplateResult {
        const { usage, dataImportFormat, primaryKeyName } = this[state];
        const settingInfo = this.#helper.settingInfo;
        const annotateFunc = ImportConfig.primaryKeyNameInfo;
        let settingInfos = [this.#helper.pkNameInfo(usage, primaryKeyName, annotateFunc)];
        if (this[state].clearTablesBeforeImport) {
            settingInfos.push(
                settingInfo('clear table(s) before', this[state].clearTablesBeforeImport),
            );
        } else {
            settingInfos.push(
                settingInfo(
                    'overwrite values if primary key exists',
                    this[state].overwriteValues,
                ),
            );
        }
        if (dataImportFormat === 'dexie') {
            settingInfos = settingInfos.concat([
                settingInfo('no transaction', this[state].noTransaction),
                settingInfo('accept name diff', this[state].acceptNameDiff),
                settingInfo('accept version diff', this[state].acceptVersionDiff),
                settingInfo(
                    'accept changed primary key',
                    this[state].acceptChangedPrimaryKey,
                ),
            ]);
            if (['origin', 'database'].includes(usage)) {
                settingInfos.push(
                    settingInfo('accept missing tables', this[state].acceptMissingTables),
                );
            }
        }
        if (dataImportFormat === 'csv') {
            settingInfos.push(
                settingInfo('import empty values as', this[state].importEmptyAs),
            );
        }
        if (this.importDirectValuesPossible()) {
            settingInfos.push(
                settingInfo('import direct values', this[state].importDirectValues),
            );
            if (this[state].importDirectValues) {
                settingInfos.push(
                    settingInfo(
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
                ${this.#helper.changeSettingsIcon('import', this[state].target)}
            </h2>
            ${settingInfos}
        `;
    }
    importDirectValuesPossible(): boolean {
        const { table, dataImportFormat, directValuesName } = this[state];
        return (
            ['csv', 'json'].includes(dataImportFormat) &&
            table !== null &&
            isPrimKeyUnnamed(table.primKey) &&
            directValuesName.length > 0
        );
    }
    changeImportFormat(event: Event) {
        const target = event.target as HTMLInputElement;
        const dataImportFormat = this.isImportFormat(target.value)
            ? target.value
            : this.formats[0];
        this.update({ dataImportFormat });
        this.#helper.updateSettings('import', this[state]);
        configLayer.update({});
    }
    isImportFormat(value: string): value is ImportFormat {
        return this.formats.includes(value as ImportFormat);
    }
    clickFileInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const input = target.closest('button')?.querySelector('input');
        if (input) input.click();
    }
};
Object.assign(Importer.prototype, ImporterExporter);

const importer = new Importer();

export default importer;
