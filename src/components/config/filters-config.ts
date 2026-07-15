/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Config from '#components/config/config';
import FilterFieldsConfig from '#components/config/filter-fields-config';
import type { ControlInstance, FiltersOptions, Option } from '#components/config/types';
import settings from '#lib/settings';
import { AppTarget, SettingSubject } from '#types';

type FiltersConfigState = {
    defaults: FiltersOptions;
    subject: SettingSubject;
} & FiltersOptions;

type FilterFieldsConfigInstance = InstanceType<typeof FilterFieldsConfig>;

export default class FiltersConfig extends Config {
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
            ${this.#filterFieldsConfig.view(!!this.state.markUnindexed)}
            ${this.checkboxOptionsView()}
        `;
    }
    override isDefault() {
        const filterFieldsDefault = this.isTable
            ? this.#filterFieldsConfig.isDefault()
            : true;
        return super.isDefault() && filterFieldsDefault;
    }
    override setDefaults() {
        if (this.isTable) {
            this.#filterFieldsConfig.setDefaults();
        }
        super.setDefaults();
    }
    override isChanged() {
        const filterFieldsChanged = this.isTable
            ? this.#filterFieldsConfig.isChanged()
            : false;
        return super.isChanged() || filterFieldsChanged;
    }
    override undoChanges() {
        if (this.isTable) {
            this.#filterFieldsConfig.undoChanges();
        }
        super.undoChanges();
    }
    static async getSettings(target: AppTarget) {
        const defaults = await FiltersConfig.getFiltersDefaults(target);
        let values = await settings.get({
            ...target,
            subject: 'filter-settings',
        });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getFiltersDefaults(target: AppTarget) {
        return await Config.getDefaults(
            target,
            'filter-settings',
            filtersDefaultOptions(),
        );
    }
}

export const filtersDefaultOptions = () => {
    return {
        markUnindexed: true,
    };
};
