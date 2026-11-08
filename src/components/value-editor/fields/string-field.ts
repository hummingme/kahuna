/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { isFlexInputNode } from '#components/value-editor/flex-input';
import Field from '#components/value-editor/fields/field';
import { getType } from '#lib/datatypes';
import { isLarge } from '#lib/datatype-attributes';
import { unescapeString } from '#lib/escape-string';
import { decodeFromFile } from '#lib/decode-string';

export default class StringField extends Field {
    formView() {
        const value = this.toFormValue() || '';
        return this.flexInput ? this.flexInput.view(value) : '';
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
        if (isFlexInputNode(this.nodeInput)) {
            return unescapeString(this.nodeInput.value);
        }
    }
    override async handleUploadedValue(file: File) {
        if (!this.flexInput || !this.codearea) return;
        const value = await decodeFromFile(file, this.state.uploadCharset);
        const compacted = this.value.length >= isLarge('string');
        this.formatterMgr.setOptions('form', { compacted });
        this.formatterMgr.setOptions('code', { compacted });
        this.update(value);
    }
    hints = {
        'string-upload': () => `A ${this.uploadCharset} encoded file is expected.`,
    };
}
