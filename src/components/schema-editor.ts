/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, type TemplateResult } from 'lit-html';
import { nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { type IndexSpec } from 'dexie';
import appWindow from './app-window.ts';
import Database from './database.ts';
import Layer from './layer.ts';
import messageStack from './messagestack.ts';
import appStore from '../lib/app-store.ts';
import { type AppTarget, globalTarget } from '../lib/app-target.ts';
import { button, symbolButton } from '../lib/button.ts';
import { getConnection } from '../lib/connection.ts';
import { isIdentifier } from '../lib/identifier.ts';
import textinput from '../lib/textinput.ts';
import { uniqueId } from '../lib/utils.ts';
import { type Position, EMPTY_POSITION } from '../lib/types/common.ts';

interface SchemaEditorState {
    target: AppTarget;
    visible: boolean;
    node?: HTMLElement;
    position: Position;
    anchorPosition: Position;
    tables: TableProps[];
    rememberedTables: TableProps[];
    addedTables: TableProps[];
}

interface TableProps {
    name: string;
    tablename: string;
    pk: string;
    indexes: string;
    invalid: Set<string>;
    deleted: boolean;
}

interface Schema {
    [key: string]: string | null;
}

const state = Symbol('schema-editor');

class SchemaEditor {
    [state]: SchemaEditorState;
    #layer;
    #colWidths = Array(4);
    #rowHeight = '0px';
    constructor() {
        this[state] = this.initState;
        this.#layer = new Layer({
            closeHandler: this.close.bind(this),
            resizeHandler: this.fixPosition.bind(this),
        });
    }
    get initState(): SchemaEditorState {
        return {
            target: globalTarget,
            visible: false,
            node: undefined,
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
        const anchorNode = appWindow.win.querySelector('nav#menu button:nth-of-type(2)');
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
    nodeReady(node?: Element): void {
        if (node !== undefined) {
            this[state].node = node as HTMLElement;
            this.render();
            setTimeout(() => {
                this.#colWidths = [...node.querySelectorAll('th')].map(
                    (th) => `${th.clientWidth - 10 - 8}px`,
                );
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
                    <em>${target.database}</em>
                </h1>
                <form id="schema-form">
                    <table>
                        <thead>
                            <tr>
                                <th width=${this.#colWidths[0] || nothing}>Tablename</th>
                                <th width=${this.#colWidths[1] || nothing}>
                                    Primary Key
                                </th>
                                <th width=${this.#colWidths[2] || nothing}>indexes</th>
                                <th width=${this.#colWidths[3] || nothing} />
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
                })}
            </div>
        `;
    }
    tableRow(table: TableProps): TemplateResult {
        const style = `width: ${this.#colWidths[2]}`;
        return html`
            <tr height=${this.#rowHeight || nothing}>
                <td>${table.name}</td>
                <td>${table.pk}</td>
                <td>${this.indexesInput(table, style)}</td>
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
                <td colspan="3" class="strike" title="table will be deleted">${name}</td>
                <td>${undoButton}</td>
            </tr>
        `;
    }
    addedRows(): TemplateResult[] {
        const rows: TemplateResult[] = [];
        this[state].addedTables.forEach((table) => {
            const styles = this.#colWidths.map((width) => `width: ${width}`);
            rows.push(html`
                <tr>
                    <td>${this.tablenameInput(table, styles[0])}</td>
                    <td>${this.pkInput(table, styles[1])}</td>
                    <td>${this.indexesInput(table, styles[2], true)}</td>
                    <td>${this.deleteButton(table.name)}</td>
                </tr>
            `);
        });
        return rows;
    }
    indexesInput(
        table: TableProps,
        style: string,
        added: boolean = false,
    ): TemplateResult {
        return textinput({
            '.value': table.indexes,
            '@change': this.indexesChange.bind(this, table.name, added),
            style,
            class: table.invalid.has('indexes') ? 'invalid' : null,
            title: table.invalid.has('indexes') ? 'invalid index spec' : null,
        });
    }
    tablenameInput(table: TableProps, style: string): TemplateResult {
        return textinput({
            '.value': table.tablename,
            '@change': this.tablenameChange.bind(this, table.name),
            style,
            class: table.invalid.has('name') ? 'invalid' : null,
            title: table.invalid.has('name') ? 'table name is required' : null,
        });
    }
    pkInput(table: TableProps, style: string): TemplateResult {
        return textinput({
            '.value': table.pk,
            '@change': this.pkChange.bind(this, table.name),
            style,
            class: table.invalid.has('pk') ? 'invalid' : null,
            title: table.invalid.has('pk') ? 'invalid primary key' : null,
        });
    }
    deleteButton(name: string): TemplateResult {
        return symbolButton({
            icon: 'tabler-trash',
            title: 'delete table',
            classes: ['right'],
            '@click': this.deleteTable.bind(this, name),
        });
    }
    tablenameChange(name: string, event: Event): void {
        const target = event.target as HTMLInputElement;
        const value = target.value.trim();
        const addedTables = this[state].addedTables;
        const table = addedTables[this.tableIndex(addedTables, name)];
        if (table) {
            table.tablename = value;
            const valid =
                value.length !== 0 ||
                (table.pk.length === 0 && table.indexes.length === 0);
            table.invalid[valid ? 'delete' : 'add']('name');
            this.update({ addedTables });
        }
    }
    indexesChange(name: string, added: boolean, event: Event): void {
        const target = event.target as HTMLInputElement;
        const value = target.value.trim();
        const { tables, addedTables } = this[state];
        const valid = this.validateIndexes(value);
        const tablesArray = added ? addedTables : tables;
        let table = tablesArray[this.tableIndex(tablesArray, name)];
        if (table) {
            table.indexes = value;
            table.invalid[valid ? 'delete' : 'add']('indexes');
            table = this.checkNameMissing(table);
            this.update({ tables, addedTables });
        }
    }
    pkChange(name: string, event: Event): void {
        const target = event.target as HTMLInputElement;
        const value = target.value.trim();
        const addedTables = this[state].addedTables;
        const valid = this.validatePrimKey(value);
        let table = addedTables[this.tableIndex(addedTables, name)];
        if (table) {
            table.pk = value;
            table.invalid[valid ? 'delete' : 'add']('pk');
            table = this.checkNameMissing(table);
            this.update({ addedTables });
        }
    }
    checkNameMissing(table: TableProps): TableProps {
        const { tablename, pk, indexes } = table;
        if (tablename !== '') {
            const missing =
                tablename.length === 0 && (pk.length !== 0 || indexes.length !== 0);
            table.invalid[missing ? 'add' : 'delete']('name');
        }
        return table;
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
    validateIndexes(value: string): boolean {
        if (value === '') return true;
        const parts = value
            .split(',')
            .map((p) => p.trim())
            .map((p) => p.replace(/^([&*])/, ''));
        if (parts.some((p) => p.length === 0)) {
            return false;
        }
        const keypaths = [];
        for (let part of parts) {
            if (part.startsWith('[') && part.endsWith(']')) {
                part = part.substring(1, part.length - 1);
                keypaths.push(...part.split('+'));
            } else {
                keypaths.push(part);
            }
        }
        const identifiers = [];
        for (const keypath of keypaths) {
            identifiers.push(...keypath.split('.'));
        }
        return identifiers.every((id) => isIdentifier(id));
    }
    validatePrimKey(value: string): boolean {
        let identifiers: string[] = [];
        if (value.startsWith('++')) {
            value = value.substring(2);
            identifiers = value.split('.');
        } else if (value.startsWith('[') && value.endsWith(']')) {
            value = value.substring(1, value.length - 1);
            const parts = value.split('+');
            if (parts.length < 2) return false;
            parts.forEach((part) => {
                identifiers.push(...part.split('.'));
            });
        } else {
            identifiers = value.split('.');
        }
        return value.length === 0 || identifiers.every((id) => isIdentifier(id));
    }
    validAddedTables(): TableProps[] {
        const addedTables = this[state].addedTables;
        return addedTables.filter(
            (table) => table.tablename !== '' && table.invalid.size === 0,
        );
    }
    schemaValid(): boolean {
        const { tables, addedTables } = this[state];
        return tables.concat(addedTables).every((table) => table.invalid.size === 0);
    }
    schemaModified(): boolean {
        const { tables, rememberedTables } = this[state];
        const validAddedTables = this.validAddedTables();
        return (
            JSON.stringify(tables) !== JSON.stringify(rememberedTables) ||
            validAddedTables.length > 0
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
