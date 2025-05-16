/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { exportDB } from 'dexie-export-import';

import configLayer from './configlayer.js';
import Database from './database.js';
import datatable from './datatable.js';
import ImporterExporter from './importer-exporter.js';
import ExportConfig from './config/export-config.js';
import ImportExport from './config/import-export.js';

import appStore from '../lib/app-store.js';
import { getConnection } from '../lib/connection.js';
import {
    getCollection,
    isPrimKeyNamed,
    leadingUnnamedPkValues,
} from '../lib/dexie-utils.js';
import messenger from '../lib/messenger.js';
import textinput from '../lib/textinput.js';
import { isPlainObject } from '../lib/types.js';
import { capitalize, downloadFile } from '../lib/utils.js';

const state = Symbol('exporter state');

const Exporter = class {
    async init(args /* { usage, target, dexieExportFilter } */) {
        this[state] = await this.initialState(args);
        messenger.register('refreshExporter', this.refreshSettings.bind(this));
    }
    async initialState(args) {
        const settings = await this.getSettings(args.target);
        let table, tables;
        if (['table', 'selection'].includes(args.usage)) {
            table = appStore.table(args.target.table);
        } else {
            tables = await Database.getTables(args.target.database);
            settings.dataExportFormat = 'dexie';
        }
        const filename = this.parseFilename({ ...args, ...settings });
        return {
            filename,
            table,
            tables,
            ...settings,
            ...args,
        };
    }
    async getSettings(target) {
        const { values: settings, defaults } = await ExportConfig.getSettings(target);
        return { defaults, ...settings };
    }
    async refreshSettings() {
        this.update(await this.getSettings(this[state].target));
        this.update({ filename: this.parseFilename(this[state]) });
        configLayer.update({});
    }
    update(changes) {
        this[state] = { ...this[state], ...changes };
    }
    get format() {
        return this[state].dataExportFormat;
    }
    get formats() {
        return this[state].usage === 'database' ? ['dexie'] : ImportExport.dataFormats;
    }
    mimeTypes = {
        dexie: 'application/json',
        json: 'application/json',
        csv: 'text/csv',
    };
    mimeType = (type) => this.mimeTypes[type];
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
                const options = {
                    filter: this[state].dexieExportFilter,
                    prettyJson: this[state].prettyDexie,
                };
                content = await exportDB(dbHandle, options);
            } else {
                const collection =
                    this[state].usage === 'selection'
                        ? getCollection(datatable.state)
                        : dbHandle.table(this[state].target.table).toCollection();
                const data = await this.collectionToData(collection);
                if (format === 'json') {
                    const space = this[state].prettyJSON ? 2 : null;
                    content = JSON.stringify(data, null, space);
                } else if (format === 'csv') {
                    content = this.doCsv(data);
                }
            }
            downloadFile(content, this[state].filename, this.mimeType(format));
            appStore.rerender({ loading: false });
            configLayer.close();
        } catch (error) {
            this.handleError(error);
        }
    }

    async collectionToData(collection) {
        const { table, primaryKeyName, directValuesName } = this[state];
        let data = [];
        if (isPrimKeyNamed(table.primKey)) {
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
    doCsv(data) {
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
    collectCsvHeads(data) {
        const heads = new Set();
        for (const row of data) {
            for (const head of Object.keys(row)) {
                heads.add(head);
            }
        }
        return [...heads];
    }
    escapeCsv(value) {
        value = value.replaceAll('"', '""');
        if (this.csvQuoteRegExp.test(value)) {
            value = `"${value}"`;
        }
        return value;
    }
    csvQuoteRegExp = /[\f\n\r\t\v",]/;

    parseFilename({ usage, target, ...settings }) {
        const replacers = this.filenameReplacers(usage);
        let filename = settings[`filename${capitalize(usage)}`];
        for (const replacer of replacers) {
            filename = filename.replaceAll(
                `{${replacer.key}}`,
                replacer.func(target, settings),
            );
        }
        return filename;
    }
    filenameReplacers(usage) {
        const now = new Date();
        const hours = ('' + now.getHours()).padStart(2, '0');
        const minutes = ('' + now.getMinutes()).padStart(2, '0');
        const seconds = ('' + now.getSeconds()).padStart(2, '0');
        const year = ('' + now.getFullYear()).substring(2);
        const month = ('' + (now.getMonth() + 1)).padStart(2, '0');
        const day = ('' + (now.getDay() + 1)).padStart(2, '0');
        const replacers = [
            { key: 'format', func: (_, settings) => settings.dataExportFormat },
            { key: 'date', func: () => `${year}${month}${day}` },
            { key: 'h', func: () => hours },
            { key: 'm', func: () => minutes },
            { key: 's', func: () => seconds },
            { key: 'time', func: () => `${hours}${minutes}${seconds}` },
            { key: 'db', func: (target) => target.database },
        ];
        if (usage === 'table') {
            replacers.push({ key: 'table', func: (target) => target.table });
        }
        return replacers;
    }

    panel() {
        const content = html`
            <div>
                <div>
                    <span>
                        ${this.formatSelect({
                            id: 'export-format',
                            onchange: this.changeExportFormat.bind(this),
                            selected: this[state].dataExportFormat,
                        })}
                    </span>
                    ${this.infoTooltipIcon()}
                </div>
                <div>
                    <label for="export-filename">filename</label>
                    ${textinput({
                        name: 'export-filename',
                        size: 20,
                        '@change': this.changeExportFilename.bind(this),
                        '@focus': (event) =>
                            (event.target.value =
                                this[state][`filename${capitalize(this[state].usage)}`]),
                        '@focusout': (event) =>
                            (event.target.value = this[state].filename),
                        '.value': this[state].filename,
                    })}
                </div>
            </div>
        `;
        const button = { click: this.export.bind(this), text: 'export' };
        return configLayer.panel(content, button);
    }
    settingsTooltipView() {
        const { usage, primaryKeyName, dataExportFormat: format } = this[state];
        const source = usage === 'database' ? this[state].tables : this[state].table;

        const annotateFunc = ExportConfig.primaryKeyNameInfo;
        const settingInfos = [
            this.pkNameInfo(usage, source, primaryKeyName, annotateFunc),
        ];
        if (this.hasPkNameInput(usage, source)) {
            settingInfos.push(
                this.settingInfo(
                    'direct values name',
                    this[state].directValuesName,
                    ExportConfig.directValuesNameInfo(),
                ),
            );
        }
        if (['dexie', 'json'].includes(format)) {
            const prettyPrintValue =
                format === 'dexie' ? this[state].prettyDexie : this[state].prettyJSON;
            settingInfos.push(this.settingInfo('pretty print output', prettyPrintValue));
        }
        settingInfos.push(
            this.settingInfo(
                'filename template',
                this[state][`filename${capitalize(usage)}`],
            ),
        );
        return html`
            <h2>
                applied export
                settings:${this.changeSettingsIcon('export', this[state].target)}
            </h2>
            ${settingInfos}
        `;
    }
    changeExportFormat(event) {
        const dataExportFormat = event.target.value;
        const filename = this.parseFilename({ ...this[state], dataExportFormat });
        this.update({ filename, dataExportFormat });
        this.updateSettings('export', state);
        configLayer.update({});
    }
    changeExportFilename(event) {
        this.update({
            [`filename${capitalize(this[state].usage)}`]: event.target.value.trim(),
        });
        this.update({ filename: this.parseFilename(this[state]) });
        this.updateSettings('export', state);
        configLayer.update({});
    }
};
Object.assign(Exporter.prototype, ImporterExporter);

const exporter = new Exporter();

export default exporter;
