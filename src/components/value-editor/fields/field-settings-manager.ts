/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type {
    FieldSettings,
    ValueFieldArgs,
} from '#components/value-editor/fields/field';
import type { FieldFormatterManager } from '#components/value-editor/fields/field-formatter-manager';
import BehaviorConfig from '#components/config/behavior-config';
import { Charset, EncodableCharset } from '#lib/charsets';
import { preferedInputMethod } from '#lib/datatype-attributes';
import settings from '#lib/settings';

export class FieldSettingsManager {
    private defaultCharsets: { upload: Charset; download: EncodableCharset } = {
        upload: 'utf-8',
        download: 'utf-8',
    };
    private useLocalTimezone = false;
    constructor(
        private args: ValueFieldArgs,
        private formatterMgr: FieldFormatterManager,
    ) {}
    defaultSettings(): FieldSettings {
        const { upload, download } = this.defaultCharsets;
        const type = this.args.type;
        return {
            inputMethod: preferedInputMethod(type),
            uploadCharset: upload,
            downloadCharset: download,
            useLocalTimezone: this.useLocalTimezone,
            datepickerType: type === 'date' ? 'datetime' : null,
            flexInput: { textarea: { width: '25em', height: '3lh' } },
            formOptions: this.formatterMgr.defaultValueOptions(),
            codeOptions: this.formatterMgr.defaultValueOptions(),
        };
    }
    async load(): Promise<FieldSettings> {
        const { fieldName, target, type } = this.args;
        const values: Partial<FieldSettings> = await settings.get({
            ...target,
            subject: 'editorfield',
            detail: `${fieldName}~${type}`,
        });

        const {
            values: {
                uploadCharset: upload,
                downloadCharset: download,
                useLocalTimezone,
            },
        } = await BehaviorConfig.getSettings(target);
        this.defaultCharsets = { upload, download };
        this.useLocalTimezone = useLocalTimezone;
        const defaultOpts = this.formatterMgr.defaultValueOptions();
        const formOptions = values.formOptions
            ? settings.cleanupSettings(
                  this.formatterMgr.variableOptions(values.formOptions),
                  defaultOpts,
              )
            : {};
        const codeOptions = values.codeOptions
            ? settings.cleanupSettings(
                  this.formatterMgr.variableOptions(values.codeOptions),
                  defaultOpts,
              )
            : {};

        return {
            ...this.defaultSettings(),
            ...values,
            formOptions: { ...defaultOpts, ...formOptions },
            codeOptions: { ...defaultOpts, ...codeOptions },
        };
    }
    save(currentSettings: Partial<FieldSettings>) {
        const { fieldName, target, type } = this.args;
        settings.saveSettings(
            currentSettings,
            this.defaultSettings(),
            target,
            'editorfield',
            `${fieldName}~${type}`,
        );
    }
}
