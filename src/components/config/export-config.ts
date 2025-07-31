/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.ts';
import type {
    ControlInstance,
    ExportOptions,
    InputOption,
    Option,
    SelectOption,
} from './types.ts';
import { type AppTarget } from '../../lib/app-target.ts';
import infoIcon from '../../lib/info-icon.ts';
import settings from '../../lib/settings.ts';
import { selfMap } from '../../lib/utils.ts';
import { DATA_FORMATS } from '../../lib/types/common.ts';
import type { SettingSubject } from '../../lib/types/settings.ts';

type ExportConfigState = {
    defaults: ExportOptions;
    subject: SettingSubject;
} & ExportOptions;

const ExportConfig = class extends Config {
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: ExportOptions;
        defaults: ExportOptions;
    }) {
        const state: ExportConfigState = {
            ...values,
            defaults,
            subject: 'export',
        };
        super(control, state);
    }
    static async activate(control: ControlInstance) {
        const { values, defaults } = await ExportConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new ExportConfig({ control, values, defaults });
    }
    checkboxOptions: Option[] = [
        { name: 'prettyDexie', label: 'pretty print dexie exports' },
        { name: 'prettyJSON', label: 'pretty print JSON exports' },
    ];
    selectOptions: SelectOption[] = [
        {
            name: 'dataExportFormat',
            label: 'format for table data export',
            options: selfMap([...DATA_FORMATS]),
        },
    ];
    inputOptions: InputOption[] = [
        { name: 'filenameDatabase', label: 'export database filename', size: 20 },
        { name: 'filenameTable', label: 'export table data filename', size: 20 },
        { name: 'filenameSelection', label: 'export selection data filename', size: 20 },
        { name: 'primaryKeyName', label: 'primary key name', size: 15 },
        { name: 'directValuesName', label: 'direct values name', size: 15 },
    ];
    view() {
        return html`
            ${this.selectOptionsView()} ${this.inputOptionsView()}
            ${this.checkboxOptionsView()}
        `;
    }
    decorateLabel(name: string, label: string) {
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
    static primaryKeyNameInfo(usage?: string) {
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
    static async getSettings(target: AppTarget) {
        const defaults = (await ExportConfig.getDefaults(target)) as ExportOptions;
        let values = (await settings.get({
            ...target,
            subject: 'export',
        })) as ExportOptions;
        values = settings.cleanupSettings(values, defaults) as ExportOptions;
        return { values, defaults };
    }
    static async getDefaults(target: AppTarget): Promise<ExportOptions> {
        return (await Config.getDefaults(
            target,
            'export',
            exportDefaultOptions(),
        )) as ExportOptions;
    }
    static defaultSettings(): ExportOptions {
        return exportDefaultOptions();
    }
};

export const exportDefaultOptions = () => {
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
};

export default ExportConfig;
