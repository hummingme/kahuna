/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export const specialNumbers = new Map<string, number>([
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['NaN', NaN],
    ['Math.PI', Math.PI],
    ['Math.E', Math.E],
    ['Math.LN2', Math.LN2],
    ['Math.LN10', Math.LN10],
    ['Math.LOG2E', Math.LOG2E],
    ['Math.LOG10E', Math.LOG10E],
    ['Math.SQRT1_2', Math.SQRT1_2],
    ['Math.SQRT2', Math.SQRT2],
    ['Number.EPSILON', Number.EPSILON],
    ['Number.MAX_VALUE', Number.MAX_VALUE],
    ['Number.MIN_VALUE', Number.MIN_VALUE],
    ['Number.MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
    ['Number.MIN_SAFE_INTEGER', Number.MIN_SAFE_INTEGER],
    ['Number.POSITIVE_INFINITY', Infinity],
    ['Number.NEGATIVE_INFINITY', -Infinity],
    ['Number.NaN', NaN],
]);

export const specialNumbersNames = new Map<number, string>([
    [Infinity, 'Infinity'],
    [-Infinity, '-Infinity'],
    [NaN, 'NaN'],
    [Math.PI, 'Math.PI'],
    [Math.E, 'Math.E'],
    [Math.LN2, 'Math.LN2'],
    [Math.LN10, 'Math.LN10'],
    [Math.LOG2E, 'Math.LOG2E'],
    [Math.LOG10E, 'Math.LOG10E'],
    [Math.SQRT1_2, 'Math.SQRT1_2'],
    [Math.SQRT2, 'Math.SQRT2'],
    [Number.EPSILON, 'Number.EPSILON'],
    [Number.MAX_VALUE, 'Number.MAX_VALUE'],
    [Number.MIN_VALUE, 'Number.MIN_VALUE'],
    [Number.MAX_SAFE_INTEGER, 'Number.MAX_SAFE_INTEGER'],
    [Number.MIN_SAFE_INTEGER, 'Number.MIN_SAFE_INTEGER'],
]);

export const realNumbersNames = new Set<string>([
    'Math.PI',
    'Math.LN2',
    'Math.LN10',
    'Math.LOG2E',
    'Math.LOG10E',
    'Math.SQRT1_2',
    'Math.SQRT2',
    'Number.EPSILON',
    'Number.MAX_VALUE',
    'Number.MIN_VALUE',
    'Number.MAX_SAFE_INTEGER',
    'Number.MIN_SAFE_INTEGER',
]);
