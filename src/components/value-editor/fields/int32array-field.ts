/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Int32arrayField extends TypedArrayField {
    typeConstructor = () => Int32Array;
    get value(): Int32Array {
        return this.state.value as Int32Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Int32Array.from(result);
    }
    override fromFormValue(): Int32Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Int32Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Int32Array'),
        'csv-upload': typedarrayCsvHint('Int32Array'),
    };
}
