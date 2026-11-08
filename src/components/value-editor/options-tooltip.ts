/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';

import type Field from '#components/value-editor/fields/field';
import tooltip from '#components/tooltip';
import checkbox from '#components/parts/checkbox';
import { selectbox } from '#components/parts/selectbox';
import {
    CHARSETS,
    encodableCharsets,
    isCharset,
    isEncodableCharset,
} from '#lib/charsets';
import { selfMap } from '#lib/utils';
import type { AllowedType, FormatterOptions } from '#lib/value-formatter';
import type { KeysOfType } from '#types';
import { containsStrings, inputMethods, isExpandable } from '#lib/datatype-attributes';
import { datepickerTypeOptions, isDatepickerTypeOption } from '#lib/datepicker-types';

export type OptionsUsage = 'form' | 'code';

export default function displayOptionsTooltip(
    field: Field,
    usage: OptionsUsage,
    anchor: HTMLElement,
) {
    if (tooltip.visible) return;
    const config = new ValueOptionsConfig(field, usage);
    tooltip.show({
        view: config.view.bind(config),
        anchor,
        north: true,
    });
}

type BooleanOption = KeysOfType<FormatterOptions, boolean>;

class ValueOptionsConfig {
    field;
    usage;
    constructor(field: Field, usage: OptionsUsage) {
        this.field = field;
        this.usage = usage;
    }
    view() {
        const topic = this.usage === 'form' ? 'value' : 'code';
        return html`
            <div id="config-stage">
                <h1 class="precis">Configure ${topic} format</h1>
                ${this.escapeSelect()} ${this.escapeLfCB()} ${this.escapeCrCB()}
                ${this.uploadCharsetSelect()} ${this.downloadCharsetSelect()}
                ${this.compactedDisplayCB()}${this.datepickerTypeSelect()}
            </div>
        `;
    }
    get options() {
        return this.usage === 'form'
            ? this.field.formOptions()
            : this.field.codeOptions();
    }
    escapeSelect() {
        const { escapeNonAscii, escapeNonCharacters } = this.options;
        const selected = escapeNonAscii
            ? 'escapeNonAscii'
            : escapeNonCharacters
              ? 'escapeNonCharacters'
              : 'none';
        return containsStrings(this.field.state.type)
            ? html`
                  <p>
                      ${selectbox({
                          id: 'field-escaped-characters',
                          options: this.escapedCharsetOptions(),
                          selected,
                          '@change': this.escapedCharactersChanged.bind(this),
                      })}
                      <label for="field-escape-characters">escape</label>
                  </p>
              `
            : nothing;
    }
    escapedCharsetOptions = () => ({
        escapeNonAscii: 'non ASCII characters',
        escapeNonCharacters: 'non characters',
        none: 'none',
    });
    escapedCharactersChanged(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement) {
            this.field.updateOptions(this.usage, {
                escapeNonAscii: target.value === 'escapeNonAscii',
                escapeNonCharacters: target.value === 'escapeNonCharacters',
            });
        }
    }
    escapeLfCB() {
        const { escapeLf } = this.options;
        const type = this.field.state.type;
        return this.hasEscapeLfCrCBs(type)
            ? html`
                  <p>
                      ${checkbox({
                          id: 'escapeLf',
                          label: 'escape \\n line feed characters',
                          checked: escapeLf,
                          '@change': this.valueOptionChanged.bind(this, 'escapeLf'),
                      })}
                  </p>
              `
            : nothing;
    }
    escapeCrCB() {
        const { escapeCr } = this.options;
        const type = this.field.state.type;
        return this.hasEscapeLfCrCBs(type)
            ? html`
                  <p>
                      ${checkbox({
                          id: 'escapeCr',
                          label: 'escape \\r carriage return characters',
                          checked: escapeCr,
                          '@change': this.valueOptionChanged.bind(this, 'escapeCr'),
                      })}
                  </p>
              `
            : nothing;
    }
    hasEscapeLfCrCBs(type: AllowedType) {
        const formWithoutCB = ['domexception', 'error'].includes(type);
        const hasStrings = containsStrings(type);
        return (
            type === 'string' ||
            (this.usage === 'code' && hasStrings) ||
            (this.field.inputMethod !== 'form' && hasStrings && !formWithoutCB)
        );
    }
    valueOptionChanged(name: BooleanOption, event: InputEvent) {
        const target = event.target;
        if (target instanceof HTMLInputElement) {
            this.field.updateOptions(this.usage, { [name]: target.checked });
        }
    }
    compactedDisplayCB() {
        const label = this.usage === 'form' ? 'display compacted value' : 'return value';
        return isExpandable(this.field.state.type)
            ? html`
                  <p>
                      ${checkbox({
                          id: 'compacted',
                          label,
                          checked: this.options.compacted,
                          '@change': this.compactedDisplayChanged.bind(this),
                      })}
                  </p>
              `
            : nothing;
    }
    compactedDisplayChanged(event: InputEvent) {
        const target = event.target;
        if (target instanceof HTMLInputElement) {
            this.field.updateOptions(this.usage, { compacted: target.checked });
        }
    }
    uploadCharsetSelect() {
        const hasTextUpload = inputMethods(this.field.state.type).some((method: string) =>
            ['string-upload', 'csv-upload', 'json-upload'].includes(method),
        );
        return this.usage === 'form' && hasTextUpload
            ? html`
                  <p>
                      ${selectbox({
                          id: 'field-upload-charset',
                          options: selfMap(CHARSETS),
                          selected: this.field.uploadCharset,
                          '@change': this.uploadCharsetChanged.bind(this),
                      })}
                      <label for="field-upload-charset">charset of uploads</label>
                  </p>
              `
            : nothing;
    }
    uploadCharsetChanged(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement && isCharset(target.value)) {
            this.field.uploadCharset = target.value;
        }
    }
    downloadCharsetSelect() {
        const { type, downloadCharset } = this.field.state;
        return this.usage === 'form' && type === 'string'
            ? html`
                  <p>
                      ${selectbox({
                          id: 'field-download-charset',
                          options: selfMap(encodableCharsets()),
                          selected: downloadCharset,
                          '@change': this.downloadCharsetChanged.bind(this),
                      })}
                      <label for="field-download-charset">charset for downloads</label>
                  </p>
              `
            : nothing;
    }
    downloadCharsetChanged(event: Event) {
        const target = event.target;
        if (target instanceof HTMLSelectElement && isEncodableCharset(target.value)) {
            this.field.downloadCharset = target.value;
        }
    }
    datepickerTypeSelect() {
        const { datepickerType, type: typeName } = this.field.state;
        if (!this.hasDatepickerTypeSelect()) return nothing;

        const optionValues =
            typeName === 'number'
                ? ['', ...datepickerTypeOptions]
                : [...datepickerTypeOptions];

        return html`
            <p>
                ${selectbox({
                    id: 'field-datepicker-type',
                    options: selfMap(optionValues),
                    selected: datepickerType ?? '',
                    '@change': this.datepickerTypeChanged.bind(this),
                })}
                <label for="field-datepicker-type">type of datepicker</label>
            </p>
        `;
    }
    hasDatepickerTypeSelect() {
        const { type, columnFormat } = this.field.state;
        return (
            this.usage === 'form' &&
            (type === 'date' ||
                (type === 'number' &&
                    (columnFormat === 'date' || columnFormat === 'date/1000')))
        );
    }
    datepickerTypeChanged(event: Event) {
        const target = event.target;
        if (
            target instanceof HTMLSelectElement &&
            (isDatepickerTypeOption(target.value) || target.value === '')
        ) {
            const datepickerType = target.value === '' ? null : target.value;
            this.field.datepickerType = datepickerType;
            this.field.updateForm();
        }
    }
}
