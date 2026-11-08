/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { IndexableType, Table } from 'dexie';
import { html } from 'lit-html';
import { nothing } from 'lit';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import Field, { type ValueFieldArgs } from '#components/value-editor/fields/field';
import { fieldFactory } from '#components/value-editor/field-factory';
import configLayer from '#components/configlayer';
import messageStack from '#components/messagestack';
import { selectbox } from '#components/parts/selectbox';
import { getConnection } from '#lib/connection';
import {
    datatypeAttributes,
    inputMethods,
    isTypeInputMethod,
    methodNames,
} from '#lib/datatype-attributes';
import { getType } from '#lib/datatypes';
import { collectionToArray, isPrimKeyUnnamed, pkToString } from '#lib/dexie-utils';
import messenger from '#lib/messenger';
import { rowSelectorFields } from '#lib/row-selection';
import { setPath } from '#lib/utils';
import { type AllowedType } from '#lib/value-formatter';
import type {
    AppTarget,
    ColumnFormat,
    Position,
    RecordOf,
    RememberedValue,
    RequiredVariables,
} from '#types';

type ValueEditorArgs = {
    target: AppTarget;
    rowSelector: IndexableType;
    selectorFields: string[];
    requireVariables: () => RequiredVariables;
    fieldName: string;
    innerValue: boolean;
    value: unknown;
    absent: boolean;
    columnFormat: ColumnFormat;
    anchorPosition: Position;
};

type ValueEditorState = Omit<ValueEditorArgs, 'value' | 'absent'> & {
    type: AllowedType;
    remembered: RememberedValue;
};

type CreateFieldArgs = {
    type: AllowedType;
    value: unknown;
    absent: boolean;
    columnFormat: ColumnFormat;
};

const state = Symbol('value-editor state');

