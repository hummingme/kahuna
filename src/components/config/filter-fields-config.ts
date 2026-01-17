/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Table } from 'dexie';
import { nothing } from 'lit';
import { html } from 'lit-html';
import { map } from 'lit/directives/map.js';

import datatable from '../datatable.ts';
import FiltersConfig from './filters-config.ts';
import type { ControlInstance } from './types.ts';
import { type AppTarget, isTable } from '../../lib/app-target.ts';
import { symbolButton } from '../../lib/button.ts';
import checkbox from '../../lib/checkbox.ts';
import { type Column } from '../../lib/column.ts';
import { getConnection } from '../../lib/connection.ts';
import { isEmptyObject } from '../../lib/datatypes.ts';
import {
    caseSensitiveMethods,
    compoundHeadIndexedMethods,
    defaultFilterOptions,
    emptyFilter,
    FilterDefaultOptions,
    indexedMethods,
    initialFilter,
    searchMethods,
    type CompoundHeadIndexedMethod,
    type Filter,
    type FilterEmptyMethod,
    type FilterMethod,
    type IndexedMethod,
} from '../../lib/filter.ts';
import { selectbox } from '../../lib/selectbox.ts';
import settings from '../../lib/settings.ts';
import { capitalize, pickProperties } from '../../lib/utils.ts';

interface FilterFieldsConfigState {
    filters: Filter[];
    columns: Column[];
    filtersBefore: Filter[];
    rememberedOptions: FilterDefaultOptions[][];
    markUnindexed: boolean;
    dexieTable: Table | null;
}

type ConfigInstance = InstanceType<typeof FiltersConfig>;

let filtersConfig: ConfigInstance;

const state = Symbol('filter-fields-config state');

