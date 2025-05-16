/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import configLayer from './configlayer.js';
import exporter from './exporter.js';
import datatable from './datatable.js';
import appStore from '../lib/app-store.js';
import { symbolButton } from '../lib/button.js';
import checkbox from '../lib/checkbox.js';
import { getCollection } from '../lib/dexie-utils.js';
import { applyFilters } from '../lib/querydata.js';
import svgIcon from '../lib/svgicon.js';
import { rowSelector } from '../lib/row-selection.js';
import { addNestedValues, removeNestedValues, resolvePath } from '../lib/utils.js';
import { isPrimKeyUnnamed, collectionToArray } from '../lib/dexie-utils.js';

const summon = (anchorId) => {
    const { target, dexieTable, selectorFields, selected } = datatable.state;
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
        },
    });
};

const dexieExportFilter = (dexieTable, selectorFields, selected) => {
    const pkUnnamed = isPrimKeyUnnamed(dexieTable.schema.primKey);
    const paths = selectorFields.filter((sf) => sf.includes('.'));
    if (pkUnnamed) {
        return (dtable, _values, key) => {
            return dtable === dexieTable.name && selected.has(`${key}`);
        };
    } else if (paths.length === 0) {
        return (dtable, values, _key) => {
            const selector = rowSelector(selectorFields, values);
            return dtable === dexieTable.name && selected.has(selector);
        };
    } else {
        // paths.length > 0
        return (dtable, values, _key) => {
            values = addNestedValues(values, paths);
            const selector = rowSelector(selectorFields, values);
            values = removeNestedValues(values, paths);
            return dtable === dexieTable.name && selected.has(selector);
        };
    }
};

const invertSelection = async () => {
    const selected = await invert(datatable.state);
    datatable.update({ selected });
    configLayer.close();
};

const clearSelection = () => {
    datatable.update({ selected: new Set() });
    configLayer.close();
};

const deleteSelection = async () => {
    const tstate = datatable.state;
    const collection = loadCollection(tstate);
    const deleted = await collection.delete();
    datatable.updateDatatable({
        selected: new Set(),
        total: tstate.total - deleted,
    });
    appStore.update({ tables: datatable.table.name });
    configLayer.close();
};

const view = () => {
    const { datatable, loading } = appStore.state;
    const topic = configLayer.fromState('topic');
    const tstate = datatable.state;
    const tablename = datatable.table.name;
    const count = datatable.state.selected.size;
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
                      tablename,
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

const lastfmDeleteAutomaticEdits = async () => {
    const collection = loadCollection(datatable.state);
    await lastfmDeleteAutomaticEditsSelection(collection);
    datatable.updateDatatable({
        selected: new Set(),
    });
    configLayer.close();
};

const lastfmDeleteAutomaticEditsSelection = async (selection) => {
    const rows = await selection.toArray();
    const ids = rows.map((r) => r.id);
    await datatable.state.dexieDb.table('jobs').put({
        job: 'deleteEdits',
        state: 'waiting',
        data: { ids },
        modified: Date.now(),
    });
    return ids.length;
};

/*
 * displayed beneath of datatable view
 */
const controls = ({ data, selected, selectorFields, total }) => {
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
                  changeFunc: pageSelectedChanged,
              })
            : '';
    const allSelectCb = checkbox({
        label: `select all  (${total})`,
        checked: isAllSelected,
        changeFunc: allSelectedChanged,
    });
    return html`
        <div id="selection-info">${allSelectCb} ${pageSelectCb} ${info}</div>
    `;
};

/*
 * change event handler of 'select all' checkbox
 */
const allSelectedChanged = async (ev) => {
    return datatable.doLoading(async () => {
        const tstate = datatable.state;
        const selected = new Set();
        if (ev.target.checked) {
            const data = await getSelectableData(tstate);
            data.forEach((row) => {
                const selector = rowSelector(tstate.selectorFields, row);
                selected.add(selector);
            });
        }
        datatable.update({ selected });
    }, 'allSelectedChanged');
};

/*
 * change event handler of 'select page' checkbox
 */
const pageSelectedChanged = (ev) => {
    const selectPage = ev.target.checked;
    const { selected, selectorFields, data } = datatable.state;
    if (selectorFields.length > 0) {
        for (let idx = 0; idx < data.length; idx++) {
            const selector = rowSelector(selectorFields, data[idx]);
            selectPage ? selected.add(selector) : selected.delete(selector);
        }
        datatable.update({ selected });
        appStore.rerender();
    }
};

/**
 * used by selection-tools: invertSelection
 */
const invert = async (tstate) => {
    const { selectorFields, selected } = tstate;
    return datatable.doLoading(async () => {
        const inverted = new Set();
        const data = await getSelectableData(tstate);
        data.forEach((row) => {
            const selector = rowSelector(selectorFields, row);
            if (selected.has(selector) === false) {
                inverted.add(selector);
            }
        });
        return inverted;
    }, 'SelectionTools.invert');
};

/**
 * get data required to identify the datasets to select
 * by allSelectedChanged and invertSelection
 */
const getSelectableData = async ({ dexieTable, filters, selectorFields }) => {
    const collection = await applyFilters({ dexieTable, filters });
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

const loadCollection = ({ dexieTable, selected, selectorFields }) => {
    return datatable.doLoading(() => {
        return getCollection({ dexieTable, selected, selectorFields });
    }, 'SelectionTools.loadCollection');
};

const SelectionTools = {
    controls,
};

export default SelectionTools;
