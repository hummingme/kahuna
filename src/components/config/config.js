/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import checkbox from '../../lib/checkbox.js';
import settings from '../../lib/settings.js';
import { pickProperties, isGlobal, isDatabase } from '../../lib/utils.js';
import { selectbox } from '../../lib/selectbox.js';
import svgIcon from '../../lib/svgicon.js';
import textinput from '../../lib/textinput.js';

const state = Symbol('config state');

const Config = class {
    #control;
    constructor(control) {
        this.#control = control;
    }
    get state() {
        return this[state];
    }
    set state(value) {
        this[state] = value;
    }
    get isGlobal() {
        return this.#control.isGlobal;
    }
    get isDatabase() {
        return this.#control.isDatabase;
    }
    get isTable() {
        return this.#control.isTable;
    }
    get target() {
        return this.#control.target;
    }
    render() {
        this.#control.render();
    }
    isDefault() {
        for (const [key, value] of Object.entries(this.state.defaults)) {
            if (!settings.isEqualSetting(value, this.state[key])) {
                return false;
            }
        }
        return true;
    }
    setDefaults() {
        this.state = { ...this.state, ...this.state.defaults };
        this.saveSettings();
    }
    isChanged() {
        const remembered = this.#control.rememberedSettings;
        for (const key in remembered) {
            if (!settings.isEqualSetting(remembered[key], this.state[key])) {
                return true;
            }
        }
        return false;
    }
    undoChanges() {
        this.state = { ...this.state, ...this.#control.rememberedSettings };
        this.saveSettings();
    }
    checkboxOptionsView() {
        const checkboxes = [];
        for (const args of this.checkboxOptions) {
            checkboxes.push(this.optionCheckboxView(args));
        }
        return html`
            ${checkboxes}
        `;
    }
    optionCheckboxView({ name, label, change }) {
        return html`
            <p>
                ${checkbox({
                    name,
                    label: this.optionLabel(name, label),
                    checked: this.state[name],
                    changeFunc: change ?? this.checkboxOptionChanged.bind(this, name),
                })}
            </p>
        `;
    }
    inputOptionsView() {
        const inputs = [];
        for (const args of this.inputOptions) {
            inputs.push(this.optionInputView(args));
        }
        return html`
            ${inputs}
        `;
    }
    optionInputView({ label, ...props }) {
        const textInput = textinput(
            Object.assign(props, {
                '.value': this.state[props.name],
                '@change': this.inputOptionChanged.bind(this, props.name),
            }),
        );
        return html`
            <p>${textInput} ${this.optionLabel(props.name, label)}</p>
        `;
    }
    selectOptionsView() {
        const selects = [];
        for (const args of this.selectOptions) {
            selects.push(this.optionSelectView(args));
        }
        return html`
            ${selects}
        `;
    }
    optionSelectView({ label, ...props }) {
        props.selected = this.state[props.name];
        props['@change'] ??= this.inputOptionChanged.bind(this, props.name);
        const select = selectbox(props);
        return html`
            <p>${select} ${this.optionLabel(props.name, label)}</p>
        `;
    }
    optionLabel(name, label) {
        const remembered = this.#control.rememberedSettings;
        const modifiedIcon = settings.isEqualSetting(this.state[name], remembered[name])
            ? ''
            : this.modifiedIcon();
        const defaultIcon = settings.isEqualSetting(
            this.state[name],
            this.state.defaults[name],
        )
            ? this.defaultIcon()
            : '';
        if (typeof this.decorateLabel === 'function') {
            label = this.decorateLabel(name, label);
        }
        return html`
            ${modifiedIcon} ${defaultIcon} ${label}
        `;
    }
    modifiedIcon() {
        return html`
            <span title="modified and saved, click 'undo changes' to restore">
                ${svgIcon('tabler-check', {
                    width: 16,
                    class: 'inline',
                })}
            </span>
        `;
    }
    defaultIcon() {
        return html`
            <span title="setting applies the default value">
                ${svgIcon('tabler-circle-dot', {
                    width: 16,
                    class: 'inline',
                })}
            </span>
        `;
    }
    checkboxOptionChanged(name, event) {
        if (this.checkboxOptions.map((o) => o.name).includes(name)) {
            this.state[name] = event.target.checked;
            this.saveSettings();
        }
    }
    inputOptionChanged(name, event) {
        if (Object.hasOwn(this.state, name)) {
            let value = event.target.value.trim();
            if (event.target.checkValidity() === true) {
                if (value.length > 0 && Number.isNaN(Number(value)) === false) {
                    value = Number(value);
                }
            } else if (event.target.type === 'number') {
                const validity = event.target.validity;
                if (
                    event.target.min !== '' &&
                    (validity.valueMissing ||
                        validity.rangeUnderflow ||
                        validity.badInput)
                ) {
                    value = Number(event.target.min);
                } else if (event.target.max !== '' && validity.rangeOverflow) {
                    value = Number(event.target.max);
                } else {
                    value = this.state[name];
                }
                event.target.value = value;
            }
            this.state[name] = value;
            this.saveSettings();
        }
    }
    static async getDefaults(target, subject, preset) {
        if (isGlobal(target)) {
            return preset;
        }
        target = { ...target };
        if (isDatabase(target)) {
            target.database = '*';
        }
        target.table = '*';
        const defaults = await settings.get({ ...target, subject });
        return { ...preset, ...defaults };
    }
    saveSettings() {
        const defaults = this.state.defaults;
        const values = pickProperties(this.state, Object.keys(defaults));
        const globalsDefaults = this.globalsDefaults;
        if (globalsDefaults) {
            const globals = pickProperties(this.state, Object.keys(globalsDefaults));
            for (const key in globals) {
                delete values[key];
                if (settings.isEqualSetting(globals[key], defaults[key])) {
                    delete globals[key];
                }
            }
            settings.saveGlobals(globals);
        }
        settings.saveSettings(values, defaults, this.target, this.state.subject);
        this.render();
    }
};

export default Config;
