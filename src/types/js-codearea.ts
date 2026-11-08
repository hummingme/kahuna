/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { IndexableType } from 'dexie';
import type { TemplateResult } from 'lit-html';

import { type JsCodeareaConfigValues } from '#components/config/jscodearea-config';
import type { AppTarget, ExecutionMethod, UnknownRecord } from '#types';

export type JsCodeareaUser =
    | 'database'
    | 'datatable'
    | 'editRow'
    | 'editValue'
    | 'origin';

export type JsCodeareaOptions = {
    user: JsCodeareaUser;
    target: AppTarget;
    detail?: string;
    selectorFields: string[];
    executed: (res: unknown) => void;
    requireVariables: () => RequiredVariables;
    closeButton?: TemplateResult;
};

export type JsCodeareaState = JsCodeareaConfigValues & {
    user: JsCodeareaUser;
    code: string;
    executionMethod: ExecutionMethod;
    saved: boolean;
};

export type JsConsoleOptions = {
    anchorId: string;
    user: JsCodeareaUser;
    target: AppTarget;
    selectorFields?: string[];
    rowSelector?: IndexableType | undefined;
    requireVariables: () => RequiredVariables;
    executed: () => void;
    codeareaUpdate?: Partial<JsCodeareaState> | undefined;
};

export type JsConsoleIconOptions = Omit<
    JsConsoleOptions,
    'anchorId' | 'requireVariables'
> & {
    requireVariables?: () => RequiredVariables;
};

export type RequiredVariables = {
    selected: Set<string | number>;
    row: UnknownRecord | undefined;
    value?: unknown;
};
