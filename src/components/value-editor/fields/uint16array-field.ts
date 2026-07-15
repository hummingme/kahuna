/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Uint16arrayField extends TypedArrayField {
    typeConstructor = () => Uint16Array;
    get value(): Uint16Array {
        return this.state.value as Uint16Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Uint16Array.from(result);
    }
    override fromFormValue(): Uint16Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Uint16Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Uint16Array'),
        'csv-upload': typedarrayCsvHint('Uint16Array'),
    };
}
