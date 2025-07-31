/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import type {
    AllOptions,
    ControlInstance,
    Option,
    OptionKey,
    OptionName,
    RealmOptions,
    SelectOption,
} from './types.ts';
import { isGlobal, isDatabase, AppTarget } from '../../lib/app-target.ts';
import checkbox from '../../lib/checkbox.ts';
import settings from '../../lib/settings.ts';
import { pickProperties } from '../../lib/utils.ts';
import { selectbox } from '../../lib/selectbox.ts';
import svgIcon from '../../lib/svgicon.ts';
import textinput from '../../lib/textinput.ts';
import { PlainObject } from '../../lib/types/common.ts';
import { SettingSubject } from '../../lib/types/settings.ts';

type ConfigState = {
    defaults: RealmOptions;
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
            if (
                !settings.isEqualSetting(
                    remembered[key as OptionKey],
                    this.state[key as OptionKey],
                )
            ) {
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
                    checked: this.state[name] as boolean,
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
    optionInputView({ label, ...props }: { label: string }) {
        const pname = (props as Option).name as OptionName;
        const textInput = textinput(
            Object.assign(props, {
                '.value': this.state[pname],
                '@change': this.inputOptionChanged.bind(this, pname),
            }),
        );
        return html`
            <p>${textInput} ${this.optionLabel(pname, label)}</p>
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
        const selected = this.state[props.name] ? (this.state[props.name] as string) : '';
        props['@change'] ??= this.inputOptionChanged.bind(this, props.name);
        const select = selectbox({ ...props, selected });
        return html`
            <p>${select} ${this.optionLabel(props.name, label)}</p>
        `;
    }
    optionLabel(name: OptionName, label: string | TemplateResult) {
        const remembered = this.#control.rememberedSettings as RealmOptions;
        const modifiedIcon = settings.isEqualSetting(
            this.state[name],
            remembered[name as OptionKey],
        )
            ? ''
            : this.modifiedIcon();
        const defaults = this.state.defaults;
        const defaultIcon = settings.isEqualSetting(
            this.state[name],
            defaults[name as OptionKey],
        )
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
        const target = event.target as HTMLInputElement;
        const options = this['checkboxOptions' as keyof this] as Option[];
        if (options.map((opt) => opt.name).includes(name)) {
            this.setStateValue(name, target.checked);
            this.saveSettings();
        }
    }
    inputOptionChanged(name: OptionName, event: Event) {
        const target = event.target as HTMLInputElement;
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
                value = this.state[name] as number;
            }
            target.value = String(value);
        }
        this.setStateValue(name, value);
        this.saveSettings();
    }
    static async getDefaults(
        target: AppTarget,
        subject: SettingSubject,
        preset: PlainObject,
    ) {
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
        const defaults = this.state.defaults as PlainObject;
        const values = pickProperties(this.state, Object.keys(defaults));
        const globalsDefaults = this['globalsDefaults' as keyof this];
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
