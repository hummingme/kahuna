/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

const rxLineTerminator = /[\n\r\u2028\u2029]/;

export default function quotedString(val: string) {
    if (rxLineTerminator.test(val)) {
        return `\`${escapeForTemplateLiteral(val)}\``;
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

const rxTemplateLiteral = /[`\\]|\$\{/g;
function escapeForTemplateLiteral(value: string): string {
    return value.replace(rxTemplateLiteral, (match) =>
        match === '${' ? '\\${' : '\\' + match,
    );
}
