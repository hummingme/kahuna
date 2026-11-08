/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export function addTimezoneOffset(date: Date) {
    return new Date(date.getTime() + offsetMs(date));
}

export function subTimezoneOffset(date: Date) {
    return new Date(date.getTime() - offsetMs(date));
}

function offsetMs(date: Date) {
    return date.getTimezoneOffset() * 60 * 1000;
}
