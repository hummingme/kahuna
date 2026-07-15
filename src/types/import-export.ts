/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { ImportOptions } from 'dexie-export-import';

export const DATA_FORMATS = ['json', 'csv', 'dexie'] as const;

export type ExportFormat = (typeof DATA_FORMATS)[number];
export type ImportFormat = (typeof DATA_FORMATS)[number];

export type ImportUsage = 'origin' | 'database' | 'table';
export type ExportUsage = 'database' | 'table' | 'selection';

export type ImportDexieOptions = {
    clearTablesBeforeImport: boolean;
    overwriteValues: boolean;
    acceptNameDiff: boolean;
    acceptVersionDiff: boolean;
    acceptChangedPrimaryKey: boolean;
    acceptMissingTables: boolean;
    noTransaction: boolean;
};

export type InjectedExportArgs = {
    database: string;
    table?: string;
    filename: string;
    usage: ExportUsage;
    selectorFields?: string[];
    selected?: Set<string | number>;
    prettyJson: boolean;
};

export type InjectedImportArgs = {
    database: string;
    table?: string;
    fileUrl: string;
    usage: ImportUsage;
    options: ImportOptions;
};
