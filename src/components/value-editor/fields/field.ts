/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import CodeareaInput from '#components/value-editor/codearea-input';
import FlexInput, {
    type FlexInputSettings,
    type FlexInputElement,
    isFlexInputNode,
} from '#components/value-editor/flex-input';
import UploadInput from '#components/value-editor/upload-input';
import { focusForceVisible } from '#components/value-editor/view-utils';
import { FieldFormatterManager } from '#components/value-editor/fields/field-formatter-manager';
import { FieldSettingsManager } from '#components/value-editor/fields/field-settings-manager';
import type { Charset, EncodableCharset } from '#lib/charsets';
import {
    type FieldInputMethod,
    type FieldUploadMethod,
    fieldUploadMethods,
    inputMethods,
    noValueLabelId,
    preferedInputMethod,
} from '#lib/datatype-attributes';
import { getType } from '#lib/datatypes';
import { unescapeString } from '#lib/escape-string';
import {
    type AllowedType,
    ValueFormatter,
    type FormatterOptions,
} from '#lib/value-formatter';
import { AppTarget, ColumnFormat, DatepickerType, RequiredVariables } from '#types';

export type ValueFieldArgs = {
    type: AllowedType;
    value: unknown;
    absent: boolean;
    columnFormat: ColumnFormat;
    fieldName: string;
    selectorFields: string[];
    target: AppTarget;
};

type ValueFieldState = ValueFieldArgs & {
    inputMethod: FieldInputMethod;
    uploadCharset: Charset;
    downloadCharset: EncodableCharset;
    datepickerType: DatepickerType | null;
    valid: boolean;
};

export type FieldSettings = {
    inputMethod: FieldInputMethod;
    uploadCharset: Charset;
    downloadCharset: EncodableCharset;
    useLocalTimezone: boolean;
    datepickerType: DatepickerType | null;
    flexInput: FlexInputSettings;
    formOptions: Partial<FormatterOptions>;
    codeOptions: Partial<FormatterOptions>;
};

export type UpdateOptions = {
    rerenderFlexInput?: boolean;
    updateFlexInput?: boolean;
    updateCodearea?: boolean;
};

const state = Symbol('value-field state');

