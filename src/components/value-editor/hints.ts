/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export function jsonHint(typename: string, example: string) {
    return `The form input for an ${typename} must be in JSON syntax.

${jsonAllowedValuesHint()} Example: ${example}
        
${useCodeareaHint(typename)}`;
}

export function jsonAllowedValuesHint() {
    return `Only numbers, strings, boolean values (true, false),
and null are allowed. Strings must be enclosed in
double quotes.`;
}

export function useCodeareaHint(typename: string) {
    return `For ${typename}s with other values, the javascript code input
can be used.`;
}

export function csvFormatHint() {
    return `Values are comma-separated, strings may be
double-quoted, and null, undefined, true, and false
are parsed as their native types.`;
}

export function bigint64arrayFormHint(typename: 'BigInt64Array' | 'BigUint64Array') {
    const unsigned = typename === 'BigUint64Array' ? 'unsigned' : '';
    const example =
        typename === 'BigInt64Array'
            ? '-1234; 0, 12 | 0x123'
            : '1, 234, 0b1110; 8 | 0x444';
    return `The valid form input for a ${typename} is either
an array of ${unsigned} integers or a list of ${unsigned} integers
separated by commas, semicolons, or bars.
Example: ${example}

${outOfBoundHint(typename)}`;
}

export function typedarrayCsvHint(typename: string) {
    const integer = ['BigInt64Array', 'BigUint64Array'].includes(typename)
        ? 'integer '
        : '';
    return `From a single-line file, all values are used; from a multi-line
file, the first value of each line is used.

The values must be ${integer}numbers separated by commas.
${outOfBoundHint(typename)}`;
}

export function typedarrayFormHint(typename: string) {
    const n = typename[0] === 'F' ? '' : 'n';
    return `The valid form input for a${n} ${typename} is either
an array of numbers or a list of numbers separated
by commas, semicolons, or bars (, ; |).
Examples: [12, 22, 109], or: 12; 22, 109

${outOfBoundHint(typename)}`;
}

function outOfBoundHint(typename: string) {
    if (typename.startsWith('Float')) {
        return 'Out of bound numbers become Infinity / -Infinity.';
    }
    return typename !== 'Uint8ClampedArray'
        ? 'Out of bound numbers will cause a number overflow.'
        : '';
}
