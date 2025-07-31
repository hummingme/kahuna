/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

const applicationDefaultOptions = (): {
    colorScheme: 'browser' | 'dark' | 'light';
    colorSchemeOrigin: 'same' | 'dark' | 'light';
    dontNotifyEmpty: boolean;
    ignoreDatabases: string[];
} => {
    return {
        colorScheme: 'browser',
        colorSchemeOrigin: 'same',
        dontNotifyEmpty: true,
        ignoreDatabases: ['__dbnames'],
    };
};

export default applicationDefaultOptions;
