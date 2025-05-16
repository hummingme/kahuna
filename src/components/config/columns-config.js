/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import Config from './config.js';
import datatable from '../datatable.js';
import checkbox from '../../lib/checkbox.js';
import { getConnection } from '../../lib/connection.js';
import { Column } from '../../lib/column.js';
import { isPrimKeyCompound, isPrimKeyUnnamed } from '../../lib/dexie-utils.js';
import { selectbox } from '../../lib/selectbox.js';
import settings from '../../lib/settings.js';
import { isEmptyObject } from '../../lib/types.js';
import { isTable, pickProperties } from '../../lib/utils.js';

const ColumnsConfig = class extends Config {
    #dragIndex;
    constructor({ control, values, defaults }) {
        super(control);
        this.state = {
            ...values,
            defaults,
            subject: 'column-settings',
        };
    }
    static async activate(control) {
        const { values, defaults } = await ColumnsConfig.getSettings(control.target);
        if (!control.rememberedSettings) {
            control.remember(values);
        }
        if (control.isTable) {
            const { columns, dexieTable } = isTable(control.appTarget)
                ? datatable.state
                : await ColumnsConfig.initFromSettings(control.target);
            Object.assign(values, {
                columns: structuredClone(columns),
                columnsBefore: structuredClone(columns),
                dexieTable,
            });
        }
        return new ColumnsConfig({ control, values, defaults });
    }
    static async initFromSettings(target) {
        const values = await settings.get({ ...target, subject: 'columns' });
        const columns = !isEmptyObject(values) ? values : [];
        const dexieTable = (await getConnection(target.database)).table(target.table);
        return { columns, dexieTable };
    }
    checkboxOptions = [
        {
            name: 'displayDiscoveredColumns',
            label: 'display additional data fields as table columns when they are discovered',
        },
    ];
    view() {
        return html`
            ${this.checkboxOptionsView()}${this.columnsTableView(this.state.columns)}
        `;
    }
    columnsTableView(columns) {
        return this.isTable && this.state.columns.length > 0
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
    columnRowView(column, index) {
        const visibility = this.columnAlwaysVisible(column.name)
            ? html`
                  <span title="the primary key cannot be hidden"><i>yes</i></span>
              `
            : html`
                  ${checkbox({
                      name: `visible-${index}`,
                      checked: column.visible,
                      changeFunc: this.visibilityCheckboxChanged.bind(this, index),
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
    columnFormatSelect(format, index) {
        const options = {
            '': '',
            date: 'date',
            url: 'url',
        };
        return selectbox({
            name: 'format-' + index,
            '@change': this.formatChanged.bind(this, index),
            options,
            selected: format,
        });
    }
    columnAlwaysVisible(name) {
        const primKey = this.state.dexieTable.schema.primKey;
        return (
            name === primKey.keyPath ||
            (isPrimKeyUnnamed(primKey) && name === '*key*') ||
            (isPrimKeyCompound(primKey) && primKey.keyPath.includes(name))
        );
    }
    visibilityCheckboxChanged(index, event) {
        this.state.columns[index].visible = event.target.checked;
        this.saveColumns();
        this.render();
    }
    formatChanged(index, event) {
        const format = ['date', 'url'].includes(event.target.value)
            ? event.target.value
            : null;
        this.state.columns[index].format = format;
        this.saveColumns();
        this.render();
    }
    dragStart(event) {
        this.#dragIndex = event.target.closest('tr').dataset.columnindex;
    }
    dragEnter(event) {
        event.preventDefault();
        const targetIndex = event.target.closest('tr').dataset.columnindex;
        if (targetIndex !== this.#dragIndex) {
            const columns = this.state.columns;
            columns.splice(targetIndex, 0, columns.splice(this.#dragIndex, 1)[0]);
            this.#dragIndex = targetIndex;
            this.render();
        }
    }
    dragEnd(event) {
        event.preventDefault();
        this.saveColumns();
    }
    isChanged() {
        return super.isChanged() || this.columnsChanged();
    }
    columnsChanged() {
        if (this.isTable === false || !this.state.columns) {
            return false;
        }
        const { columns, columnsBefore } = this.state;
        for (const [index, column] of columns.entries()) {
            const before = columnsBefore[index];
            if (column.visible !== before.visible || column.format !== before.format) {
                return true;
            }
        }
        return false;
    }
    undoChanges() {
        if (this.isTable) {
            this.state.columns = structuredClone(this.state.columnsBefore);
            this.saveColumns();
        }
        super.undoChanges();
    }
    static async restoreColumns(target, columns, importedOrder, namedPk) {
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
        const restoredColumns = [];
        values.forEach((columnData) => {
            const foundColumn = columns.find((column) => column.name === columnData.name);
            if (foundColumn) {
                columnData.deletedTS = null;
                restoredColumns.push(Object.assign(foundColumn, columnData));
            } else if (columnData.deletedTS === null) {
                restoredColumns.push(Object.assign(new Column(), columnData));
            }
        });
        const names = restoredColumns.map((column) => column.name);
        const newColumns = columns.filter(
            (column) => names.includes(column.name) === false,
        );
        return restoredColumns.concat(newColumns);
    }
    saveColumns() {
        ColumnsConfig.saveColumns(this.state.columns, this.target);
        datatable.update({ columns: this.state.columns });
    }
    static saveColumns(columns, target) {
        const values = columns.map((column) =>
            pickProperties(column, ['name', 'visible', 'width', 'format']),
        );
        settings.save({ ...target, subject: 'columns', values });
    }
    static async saveOrder(order, direction, target) {
        const { values, defaults } = await ColumnsConfig.getSettings(target);
        settings.saveSettings(
            { ...values, order, direction },
            defaults,
            target,
            'column-settings',
        );
    }
    static async getSettings(target) {
        const defaults = await ColumnsConfig.getDefaults(target);
        let values = await settings.get({ ...target, subject: 'column-settings' });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static orderDefaults = { order: '', direction: 'asc' };
    static async getDefaults(target) {
        return await Config.getDefaults(target, 'column-settings', {
            displayDiscoveredColumns: true,
            ...ColumnsConfig.orderDefaults,
        });
    }
};

export default ColumnsConfig;
