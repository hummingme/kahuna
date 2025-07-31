/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import type { Collection, Dexie, Table } from 'dexie';
import { exportDB, type ExportOptions } from 'dexie-export-import';

import configLayer from './configlayer.ts';
import Database from './database.ts';
import datatable from './datatable.ts';
import ImporterExporter from './importer-exporter.ts';
import ExportConfig from './config/export-config.ts';

import appStore from '../lib/app-store.ts';
import { type AppTarget, globalTarget } from '../lib/app-target.ts';
import { getConnection } from '../lib/connection.ts';
import { isPlainObject } from '../lib/datatypes.ts';
import {
    getCollection,
    isPrimKeyNamed,
    leadingUnnamedPkValues,
} from '../lib/dexie-utils.ts';
import messenger from '../lib/messenger.ts';
import textinput from '../lib/textinput.ts';
import { capitalize, downloadFile } from '../lib/utils.ts';
import {
    DATA_FORMATS,
    type ExportFormat,
    type KTable,
    type PlainObject,
} from '../lib/types/common.ts';

interface ExporterArgs {
    usage: Usage;
    target: AppTarget;
    dexieExportFilter?: (table: string, values: unknown, key: unknown) => boolean;
}
interface ExportSettings extends FilenameTemplateSettings {
    dataExportFormat: ExportFormat;
    primaryKeyName: string;
    directValuesName: string;
    prettyDexie: boolean;
    prettyJSON: boolean;
}
interface FilenameTemplateSettings {
    filenameDatabase: string;
    filenameTable: string;
    filenameSelection: string;
}
interface ExporterState extends ExporterArgs, ExportSettings {
    filename: string;
    table?: KTable;
    tables?: KTable[];
    defaults: ExportSettings;
}
interface Replacer {
    key: string;
    func: (target: AppTarget, settings: ExportSettings) => string;
}

type Usage = 'database' | 'table' | 'selection';

const state = Symbol('exporter state');

