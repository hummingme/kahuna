/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Float16arrayField extends TypedArrayField {
    typeConstructor = () => Float16Array;
    get value(): Float16Array {
        return this.state.value as Float16Array;
    }
    set value(value: unknown) {
        if (value instanceof ImageData && value.data instanceof Float16Array) {
            this.state.value = value.data;
            return;
        }
        const result: number[] = super.toArray(value);
        this.state.value = Float16Array.from(result);
    }
    override fromFormValue(): Float16Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Float16Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Float16Array'),
        'csv-upload': typedarrayCsvHint('Float16Array'),
    };
}