const Editor = class {
    [state]: ValueEditorState;
    field: Field;
    resetButton: Ref<HTMLButtonElement> = createRef();
    saveButton: Ref<HTMLButtonElement> = createRef();
    constructor(args: ValueEditorArgs) {
        const { value, absent, columnFormat, ...forState } = args;
        const type = getType(args.value);
        this[state] = {
            ...forState,
            type,
            columnFormat,
            remembered: {
                value: structuredClone(args.value),
                type,
                absent: args.absent,
            },
        };
        this.field = this.createField({ type, value, absent, columnFormat });
    }
    createField({ type, value, absent, columnFormat }: CreateFieldArgs): Field {
        const field = new Proxy<Field>(
            fieldFactory(this.fieldArgs({ type, value, absent, columnFormat })),
            this.fieldProxy,
        );
        return field;
    }
    fieldProxy: ProxyHandler<Field> = {
        set: (field, prop, value) => {
            if (prop === 'valid') {
                field.valid = value;
                this.updateButtons(this.isValueChanged(field.value, field), field.valid);
                return true;
            } else if (prop === 'value') {
                field.value = value;
                this.updateButtons(this.isValueChanged(value, field), field.valid);
                return true;
            } else if (
                prop === 'inputMethod' ||
                prop === 'uploadCharset' ||
                prop === 'downloadCharset' ||
                prop === 'datepickerType'
            ) {
                this.setField(field, prop, value);
                field.saveSettings();
                return true;
            } else {
                if (
                    typeof prop === 'string' &&
                    [
                        'buffer',
                        'codearea',
                        'datepickerType',
                        'flexInput',
                        'nodeInput',
                        'nodeForm',
                        'valid',
                    ].includes(prop) === false
                ) {
                    // eslint-disable-next-line no-console
                    console.error('fieldProxie got unexpected property', prop, value);
                }
                return Reflect.set(field, prop, value);
            }
        },
    };
    setField<K extends keyof Field>(field: Field, prop: K, value: Field[K]) {
        field[prop] = value;
    }
    fieldArgs(args: CreateFieldArgs): ValueFieldArgs {
        const { fieldName, selectorFields, target } = this[state];
        return {
            ...args,
            fieldName,
            selectorFields,
            target,
        };
    }
    async summon() {
        await this.initField(this.field);
        configLayer.show({
            view: this.view.bind(this),
            buttons: this.layerButtons(),
            anchorPosition: this[state].anchorPosition,
        });
        configLayer.makeDraggable();
        this.field.focus();
    }
    async initField(field: Field) {
        const { requireVariables } = this[state];
        await field.init(requireVariables);
    }
    layerButtons() {
        return [
            {
                label: 'reset',
                handler: this.resetChanges.bind(this),
                '?disabled': true,
                refVar: this.resetButton,
            },
            {
                label: 'save',
                handler: this.saveChanges.bind(this),
                '?disabled': this.field.valid,
                refVar: this.saveButton,
            },
        ];
    }
    update(changes: Partial<ValueEditorState>) {
        this[state] = { ...this[state], ...changes };
        this.updateResetButton(true);
        this.updateSaveButton(this.field.valid);
        configLayer.render();
    }
    view() {
        const { type } = this[state];
        const labelFor = this.field.valueLabelId() || nothing;
        return html`
            <div id="value-editor" ${ref(this.nodeReady.bind(this))}>
                <h1 class="precis">${this.headline()}</h1>
                <form id="value-form" @keydown=${this.keydownHandler.bind(this)}>
                    ${this.typeSelect(type)}
                    <label for="${labelFor}">value</label>
                    ${this.field.view()} ${this.inputMethodSelect()}
                </form>
            </div>
        `;
    }
    typeSelect(type: AllowedType) {
        const options = this.editTypes();
        return html`
            <label for="field-type">type</label>
            ${selectbox({
                id: 'field-type',
                options,
                selected: type,
                disabled: ['separator1', 'separator2'],
                '@change': this.typeChanged.bind(this),
            })}
        `;
    }
    inputMethodSelect() {
        const methods = inputMethods(this[state].type);
        return methods.length > 0
            ? html`
                  <label for="field-input-method">input</label>
                  <span>
                      ${selectbox({
                          id: 'field-input-method',
                          options: methodNames(this[state].type),
                          selected: this.field.inputMethod ?? '',
                          '@change': this.inputMethodChanged.bind(this),
                      })}
                  </span>
              `
            : nothing;
    }
    headline() {
        const { selectorFields, rowSelector, fieldName } = this[state];

        return html`
            Edit value of:
            <em>${fieldName}</em>
            for primary key:
            <em>${pkToString(selectorFields, rowSelector)}</em>
        `;
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLElement) {
            this.field.focus();
        }
    }
    editTypes() {
        const baseTypes: RecordOf<string> = {};
        const arrayTypes: RecordOf<string> = {};
        const moreTypes: RecordOf<string> = {};
        for (const [typeId, attribs] of Object.entries(datatypeAttributes())) {
            if (attribs.group === 'base') {
                baseTypes[typeId] = attribs.name;
            } else if (attribs.group === 'array') {
                arrayTypes[typeId] = attribs.name;
            } else if (attribs.group === 'more') {
                moreTypes[typeId] = attribs.name;
            }
        }
        return Object.assign(
            baseTypes,
            { separator1: '\u2015'.repeat(8) },
            arrayTypes,
            { separator2: '\u2015'.repeat(8) },
            moreTypes,
        );
    }
    keydownHandler(event: KeyboardEvent) {
        const target = event.target;
        if (event.key == 'Enter') {
            if (
                this.field.usesFormInput() &&
                this.field.valid &&
                (target instanceof HTMLInputElement ||
                    target instanceof HTMLTextAreaElement ||
                    (target instanceof HTMLSelectElement &&
                        target.id == 'field-type' &&
                        ['null', 'undefined'].includes(target.value)))
            ) {
                event.preventDefault();
                this.field.handleFormChange();
                this.saveChanges();
            }
            return false;
        }
    }
    async typeChanged(event: Event) {
        const target = event.target as HTMLInputElement;
        const type = target.value as AllowedType;
        const value = this[state].type === 'undefined' ? undefined : this.field.value;
        const columnFormat = this[state].columnFormat;
        this.field.shutdown();

        this.field = this.createField({ type, value, absent: true, columnFormat });
        await this.initField(this.field);
        this.update({ type });
        this.field.focus();
    }
    inputMethodChanged(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement) {
            const method = target.value;
            if (isTypeInputMethod(method, this[state].type)) {
                this.field.inputMethod = method;
                configLayer.render();
            }
        }
    }
    async resetChanges() {
        this.field.shutdown();
        const { type, value, absent } = structuredClone(this[state].remembered);
        this[state].type = type;
        const columnFormat = this[state].columnFormat;
        this.field = this.createField({ type, value, absent, columnFormat });
        await this.initField(this.field);
        configLayer.render();
        this.updateResetButton(false);
        this.updateSaveButton(false);
    }
    updateButtons(valueChanged: boolean, valid: boolean) {
        this.updateResetButton(valueChanged);
        this.updateSaveButton(valid && valueChanged);
    }
    isValueChanged(value: unknown, field: Field): boolean {
        if ('valueChanged' in field && field.valueChanged instanceof Function) {
            // some fields implement valueChanged() because
            // calling field.fromFormValue() would be to slow for onInput
            return field.valueChanged(this[state].remembered);
        } else {
            const valueNew =
                field.inputMethod !== 'form' || field.formOptions().compacted
                    ? value
                    : field.fromFormValue();
            const { value: valueOld, type: typeOld } = this[state].remembered;
            const typeNew = getType(valueNew);
            if (typeNew === typeOld) {
                const now = field.stringFormatter.render(valueNew, typeNew);
                const old = field.stringFormatter.render(valueOld, typeOld);
                return now !== old;
            }
            return true;
        }
    }
    updateResetButton(enabled: boolean) {
        if (this.resetButton.value) {
            this.resetButton.value.disabled = !enabled;
        }
    }
    updateSaveButton(enabled: boolean) {
        if (this.saveButton.value) {
            this.saveButton.value.disabled = !enabled;
        }
    }
    async saveChanges() {
        if (!this.field.valid) {
            messageStack.displayError('Cannot save an invalid field value!');
            return;
        }
        try {
            if (this[state].type === 'undefined') {
                await this.saveUndefined();
            } else {
                await this.saveValue(this.field.value);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            messageStack.displayError(`Failed to save changes: ${message}`);
        }
        this.field.shutdown();
        configLayer.close();
        messenger.post({ type: 'refreshDatatable' });
    }
    async saveValue(value: unknown) {
        const { fieldName, innerValue, rowSelector, target } = this[state];
        const db = await getConnection(target.database);
        const table = db.table(target.table);
        if (fieldName === '*value*') {
            table.put(value, rowSelector);
        } else {
            const data = structuredClone(await this.getRowData(table));
            const row = innerValue
                ? setPath(data, fieldName, value)
                : Object.assign(data, {
                      [fieldName]: value,
                  });
            if (isPrimKeyUnnamed(table.schema.primKey)) {
                delete row['*key*'];
                table.put(row, rowSelector);
            } else {
                await db.transaction('rw', target.table, async () => {
                    if (this.isPrimKeyKeyPath(fieldName, table.schema.primKey.keyPath)) {
                        table.delete(rowSelector);
                    }
                    table.put(row);
                });
            }
        }
    }
    async getRowData(table: Table) {
        const { rowSelector } = this[state];
        if (isPrimKeyUnnamed(table.schema.primKey)) {
            /* TODO:
             * Using `collectionToArray()` resp. `collection.each()`
             * prevents BigInt64Array values from disappearing
             * during querying. It remains to be determined whether
             * this is a Firefox or a Dexie issue.
             */
            const collection = table.where(':id').equals(rowSelector);
            return (await collectionToArray(collection, true))[0];
            // return await table.get(rowSelector);
        } else {
            const keyPath = table.schema.primKey.keyPath!;
            const collection = table.where(keyPath).equals(rowSelector);
            const rows: any[] = [];
            await collection.each((row) => rows.push(row));
            return rows[0];
        }
    }
    isPrimKeyKeyPath(fieldName: string, keyPath: string | string[] | undefined) {
        if (!keyPath) return false;
        if (typeof keyPath === 'string' && fieldName === keyPath) {
            return true;
        } else if (keyPath.includes(fieldName)) {
            return true;
        }
        return false;
    }
    async saveUndefined() {
        const { fieldName, rowSelector, target } = this[state];
        const db = await getConnection(target.database);
        const table = db.table(target.table);
        const pkFields = rowSelectorFields(table);
        const key =
            pkFields.length === 1
                ? pkFields[0] === '*key*'
                    ? ':id'
                    : pkFields[0]
                : pkFields;
        const row: Record<string, unknown> = (
            await table.where(key).equals(rowSelector).toArray()
        )[0];
        if (!row) return;
        if (fieldName === '*value*') {
            table.put(undefined, rowSelector);
        } else {
            if (this.field.value === 'property') {
                delete row[fieldName];
            } else {
                row[fieldName] = undefined;
            }
            if (isPrimKeyUnnamed(table.schema.primKey)) {
                await table.put(row, rowSelector);
            } else {
                await table.put(row);
            }
        }
    }
};

function displayValueEditor(args: ValueEditorArgs) {
    if (args.fieldName === '*key*') return;
    new Editor(args).summon();
}

export default displayValueEditor;
