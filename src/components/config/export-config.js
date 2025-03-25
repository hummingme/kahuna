/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.js';
import ImportExport from './import-export.js';
import settings from '../../lib/settings.js';
import infoIcon from '../../lib/info-icon.js';

const ExportConfig = class extends Config {
    constructor({ control, values, defaults }) {
        super(control);
        this.state = {
            ...values,
            defaults,
            subject: 'export',
        };
    }
    static async activate(control) {
        const { values, defaults } = await ExportConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new ExportConfig({ control, values, defaults });
    }
    checkboxOptions = [
        { name: 'prettyDexie', label: 'pretty print dexie exports' },
        { name: 'prettyJSON', label: 'pretty print JSON exports' },
    ];
    selectOptions = [{ name: 'dataExportFormat', label: 'format for table data export' }];
    inputOptions = [
        { name: 'filenameDatabase', label: 'export database filename', size: 20 },
        { name: 'filenameTable', label: 'export table data filename', size: 20 },
        { name: 'filenameSelection', label: 'export selection data filename', size: 20 },
        { name: 'primaryKeyName', label: 'primary key name', size: 15 },
        { name: 'directValuesName', label: 'direct values name', size: 15 },
    ];
    view() {
        return html`
            ${this.formatSelectView(...Object.values(this.selectOptions[0]))}
            ${this.inputOptionsView()} ${this.checkboxOptionsView()}
        `;
    }
    decorateLabel(name, label) {
        if (name === 'primaryKeyName') {
            return html`
                ${label}${ExportConfig.primaryKeyNameInfo()}
            `;
        } else if (name === 'directValuesName') {
            return html`
                ${label}${ExportConfig.directValuesNameInfo()}
            `;
        }
        return label;
    }
    static primaryKeyNameInfo(usage) {
        const info = `Name to use in the export for the unnamed primary \
key${usage === 'database' ? '(s)' : ''}. Leave the field blank to exclude \
the primary key from the export.`;
        return infoIcon(info);
    }
    static directValuesNameInfo() {
        const info = `Name to use in the export for direct values that are not \
stored as object properties, if such occur in the table. If this field \
is left blank, rows with direct values will be excluded from the export.`;
        return infoIcon(info);
    }
    static async getSettings(target) {
        const defaults = await ExportConfig.getDefaults(target);
        let values = await settings.get({ ...target, subject: 'export' });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getDefaults(target) {
        return await Config.getDefaults(target, 'export', ExportConfig.defaultSettings());
    }
    static defaultSettings() {
        return {
            dataExportFormat: 'json', // FOR tables & selections, dexie|csv|json
            filenameDatabase: '{db}-{date}-{time}.{format}',
            filenameTable: '{table}-{date}-{time}.{format}',
            filenameSelection: '{table}-part.{format}',
            primaryKeyName: 'key', // for csv & json, if pk is unnamed
            directValuesName: 'value', // for csv & json
            prettyDexie: false, // all targets, all formats
            prettyJSON: false, // all targets, all formats
        };
    }
};
Object.assign(ExportConfig.prototype, ImportExport);

export default ExportConfig;
