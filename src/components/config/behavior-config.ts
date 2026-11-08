/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Config from '#components/config/config';
import {
    behaviorDefaultOptions,
    BehaviorAllOptions,
} from '#components/config/behavior-defaults';
import type { ControlInstance, OptionName, SelectOption } from '#components/config/types';
import checkbox from '#components/parts/checkbox';
import infoIcon from '#components/parts/info-icon';
import { equalTarget, globalTarget, emptyTarget } from '#lib/app-target';
import { CHARSETS, encodableCharsets } from '#lib/charsets';
import env from '#lib/environment';
import settings from '#lib/settings';
import { selfMap } from '#lib/utils';
import { AppTarget, SettingSubject } from '#types';

type BehaviorConfigValues = BehaviorAllOptions & {
    onLoadTarget: AppTarget;
};

type BehaviorConfigState = {
    defaults: BehaviorConfigValues;
    subject: SettingSubject;
} & BehaviorAllOptions;

export default class BehaviorConfig extends Config {
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: BehaviorConfigValues;
        defaults: BehaviorConfigValues;
    }) {
        const state: BehaviorConfigState = {
            ...values,
            defaults,
            subject: 'behavior',
        };
        super(control, state);
    }
    static async activate(control: ControlInstance) {
        const { values, defaults } = await BehaviorConfig.getSettings(control.target);
        const onLoadTargets = settings.global('onLoadTargets');
        const onLoadTarget = onLoadTargets.get(location.host)
            ? control.target
            : emptyTarget;
        const vals: BehaviorConfigValues = { ...values, onLoadTarget, onLoadTargets };
        if (!control.rememberedSettings) {
            control.remember(vals);
        }
        return new BehaviorConfig({
            control,
            values: vals,
            defaults: { ...defaults, onLoadTargets, onLoadTarget },
        });
    }
    checkboxOptions = [
        { name: 'confirmDeleteRow', label: 'ask for confirmation on "delete row"' },
        {
            name: 'escapeNonAscii',
            label: 'escape all non ASCII characters in the datatable view',
        },
        {
            name: 'useLocalTimezone',
            label: `use local time zone (${env.timeZone}) for date values`,
        },
        { name: 'queryPreferWorker', label: 'prefer webworker for data querying' },
    ];
    inputOptions = [
        {
            name: 'datatableRows',
            label: 'rows per page',
            type: 'number',
            style: 'width: 6ch;',
            maxlength: 5,
            '?required': true,
            min: 1,
            max: 10000,
        },
        {
            name: 'hideMessagesSeconds',
            label: 'seconds after which messages are hidden (0 = never)',
            type: 'number',
            style: 'width: 5ch;',
            maxlength: 2,
            '?required': true,
            min: 0,
            max: 999,
        },
    ];
    selectOptions = [
        {
            name: 'uploadCharset',
            label: 'charset of uploaded text files',
            options: selfMap(CHARSETS),
        },
        {
            name: 'downloadCharset',
            label: 'charset for string value downloads',
            options: selfMap(encodableCharsets()),
        },
    ];
    view() {
        return html`
            ${this.checkboxOptionsView()}
            ${this.codeExecutionMethodsView()}${this.selectOptionsView()}
            ${this.inputOptionsView()} ${this.onLoadTargetView()}
        `;
    }
    decorateLabel(name: OptionName, label: string) {
        if (name === 'codeExecutionMethod') {
            const info: string[] = [];
            if (env.manifestVersion === 2 && env.unsafeEval === false) {
                info.push(
                    `The method "unsafeEval" is prohibited on ${window.location.origin} by CSP rules.`,
                );
            }
            if (env.workersBlocked === true) {
                info.push(
                    `Running web workers is prohibited on ${window.location.origin} by CSP rules.`,
                );
            }
            if (env.manifestVersion === 3) {
                info.push(
                    'On chromium browsers the method "unsafeEval" is not available.',
                );
            }
            if (info.length > 0) {
                const attribs = {
                    ...(env.codeExecutionMethods.length === 0
                        ? { class: 'warn inline' }
                        : null),
                };
                return html`
                    <span>
                        ${label}
                        <span>${infoIcon(info.join('\n'), attribs)}</span>
                    </span>
                `;
            }
        }
        return label;
    }
    codeExecutionMethodsView() {
        const props: SelectOption = {
            name: 'codeExecutionMethod',
            label: 'preferred method to execute Javascript',
            options: selfMap(env.codeExecutionMethods),
        };
        const methods = env.codeExecutionMethods;
        if (methods.length > 0) {
            return this.optionSelectView(props);
        } else {
            return html`
                <p>
                    <span class="not-available"></span>
                    ${this.optionLabel(props.name, props.label)}
                </p>
            `;
        }
    }
    onLoadTargetView() {
        const target = this.target;
        const remembered = this.rememberedSettings;
        const modifiedIcon =
            remembered &&
            settings.isEqualSetting(this.state.onLoadTarget, remembered.onLoadTarget)
                ? ''
                : this.modifiedIcon();
        const label = html`
            ${modifiedIcon}
            ${this.isGlobal
                ? html`
                      load the list of databases
                  `
                : this.isDatabase
                  ? html`
                        load the list of tables from database
                        <em>${target.database}</em>
                    `
                  : html`
                        load table
                        <em>${target.table}</em>
                        from database
                        <em>${target.database}</em>
                    `}
            at start
        `;
        const onLoadTarget = this.state.onLoadTargets!.get(location.host) ?? globalTarget;
        const checked = equalTarget(onLoadTarget, target);
        const disabled = checked && this.isGlobal;
        return html`
            <p>
                ${checkbox({
                    name: 'onLoadTarget',
                    label,
                    checked,
                    disabled,
                    '@change': !disabled ? this.onLoadTargetChanged.bind(this) : null,
                })}
            </p>
        `;
    }
    onLoadTargetChanged(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !this.state.onLoadTargets) return;

        if (target.checked) {
            if (equalTarget(this.target, globalTarget)) {
                this.state.onLoadTargets.delete(location.host);
            } else {
                this.state.onLoadTargets.set(location.host, this.target);
            }
            this.state.onLoadTarget = this.target;
        } else {
            const onLoadTarget =
                this.state.onLoadTargets.get(location.host) ?? emptyTarget;
            if (equalTarget(this.target, onLoadTarget)) {
                this.state.onLoadTargets.delete(location.host);
                this.state.onLoadTarget = emptyTarget;
            }
        }
        settings.saveGlobals({ onLoadTargets: this.state.onLoadTargets });
        this.render();
    }
    override isDefault() {
        for (const [key, value] of Object.entries(this.state.defaults)) {
            if (key === 'onLoadTarget' || key === 'onLoadTargets') continue;
            if (!settings.isEqualSetting(value, this.state[key as OptionName])) {
                return false;
            }
        }
        return true;
    }
    override setDefaults() {
        const { onLoadTarget, onLoadTargets, ...defaults } = this.state.defaults;
        this.state = { ...this.state, ...defaults };
        this.saveSettings();
    }
    static async getSettings(target: AppTarget) {
        const defaults = await BehaviorConfig.getBehaviorDefaults(target);
        let values = await settings.get({
            ...target,
            subject: 'behavior',
        });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getBehaviorDefaults(target: AppTarget) {
        return await Config.getDefaults(target, 'behavior', behaviorDefaultOptions());
    }
}
