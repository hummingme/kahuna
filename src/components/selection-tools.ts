/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */
import type { Collection, Table } from 'dexie';
import { html, type TemplateResult } from 'lit-html';
import configLayer from './configlayer.ts';
import exporter from './exporter.ts';
import datatable, { DatatableState } from './datatable.ts';
import appStore from '../lib/app-store.ts';
import { symbolButton } from '../lib/button.ts';
import checkbox from '../lib/checkbox.ts';
import {
    isPrimKeyUnnamed,
    collectionToArray,
    getCollection,
} from '../lib/dexie-utils.ts';
import type { Filter } from '../lib/filter.ts';
import { applyFilters } from '../lib/querydata.ts';
import svgIcon from '../lib/svgicon.ts';
import { rowSelector } from '../lib/row-selection.ts';
import { addNestedValues, removeNestedValues, resolvePath } from '../lib/utils.ts';
import type { PlainObject } from '../lib/types/common.ts';

const summon = (anchorId: string) => {
    const { target, dexieTable, selectorFields, selected } = datatable.state;
    exporter.init({
        usage: 'selection',
        target,
        dexieExportFilter: dexieExportFilter(
            dexieTable as Table,
            selectorFields,
            selected,
        ),
    });
    configLayer.show({
        view,
        anchorId,
        confirmed: {
            delete: deleteSelection,
        },
    });
};

const dexieExportFilter = (
    dexieTable: Table,
    selectorFields: string[],
    selected: Set<string | number>,
) => {
    const pkUnnamed = isPrimKeyUnnamed(dexieTable.schema.primKey);
    const paths = selectorFields.filter((sf) => sf.includes('.'));
    if (pkUnnamed) {
        return (dtable: string, _values: any, key: any) => {
            return dtable === dexieTable.name && selected.has(`${key}`);
        };
    } else if (paths.length === 0) {
        return (dtable: string, values: any, _key: any) => {
            const selector = rowSelector(selectorFields, values);
            return dtable === dexieTable.name && selected.has(selector);
        };
    } else {
        // paths.length > 0
        return (dtable: string, values: any, _key: any) => {
            values = addNestedValues(values, paths);
            const selector = rowSelector(selectorFields, values);
            values = removeNestedValues(values, paths);
            return dtable === dexieTable.name && selected.has(selector);
        };
    }
};

const invertSelection = async () => {
    const selected = (await invert(datatable.state)) as Set<string | number>;
    datatable.update({ selected });
    configLayer.close();
};

const clearSelection = () => {
    datatable.update({ selected: new Set() });
    configLayer.close();
};

const deleteSelection = async () => {
    const { dexieTable, selectorFields, selected, total } = datatable.state;
    const collection = getCollection({
        dexieTable: dexieTable as Table,
        selectorFields,
        selected,
    });
    const deleted = await collection.delete();
    datatable.updateDatatable({
        selected: new Set(),
        total: total - deleted,
    });
    appStore.update({}, { loadTable: datatable.table!.name });
    configLayer.close({ rerenderApp: false });
};

const view = (): TemplateResult => {
    const { loading } = appStore.state;
    const { database, table } = datatable.state.target;
    const count = datatable.state.selected.size;
    const topic = configLayer.topic;
    return html`
        <p>
            <a @click=${invertSelection} data-topic="invert">
                ${svgIcon('tabler-switch')}
                <label>invert selection</label>
            </a>
        </p>
        <p>
            <a @click=${clearSelection} data-topic="clear">
                ${svgIcon('tabler-eraser')}
                <label>clear selection</label>
            </a>
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="delete">
                ${svgIcon('tabler-trash')}
                <label>delete selected rows</label>
            </a>
            ${topic == 'delete'
                ? configLayer.confirmOption(
                      `Delete ${count} selected rows from table`,
                      table,
                      loading,
                  )
                : ''}
        </p>
        <p>
            <a @click=${configLayer.onTopicClicked} data-topic="export">
                ${svgIcon('tabler-upload')}
                <label>export data</label>
            </a>
            ${topic == 'export' ? exporter.panel() : ''}
        </p>
    `;
};

