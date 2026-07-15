/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import TypedBigArrayField from '#components/value-editor/fields/typedbigarray-field';
import {
    arrayToBigInt64Array,
    stringToArrayOfBigInt,
} from '#components/value-editor/converter';
import { bigint64arrayFormHint, typedarrayCsvHint } from '#components/value-editor/hints';

export default class Bigint64arrayField extends TypedBigArrayField {
    typeConstructor = () => BigInt64Array;
    get value(): BigInt64Array {
        return this.state.value as BigInt64Array;
    }
    set value(value: unknown) {
        const values: bigint[] = super.toArray(value);
        this.state.value = arrayToBigInt64Array(values);
    }
    fromFormValue(): BigInt64Array | undefined {
        const textarea = this.node.value;
        if (textarea instanceof HTMLTextAreaElement) {
            return arrayToBigInt64Array(stringToArrayOfBigInt(textarea.value));
        }
    }
    hints = {
        form: bigint64arrayFormHint('BigInt64Array'),
        'csv-upload': typedarrayCsvHint('BigInt64Array'),
    };
}
