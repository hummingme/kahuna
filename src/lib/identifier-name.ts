/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

const identifierName = /^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u;

export const isIdentifierName = (str: string): boolean => identifierName.test(str);
