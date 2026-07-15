/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedBigArrayField from '#components/value-editor/fields/typedbigarray-field';
import {
    arrayToBigUint64Array,
    stringToArrayOfBigInt,
} from '#components/value-editor/converter';
import { bigint64arrayFormHint, typedarrayCsvHint } from '#components/value-editor/hints';

export default class Biguint64arrayField extends TypedBigArrayField {
    typeConstructor = () => BigUint64Array;
    get value(): BigUint64Array {
        return this.state.value as BigUint64Array;
    }
    set value(value: unknown) {
        const values: bigint[] = super.toArray(value);
        this.state.value = arrayToBigUint64Array(values);
    }
    fromFormValue(): BigUint64Array | undefined {
        const textarea = this.node.value;
        if (textarea instanceof HTMLTextAreaElement) {
            return arrayToBigUint64Array(stringToArrayOfBigInt(textarea.value));
        }
    }
    hints = {
        form: bigint64arrayFormHint('BigUint64Array'),
        'csv-upload': typedarrayCsvHint('BigUint64Array'),
    };
}
