/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';

import type Field from '#components/value-editor/fields/field';
import tooltip from '#components/tooltip';
import {
    CHARSETS,
    encodableCharsets,
    isCharset,
    isEncodableCharset,
} from '#lib/charsets';
import checkbox from '#lib/checkbox';
import { selectbox } from '#lib/selectbox';
import { selfMap } from '#lib/utils';
import type { AllowedType, FormatterOptions } from '#lib/value-formatter';
import type { KeysOfType } from '#types';
import { containsStrings, inputMethods, isExpandable } from '#lib/datatype-attributes';

export type OptionsUsage = 'form' | 'code';

export default function displayOptionsTooltip(
    field: Field,
    usage: OptionsUsage,
    anchor: HTMLElement,
) {
    if (tooltip.visible) return;
    const config = new ValueOptionsConfig(field, usage, tooltip.rerender.bind(tooltip));
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
    rerender;
    constructor(field: Field, usage: OptionsUsage, rerender: () => void) {
        this.field = field;
        this.usage = usage;
        this.rerender = rerender;
    }
    view() {
        const topic = this.usage === 'form' ? 'value' : 'code';
        return html`
            <div id="config-stage">
                <h1 class="precis">Configure ${topic} format</h1>
                ${this.escapeNonCharactersCB()} ${this.unescapeLineFeedsCB()}
                ${this.uploadCharsetSelect()} ${this.downloadCharsetSelect()}
                ${this.compactedDisplayCB()}
            </div>
        `;
    }
    get options() {
        return this.usage === 'form'
            ? this.field.state.formOptions
            : this.field.state.codeOptions;
    }
    escapeNonCharactersCB() {
        const { escapeNonCharacters } = this.options;
        return containsStrings(this.field.state.type)
            ? html`
                  <p>
                      ${checkbox({
                          id: 'escapeNonCharacters',
                          label: 'escape non characters',
                          checked: escapeNonCharacters,
                          '@change': this.valueOptionChanged.bind(
                              this,
                              'escapeNonCharacters',
                          ),
                      })}
                  </p>
              `
            : nothing;
    }
    unescapeLineFeedsCB() {
        const { unescapedLineFeeds } = this.options;
        const type = this.field.state.type;
        return this.hasUnescapedLineFeedsCB(type)
            ? html`
                  <p>
                      ${checkbox({
                          id: 'unescapedLineFeeds',
                          label: "don't escape \\n line feed characters",
                          checked: unescapedLineFeeds,
                          '@change': this.valueOptionChanged.bind(
                              this,
                              'unescapedLineFeeds',
                          ),
                      })}
                  </p>
              `
            : nothing;
    }
    hasUnescapedLineFeedsCB(type: AllowedType) {
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
                          id: 'expanded',
                          label,
                          checked: !this.options.expanded,
                          '@change': this.compactedDisplayChanged.bind(this),
                      })}
                  </p>
              `
            : nothing;
    }
    compactedDisplayChanged(event: InputEvent) {
        const target = event.target;
        if (target instanceof HTMLInputElement) {
            this.field.updateOptions(this.usage, { expanded: !target.checked });
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
}
