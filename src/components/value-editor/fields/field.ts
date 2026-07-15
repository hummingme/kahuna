/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import CodeareaInput from '#components/value-editor/codearea-input';
import TextareaInput, {
    type TextareaInputSettings,
} from '#components/value-editor/textarea-input';
import UploadInput from '#components/value-editor/upload-input';
import type { RequiredVariables } from '#components/js-codearea';
import BehaviorConfig from '#components/config/behavior-config';
import type { Charset, EncodableCharset } from '#lib/charsets';
import {
    type FieldInputMethod,
    type FieldUploadMethod,
    fieldUploadMethods,
    inputMethods,
    preferedInputMethod,
    itemsPerLine,
} from '#lib/datatype-attributes';
import { getType } from '#lib/datatypes';
import settings from '#lib/settings';
import {
    type AllowedType,
    ValueFormatter,
    formatterOptions,
    type FormatterOptions,
} from '#lib/value-formatter';
import { AppTarget } from '#types';

export type ValueFieldArgs = {
    type: AllowedType;
    value: unknown;
    absent: boolean;
    fieldName: string;
    selectorFields: string[];
    target: AppTarget;
};

type ValueFieldState = ValueFieldArgs & {
    inputMethod: FieldInputMethod;
    uploadCharset: Charset;
    defaultUploadCharset: Charset;
    downloadCharset: EncodableCharset;
    defaultDownloadCharset: EncodableCharset;
    valid: boolean;
    formOptions: FormatterOptions;
    codeOptions: FormatterOptions;
};

export type FieldSettings = {
    inputMethod: FieldInputMethod;
    uploadCharset: Charset;
    downloadCharset: EncodableCharset;
    textarea: TextareaInputSettings;
    formOptions: FormatterOptions;
    codeOptions: FormatterOptions;
};

export type UpdateOptions = {
    rerenderTextarea?: boolean;
    updateTextarea?: boolean;
    updateCodearea?: boolean;
};

const state = Symbol('value-field state');

export default abstract class Field {
    [state]: ValueFieldState;
    node: Ref<HTMLElement> = createRef();
    textarea?: TextareaInput;
    codearea?: CodeareaInput;
    stringFormatter = new ValueFormatter('string');
    sourceFormatter = new ValueFormatter('source');
    constructor(args: ValueFieldArgs) {
        this[state] = {
            ...args,
            valid: true,
            inputMethod: preferedInputMethod(args.type),
            uploadCharset: 'utf-8',
            defaultUploadCharset: 'utf-8',
            downloadCharset: 'utf-8',
            defaultDownloadCharset: 'utf-8',
            formOptions: formatterOptions(),
            codeOptions: formatterOptions(),
        };
    }
    async init(requireVariables: () => RequiredVariables) {
        const { value, type, fieldName, selectorFields, target } = this[state];
        this.value = value;
        const {
            values: { uploadCharset, downloadCharset },
        } = await BehaviorConfig.getSettings(target);
        this[state].defaultUploadCharset = uploadCharset;
        this[state].defaultDownloadCharset = downloadCharset;

        const settings = await this.getSettings();
        if (inputMethods(type).includes(settings.inputMethod)) {
            this[state].inputMethod = settings.inputMethod;
        }
        this[state].uploadCharset = settings.uploadCharset;
        this[state].downloadCharset = settings.downloadCharset;
        this[state].formOptions = settings.formOptions;
        this[state].codeOptions = settings.codeOptions;

        this.codearea = new CodeareaInput(this);
        await this.codearea.init({
            target,
            detail: fieldName,
            selectorFields,
            requireVariables: this.addValueVariable(requireVariables),
        });
        this.textarea = this.createTextareaInput(settings.textarea);
    }
    get state() {
        return this[state];
    }
    abstract view(): TemplateResult | string;
    abstract get value(): unknown;
    abstract set value(value: unknown);

