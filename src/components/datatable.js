/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import appWindow from './app-window.js';
import ChevronNavigation from './chevron-navigation.js';
import importer from './importer.js';
import jsCodearea from './js-codearea.js';
import messageStack from './messagestack.js';
import SelectionTools from './selection-tools.js';
import TableTools from './table-tools.js';
import tooltip from './tooltip.js';
import BehaviorConfig from './config/behavior-config.js';
import ColumnsConfig from './config/columns-config.js';
import displayConfigControl from './config/config-control.js';
import FiltersConfig from './config/filters-config.js';
import FilterFieldsConfig from './config/filter-fields-config.js';

import appStore from '../lib/app-store.js';
import appWorker from '../lib/app-worker.js';
import { button, symbolButton } from '../lib/button.js';
import { Column } from '../lib/column.js';
import { getConnection } from '../lib/connection.js';
import { decodeQueryResult } from '../lib/data-wrapper.js';
import {
    isPrimKeyNamed,
    isPrimKeyUnnamed,
    isPrimKeyCompound,
} from '../lib/dexie-utils.js';
import display from '../lib/displaytype.js';
import env from '../lib/environment.js';
import {
    isFiltered,
    isFilterValid,
    isIndexedFilter,
    methodProperties,
} from '../lib/filter.js';
import messenger from '../lib/messenger.js';
import { queryData } from '../lib/querydata.js';
import { selectbox } from '../lib/selectbox.js';
import {
    rowSelector,
    rowSelectorFields,
    rowSelectorPrimKey,
} from '../lib/row-selection.js';
import svgIcon from '../lib/svgicon.js';
import textinput from '../lib/textinput.js';
import * as t from '../lib/types.js';
import { addNestedValues } from '../lib/utils.js';

