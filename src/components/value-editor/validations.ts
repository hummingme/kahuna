/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { isArgsNumbersList } from '#components/value-editor/checkings';
import { isNumber } from '#lib/datatypes';

type ValidatePositiveIntegerOptions = {
    required?: boolean;
    zeroIncluded?: boolean;
    max?: number;
};

export function validatePositiveInteger(
    input: HTMLElement | undefined,
    options: ValidatePositiveIntegerOptions = {},
): number | null {
    const {
        required = false,
        zeroIncluded = true,
        max = Number.POSITIVE_INFINITY,
    } = options;
    if (!(input instanceof HTMLInputElement)) {
        return null;
    }
    input.setCustomValidity('');
    if (!input.validity.valid) {
        return null;
    }

    const value = input.value.trim();
    if (value.length === 0 && !required) {
        input.setCustomValidity('');
        return 0;
    }
    const numericValue = Number(value);
    const isValidInteger =
        isNumber(value) && Number.isInteger(numericValue) && numericValue >= 0;

    let result: number | null = null;
    if (isValidInteger && numericValue <= max && (zeroIncluded || numericValue > 0)) {
        result = numericValue;
    }
    const maxHint = max < Number.POSITIVE_INFINITY ? ` no greater than ${max}` : '';
    input.setCustomValidity(
        result !== null ? '' : `Please enter a valid positive integer${maxHint}!`,
    );
    return result;
}

export function validateASCII(input?: HTMLElement, required = true) {
    let result: string | null = null;
    if (input instanceof HTMLInputElement) {
        const value = input.value.trim();
        if (value.length === 0 && required === false) {
            input.setCustomValidity('');
            return '';
        } else if (/^[\x20-\x7F]+$/.test(value)) {
            result = value;
        }
        input.setCustomValidity(
            result !== null ? '' : 'Please enter a string of ASCII characters!',
        );
    }
    return result;
}

export function validateDOMPoint(input?: HTMLElement, name = 'DOMPoint') {
    let valid = true;
    if (input instanceof HTMLInputElement) {
        valid = isArgsNumbersList(input.value, 4);
        input.setCustomValidity(
            valid
                ? ''
                : `Please enter ${name} arguments as a comma separated list of up to four numbers (x, y, z, w)!`,
        );
    }
    return valid;
}
