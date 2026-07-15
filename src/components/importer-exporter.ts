/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';

import messageStack from '#components/messagestack';
import tooltip from '#components/tooltip';
import displayConfigControl from '#components/config/config-control';
import appStore from '#lib/app-store';
import { isPrimKeyUnnamed } from '#lib/dexie-utils';
import messenger from '#lib/messenger';
import { labeledSelectbox } from '#lib/selectbox';
import settings from '#lib/settings';
import svgIcon from '#lib/svgicon';
import { capitalize, selfMap, sleep } from '#lib/utils';
import type { AppTarget, ExportFormat, KTable, PlainObject } from '#types';

/*
 * helper for Importer and Exporter with jointly used methods
 */
const ImporterExporter = class {
    usage;
    constructor(usage: 'import' | 'export') {
        this.usage = usage;
    }
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
    infoTooltipIcon(boundSettingsTooltipView: () => TemplateResult): TemplateResult {
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
    changeSettingsIcon(realm: 'import' | 'export', target: AppTarget): TemplateResult {
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
    private exportImportPromise: Promise<void> | undefined;
    async ensureInjectedExportImport() {
        if (this.checkInjectedLoaded) {
            return;
        }
        return (this.exportImportPromise ??= this.doEnsureInjectedExportImport());
    }
    private async doEnsureInjectedExportImport() {
        try {
            messenger.post({ type: 'injectExportImport' });
            for (let cnt = 1; cnt < 50; cnt++) {
                if (this.checkInjectedLoaded) {
                    return;
                }
                await sleep(50);
            }
            throw Error('Loading the import/export module for Firefox failed!');
        } finally {
            this.exportImportPromise = undefined;
        }
    }
    get checkInjectedLoaded() {
        return document.documentElement.hasAttribute(
            'data-kahuna-export-import-available',
        );
    }
    handleError(error: Error) {
        if (appStore.loading) {
            appStore.rerender({ loading: false });
        }
        messageStack.displayError(`${capitalize(this.usage)} error: ${error.message}`);
    }
};

export default ImporterExporter;
