/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, type TemplateResult } from 'lit-html';
import { nothing } from 'lit';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { type IndexSpec } from 'dexie';

import appWindow from '#components/app-window';
import Database from '#components/database';
import Layer from '#components/layer';
import messageStack from '#components/messagestack';
import { button, symbolButton } from '#components/parts/button';
import textinput from '#components/parts/textinput';
import appStore from '#lib/app-store';
import { globalTarget } from '#lib/app-target';
import { getConnection } from '#lib/connection';
import Draggable from '#lib/draggable';
import { print, escapeUnicode, unescapeString } from '#lib/escape-string';
import { uniqueId } from '#lib/utils';
import { validateIndexes, validatePrimKey } from '#lib/validations';
import {
    AppTarget,
    EMPTY_POSITION,
    type Position,
    type Schema,
    type Textinput,
} from '#types';

type SchemaEditorState = {
    target: AppTarget;
    visible: boolean;
    node?: HTMLElement;
    position: Position;
    anchorPosition: Position;
    tables: TableProps[];
    rememberedTables: TableProps[];
    addedTables: TableProps[];
};

type TableProps = {
    name: string; // the name of existing tables, `table-${uniqueId()}` for added tables
    tablename: string; // as entered into the name input field for added tables
    pk: string;
    indexes: string;
    invalid: Set<'name' | 'indexes' | 'pk'>;
    deleted: boolean;
};

const state = Symbol('schema-editor state');

