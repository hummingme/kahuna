/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Config from '#components/config/config';
import type {
    ControlInstance,
    BehaviorOptions,
    OptionName,
} from '#components/config/types';
import { equalTarget, globalTarget, emptyTarget } from '#lib/app-target';
import {
    type Charset,
    CHARSETS,
    type EncodableCharset,
    encodableCharsets,
} from '#lib/charsets';
import checkbox from '#lib/checkbox';
import env from '#lib/environment';
import infoIcon from '#lib/info-icon';
import settings from '#lib/settings';
import { selfMap } from '#lib/utils';
import { AppTarget, ExecutionMethod, SettingSubject } from '#types';

type BehaviorConfigState = {
    defaults: BehaviorOptions;
    subject: SettingSubject;
} & BehaviorOptions;

export default class BehaviorConfig extends Config {
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: BehaviorOptions;
        defaults: BehaviorOptions;
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
        const vals: BehaviorOptions = Object.assign(values, {
            onLoadTargets,
            onLoadTarget,
        });
        if (!control.rememberedSettings) {
            control.remember(vals);
        }
        return new BehaviorConfig({
            control,
            values: vals,
            defaults: Object.assign(defaults, behaviorGlobalDefaultOptions()),
        });
    }
    checkboxOptions = [
        { name: 'confirmDeleteRow', label: 'ask for confirmation on "delete row"' },
        {
            name: 'displayCodearea',
            label: 'display a textarea for Javascript code to be executed',
        },
        {
            name: 'codeareaPlaceholder',
            label: 'show the available variables in the javascript textarea',
        },
        { name: 'queryPreferWorker', label: 'prefer webworker for data querying' },
    ];
    inputOptions = [
        {
            name: 'datatableRows',
            label: 'rows per page',
            type: 'number',
            size: 4,
            maxlength: 5,
            '?required': true,
            min: 1,
            max: 10000,
        },
        {
            name: 'hideMessagesSeconds',
            label: 'seconds after which messages are hidden (0 = never)',
            type: 'number',
            size: 2,
            maxlength: 2,
            '?required': true,
            min: 0,
            max: 999,
        },
    ];
    selectOptions = [
        {
            name: 'codeExecutionMethod',
            label: 'preferred method to execute Javascript',
            options: selfMap(this.codeExecutionMethods()),
        },
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
    codeExecutionMethods() {
        const methods: ExecutionMethod[] = ['webworker'];
        if (env.manifestVersion === 2) {
            methods.push('unsafeEval');
        }
        if (env.executionMethodConditions['userscript']()) {
            methods.push('userscript');
        }
        return methods;
    }
    view() {
        return html`
            ${this.checkboxOptionsView()} ${this.selectOptionsView()}
            ${this.inputOptionsView()} ${this.onLoadTargetView()}
        `;
    }
    decorateLabel(name: OptionName, label: string) {
        if (name === 'displayCodearea' && env.codeExecution === false) {
            const info = `This setting has no effect on ${window.location.origin}
because all possibilities to execute javascript code are blocked`;
            return html`
                <span class="option-disabled">
                    ${label}
                    <span>
                        ${infoIcon(info, { style: 'color: var(--nice-color-attention)' })}
                    </span>
                </span>
            `;
        } else if (name === 'codeExecutionMethod') {
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
                return html`
                    <span>
                        ${label}
                        <span>${infoIcon(info.join('\n'))}</span>
                    </span>
                `;
            }
        }
        return label;
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
            at program start
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

const behaviorGlobalDefaultOptions = (): { onLoadTargets: Map<string, AppTarget> } => {
    return { onLoadTargets: new Map() };
};

export const behaviorDefaultOptions = () => {
    const defaultOptions: {
        datatableRows: number;
        hideMessagesSeconds: number;
        confirmDeleteRow: boolean;
        displayCodearea: boolean;
        codeareaPlaceholder: boolean;
        queryPreferWorker: boolean;
        codeExecutionMethod: ExecutionMethod;
        uploadCharset: Charset;
        downloadCharset: EncodableCharset;
    } = {
        datatableRows: 20,
        hideMessagesSeconds: 12,
        confirmDeleteRow: true,
        displayCodearea: true,
        codeareaPlaceholder: true,
        queryPreferWorker: true,
        codeExecutionMethod: 'webworker',
        uploadCharset: 'utf-8',
        downloadCharset: 'utf-8',
    };
    return { ...defaultOptions, ...behaviorGlobalDefaultOptions() };
};
