/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { nothing } from 'lit';
import { html } from 'lit-html';
import { map } from 'lit/directives/map.js';
import datatable from '../datatable.js';
import { symbolButton } from '../../lib/button.js';
import checkbox from '../../lib/checkbox.js';
import { getConnection } from '../../lib/connection.js';
import {
    caseSensitiveMethods,
    compoundHeadIndexedMethods,
    defaultFilterOptions,
    emptyFilter,
    indexedMethods,
    initialFilter,
    searchMethods,
} from '../../lib/filter.js';
import { selectbox } from '../../lib/selectbox.js';
import settings from '../../lib/settings.js';
import { capitalize, isTable, pickProperties } from '../../lib/utils.js';

const state = Symbol('filter-fields-config state');

const FilterFieldsConfig = class {
    #dragIndex;
    #filtersConfig;
    #remembered;
    #initialFilter;
    constructor(filtersConfig, remembered) {
        this.#filtersConfig = filtersConfig;
        this.#remembered = remembered;
    }
    async activate(control) {
        this[state] = {};
        if (control.isTable) {
            const { filters, columns, dexieTable } = isTable(control.appTarget)
                ? datatable.state
                : await this.initFromSettings(control.target);
            const { filtersBefore, rememberedOptions } = this.initRemembered({
                filters,
                columns,
                remembered: control.remembered,
            });
            this[state] = {
                filters: structuredClone(filters),
                columns: [...columns],
                filtersBefore,
                rememberedOptions,
                markUnindexed: false,
                dexieTable,
            };
            this.#initialFilter = initialFilter(columns, dexieTable);
        }
    }
    async initFromSettings(target) {
        const columns = (await settings.get({ ...target, subject: 'columns' })) || [];
        const columnNames = columns.map((c) => c.name);
        let filters = (await settings.get({ ...target, subject: 'filters' })) || [];
        filters = filters.filter((f) => columnNames.includes(f.field));
        const dexieTable = (await getConnection(target.database)).table(target.table);
        return { filters, columns, dexieTable };
    }
    initRemembered({ filters, columns, remembered }) {
        const filtersBefore =
            remembered.get(this.rememberedFiltersKey) || structuredClone(filters);
        remembered.set(this.rememberedFiltersKey, filtersBefore);

        const rememberedOptions =
            remembered.get(this.rememberedOptionsKey) ||
            this.initRememberedOptions(filters.length, columns.length);
        this.rememberOptions(rememberedOptions);

        return { filtersBefore, rememberedOptions };
    }
    get rememberedFiltersKey() {
        return JSON.stringify({ ...this.target, subject: 'filtersBefore' });
    }
    get rememberedOptionsKey() {
        return JSON.stringify({
            ...this.target,
            subject: 'rememberedOptions',
        });
    }
    rememberOptions(rememberedOptions) {
        this.#remembered.set(
            this.rememberedOptionsKey,
            rememberedOptions || this[state].rememberedOptions,
        );
    }
    view(markUnindexed) {
        this[state].markUnindexed = markUnindexed;
        return this.#filtersConfig.isTable
            ? html`
                  <fieldset id="filter-fields">
                      <legend>${this.legend()}</legend>
                      ${map(this[state].filters, (filter, idx) =>
                          this.filterView(filter, idx),
                      )}
                      ${symbolButton({
                          icon: 'tabler-square-rounded-plus',
                          title: 'add filter',
                          classes: ['right'],
                          '@click': this.addFilter.bind(this),
                      })}
                  </fieldset>
              `
            : '';
    }
    legend() {
        const modifiedIcon = this.isChanged() ? this.#filtersConfig.modifiedIcon() : '';
        const defaultIcon = this.isDefault() ? this.#filtersConfig.defaultIcon() : '';
        return html`
            ${modifiedIcon} ${defaultIcon} filter fields
        `;
    }
    filterView(filter, idx) {
        const checkboxes = this.optionCheckboxes(filter, idx);
        const [invalidClass, invalidTitle] = !this.checkboxesValid(filter)
            ? ['invalid', 'at least one of the options must be checked']
            : [];
        const ddtitle = 'drang & drop to change order';
        return html`
            <div
                data-filterindex=${idx}
                @dragstart=${this.dragStart.bind(this)}
                @dragenter=${this.dragEnter.bind(this)}
                @dragend=${this.dragEnd.bind(this)}
            >
                <label title=${ddtitle} draggable="true">${idx + 1}.</label>
                <span>${this.fieldSelect(filter, idx)}</span>
                <span>${this.methodSelect(filter, idx)}</span>
                <span>
                    <ul
                        style="display: block-inline"
                        class=${invalidClass || nothing}
                        title=${invalidTitle || nothing}
                    >
                        ${checkboxes.map(
                            (checkbox) => html`
                                <li>${checkbox}</li>
                            `,
                        )}
                    </ul>
                </span>
                ${symbolButton({
                    icon: 'tabler-trash',
                    title: 'remove filter',
                    classes: ['right'],
                    '@click': this.removeFilter.bind(this, idx),
                })}
                <hr />
            </div>
        `;
    }
    fieldSelect(filter, idx) {
        const options = Object.fromEntries(
            this[state].columns.map((column, index) => [index, column.name]),
        );
        const selected =
            this[state].columns.findIndex((c) => c.name === filter.field) + '';
        return selectbox({
            name: 'field-' + idx,
            '@change': this.fieldChanged.bind(this, idx),
            options,
            selected,
            class:
                this[state].markUnindexed && !filter.indexed && !filter.compoundHead
                    ? 'warn'
                    : null,
        });
    }
    methodSelect(filter, idx) {
        const isIndexedMethod =
            indexedMethods.includes(filter.method) &&
            (!filter.compoundHead || compoundHeadIndexedMethods.includes(filter.method));
        return selectbox({
            name: 'method-' + idx,
            '@change': this.methodChanged.bind(this, idx),
            options: this.methodOptions(filter),
            selected: filter.method,
            class: this[state].markUnindexed && !isIndexedMethod ? 'warn' : null,
        });
    }
    methodOptions(filter) {
        const { field, includeBounds, caseSensitive } = filter;
        const primKey = this[state].dexieTable.schema.primKey;
        const options = Object.fromEntries(
            Object.entries(searchMethods()).map((m) => {
                const bounds = includeBounds ? 'includeBounds' : 'excludeBounds';
                let val = m[1].short ? m[1].short : m[1][bounds].short;
                if (m[0] === 'regexp' && !caseSensitive) val += 'i';
                return { 0: m[0], 1: val };
            }),
        );
        if (
            field === '*key*' ||
            (primKey.name === field && typeof primKey.keyPath === 'string')
        ) {
            delete options['empty'];
        }
        if (field === '*key*' || (primKey.name === field && primKey.auto === true)) {
            for (const name of ['startswith', 'endswith', 'contains', 'regexp']) {
                delete options[name];
            }
        }
        return options;
    }
    optionCheckboxes(filter, idx) {
        const checkboxes = [];
        for (const checkbox of this.relatedOptionCheckboxes(filter)) {
            checkboxes.push(this.optionCheckbox(...checkbox, idx));
        }
        if (filter.method === 'empty') {
            checkboxes.push(this.emptyOptionCheckbox('undefined', 'undefined', idx));
            checkboxes.push(this.emptyOptionCheckbox('null', 'null', idx));
            checkboxes.push(this.emptyOptionCheckbox('string', 'empty string', idx));
            checkboxes.push(this.emptyOptionCheckbox('array', 'empty array', idx));
            checkboxes.push(this.emptyOptionCheckbox('object', 'empty object', idx));
        }
        return checkboxes;
    }
    relatedOptionCheckboxes(filter) {
        if (caseSensitiveMethods.includes(filter.method) && filter.field !== '*key*') {
            const className =
                this[state].markUnindexed && !filter.caseSensitive ? 'warn' : null;
            return [['caseSensitive', 'case sensitive', className]];
        }
        if (['below', 'above'].includes(filter.method)) {
            return [['includeBounds', 'include bounds', null]];
        }
        return [];
    }
    optionCheckbox(name, label, className, idx) {
        return checkbox({
            name,
            label,
            checked: this[state].filters[idx][name],
            class: className,
            changeFunc: this.checkboxChanged.bind(this, idx, name),
        });
    }
    emptyOptionCheckbox(check, label, idx) {
        const name = `empty${capitalize(check)}`;
        return checkbox({
            name,
            label,
            checked: this[state].filters[idx].empty.includes(check),
            changeFunc: this.checkboxChanged.bind(this, idx, name),
        });
    }
    addFilter(event) {
        event.preventDefault();
        this[state].filters.push(structuredClone(this.#initialFilter));
        this[state].rememberedOptions.push(
            this.addRememberedOption(this[state].columns.length),
        );
        this.rememberOptions();
        this.update(this[state].filters);
    }
    removeFilter(idx, event) {
        event.preventDefault();
        this[state].filters.splice(idx, 1);
        this[state].rememberedOptions.splice(idx, 1);
        this.rememberOptions();
        this.update(this[state].filters);
    }
    fieldChanged(idx, event) {
        const columns = this[state].columns;
        const columnIndex = parseInt(event.target.value);
        const remembered = this[state].rememberedOptions[idx][columnIndex];
        this[state].filters[idx] = Object.assign(
            emptyFilter(),
            {
                field: columns[columnIndex].name,
                indexed: columns[columnIndex].indexed,
                compoundHead: columns[columnIndex].compoundHead,
            },
            remembered,
        );
        this.update(this[state].filters);
    }
    methodChanged(idx, event) {
        this[state].filters[idx].method = event.target.value;
        this.updateRememberedOptions(idx);
        this.update(this[state].filters);
    }
    checkboxChanged(idx, name, event) {
        const filter = this[state].filters[idx];
        if (['caseSensitive', 'includeBounds'].includes(name)) {
            filter[name] = event.target.checked;
        } else if (name.startsWith('empty')) {
            const emptyOption = name.substring(5).toLowerCase();
            if (
                ['undefined', 'null', 'array', 'object', 'string'].includes(emptyOption)
            ) {
                event.target.checked
                    ? filter.empty.push(emptyOption)
                    : (filter.empty = filter.empty.filter((opt) => opt !== emptyOption));
            }
        }
        this.updateRememberedOptions(idx);
        this.update(this[state].filters);
    }
    updateRememberedOptions(idx) {
        const filter = this[state].filters[idx];
        const columnIndex = this[state].columns.findIndex(
            (column) => column.name === filter.field,
        );
        if (columnIndex !== -1) {
            this[state].rememberedOptions[idx][columnIndex] = pickProperties(
                filter,
                Object.keys(defaultFilterOptions()),
            );
        }
        this.rememberOptions();
    }
    dragStart(event) {
        this.#dragIndex = event.target.closest('div').dataset.filterindex;
    }
    dragEnter(event) {
        event.preventDefault();
        const targetIndex = event.target.closest('div').dataset.filterindex;
        if (targetIndex !== this.#dragIndex) {
            const filters = this[state].filters;
            filters.splice(targetIndex, 0, filters.splice(this.#dragIndex, 1)[0]);
            this.#dragIndex = targetIndex;
            this.#filtersConfig.render();
        }
    }
    dragEnd() {
        this.update(this[state].filters);
    }
    initRememberedOptions(filtersCount, columnsCount) {
        const remembered = [];
        for (let n = 0; n < filtersCount; n++) {
            remembered.push(this.addRememberedOption(columnsCount));
        }
        return remembered;
    }
    addRememberedOption(columnsCount) {
        return Array(columnsCount)
            .fill(1)
            .map((_) => ({ ...defaultFilterOptions() }));
    }
    checkboxesValid(filter) {
        return filter.method !== 'empty' || filter.empty.length > 0;
    }
    isDefault() {
        return (
            this.isTable === false ||
            (this[state].filters.length === 1 &&
                JSON.stringify(this[state].filters[0]) ===
                    JSON.stringify(this.#initialFilter))
        );
    }
    setDefaults() {
        this[state].filters = [structuredClone(this.#initialFilter)];
        this.saveFilters(this[state].filters);
    }
    isChanged() {
        if (this.isTable === false) {
            return false;
        }
        const { filters, filtersBefore } = this[state];
        if (filters.length !== filtersBefore.length) {
            return true;
        }
        for (const [index, filter] of filters.entries()) {
            const before = filtersBefore[index];
            if (
                filter.field !== before.field ||
                filter.method !== before.method ||
                ['caseSensitive', 'includeBounds'].some(
                    (opt) => filter[opt] !== before[opt],
                ) ||
                filter.empty.length !== before.empty.length ||
                filter.empty.every((check) => before.empty.includes(check)) === false
            ) {
                return true;
            }
        }
        return false;
    }
    undoChanges() {
        this[state].filters = structuredClone(this[state].filtersBefore);
        this.saveFilters(this[state].filters);
    }
    valid(filters) {
        return filters.every((filter) => this.checkboxesValid(filter));
    }
    update(filters) {
        this.saveFilters(filters);
        this.#filtersConfig.render();
    }
    saveFilters(filters) {
        if (this.valid(filters)) {
            FilterFieldsConfig.saveFilters(filters, this.#filtersConfig.target);
            datatable.update({ filters });
        }
    }
    static saveFilters(filters, target) {
        settings.save({ ...target, subject: 'filters', values: filters });
    }
    static async restoreFilters(target, columns, dexieTable) {
        const filters = [];
        let values = await settings.get({ ...target, subject: 'filters' });
        if (Array.isArray(values)) {
            values = values.filter((filter) =>
                Object.keys(searchMethods()).includes(filter.method),
            );
            values.forEach((filter) => {
                const column = columns.find((column) => column.name === filter.field);
                if (column) {
                    filter.indexed = column.indexed;
                    filter.compoundHead = column.compoundHead;
                    filters.push({ ...filter });
                }
            });
        }
        return filters.length > 0 ? filters : [initialFilter(columns, dexieTable)];
    }
};

export default FilterFieldsConfig;
