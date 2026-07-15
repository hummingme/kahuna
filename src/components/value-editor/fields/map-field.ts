/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import Field from '#components/value-editor/fields/field';
import { jsonAllowedValuesHint, useCodeareaHint } from '#components/value-editor/hints';
import { valueControlsTextareaView } from '#components/value-editor/view-utils';
import { isPlainObject } from '#lib/datatypes';

export default class MapField extends Field {
    view() {
        return valueControlsTextareaView(this);
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
        return this.state.inputMethod === 'form' && options.expanded
            ? this.stringFormatter.render(
                  [...this.value.entries()],
                  'array',
                  Object.assign(options, { escapeForJson: true }),
              )
            : this.stringFormatter.render(this.value, 'map', options);
    }
    fromFormValue(): Map<unknown, unknown> | undefined {
        if (this.state.inputMethod === 'form') {
            const textarea = this.node.value;
            if (textarea instanceof HTMLTextAreaElement) {
                let value = new Map();
                try {
                    const parsed = JSON.parse(textarea.value);
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
    validateTextareaValue(value: string) {
        let parsed: unknown[] | null = null;
        try {
            parsed = JSON.parse(value);
        } catch {} // eslint-disable-line no-empty
        return this.isMapLikeArray(parsed);
    }
    invalidTextareaHint =
        'The form value must be an array of tuple arrays in json syntax (e.g. [["a",1], ["b",22]] )!';
    hints = {
        form: `The form input for a Map must be an array of tuple arrays
in JSON syntax.
        
${jsonAllowedValuesHint()} Example: [["a", "b"], ["c", false], [1, 3]]
        
${useCodeareaHint('Map')}`,
    };
}
