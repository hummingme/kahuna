/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { itemsPerLine } from '#lib/datatype-attributes';
import {
    type AllowedType,
    formatterOptions,
    type FormatterOptions,
} from '#lib/value-formatter';

export class FieldFormatterManager {
    private formOpts: FormatterOptions;
    private codeOpts: FormatterOptions;
    private type: AllowedType;
    private defaultOverrides: () => Partial<FormatterOptions>;
    constructor(type: AllowedType, defaultOverrides: () => Partial<FormatterOptions>) {
        this.type = type;
        this.defaultOverrides = defaultOverrides;
        this.formOpts = this.defaultValueOptions();
        this.codeOpts = this.defaultValueOptions();
    }
    defaultValueOptions(): FormatterOptions {
        return {
            ...formatterOptions(),
            escapeBackslash: true,
            perLine: itemsPerLine(this.type),
            ...this.defaultOverrides(),
        };
    }
    variableOptions(options: Partial<FormatterOptions>): Partial<FormatterOptions> {
        const {
            escapeBackslash,
            ident,
            offset,
            perLine,
            trimLength,
            valign,
            ...variable
        } = options;
        return variable;
    }
    getVariableFormOptions() {
        return this.variableOptions({ ...this.formOpts });
    }

    getVariableCodeOptions() {
        return this.variableOptions({ ...this.codeOpts });
    }
    getFormOptions(overrides: Partial<FormatterOptions> = {}): FormatterOptions {
        return { ...this.formOpts, ...overrides };
    }
    getCodeOptions(overrides: Partial<FormatterOptions> = {}): FormatterOptions {
        return { ...this.codeOpts, ...overrides };
    }
    setOptions(usage: 'form' | 'code', options: Partial<FormatterOptions>) {
        if (usage === 'form') {
            this.formOpts = { ...this.formOpts, ...options };
        } else {
            this.codeOpts = { ...this.codeOpts, ...options };
        }
    }
}
