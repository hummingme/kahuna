/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */
import type { Table } from 'dexie';
import { html } from 'lit-html';

import Config from '#components/config/config';
import {
    columnsDefaultOptions,
    columnsDefaultOrder,
} from '#components/config/columns-default';
import type { ControlInstance, ColumnsOptions } from '#components/config/types';
import datatable from '#components/datatable';
import checkbox from '#lib/checkbox';
import {
    buildColumn,
    type Column,
    columnFormatOptions,
    isColumnFormat,
} from '#lib/column';
import { isPrimKeyCompound, isPrimKeyUnnamed } from '#lib/dexie-utils';
import { selectbox } from '#lib/selectbox';
import settings from '#lib/settings';
import { pickProperties, rowIndex } from '#lib/utils';
import type { AppTarget, Direction, SettingSubject } from '#types';

type ColumnsConfigState = {
    defaults: ColumnsOptions;
    subject: SettingSubject;
} & ColumnsOptions;

export default class ColumnsConfig extends Config {
    #columns: Column[] = [];
    #columnsBefore: Column[] = [];
    #dexieTable?: Table;
    #dragIndex = -1;
    constructor({
        control,
        values,
        defaults,
    }: {
        control: ControlInstance;
        values: ColumnsOptions;
        defaults: ColumnsOptions;
    }) {
        const state: ColumnsConfigState = {
            ...values,
            defaults,
            subject: 'column-settings',
        };
        super(control, state);
        if (control.isTable && datatable.state.dexieTable) {
            this.#columns = structuredClone(datatable.columns);
            this.#columnsBefore = structuredClone(this.#columns);
            this.#dexieTable = datatable.state.dexieTable;
        }
    }
    static async activate(control: ControlInstance) {
        const { values, defaults } = await ColumnsConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        return new ColumnsConfig({ control, values, defaults });
    }
    checkboxOptions = [
        {
            name: 'displayDiscoveredColumns',
            label: 'display additional data fields as table columns when they are discovered',
        },
    ];
    inputOptions = [
        {
            name: 'previewSize',
            label: 'image preview width and height in pixels',
            type: 'number',
            size: 3,
            maxlength: 3,
            '?required': true,
            min: 10,
            max: 1000,
        },
    ];
    view() {
        return html`
            ${this.checkboxOptionsView()} ${this.inputOptionsView()}
            ${this.columnsTableView(this.#columns)}
        `;
    }
    columnsTableView(columns: Column[]) {
        return this.isTable && this.#columns.length > 0
            ? html`
                  <fieldset id="columns-table" }>
                      <legend>${this.legend()}</legend>
                      <table>
                          <thead>
                              <tr>
                                  <th>pos</th>
                                  <th>column name</th>
                                  <th>format</th>
                                  <th>visible</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${columns.map((column, index) => {
                                  return this.columnRowView(column, index);
                              })}
                          </tbody>
                      </table>
                  </fieldset>
              `
            : '';
    }
    legend() {
        const modifiedIcon = this.columnsChanged() ? this.modifiedIcon() : '';
        return html`
            ${modifiedIcon} columns for data fields
        `;
    }
    columnRowView(column: Column, index: number) {
        const visibility = this.columnAlwaysVisible(column.name)
            ? html`
                  <span title="the primary key cannot be hidden"><i>yes</i></span>
              `
            : html`
                  ${checkbox({
                      name: `visible-${index}`,
                      checked: column.visible,
                      '@change': this.visibilityCheckboxChanged.bind(this, index),
                  })}
              `;
        return html`
            <tr
                @dragstart=${this.dragStart.bind(this)}
                @dragenter=${this.dragEnter.bind(this)}
                @dragend=${this.dragEnd.bind(this)}
            >
                <td draggable="true" class="center" title="drag & drop to change order">
                    ${index + 1}
                </td>
                <td>${column.name}</td>
                <td>${this.columnFormatSelect(column.format, index)}</td>
                <td class="center">${visibility}</td>
            </tr>
        `;
    }
    columnFormatSelect(format: string, index: number) {
        return selectbox({
            name: 'format-' + index,
            '@change': this.formatChanged.bind(this, index),
            options: columnFormatOptions(),
            selected: format,
        });
    }
    columnAlwaysVisible(name: string) {
        if (this.#dexieTable) {
            const primKey = this.#dexieTable!.schema.primKey;
            return (
                name === primKey.keyPath ||
                (isPrimKeyUnnamed(primKey) && name === '*key*') ||
                (isPrimKeyCompound(primKey) &&
                    primKey.keyPath &&
                    primKey.keyPath.includes(name))
            );
        }
    }
    visibilityCheckboxChanged(index: number, event: Event) {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        this.#columns[index].visible = target.checked;
        this.saveColumns();
        this.render();
    }
    formatChanged(index: number, event: Event) {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        this.#columns[index].format = isColumnFormat(target.value) ? target.value : '';
        this.saveColumns();
        this.render();
    }
    dragStart(event: DragEvent) {
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        this.#dragIndex = rowIndex(target);
    }
    dragEnter(event: DragEvent) {
        event.preventDefault();
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        const targetIndex = rowIndex(target);
        if (targetIndex > -1 && targetIndex !== this.#dragIndex) {
            const columns = this.#columns;
            columns.splice(targetIndex, 0, columns.splice(this.#dragIndex, 1)[0]);
            this.#dragIndex = targetIndex;
            this.render();
        }
    }
    dragEnd(event: DragEvent) {
        event.preventDefault();
        this.saveColumns();
    }
    override isDefault() {
        return super.isDefault() && this.columnsDefault();
    }
    columnsDefault() {
        if (this.#columns.some((c) => c.format !== '' || c.visible === false)) {
            return false;
        }
        return true;
    }
    override setDefaults() {
        this.#columns.map((c) => {
            c.format = '';
            c.visible = true;
        });
        super.setDefaults();
        this.saveColumns();
    }
    override isChanged() {
        return super.isChanged() || this.columnsChanged();
    }
    columnsChanged() {
        if (this.isTable === false || !this.#columns) {
            return false;
        }
        for (const [index, column] of this.#columns.entries()) {
            const before = this.#columnsBefore[index];
            if (column.visible !== before.visible || column.format !== before.format) {
                return true;
            }
        }
        return false;
    }
    override undoChanges() {
        if (this.isTable) {
            this.#columns = structuredClone(this.#columnsBefore);
            this.saveColumns();
        }
        super.undoChanges();
    }
    static async restoreColumns(
        target: AppTarget,
        columns: Column[],
        importedOrder: string[],
        namedPk: boolean,
    ) {
        let values = await settings.get({ ...target, subject: 'columns' });
        if (!Array.isArray(values)) {
            return importedOrder
                ? columns.sort(
                      (a, b) =>
                          importedOrder.indexOf(a.name) - importedOrder.indexOf(b.name),
                  )
                : columns;
        }
        if (namedPk) {
            values = values.filter((columnData) => columnData.name !== '*key*');
        }
        const restoredColumns: Column[] = [];
        values.forEach((columnData) => {
            const foundColumn = columns.find((column) => column.name === columnData.name);
            if (foundColumn) {
                columnData.deletedTS = null;
                restoredColumns.push(Object.assign(foundColumn, columnData));
            } else if (columnData.deletedTS === null) {
                restoredColumns.push(buildColumn(columnData));
            }
        });
        const names = restoredColumns.map((column) => column.name);
        const newColumns = columns.filter(
            (column) => names.includes(column.name) === false,
        );
        return restoredColumns.concat(newColumns);
    }
    saveColumns() {
        ColumnsConfig.saveColumns(this.#columns, this.target);
        datatable.update({ columns: this.#columns });
    }
    static saveColumns(columns: Column[], target: AppTarget) {
        const values = columns.map((column) =>
            pickProperties(column, ['name', 'visible', 'width', 'format']),
        );
        settings.save({ ...target, subject: 'columns', values });
    }
    static async saveOrder(order: string, direction: Direction, target: AppTarget) {
        const { values, defaults } = await ColumnsConfig.getSettings(target);
        settings.saveSettings(
            { ...values, order, direction },
            defaults,
            target,
            'column-settings',
        );
    }
    static async getSettings(target: AppTarget) {
        const defaults = await ColumnsConfig.getColumnsDefaults(target);
        let values = await settings.get({
            ...target,
            subject: 'column-settings',
        });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static async getColumnsDefaults(target: AppTarget) {
        return await Config.getDefaults(target, 'column-settings', {
            ...columnsDefaultOptions(),
            ...columnsDefaultOrder(),
        });
    }
}
