/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { isFlexInputNode } from '#components/value-editor/flex-input';
import Field, { type ValueFieldArgs } from '#components/value-editor/fields/field';
import { jsonHint } from '#components/value-editor/hints';
import messageStack from '#components/messagestack';
import { isJsonSerializable, isPlainObject } from '#lib/datatypes';
import { decodeFromFile } from '#lib/decode-string';

export default class ObjectField extends Field {
    constructor(args: ValueFieldArgs) {
        super(args);
        if (this.isFormEditable(args.value)) {
            this.inputMethod = 'form';
        }
    }
    formView() {
        const value = this.toFormValue() || '';
        return this.flexInput ? this.flexInput.view(value) : '';
    }
    set value(value: unknown) {
        let result: Record<string | number, unknown> = {};
        if (isPlainObject(value)) {
            result = value;
        } else if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (isPlainObject(parsed)) {
                    result = parsed;
                }
            } catch {} // eslint-disable-line no-empty
        } else if (
            value instanceof Map &&
            [...value.entries()].every((entry) => typeof entry[0] === 'string')
        ) {
            result = Object.fromEntries(value);
        }
        this.state.value = result;
    }
    get value(): object {
        return this.state.value as object;
    }
    toFormValue(): string {
        const options = this.formOptions(
            this.state.inputMethod === 'form' ? { escapeForJson: true } : {},
        );
        return this.stringFormatter.render(this.value, 'object', options);
    }
    fromFormValue(): object | undefined {
        const node = this.nodeInput;
        if (isFlexInputNode(node)) {
            let value = {};
            try {
                const parsed = JSON.parse(node.value);
                if (isPlainObject(value)) {
                    value = parsed;
                }
            } catch {} // eslint-disable-line no-empty
            return value;
        }
    }
    isFormEditable(value: unknown) {
        return !isPlainObject(value) || isJsonSerializable(value);
    }
    validate(value: string) {
        return isPlainObject(JSON.parse(value));
    }
    override invalidHint = 'The form value must be an object in json syntax!';
    override async handleUploadedValue(file: File) {
        let result: object | undefined;
        const { uploadCharset } = this.state;
        try {
            const content = await decodeFromFile(file, uploadCharset);
            const parsed = JSON.parse(content);
            if (isPlainObject(parsed)) {
                result = parsed;
            }
        } catch {} // eslint-disable-line no-empty
        if (result) {
            this.update(result);
        } else {
            messageStack.displayWarning(
                "The uploaded file didn't contain a valid object in json syntax!",
            );
        }
    }
    hints = {
        form: jsonHint('Object', '{ "p1": "abc", "p2": false }'),
        'json-upload': () => `The uploaded file must contain
a single Object in JSON syntax.

A ${this.uploadCharset} encoded file is expected.`,
    };
}
