/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Uint32arrayField extends TypedArrayField {
    typeConstructor = () => Uint32Array;
    get value(): Uint32Array {
        return this.state.value as Uint32Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Uint32Array.from(result);
    }
    override fromFormValue(): Uint32Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Uint32Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Uint32Array'),
        'csv-upload': typedarrayCsvHint('Uint32Array'),
    };
}
