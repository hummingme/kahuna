/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import DompointField from './dompoint-field';

export default class DompointreadonlyField extends DompointField {
    override get value(): DOMPointReadOnly {
        return this.state.value as DOMPointReadOnly;
    }
    override set value(value: unknown) {
        let result = new DOMPointReadOnly();
        if (value instanceof DOMPointReadOnly) {
            result = DOMPointReadOnly.fromPoint(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMPointReadOnly(...args);
            }
        }
        this.state.value = result;
    }
    override fromFormValue(): DOMPointReadOnly | undefined {
        const args = this.argsFromField();
        if (args) {
            return new DOMPointReadOnly(...args);
        }
    }
}
