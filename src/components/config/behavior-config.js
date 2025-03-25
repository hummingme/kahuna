/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.js';
import checkbox from '../../lib/checkbox.js';
import env from '../../lib/environment.js';
import infoIcon from '../../lib/info-icon.js';
import settings from '../../lib/settings.js';
import { globalTarget } from '../../lib/utils.js';

const BehaviorConfig = class extends Config {
    constructor({ control, values, defaults }) {
        super(control);
        this.state = {
            ...values,
            defaults,
            subject: 'behavior',
        };
    }
    static async activate(control) {
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
    view() {
        return html`
            ${this.checkboxOptionsView()} ${this.inputOptionsView()}
            ${this.onLoadTargetView()}
        `;
    }
    decorateLabel(name, label) {
        if (name === 'displayCodearea' && env.codeExecution === false) {
            const info = `This setting as no effect on ${window.location.origin}
because all possibilities to execute javascript code are blocked`;
            return html`
                <span class="option-disabled">
                    ${label}
                    <span>${infoIcon(info)}</span>
                </span>
            `;
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
                    changeFunc: !disabled ? this.onLoadTargetChanged.bind(this) : null,
                })}
            </p>
        `;
    }
    onLoadTargetChanged(event) {
        const onLoadTarget = event.target.checked
            ? this.target
            : { database: '*', table: '*' };
        this.state.onLoadTarget = onLoadTarget;
        settings.saveGlobals({ onLoadTarget });
        this.render();
    }
    get globalsDefaults() {
        return BehaviorConfig.globalsDefaults();
    }
    static globalsDefaults() {
        return { onLoadTarget: globalTarget };
    }
    static async getSettings(target) {
        const defaults = await BehaviorConfig.getDefaults(target);
        let values = await settings.get({ ...target, subject: 'behavior' });
        values = settings.cleanupSettings(values, defaults);
        values.onLoadTarget = settings.global('onLoadTarget');
        return { values, defaults };
    }
    static async getDefaults(target) {
        return await Config.getDefaults(target, 'behavior', {
            datatableRows: 20,
            hideMessagesSeconds: 12,
            confirmDeleteRow: true,
            displayCodearea: true,
            codeareaPlaceholder: true,
            ...BehaviorConfig.globalsDefaults(),
        });
    }
};

export default BehaviorConfig;
