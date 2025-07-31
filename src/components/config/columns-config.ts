/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */
import type { Table } from 'dexie';
import { html } from 'lit-html';
import Config from './config.ts';
import type { ControlInstance, ColumnsOptions } from './types.ts';
import datatable from '../datatable.ts';
import { type AppTarget } from '../../lib/app-target.ts';
import checkbox from '../../lib/checkbox.ts';
import { buildColumn, type Column } from '../../lib/column.ts';
import { isPrimKeyCompound, isPrimKeyUnnamed } from '../../lib/dexie-utils.ts';
import { selectbox } from '../../lib/selectbox.ts';
import settings from '../../lib/settings.ts';
import { pickProperties } from '../../lib/utils.ts';
import type { Direction } from '../../lib/types/common.ts';
import type { SettingSubject } from '../../lib/types/settings.ts';

type ColumnsConfigState = {
    defaults: ColumnsOptions;
    subject: SettingSubject;
} & ColumnsOptions;

const ColumnsConfig = class extends Config {
    #columns: Column[] = [];
    #columnsBefore: Column[] = [];
    #dexieTable?: Table;
    #dragIndex = NaN;
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
        if (control.isTable) {
            this.#columns = structuredClone(datatable.state.columns);
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
                data-columnindex=${index}
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
        const options = {
            '': '',
            date: 'date',
            url: 'url',
            image: 'image',
        };
        return selectbox({
            name: 'format-' + index,
            '@change': this.formatChanged.bind(this, index),
            options,
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
        const target = event.target as HTMLInputElement;
        this.#columns[index].visible = target.checked;
        this.saveColumns();
        this.render();
    }
    formatChanged(index: number, event: Event) {
        const target = event.target as HTMLInputElement;
        const format = ['date', 'url', 'image'].includes(target.value)
            ? target.value
            : '';
        this.#columns[index].format = format;
        this.saveColumns();
        this.render();
    }
    dragStart(event: Event) {
        const target = event.target as HTMLElement;
        this.#dragIndex = parseInt(target.closest('tr')?.dataset.columnindex || '');
    }
    dragEnter(event: Event) {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const targetIndex = parseInt(target.closest('tr')?.dataset.columnindex || '');
        if (targetIndex !== this.#dragIndex) {
            const columns = this.#columns;
            columns.splice(targetIndex, 0, columns.splice(this.#dragIndex, 1)[0]);
            this.#dragIndex = targetIndex;
            this.render();
        }
    }
    dragEnd(event: Event) {
        event.preventDefault();
        this.saveColumns();
    }
    isChanged() {
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
    undoChanges() {
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
        values.forEach((columnData: Column) => {
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
        const defaults = (await ColumnsConfig.getDefaults(target)) as ColumnsOptions;
        let values = (await settings.get({
            ...target,
            subject: 'column-settings',
        })) as ColumnsOptions;
        values = settings.cleanupSettings(values, defaults) as ColumnsOptions;
        return { values, defaults };
    }
    static async getDefaults(target: AppTarget) {
        return await Config.getDefaults(target, 'column-settings', {
            ...columnsDefaultOptions(),
            ...columnsDefaultOrder(),
        });
    }
};

export const columnsDefaultOptions = () => {
    return {
        displayDiscoveredColumns: true,
        previewSize: 30,
        ...columnsDefaultOrder(),
    };
};
export const columnsDefaultOrder = (): { order: string; direction: Direction } => {
    return { order: '', direction: 'asc' };
};

export default ColumnsConfig;
