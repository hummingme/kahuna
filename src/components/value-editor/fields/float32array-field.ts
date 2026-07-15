/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Float32arrayField extends TypedArrayField {
    typeConstructor = () => Float32Array;
    get value(): Float32Array {
        return this.state.value as Float32Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Float32Array.from(result);
    }
    override fromFormValue(): Float32Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Float32Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Float32Array'),
        'csv-upload': typedarrayCsvHint('Float32Array'),
    };
}
