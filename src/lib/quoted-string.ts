/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export default function quotedString(val: string, handleBackslash: boolean) {
    if (/[\n\r]/.test(val)) {
        return `\`${escapeForTemplateLiteral(val, handleBackslash)}\``;
    } else {
        return escapeQuotes(val);
    }
}

function escapeQuotes(val: string) {
    if (val.includes("'") && val.includes('"')) {
        return `"${val.replaceAll('"', '\\"')}"`;
    }
    return val.includes("'") ? `"${val}"` : `'${val}'`;
}

function escapeForTemplateLiteral(value: string, handleBackslash: boolean): string {
    const rx = handleBackslash ? /[`\\]|\$\{/g : /`|\$\{/g;
    return value.replace(rx, (match) => (match === '${' ? '\\${' : '\\' + match));
}
