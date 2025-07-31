/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import messageStack from './messagestack.ts';
import tooltip from './tooltip.ts';
import displayConfigControl from './config/config-control.ts';
import type { ConfigRealm } from './config/types.ts';
import appStore from '../lib/app-store.ts';
import { type AppTarget } from '../lib/app-target.ts';
import { isPrimKeyUnnamed } from '../lib/dexie-utils.ts';
import { labeledSelectbox } from '../lib/selectbox.ts';
import settings from '../lib/settings.ts';
import svgIcon from '../lib/svgicon.ts';
import { selfMap } from '../lib/utils.ts';
import type { ExportFormat, KTable, PlainObject } from '../lib/types/common.ts';

/*
 * helper for Importer and Exporter with jointly used methods
 */
const ImporterExporter = class {
    constructor() {}
    formatSelect({
        id,
        formats,
        selected,
        onchange,
    }: {
        id: string;
        formats: ExportFormat[];
        selected: string;
        onchange: (arg0: Event) => void;
    }): TemplateResult {
        return formats.length > 1
            ? labeledSelectbox({
                  label: 'format',
                  options: selfMap(formats),
                  id,
                  '@change': onchange,
                  selected,
              })
            : html`
                  <label>format:</label>
                  ${formats[0]}
              `;
    }
    infoTooltipIcon(boundSettingsTooltipView: any): TemplateResult {
        return html`
            <span
                class="right"
                @mouseover=${this.mouseOverInfo.bind(null, boundSettingsTooltipView)}
            >
                ${svgIcon('tabler-info-circle')}
            </span>
        `;
    }
    mouseOverInfo(boundSettingsTooltipView: () => TemplateResult, event: MouseEvent) {
        const target = event.target as HTMLElement;
        tooltip.show({
            view: boundSettingsTooltipView,
            anchor: target.closest('span'),
        });
    }
    changeSettingsIcon(realm: ConfigRealm, target: AppTarget): TemplateResult {
        const changeSettings = () => {
            tooltip.close();
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
    }
    settingInfo(
        label: string,
        value: string | boolean,
        annotation?: TemplateResult,
    ): TemplateResult {
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
    }
    pkNameInfo(
        usage: string,
        primaryKeyName: string,
        annotateFunc: (arg0: string) => TemplateResult,
    ) {
        return this.settingInfo('primary key name', primaryKeyName, annotateFunc(usage));
    }
    hasPkNameInput(format: string, source: KTable | KTable[]): boolean {
        if (['json', 'csv'].includes(format)) {
            if (Array.isArray(source)) {
                return source.some((table: KTable) => isPrimKeyUnnamed(table.primKey));
            } else {
                return isPrimKeyUnnamed(source.primKey);
            }
        }
        return false;
    }
    updateSettings(subject: 'import' | 'export', state: PlainObject) {
        const { defaults, target } = state;
        settings.saveSettings(state, defaults, target, subject);
    }
    handleError(error: Error) {
        if (appStore.loading) {
            appStore.rerender({ loading: false });
        }
        const job = this.constructor.name === 'Importer' ? 'Import' : 'Export';
        messageStack.displayError(`${job} error: ${error.message}`);
    }
};

export default ImporterExporter;
