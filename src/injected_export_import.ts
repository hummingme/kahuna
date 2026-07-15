/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { exportDB, ExportOptions, importDB } from 'dexie-export-import';

import { getConnection } from '#lib/connection';
import { dexieExportFilter } from '#lib/dexie-utils';
import { downloadFile } from '#lib/utils';
import { InjectedExportArgs, InjectedImportArgs, Message } from '#types';

document.documentElement.setAttribute('data-kahuna-export-import-available', '1');

window.addEventListener('message', async (event) => {
    const msg: Message = event.data;
    switch (msg.type) {
        case 'injectedExport':
            doExport(msg.args);
            break;
        case 'injectedImport':
            doImport(msg.args);
            break;
    }
});

async function doExport(args: InjectedExportArgs) {
    const { database, table, usage, selected, selectorFields, prettyJson } = args;
    const dbHandle = await getConnection(database);
    const options: ExportOptions = { prettyJson: prettyJson };
    if (table && (usage === 'table' || usage === 'selection')) {
        options.filter =
            usage === 'selection' && selectorFields && selected
                ? dexieExportFilter(dbHandle.table(table), selectorFields, selected)
                : (t: string) => t === table;
    }
    let error = undefined;
    try {
        const content = await exportDB(dbHandle, options);
        downloadFile(content, args.filename, 'application/dexie');
    } catch (err: unknown) {
        error = err instanceof Error ? err : Error(String(err));
    }
    window.postMessage({ type: 'injectedExportResult', error });
}

async function doImport(args: InjectedImportArgs) {
    const { database, table, usage, fileUrl, options } = args;
    let error = undefined;
    try {
        const response = await fetch(fileUrl);
        URL.revokeObjectURL(fileUrl);
        const file = await response.blob();
        if (usage === 'origin') {
            await importDB(file, options);
        } else {
            const dbHandle = await getConnection(database);
            if (usage === table) {
                options.filter = (t: string) => t === table;
            }
            await dbHandle.import(file, options);
        }
    } catch (err: unknown) {
        error = err instanceof Error ? err : Error(String(err));
    }
    window.postMessage({ type: 'injectedImportResult', error });
}
