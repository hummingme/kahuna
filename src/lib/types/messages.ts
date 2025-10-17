/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { QueryDataArgs } from '../querydata.ts';
import type { AppTarget } from '../app-target.ts';
import type { PlainObject } from './common.ts';
import type { SettingKey } from './settings.ts';

export type Message =
    | IdxdbmExecuteCodeMessage
    | RequestSettingsMessage
    | ResetSettingsMessage
    | SaveSettingsMessage
    | TableDroppedMessage
    | DatabaseDroppedMessage
    | GetPermissionsResultMessage
    | ObtainSettingsMessage
    | ExecuteCodeMessage
    | QueryDataMessage
    | FoundDatabasesMessage
    | CheckFlawsResultMessage
    | CodeErrorMessage
    | QueryResultMessage
    | QueryErrorMessage
    | SimpleMessage;

interface RequestSettingsMessage {
    type: 'requestSettings';
    key: SettingKey;
    id: string;
}
interface ResetSettingsMessage {
    type: 'resetSettings';
    target: AppTarget;
}
interface SaveSettingsMessage {
    type: 'saveSettings';
    data: PlainObject;
}
interface TableDroppedMessage {
    type: 'tableDropped';
    target: AppTarget;
}
interface ExecuteCodeMessage {
    type: 'executeCode';
    load: ExecuteCodePayload;
}
interface IdxdbmExecuteCodeMessage {
    type: 'idxdbmExecuteCode';
    load: ExecuteCodePayload;
}
export interface ExecuteCodePayload {
    database: string;
    table: string;
    selectorFields: string[];
    selected: Set<string | number>;
    row?: PlainObject;
    code: string;
}
interface QueryDataMessage {
    type: 'queryData';
    params: QueryDataArgs;
}
interface DatabaseDroppedMessage {
    type: 'databaseDropped';
    target: AppTarget;
}
interface GetPermissionsResultMessage {
    type: 'getPermissionsResult';
    values: {
        permissions: string[];
        hostPermissions: string[];
        version: string;
    };
}
interface ObtainSettingsMessage {
    type: 'obtainSettings';
    values: PlainObject;
    id: string;
}
interface FoundDatabasesMessage {
    type: 'foundDatabases';
    databases: string[];
}
interface CheckFlawsResultMessage {
    type: 'checkFlawsResult';
    result: {
        BigInt64Array: [];
    };
}
interface CodeErrorMessage {
    type: 'codeError';
    error: Error;
}
interface QueryResultMessage {
    type: 'queryResult';
    result: QueryResultMessagePayload;
}
export interface QueryResultMessagePayload {
    data: PlainObject[];
    total: number;
    encoded: boolean;
}
interface QueryErrorMessage {
    type: 'queryError';
    error: Error;
}

// messages that do not contain any payload beside of the type field
interface SimpleMessage {
    type: SimpleMessageType;
}
type SimpleMessageType =
    | 'changedDatabases'
    | 'getPermissions'
    | 'checkFlaws'
    | 'toggleVisibility'
    | 'reloadApp'
    | 'reloadOrigin'
    | 'refreshCodearea'
    | 'refreshDatatable'
    | 'refreshExporter'
    | 'refreshImporter'
    | 'refreshMessagestack'
    | 'rerenderApp'
    | 'kahunaAlive';

// message topics indexed by usage
export const MESSAGE_TOPICS = {
    toContent: [
        'changedDatabases',
        'idxdbmExecuteCode',
        'obtainSettings',
        'saveSettings',
    ],
    fromContent: ['idxdbmCodeExecuted', 'codeError'],
    toBackground: [
        'getPermissions',
        'requestSettings',
        'resetSettings',
        'saveSettings',
        'tableDropped',
        'databaseDropped',
    ],
    fromBackground: ['getPermissionsResult', 'obtainSettings', 'toggleVisibility'],
    toWorker: ['abortQuery', 'checkFlaws', 'executeCode', 'queryData'],
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
} as const;

export type TopicGroup = keyof typeof MESSAGE_TOPICS;
export type MessageTopic = (typeof MESSAGE_TOPICS)[TopicGroup][number];

export function isGroupMessage<T extends TopicGroup>(
    group: T,
    message: any,
): message is Message {
    const topic: MessageTopic =
        message[Symbol.toStringTag] === 'MessageEvent' ? message.data.type : message.type;
    return (
        typeof message === 'object' &&
        message !== null &&
        typeof topic === 'string' &&
        [...MESSAGE_TOPICS[group]].includes(topic)
    );
}

export function isTopicInGroup<T extends TopicGroup>(
    group: T,
    topic: string,
): topic is (typeof MESSAGE_TOPICS)[T][number] {
    const groupValues = [...MESSAGE_TOPICS[group]];
    return groupValues.includes(topic as MessageTopic);
}
