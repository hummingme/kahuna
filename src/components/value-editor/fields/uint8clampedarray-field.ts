/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedArrayField from '#components/value-editor/fields/typedarray-field';
import { typedarrayCsvHint, typedarrayFormHint } from '#components/value-editor/hints';

export default class Uint8clampedarrayField extends TypedArrayField {
    typeConstructor = () => Uint8ClampedArray;
    get value(): Uint8ClampedArray {
        return this.state.value as Uint8ClampedArray;
    }
    set value(value: unknown) {
        if (value instanceof ImageData && value.data instanceof Uint8ClampedArray) {
            this.state.value = value.data;
            return;
        }
        const result: number[] = super.toArray(value);
        this.state.value = Uint8ClampedArray.from(result);
    }
    override fromFormValue(): Uint8ClampedArray | undefined {
        const values = super.fromFormValue();
        if (values instanceof Array) {
            return new Uint8ClampedArray(values);
        }
    }
    hints = {
        form: typedarrayFormHint('Uint8ClampedArray'),
        'csv-upload': typedarrayCsvHint('Uint8ClampedArray'),
    };
}
