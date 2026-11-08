/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import configLayer from '#components/configlayer';
import datatable from '#components/datatable';
import messageStack from '#components/messagestack';
import { toolEntry } from '#components/parts/tool-entry';
import appStore from '#lib/app-store';
import { getConnection } from '#lib/connection';
import { isPlainObject } from '#lib/datatypes';
import { getCollection } from '#lib/dexie-utils';
import settings from '#lib/settings';
import { plural } from '#lib/utils';
import type { AppTarget, SettingObject, UnknownRecord } from '#types';

const scrubblerTable = () => {
    const { database, table } = appStore.target();
    return isScrubblerDb(database) && ['edits', 'scrobbles'].includes(table)
        ? { database, table }
        : {};
};

const isScrubblerDb = (databaseName: string) => {
    return /^scrobble-scrubbler\.[a-zA-Z0-9_-]{2,15}$/.test(databaseName);
};

export const checkScrubbler = async (target: AppTarget) => {
    const { database } = target;
    if (isScrubblerDb(database) === false) {
        return;
    }
    const columns = await settings.get({
        database: database,
        table: 'scrobbles',
        subject: 'columns',
    });
    if (isPlainObject(columns) === false || Object.keys(columns).length > 0) {
        return;
    }
    for (const setting of intialSettings) {
        settings.save(Object.assign(setting, { database }) as SettingObject);
    }
};

export const scrubblerToolEntry = (
    topic: string | null,
    count: number,
    loading: boolean,
) => {
    const { table } = scrubblerTable();
    if (!table) return '';

    const s = plural(count);
    const subject = table === 'edits' ? `automatic edit${s}` : `scrobble${s}`;

    return toolEntry({
        label: `delete last.fm ${table}`,
        topic: 'scrubblerDelete',
        panelOpen: topic === 'scrubblerDelete',
        iconName: 'tabler-brand-lastfm',
        iconArgs: { style: 'color: #d92323' },
        panelView: () =>
            configLayer.confirmOption(
                `Delete ${count}`,
                `${subject} on last.fm?`,
                loading,
            ),
    });
};

export const scrubblerDelete = async () => {
    const { dexieTable, selectorFields, selected } = datatable.state;
    const { database, table } = scrubblerTable();
    if (!dexieTable || !table) return '';

    const rows = await getCollection({
        dexieTable: dexieTable,
        selectorFields,
        selected,
    }).toArray();
    const jobData: UnknownRecord[] = rows.map((row: UnknownRecord) =>
        table === 'edits' ? deleteEditJob(row) : deleteScrobbleJob(row),
    );
    try {
        const db = await getConnection(database);
        await db.table('jobs').bulkAdd(jobData);
    } catch (error) {
        messageStack.displayError(`Failed to add scrubbler jobs: ${error}`);
    }
    datatable.updateDatatable({
        selected: new Set(),
    });
    configLayer.close();
};

const deleteEditJob = (row: UnknownRecord) => ({
    job: 'deleteEdit',
    state: 'waiting',
    retries: 0,
    data: { hash: row.hash },
    modified: Date.now(),
});

const deleteScrobbleJob = (row: UnknownRecord) => ({
    job: 'deleteScrobble',
    state: 'waiting',
    retries: 0,
    data: {
        artist_name: row.artist_name,
        track_name: row.track_name,
        timestamp: row.timestamp,
    },
    modified: Date.now(),
});

// prettier-ignore
const intialSettings: Omit<SettingObject, 'database'>[] =
[
  {
    "table": "edits",
    "subject": "columns",
    "values": [
      { "name": "artist_name", "visible": true, "width": 99, "format": "" },
      { "name": "artist_name_original", "visible": true, "width": 160, "format": "" },
      { "name": "track_name", "visible": true, "width": 97, "format": "" },
      { "name": "track_name_original", "visible": true, "width": 158, "format": "" },
      { "name": "album_name", "visible": true, "width": 104, "format": "" },
      { "name": "album_name_original", "visible": true, "width": 165, "format": "" },
      { "name": "album_artist_name", "visible": true, "width": 150, "format": "" },
      { "name": "album_artist_name_original", "visible": true, "width": 211, "format": "" },
      { "name": "position", "visible": true, "width": 72, "format": "" },
      { "name": "hash", "visible": true, "width": 47, "format": "" }
    ]
  },
  {
    "table": "edits",
    "subject": "filters",
    "values": [
      { "field": "artist_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false },
      { "field": "track_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_artist_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "artist_name_original", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "track_name_original", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_name_original", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_artist_name_original", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false }
    ]
  },
  {
    "table": "jobs",
    "subject": "columns",
    "values": [
      { "name": "id", "visible": true, "width": 42, "format": "" },
      { "name": "job", "visible": true, "width": 88, "format": "" },
      { "name": "state", "visible": true, "width": 51, "format": "" },
      { "name": "data", "visible": true, "width": 312, "format": "" },
      { "name": "modified", "visible": true, "width": 109, "format": "date" },
      { "name": "retries", "visible": true, "width": 62, "format": "" },
      { "name": "hash", "visible": true, "width": 270, "format": "" }
    ]
  },
  {
    "table": "jobs",
    "subject": "filters",
    "values": [
      { "field": "job", "search": "", "indexed": true, "valid": true, "method": "equal", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false },
      { "field": "state", "search": "", "indexed": true, "valid": true, "method": "equal", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false }
    ]
  },
  {
    "table": "loved",
    "subject": "columns",
    "values": [
      { "name": "artist_name", "visible": true, "width": 145, "format": "" },
      { "name": "track_name", "visible": true, "width": 319, "format": "" }
    ]
  },
  {
    "table": "loved",
    "subject": "filters",
    "values": [
      { "field": "artist_name", "search": "", "indexed": false, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false },
      { "field": "track_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false, datespan: false }
    ]
  },
  {
    "table": "scrobbles",
    "subject": "columns",
    "values": [
      { "name": "artist_name", "visible": true, "width": 168, "format": "" },
      { "name": "track_name", "visible": true, "width": 277, "format": "" },
      { "name": "album_name", "visible": true, "width": 338, "format": "" },
      { "name": "album_artist_name", "visible": true, "width": 168, "format": "" },
        { "name": "timestamp", "visible": true, "width": 90, "format": "date/1000" },
      { "name": "sequence", "visible": true, "width": 81, "format": "" }
    ]
  },
  {
    "table": "scrobbles",
    "subject": "filters",
    "values": [
      { "field": "artist_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "track_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "album_artist_name", "search": "", "indexed": true, "valid": true, "method": "startswith", "caseSensitive": false, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: false,  datespan: false },
      { "field": "timestamp", "search": "", "indexed": true, "valid": true, "method": "above", "caseSensitive": true, "includeBounds": false, "empty": [ "undefined", "null" ], datepicker: 'date',  datespan: 'day' }
    ]
  }
];