export default abstract class Field {
    [state]: ValueFieldState;
    nodeInput?: FlexInputElement;
    nodeForm?: HTMLDivElement;
    flexInput?: FlexInput;
    codearea?: CodeareaInput;
    stringFormatter = new ValueFormatter('string');
    sourceFormatter = new ValueFormatter('source');
    protected formatterMgr: FieldFormatterManager;
    protected settingsMgr: FieldSettingsManager;
    constructor(args: ValueFieldArgs) {
        this[state] = {
            ...args,
            valid: true,
            inputMethod: preferedInputMethod(args.type),
            uploadCharset: 'utf-8',
            downloadCharset: 'utf-8',
            datepickerType: 'datetime',
        };
        this.formatterMgr = new FieldFormatterManager(
            args.type,
            () => this.defaultOptionsOverrides,
        );
        this.settingsMgr = new FieldSettingsManager(args, this.formatterMgr);
    }
    async init(requireVariables: () => RequiredVariables) {
        const { type, fieldName, selectorFields, target } = this[state];
        this.value = this[state].value;

        const settings = await this.settingsMgr.load();
        if (inputMethods(type).includes(settings.inputMethod)) {
            this[state].inputMethod = settings.inputMethod;
        }
        this[state].uploadCharset = settings.uploadCharset;
        this[state].downloadCharset = settings.downloadCharset;
        this[state].datepickerType = settings.datepickerType;

        this.formatterMgr.setOptions('form', {
            ...(settings.formOptions && { ...settings.formOptions }),
            useLocalTimezone: settings.useLocalTimezone,
        });
        this.formatterMgr.setOptions('code', {
            ...(settings.codeOptions && { ...settings.codeOptions }),
            ...(this.isVeryLargeValue() && { compacted: true }),
            useLocalTimezone: settings.useLocalTimezone,
        });

        this.codearea = new CodeareaInput(this);
        await this.codearea.init({
            target,
            detail: fieldName,
            selectorFields,
            requireVariables: this.addValueVariable(requireVariables),
        });
        this.flexInput = this.createFlexInput(settings.flexInput);
    }
    get state() {
        return this[state];
    }
    view(): TemplateResult | string {
        return html`
            <div class="value-controls" ${ref(this.formReady.bind(this))}></div>
            ${this.inputMethodView()}
        `;
    }
    abstract formView(): TemplateResult | string;
    abstract get value(): unknown;
    abstract set value(value: unknown);
    /* returns the representation of the value as required for the form fields */
    abstract toFormValue(): string | void;
    /* returns value from the form elements */
    abstract fromFormValue(): unknown;
    update(value: unknown, options: UpdateOptions = {}) {
        this.value = value;
        this.updateFormFieldValue(options);
    }
    toFormString(str: string) {
        return this.stringFormatter.render(str, 'string', this.formOptions());
    }
    updateFormFieldValue({
        rerenderFlexInput = true,
        updateFlexInput = true,
        updateCodearea = true,
    }: UpdateOptions = {}) {
        const node = this.nodeInput;
        if (node) {
            const fieldValue = this.toFormValue() || '';
            if (this.flexInput && isFlexInputNode(node)) {
                if (rerenderFlexInput) {
                    this.flexInput.render(fieldValue);
                } else if (updateFlexInput) {
                    this.flexInput.node.value = fieldValue;
                }
            } else {
                node.value = fieldValue;
            }
        }
        if (this.codearea && updateCodearea) {
            this.codearea.updateCode();
            if (this[state].inputMethod === 'code') {
                this.codearea.codearea.textarea.value = this.toSourceValue(
                    this.codearea.compacted,
                );
            }
        }
    }
    handleFormChange() {
        if (this.valid) {
            this.update(this.fromFormValue(), {
                rerenderFlexInput: false,
                updateFlexInput: false,
                updateCodearea: false,
            });
        }
    }
    formReady(node?: Element) {
        if (node instanceof HTMLDivElement) {
            this.nodeForm = node;
            this.updateForm();
        }
    }
    updateForm() {
        const node = this.nodeForm;
        if (!node) return;
        render(
            html`
                <div class="value">${this.formView()}</div>
            `,
            node,
        );
    }
    setNodeInput = (node?: Element) => {
        if (node instanceof HTMLInputElement) {
            this.nodeInput = node;
            node.setCustomValidity('');
        }
    };
    set valid(result: boolean) {
        this.state.valid = result;
    }
    get valid() {
        return this.state.valid;
    }
    shutdown() {
        this.codearea?.shutdown();
    }
    focus(node?: HTMLInputElement) {
        const nodeInput = node || this.nodeInput;
        const nodeForm = this.nodeForm?.parentElement;
        if (nodeInput && this.usesFormInput()) {
            requestAnimationFrame(() => nodeInput.focus());
        } else if (nodeForm && this.usesUploadInput()) {
            requestAnimationFrame(() =>
                focusForceVisible(
                    nodeForm.querySelector<HTMLButtonElement>('button.upload'),
                ),
            );
        }
    }
    get inputMethod() {
        return this[state].inputMethod;
    }
    set inputMethod(method: FieldInputMethod) {
        this[state].inputMethod = method;
    }
    usesFormInput() {
        return ['form', 'ts', 'ts/1000'].includes(this.inputMethod);
    }
    usesUploadInput() {
        return fieldUploadMethods.includes(this.inputMethod as FieldUploadMethod);
    }
    get uploadCharset() {
        return this[state].uploadCharset;
    }
    set uploadCharset(charset: Charset) {
        this[state].uploadCharset = charset;
    }
    get downloadCharset() {
        return this[state].downloadCharset;
    }
    set downloadCharset(charset: EncodableCharset) {
        this[state].downloadCharset = charset;
    }
    get datepickerType() {
        return this[state].datepickerType;
    }
    set datepickerType(type: DatepickerType | null) {
        this[state].datepickerType = type;
    }
    inputMethodView() {
        let view: TemplateResult | '' = '';
        let label: TemplateResult | '' = '';
        const inputMethod = this[state].inputMethod;
        if (!inputMethod) return '';
        if (fieldUploadMethods.includes(inputMethod as FieldUploadMethod)) {
            const input = new UploadInput(this);
            view = input.view();
            label = html`
                <label for="value-upload">upload</label>
            `;
        } else if (inputMethod === 'code' && this.codearea) {
            if (this.codearea.isEmpty()) {
                this.codearea.updateCode();
            }
            view = this.codearea.view();
            label = html`
                <label for="js-codearea">code</label>
            `;
        }
        return view
            ? html`
                  ${label}
                  <div class="input-method-controls">${view}</div>
              `
            : nothing;
    }
    toSourceValue(compacted = false) {
        if (compacted) return 'return value;';
        const code = this.sourceFormatter.render(
            this.value,
            getType(this.value),
            this.codeOptions({ compacted }),
        );
        return `return ${code};`;
    }
    handleUploadedValue(file: File) {
        this.update(file);
    }
    addValueVariable(requireVariables: () => RequiredVariables) {
        return () => {
            return Object.assign(requireVariables(), { value: this.value });
        };
    }
    defaultOptionsOverrides: Partial<FormatterOptions> = {};
    updateOptions(usage: 'form' | 'code', options: Partial<FormatterOptions>) {
        this.formatterMgr.setOptions(usage, options);
        this.saveSettings();

        const rerenderFlexInput =
            (usage === 'form' && 'compacted' in options) ||
            'escapeLf' in options ||
            'escapeCr' in options
                ? true
                : false;

        this.updateFormFieldValue({
            rerenderFlexInput,
            [usage === 'form' ? 'updateCodearea' : 'updateFlexInput']: false,
        });
    }
    saveSettings() {
        const textareaStyle = this.flexInput?.isTextarea && this.flexInput.node.style;
        const currentSettings: Partial<FieldSettings> = {
            inputMethod: this.inputMethod,
            uploadCharset: this.uploadCharset,
            downloadCharset: this.downloadCharset,
            datepickerType: this.datepickerType,
            ...(textareaStyle && {
                flexInput: {
                    textarea: {
                        width: textareaStyle.width,
                        height: textareaStyle.height,
                    },
                },
            }),
            formOptions: this.formatterMgr.getVariableFormOptions(),
            codeOptions: this.formatterMgr.getVariableCodeOptions(),
        };
        this.settingsMgr.save(currentSettings);
    }
    formOptions(options: Partial<FormatterOptions> = {}): FormatterOptions {
        return this.formatterMgr.getFormOptions(options);
    }
    codeOptions(options: Partial<FormatterOptions> = {}): FormatterOptions {
        return this.formatterMgr.getCodeOptions(options);
    }
    createFlexInput(settings: FlexInputSettings) {
        return new FlexInput(this, {
            ...settings,
            validCheck: this.validCheck(),
            invalidHint: this.invalidHint,
        });
    }
    validCheck(): (val: string) => boolean {
        return 'validate' in this && this.validate instanceof Function
            ? this.validate.bind(this)
            : () => true;
    }
    invalidHint = 'Invalid input!';
    valueInputId(ext = '') {
        const { type, target } = this.state;
        const table = unescapeString(target.table);
        return `field-value-${table}-${type}${ext ? `-${ext}` : ''}`;
    }
    valueLabelId(): string | undefined {
        return noValueLabelId(this[state].type) ? undefined : this.valueInputId();
    }
    isVeryLargeValue(): boolean {
        return false;
    }
}
