/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { jsonAllowedValuesHint, useCodeareaHint } from '#components/value-editor/hints';
import { isFlexInputNode } from '#components/value-editor/flex-input';
import { isPlainObject } from '#lib/datatypes';

export default class MapField extends Field {
    formView() {
        const value = this.toFormValue() || '';
        return this.flexInput ? this.flexInput.view(value) : '';
    }
    set value(value: unknown) {
        let result: Map<unknown, unknown> = new Map();
        if (value instanceof Map) {
            result = value;
        } else if (this.isMapLikeArray(value)) {
            result = new Map(value as Map<unknown, unknown>);
        } else if (isPlainObject(value)) {
            result = new Map(Object.entries(value));
        }
        this.state.value = result;
    }
    get value(): Map<unknown, unknown> {
        return this.state.value as Map<unknown, unknown>;
    }
    toFormValue(): string {
        const options = this.formOptions();
        return this.state.inputMethod === 'form' && options.compacted
            ? this.stringFormatter.render(this.value, 'map', options)
            : this.stringFormatter.render(
                  [...this.value.entries()],
                  'array',
                  Object.assign(options, { escapeForJson: true }),
              );
    }
    fromFormValue(): Map<unknown, unknown> | undefined {
        if (this.state.inputMethod === 'form') {
            const node = this.nodeInput;
            if (isFlexInputNode(node)) {
                let value = new Map();
                try {
                    const parsed = JSON.parse(node.value);
                    if (this.isMapLikeArray(parsed)) {
                        value = new Map(parsed);
                    }
                } catch {} // eslint-disable-line no-empty
                return value;
            }
        }
    }
    isMapLikeArray(value: unknown) {
        return (
            Array.isArray(value) &&
            value.every((ele) => Array.isArray(ele) && ele.length === 2)
        );
    }
    validate(value: string) {
        let parsed: unknown[] | null = null;
        try {
            parsed = JSON.parse(value);
        } catch {} // eslint-disable-line no-empty
        return this.isMapLikeArray(parsed);
    }
    override invalidHint =
        'The form value must be an array of tuple arrays in json syntax (e.g. [["a",1], ["b",22]] )!';
    hints = {
        form: `The form input for a Map must be an array of tuple arrays
in JSON syntax.
        
${jsonAllowedValuesHint()} Example: [["a", "b"], ["c", false], [1, 3]]
        
${useCodeareaHint('Map')}`,
    };
}
