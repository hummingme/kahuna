/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { EmptyAsValue, ImportFormat } from '#types';

export type ImportOptions = {
    dataImportFormat: ImportFormat;
    primaryKeyName: string;
    importDirectValues: boolean;
    directValuesName: string;
    importEmptyAs: EmptyAsValue;
    clearTablesBeforeImport: boolean;
    overwriteValues: boolean;
    acceptNameDiff: boolean;
    acceptVersionDiff: boolean;
    acceptChangedPrimaryKey: boolean;
    acceptMissingTables: boolean;
    noTransaction: boolean;
};

export const importDefaultOptions = (): ImportOptions => {
    return {
        dataImportFormat: 'dexie', // fixed for database, for table could be also csv and json
        primaryKeyName: 'key', // for csv & json, if pk is unnamed
        importDirectValues: false, // for csv & json
        directValuesName: 'value', // for csv & json
        importEmptyAs: 'empty string', // |'null', 'undefined', 'exclude' ; for csv
        clearTablesBeforeImport: false, // database & table, all formats
        overwriteValues: false, // database & table, all formats
        acceptNameDiff: true, // database & table, for dexie
        acceptVersionDiff: true, // database & table, for dexie
        acceptChangedPrimaryKey: true, // database & table, for dexie
        acceptMissingTables: true, // database, for dexie
        noTransaction: false, // database & table, for dexie
    };
};
