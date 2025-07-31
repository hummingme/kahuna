/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { map } from 'lit/directives/map.js';
import ApplicationConfigDefaults from './application-defaults.ts';
import Config from './config.ts';
import type { ControlInstance, ApplicationOptions, OptionName } from './types.ts';
import appWindow from '../app-window.ts';
import messageStack from '../messagestack.ts';
import tooltip from '../tooltip.ts';
import { button } from '../../lib/button.ts';
import checkbox from '../../lib/checkbox.ts';
import messenger from '../../lib/messenger.ts';
import settings from '../../lib/settings.ts';
import svgIcon from '../../lib/svgicon.ts';
import textinput from '../../lib/textinput.ts';
import { pickProperties } from '../../lib/utils.ts';
import type { SettingSubject } from '../../lib/types/settings.ts';
import { PlainObject } from '../../lib/types/common.ts';

type ApplicationConfigState = {
    defaults: ApplicationOptions;
    subject: SettingSubject;
} & ApplicationOptions;

const ApplicationConfig = class extends Config {
    #confirmReset = false;
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
            subject: 'application',
        };
        super(control, state);
    }
    static activate(control: ControlInstance) {
        if (control.isGlobal === false) {
            return;
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
    view() {
        return html`
            ${this.selectOptionsView()} ${this.checkboxOptionsView()}
            ${this.ignoreDatabasesView()} ${this.resetView()}
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
            <i>${name}</i>
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
        if (this.isGlobal === false) {
            return '';
        }
        const subject = 'globally';
        const resetCheckbox = checkbox({
            label: `reset all settings to default values ${subject}`,
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
            <hr />
            <p>${resetCheckbox}</p>
            ${resetConfirmPanel}
        `;
    }
    colorSchemeChanged(name: OptionName, event: Event) {
        this.inputOptionChanged(name, event);
        appWindow.setColorScheme();
    }
    toggleReset() {
        this.#confirmReset = !this.#confirmReset;
        this.render();
    }
    resetYes() {
        settings.reset(this.target);
        messageStack.displayInfo(
            `All settings for the origin ${window.location.origin} have been deleted.`,
        );
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
        const name = target.value.trim();
        if (
            name.length > 0 &&
            Array.isArray(this.state.ignoreDatabases) &&
            this.state.ignoreDatabases.includes(name) === false
        ) {
            this.state.ignoreDatabases.push(name);
            this.saveSettings();
        }
    }
    saveSettings() {
        const values = pickProperties(this.state, Object.keys(this.state.defaults));
        settings.saveGlobals(values);
        this.render();
    }
    static getSettings() {
        const defaults = ApplicationConfigDefaults();
        const values: PlainObject = {};
        for (const key of Object.keys(defaults)) {
            const setting = settings.global(key as keyof ApplicationOptions);
            values[key] = setting;
        }
        return { values: structuredClone(values as ApplicationOptions), defaults };
    }
};

export default ApplicationConfig;