/*
 * displayed beneath of datatable view
 */
const controls = ({
    data,
    selected,
    selectorFields,
    total,
}: {
    data: PlainObject[];
    selected: Set<string | number>;
    selectorFields: string[];
    total: number;
}): TemplateResult | string => {
    if (total === 0 && selected.size === 0) {
        return '';
    }
    const isAllSelected = total > 0 && total === selected.size;
    const isPageSelected = Array.from(Array(data.length).keys()).every((idx) => {
        const selector = rowSelector(selectorFields, data[idx]);
        return selected.has(selector);
    });
    const anchorId = `selection-tools-button-id`;
    const toolsButton = symbolButton({
        icon: 'tabler-settings',
        title: 'selection tools',
        id: anchorId,
        '@click': () => summon(anchorId),
    });
    const info =
        selected.size > 0
            ? html`
                  , ${selected.size} rows selected ${toolsButton}
              `
            : '';
    const pageSelectCb =
        data.length < total
            ? checkbox({
                  label: 'select page',
                  checked: isPageSelected,
                  '@change': pageSelectedChanged,
              })
            : '';
    const allSelectCb = checkbox({
        label: `select all  (${total})`,
        checked: isAllSelected,
        '@change': allSelectedChanged,
    });
    return html`
        <div id="selection-info">${allSelectCb} ${pageSelectCb} ${info}</div>
    `;
};

/*
 * change event handler of 'select all' checkbox
 */
const allSelectedChanged = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    return datatable.doLoading(async () => {
        const tstate: any = datatable.state;
        const selected: Set<string | number> = new Set();
        if (target.checked) {
            const data = await getSelectableData(tstate);
            data.forEach((row) => {
                const selector = rowSelector(tstate.selectorFields, row);
                selected.add(selector);
            });
        }
        datatable.update({ selected });
    });
};

/*
 * change event handler of 'select page' checkbox
 */
const pageSelectedChanged = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const selectPage = target.checked;
    const { selected, selectorFields, data } = datatable.state as any;
    if (selectorFields.length > 0) {
        for (let idx = 0; idx < data.length; idx++) {
            const selector = rowSelector(selectorFields, data[idx]);
            if (selectPage) {
                selected.add(selector);
            } else {
                selected.delete(selector);
            }
        }
        datatable.update({ selected });
        appStore.rerender();
    }
};

/**
 * used by selection-tools: invertSelection
 */
const invert = async (tstate: DatatableState) => {
    const { dexieTable, filters, selectorFields, selected } = tstate;
    return datatable.doLoading(async () => {
        const inverted: Set<string | number> = new Set();
        const data = await getSelectableData({
            dexieTable: dexieTable as Table,
            filters,
            selectorFields,
        });
        data.forEach((row) => {
            const selector = rowSelector(selectorFields, row);
            if (selected.has(selector) === false) {
                inverted.add(selector);
            }
        });
        return inverted;
    });
};

/**
 * get data required to identify the datasets to select
 * by allSelectedChanged and invertSelection
 */
const getSelectableData = async ({
    dexieTable,
    filters,
    selectorFields,
}: {
    dexieTable: Table;
    filters: Filter[];
    selectorFields: string[];
}) => {
    const collection = applyFilters(dexieTable, filters);
    const data = await collectionToArray(
        collection,
        isPrimKeyUnnamed(dexieTable.schema.primKey),
    );
    const nested = selectorFields.filter((sf) => sf.includes('.'));
    nested.forEach((path) => {
        data.forEach((row, idx) => {
            data[idx][path] = resolvePath(row, path);
        });
    });

    return data;
};

const SelectionTools = {
    controls,
};

export default SelectionTools;
