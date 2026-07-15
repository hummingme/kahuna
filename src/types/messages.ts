/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { AppTarget, UnknownRecord } from '#types/common';
import { InjectedExportArgs, InjectedImportArgs } from '#types/import-export';
import type { QueryDataArgs } from '#types/querydata';
import type { SettingKey, SettingObject, SettingValues } from '#types/settings';

export type Message =
    | { type: 'checkFlawsResult'; result: { BigInt64Array: [] } }
    | { type: 'codeError'; error: Error }
    | ({ type: 'codeExecuted' } & CodeExecutedProperties)
    | { type: 'databaseDropped'; target: AppTarget }
    | { type: 'executeCode'; load: ExecuteCodePayload }
    | { type: 'exportedSettings'; data: Blob }
    | { type: 'foundDatabases'; databases: string[] }
    | {
          type: 'getPermissionsResult';
          values: { permissions: string[]; hostPermissions: string[]; version: string };
      }
    | ({ type: 'idxdbmCodeExecuted' } & CodeExecutedProperties)
    | { type: 'idxdbmExecuteCode'; load: ExecuteCodePayload }
    | { type: 'importSettings'; dataSrc: string | Blob }
    | { type: 'importSettingsResult'; error?: Error }
    | { type: 'injectedExport'; args: InjectedExportArgs }
    | { type: 'injectedExportResult'; success: boolean; error: Error | undefined }
    | { type: 'injectedImport'; args: InjectedImportArgs }
    | { type: 'injectedImportResult'; success: boolean; error: Error | undefined }
    | { type: 'obtainSettings'; values: SettingValues; id: string }
    | { type: 'queryData'; load: QueryDataArgs }
    | { type: 'queryError'; error: Error }
    | { type: 'queryResult'; result: QueryResultMessagePayload }
    | { type: 'requestSettings'; key: SettingKey; id: string }
    | { type: 'resetSettings'; target: AppTarget }
    | { type: 'saveSettings'; data: SettingObject }
    | { type: 'tableDropped'; target: AppTarget }
    | SimpleMessage;

// messages that contain no payload other than the type field
type SimpleMessage = { type: SimpleMessageType };
type SimpleMessageType =
    | 'changedDatabases'
    | 'checkFlaws'
    | 'exportSettings'
    | 'getPermissions'
    | 'injectExportImport'
    | 'kahunaAlive'
    | 'toggleVisibility'
    | 'refreshCodearea'
    | 'refreshDatatable'
    | 'refreshExporter'
    | 'refreshImporter'
    | 'refreshMessagestack'
    | 'reloadApp'
    | 'reloadOrigin'
    | 'rerenderApp';

type MessageType = Message['type'];

export type QueryResultMessagePayload = {
    data: UnknownRecord[];
    total: number;
    encoded: boolean;
};

export type ExecuteCodePayload = {
    code: string;
    target: AppTarget;
    client: 'datatable' | 'valueEditorField';
    encodeResult: boolean;
    selectorFields: string[];
    selected: Set<string | number>;
    row: UnknownRecord | undefined;
    value?: unknown;
};
type CodeExecutedProperties = {
    client: 'datatable' | 'valueEditorField';
    result: unknown;
};

// message topics indexed by usage
export const MESSAGE_TOPICS = {
    toContent: [
        'changedDatabases',
        'idxdbmExecuteCode',
        'injectedExport',
        'injectedImport',
        'obtainSettings',
        'saveSettings',
    ],
    fromContent: [
        'idxdbmCodeExecuted',
        'injectedExportResult',
        'injectedImportResult',
        'codeError',
    ],
    toBackground: [
        'exportSettings',
        'getPermissions',
        'importSettings',
        'injectExportImport',
        'requestSettings',
        'resetSettings',
        'saveSettings',
        'tableDropped',
        'databaseDropped',
    ],
    fromBackground: [
        'exportedSettings',
        'importSettingsResult',
        'getPermissionsResult',
        'obtainSettings',
        'toggleVisibility',
    ],
    toWorker: ['checkFlaws', 'executeCode', 'queryData'],
    fromWorker: [
        'checkFlawsResult',
        'codeError',
        'codeExecuted',
        'queryResult',
        'queryError',
    ],
    local: [
        'refreshCodearea',
        'refreshDatatable',
        'refreshExporter',
        'refreshImporter',
        'refreshMessagestack',
        'reloadApp',
        'reloadOrigin',
        'rerenderApp',
    ],
    contentscriptMessenger: ['foundDatabases', 'kahunaAlive'],
} as const satisfies Record<string, readonly MessageType[]>;

export type TopicGroup = keyof typeof MESSAGE_TOPICS;
export type MessageTopic = (typeof MESSAGE_TOPICS)[TopicGroup][number];

// fails if any message type is missing from MESSAGE_TOPICS
type UsedMessageTypes = (typeof MESSAGE_TOPICS)[TopicGroup][number];
type UnusedMessageTypes = Exclude<MessageType, UsedMessageTypes>;
type EnsureAllUsed = [UnusedMessageTypes] extends [never]
    ? true
    : `Missing message types: ${UnusedMessageTypes}`;
const _check: EnsureAllUsed = true;