    /* returns the representation of the value as required for the form fields */
    abstract toFormValue(expanded?: boolean): string | void;

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
        rerenderTextarea = true,
        updateTextarea = true,
        updateCodearea = true,
    }: UpdateOptions = {}) {
        const node = this.node.value;
        if (node && 'value' in node) {
            const fieldValue = this.toFormValue() || '';
            if (node instanceof HTMLTextAreaElement && this.textarea) {
                if (rerenderTextarea) {
                    this.textarea.renderTextarea(fieldValue);
                } else if (updateTextarea) {
                    this.textarea.node.value = fieldValue;
                }
            } else {
                node.value = fieldValue;
            }
        }
        if (this.codearea && updateCodearea) {
            this.codearea.updateCode();
            if (this[state].inputMethod === 'code') {
                this.codearea.codearea.textarea.value = this.toSourceValue(
                    this.codearea.expanded,
                );
            }
        }
    }
    handleFormChange() {
        if (this.valid) {
            this.update(this.fromFormValue(), {
                rerenderTextarea: false,
                updateTextarea: false,
            });
        }
    }
    set valid(result: boolean) {
        this.state.valid = result;
    }
    get valid() {
        return this.state.valid;
    }
    shutdown() {
        this.codearea?.shutdown();
    }
    focus() {
        this.node.value?.focus();
    }
    get inputMethod() {
        return this[state].inputMethod;
    }
    set inputMethod(method: FieldInputMethod) {
        this[state].inputMethod = method;
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
    inputMethodView() {
        let view: TemplateResult | '' = '';
        const inputMethod = this[state].inputMethod;
        if (!inputMethod) return '';
        if (fieldUploadMethods.includes(inputMethod as FieldUploadMethod)) {
            const input = new UploadInput(this);
            view = input.view();
        } else if (inputMethod === 'code' && this.codearea) {
            if (this.codearea.isEmpty()) {
                this.codearea.updateCode();
            }
            view = this.codearea.view() || '';
        }
        return view
            ? html`
                  <div class="value">${view}</div>
              `
            : '';
    }
    toSourceValue(expanded = true) {
        if (!expanded) return 'return value;';
        const code = this.sourceFormatter.render(
            this.value,
            getType(this.value),
            this.codeOptions({ expanded }),
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
    async getSettings(): Promise<FieldSettings> {
        const { fieldName, target, type } = this[state];
        const values: Partial<FieldSettings> = await settings.get({
            ...target,
            subject: 'editorfield',
            detail: `${fieldName}~${type}`,
        });
        const formOptions = values.formOptions
            ? settings.cleanupSettings(values.formOptions, this.defaultValueOptions())
            : {};
        const codeOptions = values.codeOptions
            ? settings.cleanupSettings(values.codeOptions, this.defaultValueOptions())
            : {};
        return {
            ...this.defaultSettings(),
            ...values,
            formOptions: {
                ...this.defaultValueOptions(),
                ...formOptions,
            },
            codeOptions: {
                ...this.defaultValueOptions(),
                ...codeOptions,
            },
        };
    }
    defaultSettings(): FieldSettings {
        const { type, defaultUploadCharset, defaultDownloadCharset } = this[state];
        return {
            inputMethod: preferedInputMethod(type),
            uploadCharset: defaultUploadCharset,
            downloadCharset: defaultDownloadCharset,
            textarea: { width: '25em', height: '1lh' },
            formOptions: this.defaultValueOptions(),
            codeOptions: this.defaultValueOptions(),
        };
    }
    defaultValueOptions(): FormatterOptions {
        return { ...formatterOptions(), perLine: itemsPerLine(this.state.type) };
    }
    updateOptions(usage: 'form' | 'code', options: Partial<FormatterOptions>) {
        const key = usage === 'form' ? 'formOptions' : 'codeOptions';
        this.state[key] = { ...this.state[key], ...options };
        this.saveSettings();
        this.updateFormFieldValue({
            rerenderTextarea: usage === 'form' && 'expanded' in options ? true : false,
            [usage === 'form' ? 'updateCodearea' : 'updateTextarea']: false,
        });
    }
    saveSettings() {
        const textareaStyle = this.node.value?.style;
        const values: Partial<FieldSettings> = {
            inputMethod: this.inputMethod,
            uploadCharset: this.uploadCharset,
            downloadCharset: this.downloadCharset,
            ...(textareaStyle && {
                textarea: {
                    width: textareaStyle.width,
                    height: textareaStyle.height,
                },
            }),
            formOptions: this.state.formOptions,
            codeOptions: this.state.codeOptions,
        };
        const { fieldName, target, type } = this[state];
        settings.saveSettings(
            values,
            this.defaultSettings(),
            target,
            'editorfield',
            `${fieldName}~${type}`,
        );
    }
    formOptions(options: Partial<FormatterOptions> = {}): FormatterOptions {
        return this.formatterOptions('form', options);
    }
    codeOptions(options: Partial<FormatterOptions> = {}): FormatterOptions {
        return this.formatterOptions('code', options);
    }
    formatterOptions(
        usage: 'form' | 'code',
        options: Partial<FormatterOptions> = {},
    ): FormatterOptions {
        const key = usage === 'form' ? 'formOptions' : 'codeOptions';
        return { ...this.state[key], ...options };
    }
    createTextareaInput(settings: TextareaInputSettings) {
        const invalidTextareaHint =
            'invalidTextareaHint' in this && typeof this.invalidTextareaHint === 'string'
                ? this.invalidTextareaHint
                : 'Invalid input!';
        const validateTextareaValue =
            'validateTextareaValue' in this &&
            this.validateTextareaValue instanceof Function
                ? this.validateTextareaValue
                : () => true;
        return new TextareaInput(this, {
            ...settings,
            validCheck: validateTextareaValue.bind(this),
            invalidHint: invalidTextareaHint,
        });
    }
}