class SchemaEditor {
    [state]: SchemaEditorState;
    #layer;
    #executeButton: Ref<HTMLButtonElement> = createRef();
    #rowHeight: string | undefined;
    constructor() {
        this[state] = this.initState;
        const DraggableLayer = Draggable(Layer);
        this.#layer = new DraggableLayer({
            closeHandler: this.close.bind(this),
            resizeHandler: this.fixPosition.bind(this),
        });
    }
    get initState(): SchemaEditorState {
        return {
            target: globalTarget,
            visible: false,
            position: EMPTY_POSITION,
            anchorPosition: EMPTY_POSITION,
            tables: [],
            rememberedTables: [],
            addedTables: [],
        };
    }
    update(changes: Partial<SchemaEditorState>) {
        this[state] = { ...this[state], ...changes };
        this.render();
    }
    async show(target: AppTarget): Promise<void> {
        const layer = this.#layer;
        this[state].target = target;
        const tables = await this.getTables(target.database);
        const anchorNode = appWindow.win.querySelector(
            'nav#toolbar button:nth-of-type(2)',
        );
        const anchorPosition = anchorNode
            ? layer.anchorPosition(anchorNode)
            : EMPTY_POSITION;
        const position = layer.calculatePosition(anchorPosition, this[state].node);
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        layer.addEscLayerHandler();
        layer.addClickWindowHandler(appWindow.win);
        layer.addResizeHandler();
        this.update({
            visible: true,
            tables,
            rememberedTables: structuredClone(tables),
            position,
            anchorPosition,
        });
        appStore.rerender();
    }
    fixPosition(): void {
        if (this[state].node === undefined) return;
        if (this.#layer.wasDragged) return;
        const position = this.#layer.calculatePosition(
            this[state].anchorPosition,
            this[state].node,
        );
        this[state].node.style.top = `${position.y}px`;
        this[state].node.style.left = `${position.x}px`;
    }
    close(): void {
        if (this[state].visible === true) {
            this.update(this.initState);
            this.#layer.removeEscLayerHandler();
            this.#layer.removeClickWindowHandler(appWindow.win);
            this.#layer.removeResizeHandler();
            appWindow.addInputHandler();
            appWindow.hideOverlay();
            appStore.rerender();
        }
    }
    async getTables(databaseName: string): Promise<TableProps[]> {
        const handle = await getConnection(databaseName);
        const tables: TableProps[] = [];
        for (const table of handle.tables) {
            const indexes = [
                ...table.schema.indexes.map((idx: IndexSpec) => idx.src),
            ].join(',');
            tables.push(
                this.tableProps({
                    name: table.name,
                    pk: table.schema.primKey.src,
                    indexes,
                }),
            );
        }
        return tables;
    }
    tableProps(initial: Partial<TableProps> = {}): TableProps {
        return {
            name: '',
            tablename: '',
            pk: '',
            indexes: '',
            invalid: new Set(),
            deleted: false,
            ...initial,
        };
    }
    tableIndex(tables: TableProps[], name: string): number {
        return tables.findIndex((table) => table.name === name);
    }
    node(): TemplateResult | string {
        const top = `${this[state].position.y}px`;
        const left = `${this[state].position.x}px`;
        const maxHeight = `${window.innerHeight - 17}px`;
        return this[state].visible
            ? html`
                  <div
                      id="schema-editor"
                      class="layer"
                      style=${styleMap({ top, left, maxHeight })}
                      ${ref(this.nodeReady.bind(this))}
                  ></div>
              `
            : '';
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLElement) {
            this[state].node = node;
            this.#layer.makeDraggable(node);
            this.render();
            setTimeout(() => {
                this.#rowHeight = `${node.querySelector('tbody>tr')?.clientHeight}px`;
            }, 0);
        }
    }
    render() {
        if (this[state].node) {
            render(this.view(), this[state].node);
        }
    }
    view(): TemplateResult | string {
        const { tables, target, visible } = this[state];
        if (visible === false) return '';

        const tableRows = tables.map((table) =>
            table.deleted ? this.deletedTableRow(table.name) : this.tableRow(table),
        );
        const addButton = symbolButton({
            icon: 'tabler-square-rounded-plus',
            title: 'add table',
            classes: ['right'],
            '@click': this.addTable.bind(this),
        });
        return html`
            <div class="stage">
                <h1 class="precis">
                    Edit schema of database
                    <em>${print(target.database)}</em>
                </h1>
                <form id="schema-form">
                    <table>
                        <thead>
                            <tr>
                                <th>Tablename</th>
                                <th>Primary Key</th>
                                <th>indexes</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows} ${this.addedRows()}
                            <tr>
                                <td class="add-table" colspan="4">${addButton}</td>
                            </tr>
                        </tbody>
                    </table>
                </form>
            </div>
            <div class="button-wrapper">
                ${button({ content: 'close', '@click': this.close.bind(this) })}
                ${button({
                    content: 'reset',
                    '@click': this.undoChanges.bind(this),
                })}
                ${button({
                    content: 'execute',
                    '@click': this.changeSchema.bind(this),
                    '?disabled': this.schemaValid() === false,
                    refVar: this.#executeButton,
                })}
            </div>
        `;
    }
    tableRow(table: TableProps): TemplateResult {
        return html`
            <tr height=${this.#rowHeight || nothing}>
                <td>${print(table.name)}</td>
                <td>${table.pk}</td>
                <td>${this.indexesInput(table)}</td>
                <td>${this.deleteButton(table.name)}</td>
            </tr>
        `;
    }
    deletedTableRow(name: string): TemplateResult {
        const undoButton = symbolButton({
            icon: 'tabler-arrow-back-up',
            title: 'undo delete',
            classes: ['right'],
            '@click': this.restoreTable.bind(this, name),
        });
        return html`
            <tr height=${this.#rowHeight || nothing}>
                <td colspan="3" class="strike" title="table will be deleted">
                    ${print(name)}
                </td>
                <td>${undoButton}</td>
            </tr>
        `;
    }
    addedRows(): TemplateResult[] {
        const rows: TemplateResult[] = [];
        this[state].addedTables.forEach((table) => {
            rows.push(html`
                <tr>
                    <td>${this.tablenameInput(table)}</td>
                    <td>${this.pkInput(table)}</td>
                    <td>${this.indexesInput(table, true)}</td>
                    <td>${this.deleteButton(table.name)}</td>
                </tr>
            `);
        });
        return rows;
    }
    indexesInput(table: TableProps, added = false): TemplateResult {
        const { database } = this[state].target;
        const idSuffix = added
            ? table.name
            : encodeURIComponent(`${database}-${table.name}`);

        const isInvalid = table.invalid.has('indexes');
        const classes = ['resizable', ...(isInvalid ? ['invalid'] : [])];

        return textinput({
            id: `schema-editor-indexes-${idSuffix}`,
            isEphemeral: added,
            '.value': table.indexes,
            '@change': this.onIndexesChange.bind(this, table.name, added),
            '@input': this.onIndexesInput.bind(this),
            classes,
            title: isInvalid ? 'invalid index spec' : null,
        }).view();
    }
    tablenameInput(table: TableProps): TemplateResult {
        const isInvalid = table.invalid.has('name');
        const classes = ['resizable', ...(isInvalid ? ['invalid'] : [])];

        return textinput({
            id: `schema-editor-table-name-${table.name}`,
            isEphemeral: true,
            '.value': escapeUnicode(table.tablename),
            '@change': this.onTablenameChange.bind(this, table.name),
            '@keyup': this.onTablenameInput.bind(this, table.name),
            classes,
            title: isInvalid ? 'table name is required' : null,
        }).view();
    }
    pkInput(table: TableProps): TemplateResult {
        const isInvalid = table.invalid.has('pk');
        const classes = ['resizable', ...(isInvalid ? ['invalid'] : [])];

        return textinput({
            id: `schema-editor-pk-${table.name}`,
            isEphemeral: true,
            '.value': table.pk,
            '@change': this.onPkChange.bind(this, table.name),
            '@keyup': this.onPkInput.bind(this),
            classes,
            title: isInvalid ? 'invalid primary key' : null,
        }).view();
    }
    deleteButton(name: string): TemplateResult {
        return symbolButton({
            icon: 'tabler-trash',
            title: 'delete table',
            classes: ['right'],
            '@click': this.deleteTable.bind(this, name),
        });
    }
    onTablenameChange(name: string, event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const value = target.value.trim();
        const addedTables = this[state].addedTables;
        const table = addedTables[this.tableIndex(addedTables, name)];
        if (table) {
            table.tablename = unescapeString(value);
            this.checkNameMissing(table);
            this.update({ addedTables });
        }
    }
    onTablenameInput(name: string, event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !this.#executeButton.value) return;
        const value = target.value.trim();
        const valid = value.length > 0;
        target.classList[valid ? 'remove' : 'add']('invalid');
        const addedTables = this[state].addedTables;
        const table = addedTables[this.tableIndex(addedTables, name)];
        table.invalid[valid ? 'delete' : 'add']('name');
        this.#executeButton.value.disabled = !valid || !this.schemaValid();
    }
    onIndexesChange(name: string, added: boolean, event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const value = target.value.trim();
        const { tables, addedTables } = this[state];
        const valid = validateIndexes(value);
        const tablesArray = added ? addedTables : tables;
        const table = tablesArray[this.tableIndex(tablesArray, name)];
        if (table) {
            table.indexes = value;
            table.invalid[valid ? 'delete' : 'add']('indexes');
            if (added) {
                this.checkNameMissing(table);
            }
            this.update({ tables, addedTables });
        }
    }
    onIndexesInput(input: Textinput) {
        if (!this.#executeButton.value) return;
        const node = input.node;
        const value = node.value.trim();
        const valid = validateIndexes(value);
        node.classList[valid ? 'remove' : 'add']('invalid');
        node.title = valid ? '' : 'invalid primary key';
        this.#executeButton.value.disabled = !valid || !this.schemaValid();
    }
    onPkChange(name: string, event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const value = target.value.trim();
        const addedTables = this[state].addedTables;
        const valid = validatePrimKey(value);
        const table = addedTables[this.tableIndex(addedTables, name)];
        if (table) {
            table.pk = value;
            table.invalid[valid ? 'delete' : 'add']('pk');
            this.checkNameMissing(table);
            this.update({ addedTables });
        }
    }
    onPkInput(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !this.#executeButton.value) return;
        const value = target.value.trim();
        const valid = validatePrimKey(value);
        target.classList[valid ? 'remove' : 'add']('invalid');
        target.title = valid ? '' : 'invalid index spec';
        this.#executeButton.value.disabled = !valid || !this.schemaValid();
    }
    checkNameMissing(table: TableProps): void {
        const { tablename, pk, indexes } = table;
        const missing =
            tablename.length === 0 && (pk.length !== 0 || indexes.length !== 0);
        table.invalid[missing ? 'add' : 'delete']('name');
    }
    deleteTable(name: string, event: MouseEvent): void {
        event.preventDefault();
        const { tables, addedTables } = this[state];
        const idx = this.tableIndex(tables, name);
        if (idx !== -1) {
            tables[idx].deleted = true;
        } else {
            const idx = this.tableIndex(addedTables, name);
            if (idx !== -1) {
                addedTables.splice(idx, 1);
            }
        }
        this.update({ tables, addedTables });
    }
    restoreTable(name: string, event: MouseEvent): void {
        event.preventDefault();
        const { tables, rememberedTables } = this[state];
        const idx = this.tableIndex(tables, name);
        if (idx !== -1) {
            tables[idx] = structuredClone(rememberedTables[idx]);
            this.update({ tables });
        }
    }
    addTable(event: MouseEvent): void {
        event.preventDefault();
        const addedTables = this[state].addedTables;
        addedTables.push(this.tableProps({ name: `table-${uniqueId()}` }));
        this.update({ addedTables });
    }
    schemaValid(): boolean {
        const { tables, addedTables } = this[state];
        return tables
            .concat(addedTables)
            .every((table) => table.invalid.size === 0 || table.deleted);
    }
    schemaModified(): boolean {
        const { tables, rememberedTables } = this[state];
        const validAddedTables = this.validAddedTables();
        return (
            JSON.stringify(tables) !== JSON.stringify(rememberedTables) ||
            validAddedTables.length > 0
        );
    }
    validAddedTables(): TableProps[] {
        const addedTables = this[state].addedTables;
        return addedTables.filter(
            (table) => table.tablename !== '' && table.invalid.size === 0,
        );
    }
    async changeSchema(): Promise<void> {
        const {
            tables,
            target: { database },
        } = this[state];
        if (this.schemaValid() === false) {
            messageStack.displayWarning('Please correct the erroneous fields first.');
        } else if (this.schemaModified() === false) {
            messageStack.displayInfo('The database schema is not modified.');
        } else {
            const schema: Schema = {};
            for (const { name, pk, indexes, deleted } of tables) {
                if (deleted) {
                    schema[name] = null;
                } else {
                    schema[name] = indexes === '' ? pk : pk.concat(',', indexes);
                }
            }
            for (const { tablename, pk, indexes } of this.validAddedTables()) {
                schema[tablename] = indexes === '' ? pk : pk.concat(',', indexes);
            }
            let done = false;
            try {
                appStore.update({
                    loading: true,
                    loadingMsg: `updating schema of database: ${database}`,
                });
                done = await Database.changeSchema(database, schema);
            } catch (error) {
                messageStack.displayError(`Error modifying database schema! ${error}`);
            } finally {
                appStore.update({ loading: false, loadingMsg: '' });
            }
            if (done) {
                const selectedDB = appStore.state.databases.findIndex(
                    (db: { name: string }) => db.name === database,
                );
                this.close();
                Database.init(selectedDB);
            }
        }
    }
    undoChanges() {
        this.update({
            tables: structuredClone(this[state].rememberedTables),
            addedTables: [],
        });
    }
}

const schemaEditor = new SchemaEditor();

export default schemaEditor;
