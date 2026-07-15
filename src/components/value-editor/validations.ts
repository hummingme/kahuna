/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { isArgsNumbersList } from '#components/value-editor/checkings';
import { isNumber } from '#lib/datatypes';

export function validatePositiveInteger(
    input?: HTMLElement,
    {
        required = false,
        zeroIncluded = true,
    }: {
        required?: boolean;
        zeroIncluded?: boolean;
    } = {},
) {
    let result: number | null = null;
    if (input instanceof HTMLInputElement) {
        const value = input.value.trim();
        if (value.length === 0 && required === false) {
            input.setCustomValidity('');
            return 0;
        } else if (
            isNumber(value) &&
            parseInt(value) >= 0 &&
            Number(value) === parseInt(value)
        ) {
            result = zeroIncluded || Number(value) > 0 ? Number(value) : null;
        }
        input.setCustomValidity(
            result !== null ? '' : 'Please enter a valid positive integer!',
        );
    }
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
