/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import DomrectField from './domrect-field';

export default class DomrectreadonlyField extends DomrectField {
    override get value(): DOMRectReadOnly {
        return this.state.value as DOMRectReadOnly;
    }
    override set value(value: unknown) {
        let result = new DOMRectReadOnly();
        if (value instanceof DOMRectReadOnly) {
            result = DOMRectReadOnly.fromRect(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMRectReadOnly(...args);
            }
        }
        this.state.value = result;
    }
    override fromFormValue(): DOMRectReadOnly | undefined {
        const args = this.argsFromField();
        if (args) {
            return new DOMRectReadOnly(...args);
        }
    }
}