export const Exporter = class {
    [state]: ExporterState = this.emptyState;
    #helper: InstanceType<typeof ImporterExporter>;
    constructor() {
        this.#helper = new ImporterExporter();
    }
    async init(args: ExporterArgs) {
        this[state] = await this.initialState(args);
        messenger.register('refreshExporter', this.refreshSettings.bind(this));
    }
    async initialState(args: ExporterArgs): Promise<ExporterState> {
        const { values: settings, defaults } = await this.getSettings(args.target);
        let table, tables;
        if (['table', 'selection'].includes(args.usage)) {
            table = appStore.table(args.target.table);
        } else {
            tables = await Database.getTables(args.target.database);
            settings.dataExportFormat = 'dexie';
        }
        const filename = this.parseFilename({ ...args, ...settings, filename: '' });
        return {
            filename,
            table,
            tables,
            ...settings,
            ...args,
            defaults,
        };
    }
    get emptyState(): ExporterState {
        const defaultSettings = ExportConfig.defaultSettings() as ExportSettings;
        return Object.assign(defaultSettings, {
            usage: 'database' as Usage,
            target: globalTarget,
            dexieExportFilter: undefined,
            filename: '',
            dataExportFormat: 'json' as ExportFormat,
            defaults: defaultSettings,
        });
    }
    async getSettings(
        target: AppTarget,
    ): Promise<{ values: ExportSettings; defaults: ExportSettings }> {
        const { values, defaults } = (await ExportConfig.getSettings(target)) as {
            values: ExportSettings;
            defaults: ExportSettings;
        };
        return { defaults, values };
    }
    async refreshSettings() {
        const settings = await this.getSettings(this[state].target);
        this.update({ ...settings.values, defaults: settings.defaults });
        this.update({ filename: this.parseFilename(this[state]) });
        configLayer.update({});
    }
    update(changes: Partial<ExporterState>) {
        this[state] = { ...this[state], ...changes };
    }
    get format(): ExportFormat {
        return this[state].dataExportFormat;
    }
    get formats(): ExportFormat[] {
        return this[state].usage === 'database' ? ['dexie'] : [...DATA_FORMATS];
    }
    mimeTypes = {
        dexie: 'application/json',
        json: 'application/json',
        csv: 'text/csv',
    } as const;
    mimeType = (type: ExportFormat): string => this.mimeTypes[type];
    async export() {
        try {
            const format = this[state].dataExportFormat;
            if (!this.formats.includes(format)) {
                throw Error(`unsupported export format "${format}"`);
            }
            appStore.update({
                loading: true,
                loadingMsg: 'exporting data...',
                loadingStop: null,
            });
            let content;
            const dbHandle = await getConnection(this[state].target.database);
            if (format === 'dexie') {
                const options: ExportOptions = {
                    filter: this[state].dexieExportFilter,
                    prettyJson: this[state].prettyDexie,
                };
                content = await exportDB(dbHandle, options);
            } else {
                const data =
                    this[state].usage === 'selection'
                        ? await this.dataFromSelection()
                        : await this.dataFromTable(dbHandle);
                if (format === 'json') {
                    const space = this[state].prettyJSON ? 2 : undefined;
                    content = JSON.stringify(data, undefined, space);
                } else if (format === 'csv') {
                    content = this.doCsv(data);
                }
            }
            if (content) {
                downloadFile(content, this[state].filename, this.mimeType(format));
            }
            configLayer.close({ rerenderApp: false });
            appStore.rerender({ loading: false });
        } catch (error) {
            this.#helper.handleError(error as Error);
        }
    }
    async dataFromSelection() {
        const { dexieTable, selectorFields, selected } = datatable.state;
        if (dexieTable === undefined) {
            throw new Error(
                'the selection cannot be exported if the datatable is not initialized!',
            );
        }
        const collection = getCollection({
            dexieTable,
            selectorFields,
            selected,
        });
        return await this.collectionToData(collection, dexieTable as Table);
    }
    async dataFromTable(dbHandle: Dexie) {
        const table = this[state].target.table;
        const collection = dbHandle.table(table).toCollection();
        const dexieTable = dbHandle.table(table);
        return await this.collectionToData(collection, dexieTable as Table);
    }
    async collectionToData(collection: Collection, table: Table): Promise<PlainObject[]> {
        const { primaryKeyName, directValuesName } = this[state];
        let data = [];
        if (isPrimKeyNamed(table.schema.primKey)) {
            data = await collection.toArray();
        } else {
            data =
                primaryKeyName.length > 0
                    ? await leadingUnnamedPkValues(collection, primaryKeyName)
                    : await collection.toArray();

            if (directValuesName.length > 0) {
                // include value
                data.forEach((row, idx) => {
                    if (row['*value*'] !== undefined) {
                        row[this[state].directValuesName] = row['*value*'];
                    } else if (isPlainObject(row) === false) {
                        data[idx] = { [directValuesName]: row };
                    }
                    delete row['*value*'];
                });
            } else {
                // don't include *value*
                data = data.map((row) => {
                    delete row['*value*'];
                    if (Object.keys(row).length === 1 && row[primaryKeyName]) {
                        // remove rows if they only contain the *key*
                        return false;
                    }
                    return row;
                });
                data = data.filter((row) => isPlainObject(row));
            }
        }
        return data;
    }
    doCsv(data: PlainObject[]): string {
        const lines = [];
        const heads = this.collectCsvHeads(data);
        lines.push(heads.map(this.escapeCsv, this).join(','));

        for (const row of data) {
            const values = [];
            for (const prop of heads) {
                values.push(`${row?.[prop] ?? ''}`);
            }
            lines.push(values.map(this.escapeCsv, this).join(','));
        }
        return lines.join('\n');
    }
    collectCsvHeads(data: PlainObject[]): string[] {
        const heads: Set<string> = new Set();
        for (const row of data) {
            for (const head of Object.keys(row)) {
                heads.add(head);
            }
        }
        return [...heads];
    }
    escapeCsv(value: string): string {
        value = value.replaceAll('"', '""');
        if (this.csvQuoteRegExp.test(value)) {
            value = `"${value}"`;
        }
        return value;
    }
    csvQuoteRegExp = /[\f\n\r\t\v",]/;
    parseFilename({
        usage,
        target,
        ...settings
    }: {
        usage: Usage;
        target: AppTarget;
    } & Omit<ExporterState, 'usage' | 'target' | 'defaults'>): string {
        const replacers = this.filenameReplacers(usage);
        const settingName = this.filenameTemplateSettingName(usage);
        let filename = settings[settingName];
        for (const replacer of replacers) {
            filename = filename.replaceAll(
                `{${replacer.key}}`,
                replacer.func(target, settings),
            );
        }
        return filename;
    }
    filenameReplacers(usage: Usage): Replacer[] {
        const now = new Date();
        const hours = ('' + now.getHours()).padStart(2, '0');
        const minutes = ('' + now.getMinutes()).padStart(2, '0');
        const seconds = ('' + now.getSeconds()).padStart(2, '0');
        const year = ('' + now.getFullYear()).substring(2);
        const month = ('' + (now.getMonth() + 1)).padStart(2, '0');
        const day = ('' + now.getDate()).padStart(2, '0');
        const replacers: Replacer[] = [
            { key: 'format', func: (_, settings) => settings.dataExportFormat },
            { key: 'date', func: () => `${year}${month}${day}` },
            { key: 'h', func: () => hours },
            { key: 'm', func: () => minutes },
            { key: 's', func: () => seconds },
            { key: 'time', func: () => `${hours}${minutes}${seconds}` },
            { key: 'db', func: (target) => target.database },
        ];
        if (['selection', 'table'].includes(usage)) {
            replacers.push({ key: 'table', func: (target) => target.table });
        }
        return replacers;
    }
    panel(): TemplateResult {
        const content = html`
            <div>
                <div>
                    <span>
                        ${this.#helper.formatSelect({
                            id: 'export-format',
                            formats: this.formats,
                            selected: this[state].dataExportFormat,
                            onchange: this.changeExportFormat.bind(this),
                        })}
                    </span>
                    ${this.#helper.infoTooltipIcon(this.settingsTooltipView.bind(this))}
                </div>
                <div>
                    <label for="export-filename">filename</label>
                    ${textinput({
                        name: 'export-filename',
                        size: 20,
                        '.value': this[state].filename,
                        '@change': this.changeExportFilename.bind(this),
                        '@focus': this.focusExportFilename.bind(this),
                        '@focusout': this.focusoutExportFilename.bind(this),
                    })}
                </div>
            </div>
        `;
        const button = { label: 'export', handler: this.export.bind(this) };
        return configLayer.panel(content, button);
    }
    settingsTooltipView(): TemplateResult {
        const { usage, primaryKeyName, dataExportFormat: format } = this[state];
        const source =
            usage === 'database'
                ? (this[state].tables as KTable[])
                : (this[state].table as KTable);

        const settingInfos: TemplateResult[] = [];
        const hasPkName = this.#helper.hasPkNameInput(this.format, source);
        const annotateFunc = ExportConfig.primaryKeyNameInfo;
        if (hasPkName) {
            settingInfos.push(
                this.#helper.pkNameInfo(usage, primaryKeyName, annotateFunc),
            );
            settingInfos.push(
                this.#helper.settingInfo(
                    'direct values name',
                    this[state].directValuesName,
                    ExportConfig.directValuesNameInfo(),
                ),
            );
        }
        if (['dexie', 'json'].includes(format)) {
            const prettyPrintValue =
                format === 'dexie' ? this[state].prettyDexie : this[state].prettyJSON;
            settingInfos.push(
                this.#helper.settingInfo('pretty print output', prettyPrintValue),
            );
        }
        const usageFilenameSetting =
            `filename${capitalize(usage)}` as keyof FilenameTemplateSettings;
        settingInfos.push(
            this.#helper.settingInfo(
                'filename template',
                this[state][usageFilenameSetting],
            ),
        );
        return html`
            <h2>
                applied export
                settings:${this.#helper.changeSettingsIcon('export', this[state].target)}
            </h2>
            ${settingInfos}
        `;
    }
    changeExportFormat(event: Event) {
        const target = event.target as HTMLInputElement;
        const dataExportFormat = this.isExportFormat(target.value)
            ? target.value
            : this.formats[0];
        const filename = this.parseFilename({ ...this[state], dataExportFormat });
        this.update({ filename, dataExportFormat });
        this.#helper.updateSettings('export', this[state]);
        configLayer.update({});
    }
    isExportFormat(value: string): value is ExportFormat {
        return this.formats.includes(value as ExportFormat);
    }
    changeExportFilename(event: Event) {
        const target = event.target as HTMLInputElement;
        this.update({
            [`filename${capitalize(this[state].usage)}`]: target.value.trim(),
        });
        this.update({ filename: this.parseFilename(this[state]) });
        this.#helper.updateSettings('export', this[state]);
        configLayer.update({});
    }
    focusExportFilename(event: Event) {
        const target = event.target as HTMLInputElement;
        const settingName = this.filenameTemplateSettingName(this[state].usage);
        target.value = this[state][settingName];
    }
    focusoutExportFilename(event: Event) {
        const target = event.target as HTMLInputElement;
        target.value = this[state].filename;
    }
    filenameTemplateSettingName(usage: Usage): keyof FilenameTemplateSettings {
        return `filename${capitalize(usage)}` as keyof FilenameTemplateSettings;
    }
};

const exporter = new Exporter();
export default exporter;
