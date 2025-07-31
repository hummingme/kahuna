/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.ts';
import type { ControlInstance, BehaviorOptions, OptionName } from './types.ts';
import { type AppTarget, globalTarget } from '../../lib/app-target.ts';
import checkbox from '../../lib/checkbox.ts';
import env from '../../lib/environment.ts';
import infoIcon from '../../lib/info-icon.ts';
import settings from '../../lib/settings.ts';
import { selfMap } from '../../lib/utils.ts';
import type { ExecutionMethod } from '../../lib/types/common.ts';
import type { SettingSubject } from '../../lib/types/settings.ts';

type BehaviorConfigState = {
    defaults: BehaviorOptions;
    subject: SettingSubject;
} & BehaviorOptions;

const BehaviorConfig = class extends Config {
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
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new BehaviorConfig({ control, values, defaults });
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
        const label = html`
            ${this.isGlobal
                ? 'load the list of databases'
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
        const checked = settings.isEqualSetting(this.state.onLoadTarget, target);
        const disabled = checked && this.isGlobal;
        return html`
            <p>
                ${checkbox({
                    name: 'onLoadTarget',
                    label: this.optionLabel('onLoadTarget', label),
                    checked,
                    disabled,
                    '@change': !disabled ? this.onLoadTargetChanged.bind(this) : null,
                })}
            </p>
        `;
    }
    onLoadTargetChanged(event: Event) {
        const target = event.target as HTMLInputElement;
        const onLoadTarget = target.checked ? this.target : { database: '*', table: '*' };
        this.state.onLoadTarget = onLoadTarget;
        settings.saveGlobals({ onLoadTarget });
        this.render();
    }
    static globalsDefaults() {
        return behaviorGlobalDefaultOptions();
    }
    static async getSettings(target: AppTarget) {
        const defaults = (await BehaviorConfig.getDefaults(target)) as BehaviorOptions;
        let values = (await settings.get({
            ...target,
            subject: 'behavior',
        })) as BehaviorOptions;
        values = settings.cleanupSettings(values, defaults) as BehaviorOptions;
        values.onLoadTarget = settings.global('onLoadTarget');
        return { values, defaults };
    }
    static async getDefaults(target: AppTarget) {
        return await Config.getDefaults(target, 'behavior', behaviorDefaultOptions());
    }
};

const behaviorGlobalDefaultOptions = () => {
    return { onLoadTarget: globalTarget };
};

export const behaviorDefaultOptions = () => {
    return {
        datatableRows: 20,
        hideMessagesSeconds: 12,
        confirmDeleteRow: true,
        displayCodearea: true,
        codeareaPlaceholder: true,
        codeExecutionMethod: 'webworker' as ExecutionMethod,
        ...behaviorGlobalDefaultOptions(),
    };
};

export default BehaviorConfig;
