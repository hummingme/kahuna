/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.js';
import FilterFieldsConfig from './filter-fields-config.js';
import settings from '../../lib/settings.js';

const FiltersConfig = class extends Config {
    #filterFieldsConfig;
    constructor({ control, values, defaults, filterFieldsConfig }) {
        super(control);
        this.#filterFieldsConfig = filterFieldsConfig;
        this.state = {
            ...values,
            defaults,
            subject: 'filter-settings',
        };
    }
    static async activate(control) {
        const { values, defaults } = await FiltersConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        const filterFieldsConfig = new FilterFieldsConfig(
            control.actor,
            control.remembered,
        );
        await filterFieldsConfig.activate(control);
        return new FiltersConfig({ control, values, defaults, filterFieldsConfig });
    }
    checkboxOptions = [
        {
            name: 'markUnindexed',
            label: 'mark filter and filter settings that will cause an unindexed search',
        },
    ];
    view() {
        return html`
            ${this.#filterFieldsConfig.view(this.state.markUnindexed)}
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
    static async getSettings(target) {
        const defaults = await FiltersConfig.getDefaults(target);
        let values = await settings.get({ ...target, subject: 'filter-settings' });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getDefaults(target) {
        return await Config.getDefaults(target, 'filter-settings', {
            markUnindexed: true,
        });
    }
};

export default FiltersConfig;
