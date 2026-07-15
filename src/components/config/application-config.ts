/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { map } from 'lit/directives/map.js';

import ApplicationConfigDefaults from '#components/config/application-defaults';
import Config from '#components/config/config';
import type {
    ControlInstance,
    ApplicationOptions,
    OptionName,
} from '#components/config/types';
import appWindow from '#components/app-window';
import messageStack from '#components/messagestack';
import tooltip from '#components/tooltip';
import { button } from '#lib/button';
import checkbox from '#lib/checkbox';
import env from '#lib/environment';
import { escapeUnicode, unescapeUnicode } from '#lib/escape-unicode';
import messenger from '#lib/messenger';
import settings from '#lib/settings';
import svgIcon from '#lib/svgicon';
import textinput from '#lib/textinput';
import { downloadFile, pickByKeys } from '#lib/utils';
import type { Message, SettingSubject, UnknownRecord } from '#types';

type ApplicationConfigState = {
    defaults: ApplicationOptions;
    subject: SettingSubject;
} & ApplicationOptions;

export default class ApplicationConfig extends Config {
    #confirmReset = false;
    #boundExportedSettings = this.exportedSettings.bind(this);
    #boundImportedSettingsResult = this.importSettingsResult.bind(this);
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: ApplicationOptions;
        defaults: ApplicationOptions;
    }) {
        const state: ApplicationConfigState = {
            ...values,
            defaults,
            subject: 'globals',
        };
        super(control, state);
    }
    static async activate(control: ControlInstance) {
        if (control.isGlobal === false) {
            throw `Cannot activate ApplicationConfig if the config Target is not 'global'!`;
        }
        const { values, defaults } = ApplicationConfig.getSettings();
        if (!control.rememberedSettings) {
            control.remember(structuredClone(values));
        }
        return new ApplicationConfig({ control, values, defaults });
    }
    checkboxOptions = [
        {
            name: 'dontNotifyEmpty',
            label: "don't notify for empty databases without tables",
        },
    ];
    selectOptions = [
        {
            name: 'colorScheme',
            label: 'preferred color scheme',
            options: { browser: 'use browser setting', light: 'light', dark: 'dark' },
            '@change': this.colorSchemeChanged.bind(this, 'colorScheme'),
        },
        {
            name: 'colorSchemeOrigin',
            label: `color scheme, specific for ${window.location.origin}`,
            options: { same: 'same as above', light: 'light', dark: 'dark' },
            '@change': this.colorSchemeChanged.bind(this, 'colorSchemeOrigin'),
        },
    ];
    inputOptions = [
        {
            name: 'colorStringLightmode',
            label: 'color for string values (light mode)',
            type: 'color',
            '@change': this.colorChanged.bind(this, 'colorStringLightmode'),
        },
        {
            name: 'colorNumberLightmode',
            label: 'color for number values (light mode)',
            type: 'color',
            '@change': this.colorChanged.bind(this, 'colorNumberLightmode'),
        },
        {
            name: 'colorStringDarkmode',
            label: 'color for string values (dark mode)',
            type: 'color',
            '@change': this.colorChanged.bind(this, 'colorStringDarkmode'),
        },
        {
            name: 'colorNumberDarkmode',
            label: 'color for number values (dark mode)',
            type: 'color',
            '@change': this.colorChanged.bind(this, 'colorNumberDarkmode'),
        },
    ];
    view() {
        return html`
            ${this.selectOptionsView()} ${this.inputOptionsView()}
            ${this.checkboxOptionsView()} ${this.ignoreDatabasesView()}
            ${this.exportImportView()} ${this.resetView()}
        `;
    }
    ignoreDatabasesView() {
        const ignoreDatabases = html`
            <p>
                dont't notify and hide these databases:
                ${map(this.state.ignoreDatabases, (name: string, index: number) =>
                    this.ignoredDatabaseNameView(name, index),
                )}
                <span
                    title="click to add database name"
                    @click=${this.addIgnoredDatabase.bind(this)}
                >
                    ${svgIcon('tabler-square-rounded-plus', {
                        width: 16,
                        class: 'inline',
                    })}
                </span>
            </p>
        `;
        return ignoreDatabases;
    }
    ignoredDatabaseNameView(name: string, index: number) {
        return html`
            <i>${escapeUnicode(name)}</i>
            <span
                title="click to remove"
                @click=${this.removeIgnoredDatabase.bind(this, index)}
            >
                ${svgIcon('tabler-square-rounded-minus', {
                    width: 16,
                    class: 'inline',
                })}
            </span>
            ,
        `;
    }
    addIgnoredDatabaseView() {
        const readyButton = button({
            content: svgIcon('tabler-check'),
            title: 'add database name',
        });
        return html`
            <div class="add-ignored">
                <p>enter database name to ignore</p>
                ${textinput({
                    size: 15,
                    '@change': this.addIgnoredDatabaseReady.bind(this),
                    refVar: this.focusAddIgnoredInput,
                })}
                ${readyButton}
            </div>
        `;
    }
    resetView() {
        const resetCheckbox = checkbox({
            label: 'reset all settings to default values globally',
            '@change': this.toggleReset.bind(this),
            checked: this.#confirmReset,
        });
        let resetConfirmPanel: string | TemplateResult = '';
        if (this.#confirmReset) {
            const buttonYes = button({
                content: 'yes',
                class: 'left',
                '@click': this.resetYes.bind(this),
            });
            const buttonNo = button({
                content: 'no',
                class: 'right',
                '@click': this.resetNo.bind(this),
            });
            resetConfirmPanel = html`
                <div class="confirm panel">
                    Are you sure?
                    <div class="clearfix">${buttonNo}${buttonYes}</div>
                </div>
            `;
        }
        return html`
            <p><span>${resetCheckbox}</span></p>
            ${resetConfirmPanel}
        `;
    }
    exportImportView() {
        const buttonExport = button({
            content: 'export settings',
            title: 'export settings in dexie format',
            '@click': this.exportSettings.bind(this),
        });
        const buttonImport = button({
            content: html`
                <label>import settings</label>
                <input
                    type="file"
                    id="import-file"
                    @change=${this.importSettings.bind(this)}
                    accept=".dexie"
                    class="hidden"
                />
            `,
            title: 'import settings from file',
            '@click': this.clickImportSettingsFileInput.bind(this),
        });
        return html`
            <hr />
            <p class="settings-export-import">${buttonExport} ${buttonImport}</p>
        `;
    }
    colorSchemeChanged(name: OptionName, event: Event) {
        this.inputOptionChanged(name, event);
        appWindow.setColorScheme();
        appWindow.setColors();
    }
    colorChanged(name: OptionName, event: Event) {
        this.inputOptionChanged(name, event);
        appWindow.setColors();
    }
    toggleReset() {
        this.#confirmReset = !this.#confirmReset;
        this.render();
    }
    resetYes() {
        messenger.post({ type: 'resetSettings', target: this.target });
        messageStack.displayInfo(`All settings have been reset.`);
        this.toggleReset();
        messenger.post({ type: 'reloadApp' });
    }
    resetNo() {
        this.toggleReset();
    }
    focusAddIgnoredInput(node?: Element) {
        if (node !== undefined) {
            setTimeout(() => (node as HTMLInputElement).focus(), 0);
        }
    }
    addIgnoredDatabase(event: Event) {
        const target = event.target as HTMLElement;
        const anchor = target.closest('span') as HTMLAnchorElement;
        tooltip.show({
            view: this.addIgnoredDatabaseView.bind(this),
            anchor,
            north: true,
            hideDistance: 40,
        });
    }
    removeIgnoredDatabase(index: number) {
        if (Array.isArray(this.state.ignoreDatabases)) {
            this.state.ignoreDatabases.splice(index, 1);
            this.saveSettings();
        }
    }
    addIgnoredDatabaseReady(event: Event) {
        tooltip.close();
        const target = event.target as HTMLInputElement;
        const name = unescapeUnicode(target.value.trim());
        if (
            name.length > 0 &&
            Array.isArray(this.state.ignoreDatabases) &&
            this.state.ignoreDatabases.includes(name) === false
        ) {
            this.state.ignoreDatabases.push(name);
            this.saveSettings();
        }
    }
    exportSettings() {
        messenger.register('exportedSettings', this.#boundExportedSettings);
        messenger.post({ type: 'exportSettings' });
    }
    async exportedSettings(msg: Message) {
        if (msg.type === 'exportedSettings') {
            downloadFile(msg.data, 'kahuna-settings.dexie', 'application/dexie');
            messenger.unregister('exportedSettings', this.#boundExportedSettings);
        }
    }
    clickImportSettingsFileInput(event: Event) {
        const target = event.target;
        if (target instanceof HTMLElement && !(target instanceof HTMLInputElement)) {
            const input = target.closest('button')?.querySelector('input');
            if (input) input.click();
        }
    }
    importSettings(event: Event) {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.files?.length === 1) {
            const dataSrc = env.isFirefox
                ? target.files[0]
                : URL.createObjectURL(target.files[0]);
            messenger.register('importSettingsResult', this.#boundImportedSettingsResult);
            messenger.post({ type: 'importSettings', dataSrc });
        }
    }
    importSettingsResult(msg: Message) {
        if (msg.type === 'importSettingsResult') {
            if ('error' in msg) {
                messageStack.displayError(msg.error.message);
            } else {
                messageStack.displayInfo('The settings data has been imported.');
            }
            messenger.unregister(
                'importSettingsResult',
                this.#boundImportedSettingsResult,
            );
        }
    }
    override setDefaults() {
        super.setDefaults();
        appWindow.setColorScheme();
        appWindow.setColors();
    }
    override undoChanges() {
        super.undoChanges();
        appWindow.setColorScheme();
        appWindow.setColors();
    }
    override saveSettings() {
        const values = pickByKeys(this.state, this.state.defaults);
        settings.saveGlobals(values);
        this.render();
    }
    static getSettings() {
        const defaults = ApplicationConfigDefaults();
        const values: UnknownRecord = {};
        for (const key of Object.keys(defaults)) {
            const setting = settings.global(key as keyof ApplicationOptions);
            values[key] = setting;
        }
        return { values: structuredClone(values as ApplicationOptions), defaults };
    }
}
