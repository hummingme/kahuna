/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';

import type {
    AllOptions,
    ControlInstance,
    Option,
    OptionName,
    SelectOption,
    InputOption,
} from '#components/config/types';
import { isGlobal, isDatabase } from '#lib/app-target';
import checkbox from '#lib/checkbox';
import settings from '#lib/settings';
import { pickProperties } from '#lib/utils';
import { selectbox } from '#lib/selectbox';
import svgIcon from '#lib/svgicon';
import textinput from '#lib/textinput';
import {
    AppTarget,
    SerializedSettingValues,
    SettingSubject,
    SettingValuesMap,
} from '#types';

type ConfigState = {
    defaults: Partial<AllOptions>;
    subject: SettingSubject;
} & Partial<AllOptions>;

const state = Symbol('config state');

const Config = class {
    [state]: ConfigState;
    #control;
    constructor(control: ControlInstance, configState: ConfigState) {
        this.#control = control;
        this[state] = configState;
    }
    get state() {
        return this[state];
    }
    set state(value) {
        this[state] = value;
    }
    setStateValue<K extends keyof ConfigState>(key: K, value: ConfigState[K]) {
        this[state][key] = value;
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
    get rememberedSettings() {
        return this.#control.rememberedSettings;
    }

    render() {
        this.#control.render();
    }
    isDefault() {
        for (const [key, value] of Object.entries(this.state.defaults)) {
            if (!settings.isEqualSetting(value, this.state[key as OptionName])) {
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
            if (this.isOptionChanged(key as OptionName)) return true;
        }
        return false;
    }
    isOptionChanged(option: OptionName) {
        const remembered = this.#control.rememberedSettings;
        return (
            typeof remembered !== 'undefined' &&
            !settings.isEqualSetting(remembered[option], this.state[option])
        );
    }
    undoChanges() {
        this.state = { ...this.state, ...this.#control.rememberedSettings };
        this.saveSettings();
    }
    checkboxOptionsView() {
        const checkboxes = [];
        const options = this['checkboxOptions' as keyof this] as Option[];
        for (const args of options) {
            checkboxes.push(this.optionCheckboxView(args));
        }
        return html`
            ${checkboxes}
        `;
    }
    optionCheckboxView({
        name,
        label,
        change,
    }: {
        name: OptionName;
        label: string;
        change?: () => void;
    }) {
        return html`
            <p>
                ${checkbox({
                    name,
                    label: this.optionLabel(name, label),
                    checked: !!this.state[name],
                    '@change': change ?? this.checkboxOptionChanged.bind(this, name),
                })}
            </p>
        `;
    }
    inputOptionsView() {
        const inputs = [];
        const options = this['inputOptions' as keyof this] as [];
        for (const args of options) {
            inputs.push(this.optionInputView(args));
        }
        return html`
            ${inputs}
        `;
    }
    optionInputView(args: InputOption) {
        const { label, ...props } = args;
        const name = props.name;
        props['@change'] ??= this.inputOptionChanged.bind(this, name);
        const textInput = textinput(
            Object.assign(props, {
                '.value': this.state[name],
            }),
        );
        return html`
            <p>${textInput} ${this.optionLabel(name, label)}</p>
        `;
    }
    selectOptionsView() {
        const selects = [];
        const options = this['selectOptions' as keyof this] as SelectOption[];
        for (const args of options) {
            selects.push(this.optionSelectView(args));
        }
        return html`
            ${selects}
        `;
    }
    optionSelectView(args: SelectOption) {
        const { label, ...props } = args;
        const selected = this.state[props.name] ? String(this.state[props.name]) : '';
        props['@change'] ??= this.inputOptionChanged.bind(this, props.name);
        const select = selectbox({ ...props, selected });
        return html`
            <p>${select} ${this.optionLabel(props.name, label)}</p>
        `;
    }
    optionLabel(name: OptionName, label: string | TemplateResult) {
        const remembered = this.#control.rememberedSettings;
        const defaults = this.state.defaults;
        if (!remembered || name in defaults === false) return '';
        const modifiedIcon = settings.isEqualSetting(this.state[name], remembered[name])
            ? ''
            : this.modifiedIcon();
        const defaultIcon = settings.isEqualSetting(this.state[name], defaults[name])
            ? this.defaultIcon()
            : '';
        const decorateLabel = this['decorateLabel' as keyof this];
        if (typeof decorateLabel === 'function') {
            label = decorateLabel(name, label);
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
    checkboxOptionChanged(name: OptionName, event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const options = this['checkboxOptions' as keyof this] as Option[];
        if (options.map((opt) => opt.name).includes(name)) {
            this.setStateValue(name, target.checked);
            this.saveSettings();
        }
    }
    inputOptionChanged(name: OptionName, event: Event) {
        const target = event.target;
        if (
            !(target instanceof HTMLInputElement) &&
            !(target instanceof HTMLSelectElement)
        )
            return;
        let value: string | number = target.value.trim();
        if (target.checkValidity() === true) {
            if (value.length > 0 && Number.isNaN(Number(value)) === false) {
                value = Number(value);
            }
        } else if (target.type === 'number') {
            const validity = target.validity;
            if (
                target.min !== '' &&
                (validity.valueMissing || validity.rangeUnderflow || validity.badInput)
            ) {
                value = Number(target.min);
            } else if (target.max !== '' && validity.rangeOverflow) {
                value = Number(target.max);
            } else {
                value = Number(this.state[name]);
            }
            target.value = String(value);
        }
        this.setStateValue(name, value);
        this.saveSettings();
    }
    static async getDefaults<S extends SettingSubject>(
        target: AppTarget,
        subject: S,
        preset: SettingValuesMap[S],
    ): Promise<SettingValuesMap[S]> {
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
        const defaults = this.state.defaults as SerializedSettingValues;
        const keys = Object.keys(defaults) as OptionName[];
        const values = pickProperties(this.state, keys);
        if (
            'saveGlobalSettings' in this &&
            typeof this.saveGlobalSettings === 'function'
        ) {
            this.saveGlobalSettings();
        }
        settings.saveSettings(values, defaults, this.target, this.state.subject);
        this.render();
    }
};

export default Config;
