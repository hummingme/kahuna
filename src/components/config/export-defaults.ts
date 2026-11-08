/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { ExportFormat } from '#types';

export type ExportOptions = {
    dataExportFormat: ExportFormat;
    primaryKeyName: string;
    directValuesName: string;
    prettyDexie: boolean;
    prettyJSON: boolean;
    filenameDatabase: string;
    filenameTable: string;
    filenameSelection: string;
};

export const exportDefaultOptions = (): ExportOptions => {
    return {
        dataExportFormat: 'json', // FOR tables & selections, dexie|csv|json
        filenameDatabase: '{db}-{date}-{time}.{format}',
        filenameTable: '{table}-{date}-{time}.{format}',
        filenameSelection: '{table}-part.{format}',
        primaryKeyName: 'key', // for csv & json, if pk is unnamed
        directValuesName: 'value', // for csv & json
        prettyDexie: false, // all targets, all formats
        prettyJSON: false, // all targets, all formats
    };
};
