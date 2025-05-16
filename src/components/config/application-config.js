/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { map } from 'lit/directives/map.js';
import ApplicationConfigDefaults from './application-defaults.js';
import Config from './config.js';
import messageStack from '../messagestack.js';
import tooltip from '../tooltip.js';
import { button } from '../../lib/button.js';
import checkbox from '../../lib/checkbox.js';
import settings from '../../lib/settings.js';
import svgIcon from '../../lib/svgicon.js';
import textinput from '../../lib/textinput.js';
import { pickProperties } from '../../lib/utils.js';
import appWindow from '../app-window.js';

const ApplicationConfig = class extends Config {
    constructor({ control, values, defaults }) {
        super(control);
        this.state = {
            ...values,
            defaults,
            confirmReset: false,
            subject: 'application',
        };
    }
    static async activate(control) {
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
                ${map(this.state.ignoreDatabases, (name, index) =>
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
    ignoredDatabaseNameView(name, index) {
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
            '@click': this.addIgnoredDatabaseReady.bind(this),
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
            changeFunc: this.toggleReset.bind(this),
            checked: this.state.confirmReset,
        });

        let resetConfirmPanel = '';
        if (this.state.confirmReset) {
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
    colorSchemeChanged(name, event) {
        this.inputOptionChanged(name, event);
        appWindow.setColorScheme();
    }
    toggleReset() {
        this.state.confirmReset = !this.state.confirmReset;
        this.render();
    }
    resetYes() {
        settings.reset(this.target);
        messageStack.displayInfo(
            `All settings for the origin ${window.location.origin} have been deleted.`,
        );
        this.toggleReset();
    }
    resetNo() {
        this.toggleReset();
    }
    focusAddIgnoredInput(inputNode) {
        if (inputNode) {
            setTimeout(() => inputNode.focus(), 0);
        }
    }
    addIgnoredDatabase(event) {
        tooltip.show({
            view: this.addIgnoredDatabaseView.bind(this),
            anchor: event.target.closest('span'),
            north: true,
            hideDistance: 40,
        });
    }
    removeIgnoredDatabase(index) {
        this.state.ignoreDatabases.splice(index, 1);
        this.saveSettings();
    }
    addIgnoredDatabaseReady(event) {
        tooltip.hide();
        const name = event.target.value.trim();
        if (name.length > 0 && this.state.ignoreDatabases.includes(name) === false) {
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
        const defaults = ApplicationConfig.getDefaults();
        const values = structuredClone(defaults);
        for (const key in values) {
            values[key] = settings.global(key);
        }
        return { values: structuredClone(values), defaults };
    }
    static getDefaults() {
        return ApplicationConfigDefaults();
    }
};

export default ApplicationConfig;
