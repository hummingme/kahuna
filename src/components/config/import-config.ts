/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.ts';
import type {
    ControlInstance,
    ImportOptions,
    InputOption,
    Option,
    OptionName,
    SelectOption,
} from './types.ts';
import type { AppTarget } from '../../lib/app-target.ts';
import infoIcon from '../../lib/info-icon.ts';
import settings from '../../lib/settings.ts';
import { selfMap } from '../../lib/utils.ts';
import { DATA_FORMATS, EMPTY_AS } from '../../lib/types/common.ts';
import type { SettingSubject } from '../../lib/types/settings.ts';

type ImportConfigState = {
    defaults: ImportOptions;
    subject: SettingSubject;
} & ImportOptions;

const ImportConfig = class extends Config {
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: ImportOptions;
        defaults: ImportOptions;
    }) {
        const state: ImportConfigState = {
            ...values,
            defaults,
            subject: 'import',
        };
        super(control, state);
    }
    static async activate(control: ControlInstance) {
        const { values, defaults } = await ImportConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new ImportConfig({ control, values, defaults });
    }
    checkboxOptions: Option[] = [
        { name: 'clearTablesBeforeImport', label: 'clear tables before' },
        { name: 'overwriteValues', label: 'overwrite values' },
        { name: 'noTransaction', label: 'no transaction' },
        { name: 'acceptNameDiff', label: 'accept name diff' },
        { name: 'acceptVersionDiff', label: 'accept version diff' },
        { name: 'acceptChangedPrimaryKey', label: 'accept changed primary key' },
        { name: 'acceptMissingTables', label: 'accept missing tables' },
        { name: 'importDirectValues', label: 'import data as direct value' },
    ];
    selectOptions: SelectOption[] = [
        {
            name: 'dataImportFormat',
            label: 'file format for data import',
            options: selfMap([...DATA_FORMATS]),
        },
        {
            name: 'importEmptyAs',
            label: 'import empty csv values as',
            options: selfMap([...EMPTY_AS]),
        },
    ];
    inputOptions: InputOption[] = [
        { name: 'primaryKeyName', label: 'primary key name', size: 15 },
        { name: 'directValuesName', label: 'direct values name', size: 15 },
    ];
    view() {
        return html`
            ${this.selectOptionsView()} ${this.optionInputView(this.inputOptions[0])}
            ${this.checkboxOptionsView()}${this.directValuesNameView()}
        `;
    }
    directValuesNameView() {
        this.inputOptions[1].class =
            this.state.importDirectValues === true &&
            this.state.directValuesName &&
            this.state.directValuesName.length === 0
                ? 'warn'
                : undefined;
        return html`
            ${this.optionInputView(this.inputOptions[1])}
        `;
    }
    decorateLabel(name: OptionName, label: string) {
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
    static primaryKeyNameInfo(usage?: string) {
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
    static async getSettings(target: AppTarget) {
        const defaults = await ImportConfig.getDefaults(target);
        let values = (await settings.get({
            ...target,
            subject: 'import',
        })) as ImportOptions;
        values = settings.cleanupSettings(values, defaults) as ImportOptions;
        return { values, defaults };
    }
    static async getDefaults(target: AppTarget): Promise<ImportOptions> {
        return (await Config.getDefaults(
            target,
            'import',
            ImportConfig.defaultSettings(),
        )) as ImportOptions;
    }
    static defaultSettings(): ImportOptions {
        return importDefaultOptions();
    }
};

export const importDefaultOptions = () => {
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
};

export default ImportConfig;
