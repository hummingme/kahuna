/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

type ApplicationDefaultOptions = {
    colorScheme: 'browser' | 'dark' | 'light';
    colorSchemeOrigin: 'same' | 'dark' | 'light';
    colorStringDarkmode: string;
    colorNumberDarkmode: string;
    colorStringLightmode: string;
    colorNumberLightmode: string;
    dontNotifyEmpty: boolean;
    ignoreDatabases: string[];
};

const applicationDefaultOptions = (): ApplicationDefaultOptions => {
    return {
        colorScheme: 'browser',
        colorSchemeOrigin: 'same',
        colorStringDarkmode: '#a9a2f9',
        colorNumberDarkmode: '#7ec699',
        colorStringLightmode: '#8c1212',
        colorNumberLightmode: '#045704',
        dontNotifyEmpty: true,
        ignoreDatabases: ['__dbnames'],
    };
};

export default applicationDefaultOptions;
