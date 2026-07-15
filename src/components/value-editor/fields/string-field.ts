/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import Field from '#components/value-editor/fields/field';
import { getType } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import { unescapeUnicode } from '#lib/escape-unicode';
import { decodeFromFile } from '#lib/decode-string';

export default class StringField extends Field {
    view() {
        return valueControlsTextareaView(this);
    }
    get value(): string {
        return this.state.value as string;
    }
    set value(value: unknown) {
        let result = '';
        if (
            Array.isArray(value) &&
            value.every((v) => ['number', 'string'].includes(typeof v))
        ) {
            result = value.join(',');
        } else if (getType(value) === 'set') {
            const vals = [...(value as Set<unknown>).values()];
            if (vals.every((v) => ['number', 'string'].includes(typeof v))) {
                result = vals.join(',');
            }
        } else if (value instanceof Date) {
            result = value.toISOString();
        } else {
            result = value === null || value === undefined ? '' : value.toString();
        }
        this.state.value = result;
    }
    toFormValue(): string {
        return this.stringFormatter.render(this.value, 'string', this.formOptions());
    }
    fromFormValue(): string | undefined {
        if (this.node.value instanceof HTMLTextAreaElement) {
            return unescapeUnicode(this.node.value.value);
        }
    }
    override async handleUploadedValue(file: File) {
        if (!this.textarea || !this.codearea) return;
        const value = await decodeFromFile(file, this.state.uploadCharset);
        this.state.formOptions.expanded = this.state.codeOptions.expanded =
            this.value.length < isLarge('string');
        this.update(value);
    }
    hints = {
        'string-upload': () => `A ${this.uploadCharset} encoded file is expected.`,
    };
}
