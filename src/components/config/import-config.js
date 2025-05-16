/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.js';
import ImportExport from './import-export.js';
import { selectbox } from '../../lib/selectbox.js';
import settings from '../../lib/settings.js';
import infoIcon from '../../lib/info-icon.js';
import { selfMap } from '../../lib/utils.js';

const ImportConfig = class extends Config {
    constructor({ control, values, defaults }) {
        super(control);
        this.state = {
            ...values,
            defaults,
            subject: 'import',
        };
    }
    static async activate(control) {
        const { values, defaults } = await ImportConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new ImportConfig({ control, values, defaults });
    }
    checkboxOptions = [
        { name: 'clearTablesBeforeImport', label: 'clear tables before' },
        { name: 'overwriteValues', label: 'overwrite values' },
        { name: 'noTransaction', label: 'no transaction' },
        { name: 'acceptNameDiff', label: 'accept name diff' },
        { name: 'acceptVersionDiff', label: 'accept version diff' },
        { name: 'acceptChangedPrimaryKey', label: 'accept changed primary key' },
        { name: 'acceptMissingTables', label: 'accept missing tables' },
        { name: 'importDirectValues', label: 'import data as direct value' },
    ];
    selectOptions = [
        { name: 'dataImportFormat', label: 'file format for data import' },
        { name: 'importEmptyAs', label: 'import empty csv values as' },
    ];
    inputOptions = [
        { name: 'primaryKeyName', label: 'primary key name', size: 15 },
        { name: 'directValuesName', label: 'direct values name', size: 15 },
    ];
    view() {
        return html`
            ${this.formatSelectView(...Object.values(this.selectOptions[0]))}
            ${this.importEmptyAsView()} ${this.optionInputView(this.inputOptions[0])}
            ${this.checkboxOptionsView()}${this.directValuesNameView()}
        `;
    }
    importEmptyAsView() {
        const { name, label } = this.selectOptions[1];
        const emptyAsLabel = this.optionLabel(name, label);
        const emptyAsSelect = selectbox({
            name,
            options: selfMap(this.emptyAs),
            selected: this.state[name],
            '@change': this.inputOptionChanged.bind(this, name),
        });
        return html`
            <p>${emptyAsSelect}${emptyAsLabel}</p>
        `;
    }
    directValuesNameView() {
        this.inputOptions[1].class =
            this.state.importDirectValues === true &&
            this.state.directValuesName.length === 0
                ? 'warn'
                : null;
        return html`
            ${this.optionInputView(this.inputOptions[1])}
        `;
    }
    decorateLabel(name, label) {
        if (name === 'primaryKeyName') {
            return html`
                ${label}${ImportConfig.primaryKeyNameInfo()}
            `;
        } else if (name === 'directValuesName') {
            return html`
                ${label}${ImportConfig.directValuesNameInfo()}
            `;
        }
        return label;
    }
    static primaryKeyNameInfo(usage) {
        const info = `Name used in the import file for the unnamed primary \
key${usage === 'database' ? '(s)' : ''}. If left blank for an autoincrement \
primary key, new values will be generated on import.`;
        return infoIcon(info);
    }
    static directValuesNameInfo() {
        const info = `Name used in the import file for direct values which \
should not get stored as object properties. If this field contains a name, \
further values from the same row are ignored, if any. Applied only for CSV and \
JSON import into tables with unnamed primary key.`;
        return infoIcon(info);
    }
    static async getSettings(target) {
        const defaults = await ImportConfig.getDefaults(target);
        let values = await settings.get({ ...target, subject: 'import' });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getDefaults(target) {
        return await Config.getDefaults(target, 'import', ImportConfig.defaultSettings());
    }
    static defaultSettings() {
        return {
            dataImportFormat: 'dexie', // fixed for database, for table could be also csv and json
            primaryKeyName: 'key', // for csv & json, if pk is unnamed
            importDirectValues: false, // for csv & json
            directValuesName: 'value', // for csv & json
            importEmptyAs: 'empty string', // |'null', 'undefined', 'exclude' ; for csv
            clearTablesBeforeImport: false, // database & table, all formats
            overwriteValues: false, // database & table, all formats
            acceptNameDiff: true, // database & table, for dexie
            acceptVersionDiff: true, // database & table, for dexie
            acceptChangedPrimaryKey: true, // database & table, for dexie
            acceptMissingTables: true, // database, for dexie
            noTransaction: false, // database & table, for dexie
        };
    }
};
Object.assign(ImportConfig.prototype, ImportExport);

export default ImportConfig;
