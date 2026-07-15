/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Int16arrayField extends TypedArrayField {
    typeConstructor = () => Int16Array;
    get value(): Int16Array {
        return this.state.value as Int16Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Int16Array.from(result);
    }
    override fromFormValue(): Int16Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Int16Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Int16Array'),
        'csv-upload': typedarrayCsvHint('Int16Array'),
    };
}
