/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { type Charset, type EncodableCharset } from '#lib/charsets';
import { AppTarget, ExecutionMethod } from '#types';

export type BehaviorGlobalOptions = {
    onLoadTargets: Map<string, AppTarget>;
};

export type BehaviorOptions = {
    datatableRows: number;
    hideMessagesSeconds: number;
    confirmDeleteRow: boolean;
    escapeNonAscii: boolean;
    useLocalTimezone: boolean;
    queryPreferWorker: boolean;
    codeExecutionMethod: ExecutionMethod;
    uploadCharset: Charset;
    downloadCharset: EncodableCharset;
};

export type BehaviorAllOptions = BehaviorOptions & BehaviorGlobalOptions;

export const behaviorGlobalDefaultOptions = (): BehaviorGlobalOptions => {
    return { onLoadTargets: new Map() };
};

export const behaviorDefaultOptions = () => {
    const defaultOptions: BehaviorOptions = {
        datatableRows: 20,
        hideMessagesSeconds: 12,
        confirmDeleteRow: true,
        escapeNonAscii: false,
        useLocalTimezone: true,
        queryPreferWorker: true,
        codeExecutionMethod: 'webworker',
        uploadCharset: 'utf-8',
        downloadCharset: 'utf-8',
    };
    return { ...defaultOptions, ...behaviorGlobalDefaultOptions() };
};
