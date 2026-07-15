/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Uint8arrayField extends TypedArrayField {
    typeConstructor = () => Uint8Array;
    get value(): Uint8Array {
        return this.state.value as Uint8Array;
    }
    set value(value: unknown) {
        const result: number[] = super.toArray(value);
        this.state.value = Uint8Array.from(result);
    }
    override fromFormValue(): Uint8Array | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Uint8Array(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Uint8Array'),
        'csv-upload': typedarrayCsvHint('Uint8Array'),
    };
}
