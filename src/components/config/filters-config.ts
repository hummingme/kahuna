/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.ts';
import FilterFieldsConfig from './filter-fields-config.ts';
import type { ControlInstance, FiltersOptions, Option } from './types.ts';
import settings from '../../lib/settings.ts';
import { type AppTarget } from '../../lib/app-target.ts';
import { SettingSubject } from '../../lib/types/settings.ts';

type FiltersConfigState = {
    defaults: FiltersOptions;
    subject: SettingSubject;
} & FiltersOptions;

type FilterFieldsConfigInstance = InstanceType<typeof FilterFieldsConfig>;

const FiltersConfig = class extends Config {
    #filterFieldsConfig;
    constructor({
        control,
        values,
        defaults,
        filterFieldsConfig,
    }: {
        control: ControlInstance;
        values: FiltersOptions;
        defaults: FiltersOptions;
        filterFieldsConfig: FilterFieldsConfigInstance;
    }) {
        const state: FiltersConfigState = {
            ...values,
            defaults,
            subject: 'filter-settings',
        };
        super(control, state);
        this.#filterFieldsConfig = filterFieldsConfig;
    }
    static async activate(control: ControlInstance) {
        const { values, defaults } = await FiltersConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        const filterFieldsConfig = new FilterFieldsConfig();
        const filtersConfig = new FiltersConfig({
            control,
            values,
            defaults,
            filterFieldsConfig,
        });
        await filterFieldsConfig.activate(filtersConfig, control);
        return filtersConfig;
    }
    checkboxOptions: Option[] = [
        {
            name: 'markUnindexed',
            label: 'mark filter and filter settings that will cause an unindexed search',
        },
    ];
    view() {
        return html`
            ${this.#filterFieldsConfig.view(this.state.markUnindexed as boolean)}
            ${this.checkboxOptionsView()}
        `;
    }
    isDefault() {
        const filterFieldsDefault = this.isTable
            ? this.#filterFieldsConfig.isDefault()
            : true;
        return super.isDefault() && filterFieldsDefault;
    }
    setDefaults() {
        if (this.isTable) {
            this.#filterFieldsConfig.setDefaults();
        }
        super.setDefaults();
    }
    isChanged() {
        const filterFieldsChanged = this.isTable
            ? this.#filterFieldsConfig.isChanged()
            : false;
        return super.isChanged() || filterFieldsChanged;
    }
    undoChanges() {
        if (this.isTable) {
            this.#filterFieldsConfig.undoChanges();
        }
        super.undoChanges();
    }
    static async getSettings(target: AppTarget) {
        const defaults = (await FiltersConfig.getDefaults(target)) as FiltersOptions;
        let values = (await settings.get({
            ...target,
            subject: 'filter-settings',
        })) as FiltersOptions;
        values = settings.cleanupSettings(values, defaults) as FiltersOptions;
        return { values, defaults };
    }
    static async getDefaults(target: AppTarget) {
        return (await Config.getDefaults(
            target,
            'filter-settings',
            filtersDefaultOptions(),
        )) as FiltersOptions;
    }
};

export const filtersDefaultOptions = () => {
    return {
        markUnindexed: true,
    };
};

export default FiltersConfig;
