/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Float64arrayField extends TypedArrayField {
    typeConstructor = () => Float64Array;
    get value(): Float64Array {
        return this.state.value as Float64Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Float64Array.from(result);
    }
    override fromFormValue(): Float64Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Float64Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Float64Array'),
        'csv-upload': typedarrayCsvHint('Float64Array'),
    };
}
