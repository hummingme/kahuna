/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import messageStack from './messagestack.js';
import tooltip from './tooltip.js';
import displayConfigControl from './config/config-control.js';
import appStore from '../lib/app-store.js';
import { isPrimKeyUnnamed } from '../lib/dexie-utils.js';
import { labeledSelectbox } from '../lib/selectbox.js';
import settings from '../lib/settings.js';
import svgIcon from '../lib/svgicon.js';
import { selfMap } from '../lib/utils.js';

/*
 * mixin for Importer and Exporter with jointly used methods
 */
const ImporterExporter = {
    formatSelect({ id, onchange, selected }) {
        return this.formats.length > 1
            ? labeledSelectbox({
                  label: 'format',
                  options: selfMap(this.formats),
                  id,
                  '@change': onchange,
                  selected,
              })
            : html`
                  <label>format:</label>
                  ${this.formats[0]}
              `;
    },
    infoTooltipIcon() {
        return html`
            <span class="right" @mouseover=${this.mouseOverInfo.bind(this)}>
                ${svgIcon('tabler-info-circle')}
            </span>
        `;
    },
    mouseOverInfo(event) {
        tooltip.show({
            view: this.settingsTooltipView.bind(this),
            anchor: event.target.closest('span'),
        });
    },
    changeSettingsIcon(realm, target) {
        const changeSettings = () => {
            tooltip.hide();
            displayConfigControl({
                target,
                realm,
                anchorId: 'settings-config',
            });
        };
        return html`
            <span
                class="right"
                title="change ${realm} settings"
                @click=${changeSettings.bind(this)}
            >
                ${svgIcon('tabler-adjustments')}
            </span>
        `;
    },
    settingInfo(label, value, annotation = '') {
        if (typeof value === 'boolean') {
            value = value === true ? 'yes' : 'no';
        } else if (typeof value === 'string' && value.length === 0) {
            value = '<empty>';
        }
        return html`
            <p>
                ${label}:
                <em>${value}</em>
                ${annotation}
            </p>
        `;
    },
    pkNameInfo(usage, source, primaryKeyName, annotateFunc) {
        return this.hasPkNameInput(usage, source)
            ? this.settingInfo('primary key name', primaryKeyName, annotateFunc(usage))
            : '';
    },
    hasPkNameInput(usage, source) {
        return (
            ['json', 'csv'].includes(this.format) &&
            (usage === 'database'
                ? source.some((t) => isPrimKeyUnnamed(t.primKey))
                : isPrimKeyUnnamed(source.primKey))
        );
    },
    updateSettings(subject, state) {
        const { defaults, target } = this[state];
        settings.saveSettings(this[state], defaults, target, subject);
    },
    handleError(error) {
        if (appStore.loading) {
            appStore.rerender({ loading: false });
        }
        const job = this.constructor.name === 'Importer' ? 'Import' : 'Export';
        messageStack.displayError(`${job} error: ${error.message}`);
    },
};

export default ImporterExporter;
