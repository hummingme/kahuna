/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { isIdentifierName } from '#lib/identifier-name';

export function validateIndexesString(indexes: string) {
    const [primaryKey, ...rest] = indexes.split(',');
    const otherIndexes = rest.join(',');
    return validatePrimKey(primaryKey) && validateIndexes(otherIndexes);
}

export function validateIndexes(value: string): boolean {
    if (value === '') return true;
    const parts = value
        .split(',')
        .map((p) => p.trim())
        .map((p) => p.replace(/^([&*])/, ''));
    if (parts.some((p) => p.length === 0)) {
        return false;
    }
    const keypaths = [];
    for (let part of parts) {
        if (part.startsWith('[') && part.endsWith(']')) {
            part = part.substring(1, part.length - 1);
            keypaths.push(...part.split('+'));
        } else {
            keypaths.push(part);
        }
    }
    const identifiers = [];
    for (const keypath of keypaths) {
        identifiers.push(...keypath.split('.'));
    }
    return identifiers.every((id) => isIdentifierName(id));
}

export function validatePrimKey(value: string): boolean {
    let identifiers: string[] = [];
    if (value.startsWith('++')) {
        value = value.substring(2);
        identifiers = value.split('.');
    } else if (value.startsWith('[') && value.endsWith(']')) {
        value = value.substring(1, value.length - 1);
        const parts = value.split('+');
        if (parts.length < 2) return false;
        parts.forEach((part) => {
            identifiers.push(...part.split('.'));
        });
    } else {
        identifiers = value.split('.');
    }
    return value.length === 0 || identifiers.every((id) => isIdentifierName(id));
}
