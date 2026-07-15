/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { Table } from 'dexie';
import { html, TemplateResult } from 'lit-html';
import { nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import appWindow from '#components/app-window';
import ChevronNavigation from '#components/chevron-navigation';
import importer from '#components/importer';
import jsCodearea from '#components/js-codearea';
import messageStack from '#components/messagestack';
import SelectionTools from '#components/selection-tools';
import tableTools from '#components/table-tools';
import tooltip from '#components/tooltip';
import BehaviorConfig from '#components/config/behavior-config';
import ColumnsConfig from '#components/config/columns-config';
import { columnsDefaultOrder } from './config/columns-default';
import displayConfigControl from '#components/config/config-control';
import FiltersConfig from '#components/config/filters-config';
import FilterFieldsConfig from '#components/config/filter-fields-config';
import displayValueEditor from '#components/value-editor/editor';

import appStore from '#lib/app-store';
import { globalTarget } from '#lib/app-target';
import appWorker from '#lib/app-worker';
import { button, symbolButton } from '#lib/button';
import { buildColumn, type Column } from '#lib/column';
import { getConnection } from '#lib/connection';
import * as t from '#lib/datatypes';
import { decodeQueryResult } from '#lib/data-wrapper';
import { isPrimKeyNamed, isPrimKeyUnnamed, isPrimKeyCompound } from '#lib/dexie-utils';
import display from '#lib/displaytype';
import env from '#lib/environment';
import { escapeUnicode } from '#lib/escape-unicode';
import {
    isFiltered,
    isFilterValid,
    isIndexedFilter,
    methodProperties,
} from '#lib/filter';
import { hideMessageType, getHiddenMessagesOrigin } from '#lib/hidden-messages';
import messenger from '#lib/messenger';
import { queryData } from '#lib/querydata';
import { checkScrubbler } from '#lib/scrubbler';
import { selectbox } from '#lib/selectbox';
import { rowSelector, rowSelectorFields, rowSelectorPrimKey } from '#lib/row-selection';
import svgIcon from '#lib/svgicon';
import textinput from '#lib/textinput';
import { addNestedValues } from '#lib/utils';
import { type AllowedType, ValueFormatter } from '#lib/value-formatter';
import type {
    AppTarget,
    Direction,
    Filter,
    KTable,
    Message,
    QueryResultMessagePayload,
    Position,
    QueryDataArgs,
    UnknownRecord,
} from '#types';

type DatatableSettings = {
    order: string;
    direction: Direction;
    displayDiscoveredColumns: boolean;
    markUnindexed: boolean;
    limit: number;
    confirmDeleteRow: boolean;
    displayCodearea: boolean;
    queryPreferWorker: boolean;
    previewSize: number;
};

export type DatatableState = DatatableSettings & {
    dexieTable?: Table;
    selectedTable?: number;
    target: AppTarget;
    columns: Column[];
    filters: Filter[];
    data: UnknownRecord[];
    selectorFields: string[];
    selected: Set<string | number>;
    offset: number;
    total: number;
    rowSelector?: unknown | unknown[];
    colResizing?: ColumnResizeData | undefined;
    firstrun: boolean;
    aborted: boolean;
    scrollPos: ScrollToOptions;
};

type ColumnResizeData = { startX: number; startWidth: number; index: number };

const Datatable = class {
    #state: DatatableState = this.emptyState;
    constructor() {
        messenger.register('queryResult', onQueryResult.bind(this));
        messenger.register('queryError', onQueryError.bind(this));
        messenger.register('refreshDatatable', this.refresh.bind(this));
    }
    update(diff: Partial<DatatableState>) {
        this.#state = { ...this.#state, ...diff };
    }
    get state() {
        return { ...this.#state };
    }
    get emptyState(): DatatableState {
        return {
            target: globalTarget,
            columns: [],
            filters: [],
            data: [],
            selectorFields: [],
            selected: new Set(),
            offset: 1,
            total: 0,
            firstrun: true,
            aborted: false,
            order: '',
            direction: 'asc',
            displayDiscoveredColumns: true,
            markUnindexed: true,
            limit: 20,
            confirmDeleteRow: true,
            displayCodearea: true,
            queryPreferWorker: true,
            previewSize: 30,
            scrollPos: { top: 0, left: 0 },
        };
    }
    get table(): KTable | undefined {
        if (this.#state.selectedTable !== undefined) {
            return appStore.table(this.#state.selectedTable);
        }
    }
    get columns() {
        return [...this.#state.columns];
    }
    get filters() {
        return [...this.#state.filters];
    }
    get breadcrumbIcons() {
        const selectedTable = this.#state.selectedTable;
        return typeof selectedTable === 'number'
            ? [
                  {
                      icon: 'tabler-settings',
                      title: 'table tools',
                      id: tableToolsButtonId,
                      '@click': tableToolsClicked.bind(null, selectedTable),
                  },
                  {
                      icon: 'tabler-adjustments',
                      title: 'table settings and configuration',
                      '@click': settingsConfigClicked,
                      id: 'settings-config',
                  },
              ]
            : [];
    }

    /**
     * onclick action when a new table is selected for the datatable view
     */
    async summon(selectedTable: number) {
        const table = appStore.table(selectedTable);
        if (!table) return;
        const target = appStore.target(selectedTable);
        const dexieTable = (await getConnection(target.database)).table(target.table);
        const settings = await this.getSettings(target);
        const selectorFields = rowSelectorFields(dexieTable);
        const initialState: DatatableState = {
            ...this.emptyState,
            ...settings,
            dexieTable,
            selectedTable,
            target,
            selectorFields,
            total: table.count, // filters applied
        };
        await jsCodearea.init({
            user: 'datatable',
            enabled: settings.displayCodearea && env.codeExecution,
            target,
            selectorFields,
            executed: codeareaExecuted,
            requireVariables: () => codeareaRequireVariables(datatable.state),
        });
        await checkScrubbler(target);
        await this.updateDatatable(initialState);
        appStore.update({ selectedTable });

        appWindow.externMoveHandler = {
            isTarget: moveTarget,
            start: columnResizeStart,
            moving: resizeColumn,
            stop: columnResizeStop,
        };
        appWindow.externKeyHandler = { down: onKeydown };
    }
    async refresh() {
        const settings = await this.getSettings(this.#state.target);
        this.updateDatatable({
            ...settings,
            firstrun: true,
        });
    }
    async getSettings(target: AppTarget): Promise<DatatableSettings> {
        const {
            values: { order, direction, displayDiscoveredColumns, previewSize },
        } = await ColumnsConfig.getSettings(target);
        const {
            values: { markUnindexed },
        } = await FiltersConfig.getSettings(target);
        const {
            values: {
                datatableRows,
                confirmDeleteRow,
                displayCodearea,
                queryPreferWorker,
            },
        } = await BehaviorConfig.getSettings(target);
        return {
            order,
            direction,
            displayDiscoveredColumns,
            markUnindexed,
            limit: datatableRows,
            confirmDeleteRow,
            displayCodearea,
            queryPreferWorker,
            previewSize,
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
                ${content} ${content ? jsCodearea.node() : ''}
            </div>
        `;
    }
    async updateDatatable(stateDiff: Partial<DatatableState>) {
        this.update(Object.assign(stateDiff, { data: [], total: 0 }));
        const {
            target,
            dexieTable,
            filters,
            order,
            direction,
            offset,
            limit,
            queryPreferWorker,
            firstrun,
        } = this.#state;
        appStore.update({
            loading: true,
            loadingMsg: 'loading data',
            loadingStop: this.abortQueryData,
        });
        const addUnnamedPk =
            dexieTable !== undefined && isPrimKeyUnnamed(dexieTable.schema.primKey);
        const load: QueryDataArgs = {
            dbname: target.database,
            tablename: target.table,
            addUnnamedPk,
            filters,
            order,
            direction,
            offset,
            limit: firstrun && limit < 50 ? 50 : limit,
            encodeQueryResult: env.bigIntArrayFlaw === true,
        };
        if (env.workersBlocked === true || queryPreferWorker === false) {
            const result = await queryData(load);
            await processQueryResult({ ...result, encoded: false });
        } else {
            messenger.post({ type: 'queryData', load });
        }
    }
    async reloadDatatable(stateDiff: Partial<DatatableState>) {
        if (appStore.loading === true) {
            await this.abortQueryData(true);
        }
        this.update({
            scrollPos: { left: appWindow.main.scrollLeft, top: appWindow.main.scrollTop },
        });
        await this.updateDatatable(stateDiff);
    }
    async setData({ data, total }: { data: UnknownRecord[]; total: number }) {
        const table = this.table;
        let { columns, filters } = this.#state;
        const {
            order,
            direction,
            limit,
            dexieTable,
            target,
            firstrun,
            displayDiscoveredColumns,
        } = this.#state;
        if (table === undefined || dexieTable === undefined) {
            messageStack.displayError(
                'Sorry, this is unexpected, but the datatable is not initialized correctly!',
            );
            return true;
        }
        if (firstrun) {
            const dataProps = getDataProperties(data);
            columns = columnsFromIndices(table, dataProps);
            data = addKeypathsData(data, columns);
            columns = columnsFromData(data, columns, displayDiscoveredColumns, firstrun);
            columns = await ColumnsConfig.restoreColumns(
                target,
                columns,
                importer.importedCsvHeads.get(target.table) || [],
                isPrimKeyNamed(table.primKey),
            );
            filters = await FilterFieldsConfig.restoreFilters(
                target,
                columns,
                dexieTable,
            );
            if (data.length > 0 && (isFiltered(filters) || order !== '')) {
                // reload data and datatable
                this.updateDatatable({
                    columns,
                    filters,
                    order,
                    direction,
                    firstrun: false,
                });
                return false;
            } else if (data.length > limit) {
                data = data.slice(0, limit);
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
    doLoading = async (func: () => unknown | Promise<unknown>) => {
        appStore.update({ loading: true, loadingMsg: 'loading data' });
        const res = await func();
        appStore.rerender({ loading: false });
        return res;
    };
};

const addKeypathsData = (data: UnknownRecord[], columns: Column[]) => {
    const paths = columns.filter((c) => c.innerValue === true).map((c) => c.name);
    return addNestedData(data, paths);
};

const addNestedData = (data: UnknownRecord[], paths: string[]) => {
    data.forEach((row) => {
        addNestedValues(row, paths);
    });
    return data;
};

const getDataProperties = (data: UnknownRecord[]) => {
    const props = [];
    for (const row of data) {
        props.push(...Object.getOwnPropertyNames(row));
    }
    return new Set(props);
};

const columnsFromData = (
    data: UnknownRecord[],
    columns: Column[],
    displayDiscoveredColumns: boolean,
    firstrun = false,
) => {
    const foundColumns: Column[] = [];
    const existingNames = columns.map((c) => c.name);
    data.forEach((_, idx) => {
        for (const key of Object.keys(data[idx])) {
            if (existingNames.indexOf(key) === -1) {
                foundColumns.push(
                    buildColumn({
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

const columnsFromIndices = (table: KTable, dataProps: Set<string>) => {
    const columns: Column[] = [];

    if (isPrimKeyNamed(table.primKey) && !isPrimKeyCompound(table.primKey)) {
        // primary key, not compound
        columns.unshift(
            buildColumn({ name: table.primKey.name, indexed: true, visible: true }),
        );
    }
    if (isPrimKeyUnnamed(table.primKey)) {
        // unnamed primary key
        columns.unshift(buildColumn({ name: '*key*', indexed: true, visible: true }));
    }
    table.indexes.forEach((index) => {
        // regular indexes
        if (!index.compound) {
            if (columns.some((c) => c.name === index.name) === false) {
                columns.push(
                    buildColumn({ name: index.name, indexed: true, visible: true }),
                );
            }
        } else if (Array.isArray(index.keyPath)) {
            columns.push(...columnsFromKeypath(index.keyPath, columns));
        }
    });
    if (isPrimKeyCompound(table.primKey) && Array.isArray(table.primKey.keyPath)) {
        // primary key, compound
        // checked at the end so that additional indices on the used fields are prioritized
        columns.push(...columnsFromKeypath(table.primKey.keyPath, columns));
    }

    for (const column of columns) {
        column.innerValue = !dataProps.has(column.name) && column.name.includes('.');
    }
    return columns;
};

const columnsFromKeypath = (keypath: string[], columns: Column[]) => {
    const cols: Column[] = [];
    let first = true;
    keypath.forEach((kp) => {
        if (-1 === columns.findIndex((c) => c.name === kp)) {
            columns.push(
                buildColumn({
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
const setColumnsWidths = (columns: Column[], data: UnknownRecord[]) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    if (ctx === null) {
        columns.map((column) => (column.width = 100));
    } else {
        const fonts = appWindow.fontFamily;

        // set widths to satisfy column headers
        ctx.font = `700 15px ${fonts}`;
        columns.forEach((col, idx) => {
            const text = ctx.measureText(col.name + ' △');
            columns[idx].width = Math.floor(text.width);
        });

        // required widths to satisfy the data
        const widths: number[] = [];
        ctx.font = `400 15px ${fonts}`;
        columns.forEach((col, idx) => {
            const columnVals = data.map((row) => row[col.name]);
            columnVals.forEach((val) => {
                const text = ctx.measureText(String(val));
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
            columns.forEach((_col, idx) => {
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
    }
    return columns;
};

/*
 * a filter value has changed -> validate and save the filter
 */
function onFilterChanged(this: HTMLInputElement) {
    const idx = parseInt(this.dataset.searchindex || '');
    const val = this.value.trim();
    const filters = datatable.filters;
    if (Number.isInteger(idx) && val !== filters[idx].search) {
        filters[idx].search = val;
        filters[idx].valid = isFilterValid(val, filters[idx]);
        FilterFieldsConfig.saveFilters(filters, appStore.target());
        datatable.update({ filters });
    }
}

/*
 * trigger search on Enter in a filter element
 */
function onFilterKeydown(this: HTMLInputElement, event: KeyboardEvent) {
    if (event.key === 'Enter') {
        onFilterChanged.bind(this)();
        doSearch();
    }
}

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
const navigate = (offset: number) => {
    const { total, limit, offset: previousOffset } = datatable.state;
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
function onColumnClicked(this: HTMLElement) {
    const colindex = this.closest('th')?.cellIndex;
    if (colindex !== undefined) {
        orderColumn(colindex);
    }
}

const onKeydown = (event: KeyboardEvent) => {
    const focused = appWindow.root.activeElement;
    if (
        event.key === 'Enter' &&
        focused instanceof HTMLAnchorElement &&
        focused.dataset.colindex
    ) {
        orderColumn(parseInt(focused.dataset.colindex));
    }
};

/**
 * click action of column headers
 */
let orderTimeout: number | null = null;
const orderColumn = (colindex: number) => {
    if (orderTimeout) {
        // it's a dblclick, handled by unsetOrder
        clearTimeout(orderTimeout);
        orderTimeout = null;
    } else {
        orderTimeout = window.setTimeout(() => {
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
    const selection = document.getSelection();
    if (selection) selection.empty();
    const orderDefaults = columnsDefaultOrder();
    datatable.reloadDatatable({
        offset: 1,
        ...orderDefaults,
    });
    ColumnsConfig.saveOrder(
        ...(Object.values(columnsDefaultOrder()) as [string, Direction]),
        appStore.target(),
    );
};

const moveTarget = (event: MouseEvent) => {
    return isResizeHandle(event.target) || datatable.state.colResizing !== undefined;
};

const columnResizeStart = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const index = parseInt(target.dataset?.colindex || '');
    const columns = visibleColumns(datatable.columns);
    if (columns[index]) {
        const colResizing = {
            index,
            startX: event.clientX,
            startWidth: visibleColumns(datatable.columns)[index].width,
        };
        datatable.update({ colResizing });
    }
};

const resizeColumn = (posX: number) => {
    const { columns, colResizing } = datatable.state;
    const { startX, startWidth, index } = colResizing!;
    const delta = posX - startX;
    visibleColumns(columns)[index].width = Math.max(20, startWidth + delta);
    handleWidthHandle(index - 1, 'visible');
    datatable.update({ columns });
    appStore.rerender();
};

const columnResizeStop = (event: Event) => {
    if (isResizeHandle(event.target) === false) {
        hideWidthHandles();
    }
    datatable.update({ colResizing: undefined });
    ColumnsConfig.saveColumns(datatable.columns, appStore.target());
    prepareDatatable();
};

const isResizeHandle = (node: EventTarget | null) => {
    return node instanceof HTMLDivElement && Object.hasOwn(node.dataset, 'colindex');
};

/*
 * display widthHandles while above the corresponding column
 */
type HeaderJob = 'visible' | 'hidden';
const onMouseOverHeader = (job: HeaderJob, event: Event) => {
    if (datatable.state.colResizing) {
        return;
    }
    const target = event.target as HTMLElement;
    const colIndex = target.closest('th')?.cellIndex;
    if (colIndex) {
        hideWidthHandles();
        handleWidthHandle(colIndex, job);
        if (colIndex > 0) {
            handleWidthHandle(colIndex - 1, job);
        }
    }
};
const handleWidthHandle = (index: number, job: HeaderJob) => {
    const handle = appWindow.root.querySelector<HTMLElement>(
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
    appWindow.root
        .querySelectorAll<HTMLElement>('div.width-handle')
        .forEach((handle) => (handle.style.visibility = 'hidden'));
};

/*
 * click handler for row icon "delete"
 * delete the row at idx from table
 */
const deleteRow = async (idx: number) => {
    const { dexieTable, selectorFields, selected, data, total, confirmDeleteRow } =
        datatable.state;
    if (!dexieTable) return;
    const pk = rowSelectorPrimKey(selectorFields, data[idx]);
    const stringFormatter = new ValueFormatter('string');
    const pk_str = stringFormatter.render(pk, t.getType(pk));
    const msg = `Sure to delete the row for primaryKey: ${pk_str}`;
    if (!confirmDeleteRow || window.confirm(msg)) {
        await dexieTable.delete(pk);
        selected.delete(rowSelector(selectorFields, data[idx]));
        datatable.updateDatatable({
            selected,
            total: total - 1,
        });
        appStore.update({}, { loadTable: dexieTable.name });
    }
};

/*
 * click handler for row icon "edit"
 * display a string 'table.update(pk, {})' in the js-textarea
 */
const editRow = (idx: number) => {
    const { selectorFields, data } = datatable.state;
    const dataRow = data[idx];
    const rowSelector = rowSelectorPrimKey(selectorFields, dataRow);
    const code = editRowCode(dataRow, selectorFields);

    datatable.update({ rowSelector });
    jsCodearea.update({
        enabled: true,
        code,
        savedIndex: -1,
        saved: false,
    });
    appStore.rerender();
};

const editRowCode = (dataRow: UnknownRecord, selectorFields: string[]) => {
    const { columns, dexieTable } = datatable.state;
    const hasUnnamedPK = dexieTable && isPrimKeyUnnamed(dexieTable.schema.primKey);
    let code: string;
    if (
        Object.getOwnPropertyNames(dataRow).length === 2 &&
        hasUnnamedPK &&
        Object.hasOwn(dataRow, '*value*')
    ) {
        // row of key-value store
        const item = editValue('*value*', dataRow['*value*']);
        const key = editValue('*key*', dataRow['*key*']);
        code = `table.put(${item}, ${key})`;
    } else {
        const items: string[] = editObjectItems(dataRow, selectorFields, columns, false);
        if (hasUnnamedPK) {
            // row with unnamed PK
            const key = editKey(selectorFields, dataRow);
            code = `table.put({
    ${items.join(',\n    ')}
}, ${key})`;
        } else {
            // row with inbound PK
            items.unshift(...editObjectItems(dataRow, selectorFields, columns, true));
            code = `table.put({
    ${items.join(',\n    ')}
});`;
        }
    }
    return code;
};
const editObjectItems = (
    dataRow: UnknownRecord,
    selectorFields: string[],
    columns: Column[],
    forSelector: boolean,
) => {
    const items: string[] = [];
    editableColumns(columns).forEach((col) => {
        if (
            Object.hasOwn(dataRow, col.name) &&
            ((forSelector === false && !selectorFields.includes(col.name)) ||
                (forSelector === true && selectorFields.includes(col.name)))
        ) {
            const prop = t.maybeQuotedProperty(col.name);
            const val = editValue(col.name, dataRow[col.name]);
            items.push(`${prop}: ${val}`);
        }
    });
    return items;
};
const editValue = (name: string, val: unknown) => {
    const type = t.getType(val) as (typeof t.typesFromRow)[number];
    const sourceFormatter = new ValueFormatter('source');
    return t.typesFromRow.includes(type)
        ? editValueFromRow(name)
        : sourceFormatter.render(val, type);
};
const editKey = (selectorFields: string[], dataRow: UnknownRecord) => {
    return selectorFields.length === 1
        ? editValue(selectorFields[0], dataRow[selectorFields[0]])
        : `[${selectorFields.map((name) => editValue(name, dataRow[name])).join(', ')}]`;
};
const editValueFromRow = (name: string) => {
    return t.isUnquotedPropertyName(name) ? `row.${name}` : `row["${name}"]`;
};

/**
 * click handler to select/deselect table rows, or to edit/delete the datasets
 */
const tbodyClicked = (event: MouseEvent) => {
    const target = event.target as Element;
    const tr = target.closest('tr');
    const td = target.closest('td');
    if (target.nodeName === 'A' || tr === null || td === null) {
        return;
    }
    const idx = tr.rowIndex - 1;
    if (idx < 0) {
        return;
    }
    if (td.classList.contains('row-icons')) {
        if (target.closest('button')?.classList.contains('delete')) {
            deleteRow(idx);
        } else {
            editRow(idx);
        }
    } else if (td.classList.contains('editable')) {
        const span = td.firstElementChild;
        if (
            span instanceof HTMLSpanElement &&
            editValueIconClicked(span, event.clientX)
        ) {
            const rect = valueContainerRect(span);
            const xOffset = td.classList.contains('aright') ? 15 : 5;
            const anchorPosition = {
                x: rect.right + xOffset,
                y: (rect.top + rect.bottom) / 2,
            };
            const absent = span.dataset.absent === '1';
            editCellValue(tr.rowIndex - 1, td.cellIndex, anchorPosition, absent);
        } else {
            tr.classList.toggle('hilight');
            toggleSelected(idx);
        }
    }
};

const editValueIconClicked = (span: HTMLElement, x: number) => {
    const iconWidth = 17;
    const rect = valueContainerRect(span);
    return x >= rect.right && x <= rect.right + iconWidth;
};

const valueContainerRect = (span: HTMLElement) => {
    const hasPreview = span.firstElementChild?.classList.contains('preview-wrapper');
    return hasPreview
        ? span.firstElementChild!.getBoundingClientRect()
        : span.getBoundingClientRect();
};

const editCellValue = (
    rowIndex: number,
    cellIndex: number,
    anchorPosition: Position,
    absent: boolean,
) => {
    const { data, columns, target, selectorFields } = datatable.state;
    const column = visibleColumns(columns)[cellIndex].name;
    const value = structuredClone(data[rowIndex][column]);
    const rowSelector = rowSelectorPrimKey(selectorFields, data[rowIndex]);
    datatable.update({ rowSelector });
    displayValueEditor({
        target,
        selectorFields,
        rowSelector,
        requireVariables: () => codeareaRequireVariables(datatable.state),
        fieldName: columns[cellIndex].name,
        innerValue: columns[cellIndex].innerValue,
        value,
        absent,
        anchorPosition,
    });
};

/**
 * invert datatable.state.selected for given data index
 */
const toggleSelected = (idx: number) => {
    const { selected, selectorFields, data } = datatable.state;
    if (selectorFields.length > 0) {
        const selector = rowSelector(selectorFields, data[idx]);
        if (selected.has(selector)) {
            selected.delete(selector);
        } else {
            selected.add(selector);
        }
        datatable.update({ selected });
        appStore.rerender();
    }
};

const visibleColumns = (columns: Column[]) =>
    columns.filter((col) => col.visible === true);
const hiddenColumns = (columns: Column[]) =>
    columns.filter((col) => col.visible === false);
const editableColumns = (columns: Column[]) =>
    columns.filter((col) => col.name !== '*key*' && col.innerValue === false);

const headlineView = (table: KTable) => {
    return html`
        Table
        <i>${escapeUnicode(table.name)}</i>
        has ${table.count} record${table.count === 1 ? '' : 's'} in total
    `;
};

const datatableView = (tstate: DatatableState) => {
    const { columns, data, total, offset, limit, colResizing, firstrun, aborted } =
        tstate;
    if (firstrun) return;
    const visColumns = visibleColumns(columns);
    const dtrows: TemplateResult[] = [];
    data.forEach((rdata) => dtrows.push(rowView(rdata, visColumns, tstate)));
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

/**
 * called after the table is rendered into the DOM, so that,
 * depending on the width, css classes can be added to the table cells
 */
const prepareDatatable = () => {
    setTimeout(() => {
        const tds = appWindow.root.querySelectorAll('table.datatable td.editable');
        tds.forEach((td) => {
            const span = td.firstElementChild;
            if (span instanceof HTMLSpanElement === false) return;
            const hasPreview = !!span.querySelector('div.preview-box');
            const isOverflowing = span.offsetWidth > td.clientWidth - 19;
            td.classList[isOverflowing && !hasPreview ? 'add' : 'remove']('oright');
        });
    }, 0);
};

const colHeaderView = (columns: Column[], order: string, direction: Direction) => {
    const cells = [];
    columns.forEach((column) => {
        const content =
            order === column.name
                ? html`<div class=th-container>
                     <div class=th-title>${column.name}</div>
                     <div class=th-icon>${direction === 'asc' ? '▽' : '△'}</div>
                   </div`
                : html`
                      ${column.name}
                  `;
        cells.push(html`
            <th
                width="${column.width}px"
                @dblclick=${unsetOrder}
                @mouseenter=${onMouseOverHeader.bind(null, 'visible')}
                @mouseleave=${onMouseOverHeader.bind(null, 'hidden')}
            >
                <a title="change sort order" tabindex="0" @click=${onColumnClicked}>
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
    let tpl: TemplateResult | undefined;
    const hcols = hiddenColumns(datatable.columns);
    if (hcols.length) {
        tpl = html`
            <span @mouseover=${hciMouseOver}>(${hcols.length})</span>
        `;
    }
    return tpl;
};

const hciMouseOver = (event: Event) => {
    tooltip.show({
        view: hiddenColumnsTooltipView,
        anchor: event.target as HTMLElement,
    });
};

const hiddenColumnsTooltipView = () => {
    const hcols = hiddenColumns(datatable.state.columns);
    const known = hcols.filter((c) => c.discoveredTS === null).map((c) => c.name);
    const added = hcols
        .filter((c) => c.discoveredTS && c.discoveredTS > 0)
        .sort((a, b) => a.discoveredTS! - b.discoveredTS!)
        .map((c) => c.name);

    let addedP: TemplateResult | undefined;
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

    let knownP: TemplateResult | undefined;
    if (known.length > 0) {
        const str1 = known.length === 1 ? ' is' : 's are';
        knownP = html`
            <p>
                ${known.length} ${addedP ? 'more ' : ''} column${str1} hidden:
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

const listSomeColumns = (cols: string[], num: number) => html`
    <i>${unsafeHTML(cols.slice(0, num).join('</i>, <i>'))}</i>
    ${moreColumnsAdd(cols)}
`;

const moreColumnsAdd = (cols: string[]) =>
    cols.length > 3 ? ` and ${cols.length - 3} more` : '';

const configureHiddenColumns = (event: Event) => {
    event.stopPropagation();
    displayConfigControl({
        target: appStore.target(),
        realm: 'columns',
        anchorId: 'settings-config',
    });
    tooltip.close();
};

const displayAddedColumns = () => {
    tooltip.close();
    const columns = datatable.columns;
    columns.forEach((col, idx) => {
        if (col.discoveredTS !== null) {
            columns[idx].visible = true;
            columns[idx].discoveredTS = null;
        }
    });
    datatable.updateDatatable({ columns });
};

const tableWidth = (columns: Column[]) =>
    columns.reduce((sum, col) => sum + col.width + 10, 0); // 10px padding per column

const headerResizeHandles = (columns: Column[], resizeIndex?: number) => {
    const handles: TemplateResult[] = [];
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

const rowView = (rdata: UnknownRecord, columns: Column[], tstate: DatatableState) => {
    const cells: TemplateResult[] = [];
    columns.forEach((col) => {
        let value: TemplateResult | string = '',
            type: AllowedType = 'string',
            absent;
        if (Object.hasOwn(rdata, col.name)) {
            type = t.getType(rdata[col.name]);
            value = display(rdata[col.name], type, {
                format: col.format,
                previewSize: tstate.previewSize,
            });
        } else {
            absent = '1';
        }
        cells.push(html`
            <td class=${cellClasses(type, col.name) || nothing}>
                <span data-absent="${absent ?? nothing}">${value}</span>
            </td>
        `);
    });
    cells.push(html`
        <td class="row-icons">${rowIcons()}</td>
    `);
    const selector = rowSelector(tstate.selectorFields, rdata);
    const trclass = tstate.selected.has(selector) ? 'hilight' : '';
    return html`
        <tr class=${trclass || nothing}>${cells}</tr>
    `;
};

const cellClasses = (type: AllowedType, name: string) => {
    const classes = [];
    if (name !== '*key*') {
        classes.push('editable');
    }
    if (['number', 'bigint'].includes(type)) {
        classes.push('aright', 'colored-number');
    } else if (type === 'string') {
        classes.push('colored-string');
    } else if (['null', 'undefined', 'boolean'].includes(type)) {
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

const noResultView = (noData: boolean, loading: boolean, aborted: boolean) => {
    return noData === false ? '' : aborted ? abortedView() : noFilterResultView(loading);
};

const noFilterResultView = (loading: boolean) => {
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

const navigationView = ({
    limit,
    offset,
    total,
}: {
    limit: number;
    offset: number;
    total: number;
}) => {
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

const searchfieldsView = ({
    filters,
    markUnindexed,
}: {
    filters: Filter[];
    markUnindexed: boolean;
}) => {
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
    const searchfields: TemplateResult[] = [];
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

const searchfieldView = (filter: Filter, idx: number, markUnindexed: boolean) => {
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

const searchEmptyOptions = (fname: string) => ({
    '': '',
    yes: `${fname} is empty`,
    no: `${fname} not empty`,
});

const tableToolsButtonId = 'table-tools-button-id';
const tableToolsClicked = (tableIdx: number) => {
    tableTools.summon(tableIdx, tableToolsButtonId);
};

const settingsConfigClicked = () => {
    displayConfigControl({
        target: appStore.target(),
        anchorId: 'settings-config',
    });
};

const onQueryResult = async (message: Message) => {
    if (message.type === 'queryResult') {
        processQueryResult(structuredClone(message.result));
    }
};

const processQueryResult = async (payload: QueryResultMessagePayload) => {
    if (payload.encoded === true) {
        payload.data = decodeQueryResult(payload.data);
    }
    payload = sanitizeQueryPayload(payload);
    const ready = await datatable.setData(payload);
    if (ready) {
        requestAnimationFrame(() => appWindow.main.scrollTo(datatable.state.scrollPos));
        appStore.update({ loading: false, loadingMsg: '', loadingStop: null });
        prepareDatatable();
    }
};

const sanitizeQueryPayload = (payload: QueryResultMessagePayload) => {
    let cnt = 0;
    // this has happened on chrome for rows containing RTCCerticate values
    payload.data = payload.data.filter((row) => {
        if (row === null) cnt++;
        return row !== null;
    });
    payload.total -= cnt;

    const displayWarning = !getHiddenMessagesOrigin().includes('incompleteQueryResult');
    if (cnt > 0 && displayWarning) {
        const s1 = cnt > 1 ? 's' : '';
        const s2 = cnt > 1 ? '' : 's';
        const content = `The displayed data is incomplete:
No results were returned when querying ${cnt} data record${s1}.
This may be because the dataset${s1} contain${s2} RTCCertificate values.`;
        const checkbox = {
            label: "don't show this message again for this origin",
            '@change': hideMessageType.bind(null, 'incompleteQueryResult'),
        };
        messageStack.displayWarning(content, { checkbox });
    }
    return payload;
};

const onQueryError = (message: Message) => {
    if (message.type === 'queryError') {
        const errorText =
            typeof message.error === 'string'
                ? message.error
                : message.error.message.split('\n').shift();
        messageStack.displayError(`Error querying data: ${errorText}`);
    }
};

const codeareaRequireVariables = (state: DatatableState) => {
    const { rowSelector, selectorFields, data } = state;
    return {
        selected: structuredClone(state.selected),
        row: structuredClone(getEditRow({ rowSelector, selectorFields, data })),
    };
};

const getEditRow = ({
    rowSelector,
    selectorFields,
    data,
}: {
    rowSelector: unknown;
    selectorFields: string[];
    data: UnknownRecord[];
}) => {
    if (rowSelector !== undefined) {
        if (!Array.isArray(rowSelector)) {
            rowSelector = [rowSelector];
        }
        for (const row of data) {
            if (
                selectorFields.every(
                    (field, idx) => row[field] === (rowSelector as Array<unknown>)[idx],
                )
            ) {
                return row;
            }
        }
    }
};

const codeareaExecuted = async () => {
    if (datatable.state.displayCodearea === false) {
        jsCodearea.disable();
    }
    datatable.reloadDatatable({});
};

const datatable = new Datatable();
export default datatable;
