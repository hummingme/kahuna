/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import DommatrixreadonlyField from './dommatrixreadonly-field';

export default class DommatrixField extends DommatrixreadonlyField {
    override get value(): DOMMatrix {
        return this.state.value as DOMMatrix;
    }
    override set value(value: unknown) {
        let result = new DOMMatrix();
        if (value instanceof DOMMatrixReadOnly) {
            result = DOMMatrix.fromMatrix(value);
        } else {
            const args = this.argsFromValue(value);
            if (args) {
                result = new DOMMatrix(args);
            }
        }
        this.state.value = result;
    }
    override fromFormValue(): DOMMatrix | undefined {
        const args = this.argFromField();
        if (args) {
            return new DOMMatrix(args);
        }
    }
}
