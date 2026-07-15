/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */
import type { Table } from 'dexie';
import { html, type TemplateResult } from 'lit-html';

import configLayer from '#components/configlayer';
import exporter from '#components/exporter';
import datatable, { type DatatableState } from '#components/datatable';
import appStore from '#lib/app-store';
import { symbolButton } from '#lib/button';
import checkbox from '#lib/checkbox';
import {
    collectionToArray,
    dexieExportFilter,
    getCollection,
    isPrimKeyUnnamed,
} from '#lib/dexie-utils';
import { applyFilters } from '#lib/querydata';
import svgIcon from '#lib/svgicon';
import { rowSelector } from '#lib/row-selection';
import { scrubblerDelete, scrubblerTopic } from '#lib/scrubbler';
import { resolvePath } from '#lib/utils';
import type { Filter, UnknownRecord } from '#types';

const summon = (anchorId: string) => {
    const { target, dexieTable, selectorFields, selected } = datatable.state;
    if (!dexieTable) return;
    exporter.init({
        usage: 'selection',
        target,
        dexieExportFilter: dexieExportFilter(dexieTable, selectorFields, selected),
    });
    configLayer.show({
        view,
        anchorId,
        confirmed: {
            delete: deleteSelection,
            scrubblerDelete: scrubblerDelete.bind(dexieTable.name),
        },
    });
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
    if (!dexieTable) return;
    const collection = getCollection({
        dexieTable: dexieTable,
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
    const { table } = datatable.state.target;
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
        ${scrubblerTopic(topic, count, loading)}
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
    data: UnknownRecord[];
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
async function allSelectedChanged(this: HTMLInputElement) {
    return datatable.doLoading(async () => {
        const tstate: any = datatable.state;
        const selected: Set<string | number> = new Set();
        if (this.checked) {
            const data = await getSelectableData(tstate);
            data.forEach((row) => {
                const selector = rowSelector(tstate.selectorFields, row);
                selected.add(selector);
            });
        }
        datatable.update({ selected });
    });
}

/*
 * change event handler of 'select page' checkbox
 */
const pageSelectedChanged = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement === false) return;
    const selectPage = target.checked;
    const { selected, selectorFields, data } = datatable.state;
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
    if (!dexieTable) return;
    return datatable.doLoading(async () => {
        const inverted: Set<string | number> = new Set();
        const data = await getSelectableData({
            dexieTable: dexieTable,
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