const FilterFieldsConfig = class {
    [state]: FilterFieldsConfigState = this.emptyState;
    #dragIndex = -1;
    #remembered: Map<string, unknown> = new Map();
    #initialFilter = emptyFilter();
    constructor() {}
    async activate(filtersConfigInstance: ConfigInstance, control: ControlInstance) {
        filtersConfig = filtersConfigInstance;
        this.#remembered = control.remembered;
        if (control.isTable) {
            const { filters, columns, dexieTable } = isTable(control.appTarget)
                ? (datatable.state as {
                      filters: Filter[];
                      columns: Column[];
                      dexieTable: Table;
                  })
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
            if (columns.length > 0) {
                this.#initialFilter = initialFilter(columns, dexieTable);
            }
        }
    }
    get emptyState() {
        return {
            filters: [],
            columns: [],
            filtersBefore: [],
            rememberedOptions: [],
            markUnindexed: false,
            dexieTable: null,
        };
    }
    async initFromSettings(target: AppTarget) {
        const columnValues = (await settings.get({
            ...target,
            subject: 'columns',
        })) as Column[];
        const columns = !isEmptyObject(columnValues) ? columnValues : ([] as Column[]);
        const columnNames = columns.map((c) => c.name);
        const filterValues = (await settings.get({
            ...target,
            subject: 'filters',
        })) as Filter[];
        const filters = (!isEmptyObject(filterValues) ? filterValues : []).filter((f) =>
            columnNames.includes(f.field),
        );
        const dexieTable = (await getConnection(target.database)).table(target.table);
        return { filters, columns, dexieTable };
    }
    initRemembered({
        filters,
        columns,
        remembered,
    }: {
        filters: Filter[];
        columns: Column[];
        remembered: Map<string, unknown>;
    }) {
        const filtersBefore: Filter[] =
            (remembered.get(this.rememberedFiltersKey) as []) || structuredClone(filters);
        remembered.set(this.rememberedFiltersKey, filtersBefore);

        const rememberedOptions: FilterDefaultOptions[][] =
            (remembered.get(this.rememberedOptionsKey) as [][]) ||
            this.initRememberedOptions(filters.length, columns.length);
        this.rememberOptions(rememberedOptions);

        return { filtersBefore, rememberedOptions };
    }
    get rememberedFiltersKey() {
        return JSON.stringify({
            ...filtersConfig.target,
            subject: 'filtersBefore',
        });
    }
    get rememberedOptionsKey() {
        return JSON.stringify({
            ...filtersConfig.target,
            subject: 'rememberedOptions',
        });
    }
    rememberOptions(rememberedOptions?: FilterDefaultOptions[][]) {
        this.#remembered.set(
            this.rememberedOptionsKey,
            rememberedOptions || this[state].rememberedOptions,
        );
    }
    view(markUnindexed: boolean) {
        this[state].markUnindexed = markUnindexed;
        return filtersConfig.isTable && this[state].columns.length > 0
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
        const modifiedIcon = this.isChanged() ? filtersConfig.modifiedIcon() : '';
        const defaultIcon = this.isDefault() ? filtersConfig.defaultIcon() : '';
        return html`
            ${modifiedIcon} ${defaultIcon} filter fields
        `;
    }
    filterView(filter: Filter, idx: number) {
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
    fieldSelect(filter: Filter, idx: number) {
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
    methodSelect(filter: Filter, idx: number) {
        const isIndexedMethod =
            indexedMethods.includes(filter.method as IndexedMethod) &&
            (!filter.compoundHead ||
                compoundHeadIndexedMethods.includes(
                    filter.method as CompoundHeadIndexedMethod,
                ));
        return selectbox({
            name: 'method-' + idx,
            '@change': this.methodChanged.bind(this, idx),
            options: this.methodOptions(filter),
            selected: filter.method,
            class: this[state].markUnindexed && !isIndexedMethod ? 'warn' : null,
        });
    }
    methodOptions(filter: Filter) {
        const { field, includeBounds, caseSensitive } = filter;
        const primKey = (this[state].dexieTable as Table).schema.primKey;
        const options = Object.fromEntries(
            Object.entries(searchMethods()).map((m) => {
                let val: string =
                    'includeBounds' in m[1]
                        ? m[1][includeBounds ? 'includeBounds' : 'excludeBounds'].short
                        : m[1].short;
                if (m[0] === 'regexp' && caseSensitive === false) val += 'i';
                return [m[0], val];
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
    optionCheckboxes(filter: Filter, idx: number) {
        const checkboxes = [];
        for (const checkbox of this.relatedOptionCheckboxes(filter)) {
            checkboxes.push(
                this.optionCheckbox(
                    ...(checkbox as [keyof FilterDefaultOptions, string, string]),
                    idx,
                ),
            );
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
    relatedOptionCheckboxes(filter: Filter) {
        const { field, method, caseSensitive } = filter;
        if (field !== '*key*' && caseSensitiveMethods.includes(method)) {
            const className =
                this[state].markUnindexed &&
                !caseSensitive &&
                !['equal', 'startswith'].includes(method)
                    ? 'warn'
                    : null;
            return [['caseSensitive', 'case sensitive', className]];
        }
        if (['below', 'above'].includes(method)) {
            return [['includeBounds', 'include bounds', null]];
        }
        return [];
    }
    optionCheckbox(
        name: keyof FilterDefaultOptions,
        label: string,
        className: string | null,
        idx: number,
    ) {
        const checked = !!this[state].filters[idx][name];
        return checkbox({
            name,
            label,
            checked,
            class: className,
            '@change': this.checkboxChanged.bind(this, idx, name),
        });
    }
    emptyOptionCheckbox(check: FilterEmptyMethod, label: string, idx: number) {
        const name = `empty${capitalize(check)}`;
        return checkbox({
            name,
            label,
            checked: this[state].filters[idx].empty.includes(check),
            '@change': this.checkboxChanged.bind(this, idx, name),
        });
    }
    addFilter(event: Event) {
        event.preventDefault();
        this[state].filters.push(structuredClone(this.#initialFilter));
        this[state].rememberedOptions.push(
            this.addRememberedOption(this[state].columns.length),
        );
        this.rememberOptions();
        this.update(this[state].filters);
    }
    removeFilter(idx: number, event: Event) {
        event.preventDefault();
        this[state].filters.splice(idx, 1);
        this[state].rememberedOptions.splice(idx, 1);
        this.rememberOptions();
        this.update(this[state].filters);
    }
    fieldChanged(idx: number, event: Event) {
        const target = event.target as HTMLInputElement;
        const columns = this[state].columns;
        const columnIndex = parseInt(target.value);
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
    methodChanged(idx: number, event: Event) {
        const target = event.target as HTMLInputElement;
        this[state].filters[idx].method = target.value as FilterMethod;
        this.updateRememberedOptions(idx);
        this.update(this[state].filters);
    }
    checkboxChanged(idx: number, name: string, event: Event) {
        const target = event.target as HTMLInputElement;
        const filter = this[state].filters[idx];
        if (name === 'caseSensitive' || name === 'includeBounds') {
            filter[name] = target.checked;
        } else if (name.startsWith('empty')) {
            const emptyOption = name.substring(5).toLowerCase() as FilterEmptyMethod;
            if (
                ['undefined', 'null', 'array', 'object', 'string'].includes(emptyOption)
            ) {
                if (target.checked) {
                    filter.empty.push(emptyOption);
                } else {
                    filter.empty = filter.empty.filter((opt) => opt !== emptyOption);
                }
            }
        }
        this.updateRememberedOptions(idx);
        this.update(this[state].filters);
    }
    updateRememberedOptions(idx: number) {
        const filter = this[state].filters[idx];
        const columnIndex = this[state].columns.findIndex(
            (column) => column.name === filter.field,
        );
        if (columnIndex !== -1) {
            this[state].rememberedOptions[idx][columnIndex] = pickProperties(
                filter,
                Object.keys(defaultFilterOptions()),
            ) as FilterDefaultOptions;
        }
        this.rememberOptions();
    }
    dragStart(event: Event) {
        const target = event.target as HTMLElement;
        this.#dragIndex = parseInt(target.closest('div')?.dataset.filterindex || '-1');
    }
    dragEnter(event: Event) {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const targetIndex = parseInt(target.closest('div')?.dataset.filterindex || '-1');
        if (targetIndex !== this.#dragIndex) {
            const filters = this[state].filters;
            filters.splice(targetIndex, 0, filters.splice(this.#dragIndex, 1)[0]);
            this.#dragIndex = targetIndex;
            filtersConfig.render();
        }
    }
    dragEnd() {
        this.update(this[state].filters);
    }
    initRememberedOptions(filtersCount: number, columnsCount: number) {
        const remembered: FilterDefaultOptions[][] = [];
        for (let n = 0; n < filtersCount; n++) {
            remembered.push(this.addRememberedOption(columnsCount));
        }
        return remembered;
    }
    addRememberedOption(columnsCount: number): FilterDefaultOptions[] {
        return Array(columnsCount)
            .fill(1)
            .map((_) => ({ ...defaultFilterOptions() }));
    }
    checkboxesValid(filter: Filter) {
        return filter.method !== 'empty' || filter.empty.length > 0;
    }
    isDefault(): boolean {
        return (
            filtersConfig.isTable === false ||
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
        if (filtersConfig.isTable === false) {
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
                filter['caseSensitive'] !== before['caseSensitive'] ||
                filter['includeBounds'] !== before['includeBounds'] ||
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
    valid(filters: Filter[]) {
        return filters.every((filter) => this.checkboxesValid(filter));
    }
    update(filters: Filter[]) {
        this.saveFilters(filters);
        filtersConfig.render();
    }
    saveFilters(filters: Filter[]) {
        if (this.valid(filters)) {
            FilterFieldsConfig.saveFilters(filters, filtersConfig.target);
            datatable.update({ filters });
        }
    }
    static saveFilters(filters: Filter[], target: AppTarget) {
        settings.save({ ...target, subject: 'filters', values: filters });
    }
    static async restoreFilters(target: AppTarget, columns: Column[], dexieTable: Table) {
        const filters: Filter[] = [];
        let values = await settings.get({ ...target, subject: 'filters' });
        if (Array.isArray(values)) {
            values = values.filter((filter) =>
                Object.keys(searchMethods()).includes(filter.method),
            );
            values.forEach((filter: Filter) => {
                const column = columns.find((column) => column.name === filter.field);
                // if (column) {
                filter.indexed = column ? column.indexed : false;
                filter.compoundHead = column ? column.compoundHead : false;
                filters.push({ ...filter });
                // }
            });
        }
        return filters.length > 0 ? filters : [initialFilter(columns, dexieTable)];
    }
};

export default FilterFieldsConfig;