const Datatable = class {
    #state = this.emptyState;
    constructor() {
        messenger.register('queryResult', onQueryResult.bind(this));
        messenger.register('queryError', onQueryError.bind(this));
        messenger.register('refreshDatatable', this.refresh.bind(this));
    }
    update(diff) {
        this.#state = { ...this.#state, ...diff };
    }
    get state() {
        return {
            columns: [...this.#state.columns],
            filters: [...this.#state.filters],
            ...this.#state,
        };
    }
    get emptyState() {
        return { columns: [], filters: [] };
    }
    get table() {
        return appStore.table(this.#state.selectedTable);
    }
    get columns() {
        return [...this.#state.columns];
    }
    get filters() {
        return [...this.#state.filters];
    }

    get breadcrumbIcons() {
        return [
            {
                icon: 'tabler-settings',
                title: 'table tools',
                id: tableToolsButtonId,
                '@click': tableToolsClicked.bind(null, this.#state.selectedTable),
            },
            {
                icon: 'tabler-adjustments',
                title: 'table settings and configuration',
                '@click': settingsConfigClicked,
                id: 'settings-config',
            },
        ];
    }

    /**
     * onclick action when a new table is selected for the datatable view
     */
    async summon(selectedTable) {
        const table = appStore.table(selectedTable);
        const target = appStore.target(selectedTable);
        const dexieTable = (await getConnection(target.database)).table(target.table);
        const settings = await this.getSettings(target);
        const selectorFields = rowSelectorFields(table);
        const initialState = {
            ...settings,
            dexieTable,
            selectedTable,
            target,
            columns: [],
            filters: [],
            data: [],
            selectorFields,
            selected: new Set(),
            offset: 1,
            total: table.count, // total rows, with filter applied
            editSelector: null,
            colResizing: null,
            firstrun: true,
            aborted: false,
        };
        await jsCodearea.init({
            enabled: settings.displayCodearea && env.codeExecution,
            target,
            exposedVariables: async () => await codeareaExposedVariables(datatable.state),
            executed: async () => await codeareaExecuted(dexieTable),
            selectorFields,
            selected: initialState.selected,
        });
        await this.updateDatatable(initialState);
        appStore.update({ loading: true, selectedTable }, 'Datatable.summon');

        appWindow.externMoveHandler = {
            isTarget: moveTarget,
            start: columnResizeStart,
            moving: resizeColumn,
            stop: columnResizeStop,
        };
        appWindow.externKeyHandler = { down: onKeydown };
    }
    async refresh() {
        jsCodearea.refresh();
        const settings = await this.getSettings(this.#state.target);
        this.updateDatatable({
            ...settings,
            firstrun: true,
        });
    }
    async getSettings(target) {
        const {
            values: { order, direction, displayDiscoveredColumns },
        } = await ColumnsConfig.getSettings(target);
        const {
            values: { markUnindexed },
        } = await FiltersConfig.getSettings(target);
        const {
            values: { datatableRows, confirmDeleteRow, displayCodearea },
        } = await BehaviorConfig.getSettings(target);
        return {
            order,
            direction,
            displayDiscoveredColumns,
            markUnindexed,
            limit: datatableRows,
            confirmDeleteRow,
            displayCodearea,
        };
    }
    release() {
        if (appStore.loading === true) {
            this.abortQueryData(true);
        }
        this.#state = this.emptyState;
        appWindow.externMoveHandler = null;
    }
    template() {
        const table = this.table;
        if (table === undefined) {
            return '';
        }
        const content =
            table.count > 0
                ? datatableView(this.state)
                : html`
                      <div class="lonely"></div>
                  `;
        return html`
            <div>
                <h1 class="precis">${headlineView(table)}</h1>
                ${content} ${content ? jsCodearea.view() : ''}
            </div>
        `;
    }
    async updateDatatable(stateDiff) {
        appStore.update(
            {
                loading: true,
                loadingMsg: 'loading data',
                loadingStop: this.abortQueryData,
            },
            'updateDatatable',
        );
        this.update(Object.assign(stateDiff, { data: [], total: 0 }));

        const { target, dexieTable, filters, order, direction, offset, limit } =
            this.#state;
        const params = {
            dbname: target.database,
            tablename: target.table,
            addUnnamedPk: isPrimKeyUnnamed(dexieTable.schema.primKey),
            filters,
            order,
            direction,
            offset,
            limit,
            encodeQueryResult: env.bigIntArrayFlaw === true,
        };
        if (env.workersBlocked) {
            const result = await queryData(params);
            await onQueryResult({ result, encoded: false });
        } else {
            messenger.post({ type: 'queryData', params });
        }
    }
    async reloadDatatable(stateDiff) {
        if (appStore.loading === true) {
            await this.abortQueryData(true);
        }
        await this.updateDatatable(stateDiff);
    }
    async setData({ data, total }) {
        let {
            columns,
            filters,
            order,
            direction,
            dexieTable,
            target,
            firstrun,
            displayDiscoveredColumns,
        } = this.#state;
        if (firstrun) {
            const dataProps = getDataProperties(data);
            columns = columnsFromIndices(this.table, dataProps);
            data = addKeypathsData(data, columns);
            columns = columnsFromData(data, columns, displayDiscoveredColumns, firstrun);
            columns = await ColumnsConfig.restoreColumns(
                target,
                columns,
                importer.importedCsvHeads.get(target.table),
                isPrimKeyNamed(this.table.primKey),
            );
            filters = await FilterFieldsConfig.restoreFilters(
                target,
                columns,
                dexieTable,
            );
            if (isFiltered(filters) || order !== null) {
                // reload data and datatable
                this.updateDatatable({
                    columns,
                    filters,
                    order,
                    direction,
                    firstrun: false,
                });
                return false;
            }
        }
        data = addKeypathsData(data, columns);
        columns = columnsFromData(data, columns, displayDiscoveredColumns);
        this.update({
            columns,
            filters,
            order,
            direction,
            data,
            total,
            firstrun: false,
        });
        return true;
    }
    abortQueryData = async (silent = false) => {
        await appWorker.restart();
        datatable.update({ aborted: !silent });
        appStore.update({ loading: false, loadingMsg: '', loadingStop: null });
    };
    doLoading = async (func, logLabel) => {
        appStore.update({ loading: true, loadingMsg: 'loading data' }, `${logLabel} 1`);
        const res = await func();
        appStore.rerender({ loading: false }, `${logLabel} 2`);
        return res;
    };
};

const addKeypathsData = (data, columns) => {
    const paths = columns.filter((c) => c.innerValue === true).map((c) => c.name);
    return addNestedData(data, paths);
};

const addNestedData = (data, paths) => {
    data.forEach((row, idx) => {
        data[idx] = addNestedValues(row, paths);
    });
    return data;
};

const getDataProperties = (data) => {
    const props = [];
    for (const row of data) {
        props.push(...Object.getOwnPropertyNames(row));
    }
    return new Set(props);
};

const columnsFromData = (data, columns, displayDiscoveredColumns, firstrun = false) => {
    const foundColumns = [];
    const existingNames = columns.map((c) => c.name);
    data.forEach((_, idx) => {
        for (const key of Object.keys(data[idx])) {
            if (existingNames.indexOf(key) === -1) {
                foundColumns.push(
                    Object.assign(new Column(), {
                        name: key,
                        visible: firstrun || displayDiscoveredColumns ? true : false,
                        discoveredTS: firstrun ? null : Date.now(),
                    }),
                );
                existingNames.push(key);
            }
        }
    });
    foundColumns.sort((a, b) => a.name.localeCompare(b.name));
    columns = columns.concat(foundColumns);

    if (firstrun) {
        columns = setColumnsWidths(columns, data);
    }
    return columns;
};

const columnsFromIndices = (table, dataProps) => {
    let columns = [];
    // the indexed fields are sure columns
    if (isPrimKeyNamed(table.primKey)) {
        if (isPrimKeyCompound(table.primKey)) {
            columns.push(...columnsFromKeypath(table.primKey.keyPath, columns));
        } else {
            columns.unshift(
                Object.assign(new Column(), {
                    name: table.primKey.name,
                    indexed: true,
                    visible: true,
                }),
            );
        }
    }
    // unnamed primary key
    if (isPrimKeyUnnamed(table.primKey)) {
        columns.unshift(
            Object.assign(new Column(), {
                name: '*key*',
                indexed: true,
                visible: true,
            }),
        );
    }

    table.indexes.forEach((index) => {
        if (!index.compound) {
            if (columns.some((c) => c.name === index.name) === false) {
                columns.push(
                    Object.assign(new Column(), {
                        name: index.name,
                        indexed: true,
                        visible: true,
                    }),
                );
            }
        } else {
            columns.push(...columnsFromKeypath(index.keyPath, columns));
        }
    });
    for (const column of columns) {
        column.innerValue = !dataProps.has(column.name) && column.name.includes('.');
    }
    return columns;
};

const columnsFromKeypath = (keypath, columns) => {
    const cols = [];
    let first = true;
    keypath.forEach((kp) => {
        if (-1 === columns.findIndex((c) => c.name === kp)) {
            columns.push(
                Object.assign(new Column(), {
                    name: kp,
                    indexed: false,
                    compoundHead: first,
                    visible: true,
                }),
            );
            first = false;
        }
    });
    return cols;
};

/**
 * the width of the column headers and data is analyzed
 * and the available table width is divided between the columns
 */
const setColumnsWidths = (columns, data) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fonts = appWindow.fontFamily;

    // set widths to satisfy column headers
    ctx.font = `700 15px ${fonts}`;
    columns.forEach((col, idx) => {
        const text = ctx.measureText(col.name + ' △');
        columns[idx].width = Math.floor(text.width);
    });

    // required widths to satisfy the data
    const widths = [];
    ctx.font = `400 15px ${fonts}`;
    columns.forEach((col, idx) => {
        const cvals = data.map((row) => row[col.name]);
        cvals.forEach((val) => {
            const text = ctx.measureText(val);
            if (!widths[idx] || widths[idx] < text.width) {
                widths[idx] = Math.floor(text.width);
            }
        });
    });
    const columnsTotal = widths.reduceRight((sum, cur) => sum + cur + 10, 0);
    const availableTotal = appWindow.dims.width - 18 - 42; // 18: table padding; 42: row icons column

    // number columns get all space they need
    let rcnt = columns.length;
    columns.forEach((col, idx) => {
        if (availableTotal >= columnsTotal) {
            if (widths[idx] > col.width) {
                columns[idx].width = widths[idx];
            }
            rcnt--; // remaining columns
        }
    });

    // available table width without horizontal scrolling
    let avwidth = availableTotal - tableWidth(columns) - 3; // 3px for rightest column resizer
    if (rcnt > 0 && avwidth > 0) {
        columns.forEach((col, idx) => {
            if (columns[idx].width < widths[idx]) {
                const fairwidth = Math.floor(avwidth / rcnt);
                const takewidth =
                    Math.min(fairwidth, widths[idx] - columns[idx].width) - 5;
                columns[idx].width += takewidth;
                avwidth -= takewidth;
                rcnt--;
            }
        });
    }

    return columns;
};

/*
 * a filter value has changed -> validate and save the filter
 */
const onFilterChanged = (ev) => {
    const idx = ev.target.dataset.searchindex;
    const val = ev.target.value.trim();
    const filters = datatable.filters;
    if (val !== filters[idx].search) {
        filters[idx].search = val;
        filters[idx].valid = isFilterValid(val, filters[idx]);
        FilterFieldsConfig.saveFilters(filters, appStore.target());
        datatable.update({ filters });
    }
};

/*
 * trigger search on Enter in a filter element
 */
const onFilterKeydown = (ev) => {
    if (ev.key === 'Enter') {
        onFilterChanged(ev);
        doSearch();
    }
};

/*
 * event handler for 'trigger search' button and called by onFilterKeydown
 */
const doSearch = () => {
    datatable.reloadDatatable({ offset: 1 });
};

/*
 * event handler for 'clear filter' button
 */
const doReset = () => {
    const filters = datatable.filters.map((f) => {
        f.search = '';
        return f;
    });
    FilterFieldsConfig.saveFilters(filters, appStore.target());
    datatable.reloadDatatable({ filters, offset: 1 });
};

/**
 * navigate action for chevronNavigation
 */
const navigate = (offset) => {
    const { total, limit, offset: previousOffset } = datatable.state;
    offset = parseInt(offset);
    if (offset === previousOffset) return;
    if (offset < 1 || isNaN(offset)) {
        offset = 1;
    } else if (offset > total) {
        offset = Math.floor(total / limit) * limit + 1;
    }
    datatable.reloadDatatable({ offset });
};

/**
 * onclick action of the column header title links
 */
const onColumnClicked = (ev) => {
    const colindex = parseInt(ev.target.closest('a').dataset.colindex);
    orderColumn(colindex);
};

const onKeydown = (ev) => {
    const focused = appWindow.root.activeElement;
    if (ev.key === 'Enter' && focused?.tagName === 'A' && focused.dataset.colindex) {
        orderColumn(parseInt(focused.dataset.colindex));
    }
};

/**
 * click action of column headers
 */
let orderTimeout = null;
const orderColumn = (colindex) => {
    if (orderTimeout) {
        // it's a dblclick, handled by unsetOrder
        clearTimeout(orderTimeout);
        orderTimeout = null;
    } else {
        orderTimeout = setTimeout(() => {
            const { columns, order, direction } = datatable.state;
            const name = visibleColumns(columns)[colindex].name;
            const dir = name === order ? (direction === 'asc' ? 'desc' : 'asc') : 'asc';
            datatable.reloadDatatable({
                offset: 1,
                order: name,
                direction: dir,
            });
            ColumnsConfig.saveOrder(name, dir, appStore.target());
            orderTimeout = null;
        }, 300);
    }
};

/**
 * dblclick action of column headers
 */
const unsetOrder = () => {
    document.getSelection().empty();
    datatable.reloadDatatable({
        offset: 1,
        ...ColumnsConfig.orderDefaults,
    });
    ColumnsConfig.saveOrder(
        ...Object.values(ColumnsConfig.orderDefaults),
        appStore.target(),
    );
};

const moveTarget = (ev) => {
    return (
        ev.target.matches('div[data-colindex]') || datatable.state.colResizing !== null
    );
};

const columnResizeStart = (ev) => {
    const index = parseInt(ev.target.dataset.colindex);
    const startWidth = visibleColumns(datatable.columns)[index].width;
    const colResizing = {
        index,
        startX: ev.clientX,
        startWidth,
    };
    datatable.update({ colResizing });
};

const resizeColumn = (posX) => {
    const {
        columns,
        colResizing: { startX, startWidth, index },
    } = datatable.state;
    const delta = posX - startX;
    visibleColumns(columns)[index].width = Math.max(20, startWidth + delta);
    handleWidthHandle(index - 1, 'visible');
    datatable.update({ columns });
    appStore.rerender();
};

const columnResizeStop = (event) => {
    if (event.target.matches('div[data-colindex]') === false) {
        hideWidthHandles();
    }
    datatable.update({ colResizing: null });
    ColumnsConfig.saveColumns(datatable.columns, appStore.target());
};

/*
 * display widthHandles while above the corresponding column
 */
const onMouseOverHeader = (job, event) => {
    if (datatable.state.colResizing) {
        return;
    }
    const colIndex = parseInt(
        event.target.closest('th')?.firstElementChild.dataset.colindex,
    );
    if (Number.isInteger(colIndex)) {
        hideWidthHandles();
        handleWidthHandle(colIndex, job);
        if (colIndex > 0) {
            handleWidthHandle(colIndex - 1, job);
        }
    }
};
const handleWidthHandle = (index, job) => {
    const handle = appWindow.main.querySelector(
        `div.width-handle[data-colindex="${index}"]`,
    );
    if (handle) {
        if (handle.matches(':hover')) {
            handle.style.visibility = 'visible';
        } else {
            handle.style.visibility = job;
        }
    }
};
const hideWidthHandles = () => {
    appWindow.main
        .querySelectorAll('div.width-handle')
        .forEach((handle) => (handle.style.visibility = 'hidden'));
};

/*
 * click handler for row icon "delete"
 * delete the row at idx from table
 */
const deleteRow = async (idx) => {
    const { dexieTable, selectorFields, selected, data, total, confirmDeleteRow } =
        datatable.state;
    const pk = rowSelectorPrimKey(selectorFields, data[idx]);
    const pk_str = t.valueToString(pk, t.getType(pk));
    const msg = `Sure to delete the row for primaryKey: ${pk_str}`;
    if (!confirmDeleteRow || window.confirm(msg)) {
        await dexieTable.delete(pk);
        selected.delete(rowSelector(selectorFields, data[idx]));
        datatable.updateDatatable({
            selected,
            total: total - 1,
        });
        appStore.update({ tables: dexieTable.name });
    }
};

/*
 * click handler for row icon "edit"
 * display a string 'table.update(pk, {})' in the js-textarea
 */
const editRow = (idx) => {
    const { selectorFields, columns, data } = datatable.state;
    const dataRow = data[idx];
    const primaryKey = rowSelectorPrimKey(selectorFields, dataRow);
    const code = editRowCode(dataRow, selectorFields, columns);

    datatable.update({ editSelector: primaryKey });
    jsCodearea.update({
        enabled: true,
        code,
        savedIndex: null,
        saved: false,
    });
    appStore.rerender();
};

const editRowCode = (dataRow, selectorFields, columns) => {
    let code;
    if (
        Object.getOwnPropertyNames(dataRow).length === 2 &&
        Object.hasOwn(dataRow, '*value*')
    ) {
        const item = editValue('*value*', dataRow['*value*']);
        const key = editValue('*key*', dataRow['*key*']);
        code = `table.put(${item}, ${key})`;
    } else {
        const key = editKey(selectorFields);
        const items = [];
        editableColumns(columns).forEach((col) => {
            if (Object.hasOwn(dataRow, col.name) && !selectorFields.includes(col.name)) {
                const prop = t.maybeQuotedProperty(col.name);
                const val = editValue(col.name, dataRow[col.name]);
                items.push(`${prop}: ${val}`);
            }
        });
        code = `table.update(${key}, {
    ${items.join(',\n    ')}
 });`;
    }
    return code;
};

const editValue = (name, val) => {
    const type = t.getType(val);
    return t.typesFromRow.includes(type)
        ? editValueFromRow(name)
        : t.valueToSource(val, type);
};

const editKey = (selectorFields) => {
    return selectorFields.length === 1
        ? editValueFromRow(selectorFields[0])
        : `[${selectorFields.map((name) => editValueFromRow(name)).join(', ')}]`;
};

const editValueFromRow = (name) => {
    return t.isUnquotedPropertyName(name) ? `row.${name}` : `row["${name}"]`;
};

/**
 * click handler to select/deselect table rows, or to edit/delete the datasets
 */
const tbodyClicked = (ev) => {
    const tr = ev.target.closest('tr');
    if (tr === null || ev.target.nodeName === 'A') {
        return;
    }
    const idx = parseInt(tr.dataset.rowindex);
    if (ev.target.closest('td')?.classList.contains('row-icons')) {
        // row icons column
        ev.target.closest('button')?.classList.contains('delete')
            ? deleteRow(idx)
            : editRow(idx);
    } else {
        tr.classList.toggle('hilight');
        toggleSelected(idx);
    }
};

/**
 * invert datatable.state.selected for given data index
 */
const toggleSelected = (idx) => {
    const { selected, selectorFields, data } = datatable.state;
    if (selectorFields.length > 0) {
        const selector = rowSelector(selectorFields, data[idx]);
        selected.has(selector) ? selected.delete(selector) : selected.add(selector);
        datatable.update({ selected });
        appStore.rerender();
    }
};

const visibleColumns = (columns) => columns.filter((col) => col.visible === true);
const hiddenColumns = (columns) => columns.filter((col) => col.visible === false);
const editableColumns = (columns) =>
    columns.filter((col) => col.name !== '*key*' && col.innerValue === false);

const headlineView = (table) => {
    return html`
        Table
        <i>${table.name}</i>
        has ${table.count} record${table.count === 1 ? '' : 's'} in total
    `;
};

const datatableView = function (tstate) {
    const { columns, data, total, offset, limit, colResizing, firstrun, aborted } =
        tstate;
    if (firstrun) return;

    const visColumns = visibleColumns(columns);
    const dtrows = [];
    data.forEach((rdata, idx) => dtrows.push(rowView(rdata, idx, visColumns, tstate)));
    const twidth = tableWidth(visColumns) + 42; // 42: row icons column
    const awidth = appWindow.dims.width - 20; // 20: app section padding
    const width =
        Math.min(twidth, awidth) < (awidth * 2) / 3
            ? (awidth * 2) / 3 + 'px'
            : Math.min(twidth, awidth) + 'px';
    const minWidth = total < limit ? '250px' : '500px';

    return html`
        <div class="dttable">
            <div id="dtheader" style=${styleMap({ width, minWidth })}>
                ${searchfieldsView(tstate)} ${navigationView({ limit, offset, total })}
            </div>
            <div>
                <table class="datatable" style="width: ${twidth}px">
                    <thead>
                        ${colHeaderView(visColumns, tstate.order, tstate.direction)}
                    </thead>
                    <tbody @click=${tbodyClicked}>${dtrows}</tbody>
                </table>
                ${headerResizeHandles(visColumns, colResizing?.index)}
                ${noResultView(data.length === 0, appStore.loading, aborted)}
            </div>
            ${SelectionTools.controls(tstate)}
        </div>
    `;
};

const colHeaderView = (columns, order, direction) => {
    const cells = [];
    columns.forEach((c, idx) => {
        const content =
            order === c.name
                ? html`<div class=th-container>
                     <div class=th-title>${c.name}</div>
                     <div class=th-icon>${direction === 'asc' ? '▽' : '△'}</div>
                   </div`
                : html`
                      ${c.name}
                  `;
        cells.push(html`
            <th
                width="${c.width}px"
                @dblclick=${unsetOrder}
                @mouseenter=${onMouseOverHeader.bind(null, 'visible')}
                @mouseleave=${onMouseOverHeader.bind(null, 'hidden')}
            >
                <a
                    title="change sort order"
                    tabindex="0"
                    @click=${onColumnClicked}
                    data-colindex=${idx}
                >
                    ${content}
                </a>
            </th>
        `);
    });
    cells.push(html`
        <th class="icon-col">${hiddenColumnsIndicator()}</th>
    `); // row icons column and hidden columns indicator

    return html`
        <tr>${cells}</tr>
    `;
};

const hiddenColumnsIndicator = () => {
    let tpl = '';
    const hcols = hiddenColumns(datatable.columns);
    if (hcols.length) {
        tpl = html`
            <span @mouseover=${hciMouseOver}>(${hcols.length})</span>
        `;
    }
    return tpl;
};

const hciMouseOver = (event) => {
    tooltip.show({
        view: hiddenColumnsTooltipView,
        anchor: event.target,
    });
};

const hiddenColumnsTooltipView = () => {
    const hcols = hiddenColumns(datatable.state.columns);
    const known = hcols.filter((c) => c.discoveredTS === null).map((c) => c.name);
    const added = hcols
        .filter((c) => c.discoveredTS > 0)
        .sort((a, b) => a.discoveredTS - b.discoveredTS)
        .map((c) => c.name);

    let addedP = '';
    if (added.length > 0) {
        const str1 = added.length === 1 ? '' : 's';
        addedP = html`
            <p>
                ${added.length} new column${str1} added:
                <br />
                ${listSomeColumns(added, 3)}
                ${symbolButton({
                    icon: 'tabler-square-rounded-plus',
                    title: 'display all as columns',
                    classes: ['right'],
                    '@click': displayAddedColumns,
                })}
            </p>
        `;
    }

    let knownP = '';
    if (known.length > 0) {
        const str1 = known.length === 1 ? ' is' : 's are';
        knownP = html`
            <p>
                ${known.length} ${addedP !== '' ? 'more ' : ''} column${str1} hidden:
                <br />
                ${listSomeColumns(known, 3)}
                ${symbolButton({
                    icon: 'tabler-adjustments',
                    title: 'columns configuration',
                    classes: ['right'],
                    '@click': configureHiddenColumns,
                })}
            </p>
        `;
    }

    return html`
        ${addedP}${knownP}
    `;
};

const listSomeColumns = (cols, num) => html`
    <i>${unsafeHTML(cols.slice(0, num).join('</i>, <i>'))}</i>
    ${moreColumnsAdd(cols)}
`;

const moreColumnsAdd = (cols) => (cols.length > 3 ? ` and ${cols.length - 3} more` : '');

const configureHiddenColumns = (ev) => {
    ev.stopPropagation();
    displayConfigControl({
        target: appStore.target(),
        realm: 'columns',
        anchorId: 'settings-config',
    }),
        tooltip.hide();
};

const displayAddedColumns = () => {
    tooltip.hide();
    const columns = datatable.columns;
    columns.forEach((col, idx) => {
        if (col.discoveredTS !== null) {
            columns[idx].visible = true;
            columns[idx].discoveredTS = null;
        }
    });
    datatable.updateDatatable({ columns });
};

const tableWidth = (columns) => columns.reduce((sum, col) => sum + +col.width + 10, 0); // 10px padding per column

const headerResizeHandles = (columns, resizeIndex) => {
    const handles = [];
    let left = -2;
    columns.forEach((col, idx) => {
        left += col.width + 10; // padding: 10; center resizer: 1
        const visibility = idx === resizeIndex ? 'visible' : 'hidden';
        handles.push(html`
            <div
                class="width-handle"
                style="left: ${left - 1}px; visibility:${visibility};"
                data-colindex=${idx}
            >
                <div data-colindex=${idx}></div>
            </div>
        `);
    });
    return handles;
};

const rowView = (rdata, idx, columns, tstate) => {
    const cells = [];
    columns.forEach((col) => {
        let value = '',
            type = null;
        if (Object.hasOwn(rdata, col.name)) {
            type = t.getType(rdata[col.name]);
            value = display(rdata[col.name], col.format, type);
        }
        cells.push(html`
            <td class=${cellClasses(type) || nothing}>${value}</td>
        `);
    });
    cells.push(html`
        <td class="row-icons">${rowIcons()}</td>
    `);
    const selector = rowSelector(tstate.selectorFields, rdata);
    const trclass = tstate.selected.has(selector) ? 'hilight' : '';
    return html`
        <tr data-rowindex=${idx} class=${trclass || nothing}>${cells}</tr>
    `;
};

const cellClasses = (type) => {
    const classes = [];
    if (!['string', 'number', 'bigint', 'array', 'object'].includes(type)) {
        classes.push('italic');
    }
    if (['number', 'bigint'].includes(type)) {
        classes.push('aright');
    }
    if (['null', 'undefined', 'boolean'].includes(type)) {
        classes.push('center');
    }
    return classes.join(' ');
};

const rowIcons = () => {
    const trashIcon = symbolButton({
        title: 'delete row',
        icon: 'tabler-trash',
        classes: ['delete'],
    });
    const editIcon = env.codeExecution
        ? symbolButton({
              title: 'edit data',
              icon: 'tabler-edit',
              classes: ['edit'],
          })
        : '';

    return html`
        ${trashIcon} ${editIcon}
    `;
};

const noResultView = (noData, loading, aborted) => {
    return noData === false ? '' : aborted ? abortedView() : noFilterResultView(loading);
};

const noFilterResultView = (loading) => {
    const msg = loading ? '' : 'the filters do not match any data set';
    return html`
        <div class="lonely"><i>${msg}</i></div>
    `;
};

const abortedView = () => html`
    <div class="lonely">Loading data aborted!</div>
    <div class="lonely">
        If it was stuck or took to long try resetting the filter or removing the sorting
        by double-clicking on the column header.
    </div>
`;

const navigationView = ({ limit, offset, total }) => {
    if (limit < total) {
        const nav = new ChevronNavigation({
            offset,
            step: limit,
            max: total,
            navigate,
            input: true,
        });
        return html`
            <div id="dtnav">${nav.view()}</div>
        `;
    }
};

const searchfieldsView = ({ filters, markUnindexed }) => {
    const buttonId = 'filter-config-button-id';
    const configButton = symbolButton({
        title: 'filter configuration',
        icon: 'tabler-adjustments-search',
        id: buttonId,
        '@click': () =>
            displayConfigControl({
                target: appStore.target(),
                realm: 'filters',
                anchorId: buttonId,
            }),
    });
    const searchButton = button({
        title: 'trigger search',
        content: svgIcon('tabler-check'),
        '@click': doSearch,
    });
    const clearButton = button({
        title: 'clear filter',
        content: svgIcon('tabler-x'),
        '@click': doReset,
    });
    const searchfields = [];
    filters.forEach((filter, idx) =>
        searchfields.push(searchfieldView(filter, idx, markUnindexed)),
    );
    return html`
        ${configButton}
        <div id="dtsearch">
            ${searchfields}
            <div>${searchButton} ${clearButton}</div>
        </div>
    `;
};

const searchfieldView = (filter, idx, markUnindexed) => {
    const placeholder = `${filter.field} ${methodProperties(filter).short}`;
    const className = markUnindexed && !isIndexedFilter(filter) ? 'warn' : null;
    const attributes = {
        title: `search ${placeholder}`,
        placeholder,
        'data-searchindex': idx,
        '@change': onFilterChanged,
        '@keydown': onFilterKeydown,
        class: className,
    };
    return filter.method === 'empty'
        ? selectbox(
              Object.assign(attributes, {
                  options: searchEmptyOptions(filter.field),
                  selected: filter.search,
              }),
          )
        : textinput(
              Object.assign(attributes, {
                  typ: 'search',
                  '.value': filter.search,
              }),
          );
};

const searchEmptyOptions = (fname) => ({
    '': '',
    yes: `${fname} is empty`,
    no: `${fname} not empty`,
});

const tableToolsButtonId = 'table-tools-button-id';
const tableToolsClicked = (tableIdx) => {
    TableTools.summon(tableIdx, tableToolsButtonId);
};

const settingsConfigClicked = () => {
    displayConfigControl({
        target: appStore.target(),
        anchorId: 'settings-config',
    });
};

const onQueryResult = async (message) => {
    const result = message.result.encoded
        ? structuredClone(message.result)
        : message.result;
    if (result.encoded === true) {
        result.data = decodeQueryResult(result.data);
    }
    const ready = await datatable.setData(result);
    if (ready) {
        appStore.update({ loading: false, loadingMsg: '', loadingStop: null });
    }
};

const onQueryError = (error) => {
    messageStack.displayError(`Error querying data: ${error.message}`);
};

const codeareaExposedVariables = async (state) => {
    return {
        row: getEditRow(state),
        db: null,
        table: null,
        selection: null,
    };
};

const getEditRow = ({ editSelector, selectorFields, data }) => {
    if (editSelector !== null) {
        if (selectorFields.length === 1) {
            editSelector = [editSelector];
        }
        for (const row of data) {
            if (selectorFields.every((field, idx) => row[field] === editSelector[idx])) {
                return row;
            }
        }
    }
    return null;
};

const codeareaExecuted = async (dexieTable) => {
    const count = await dexieTable.count();
    if (datatable.state.displayCodearea === false) {
        jsCodearea.disable();
    }
    datatable.updateDatatable({ table: { ...datatable.table, count } });
};

const datatable = new Datatable();
export default datatable;
