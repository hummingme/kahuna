/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import appWindow from '../components/app-window.ts';
import messenger from './messenger.ts';
import { manifestVersion } from './runtime.ts';
import type { ExecutionMethod } from './types/common.ts';
import type { Message } from './types/messages.ts';

interface EnvironmentValues {
    version: string;
    manifestVersion: number;
    permissions: string[] | undefined;
    hostPermissions: string[] | undefined;
    unsafeEval: boolean;
    workersBlocked: boolean;
    preferedColorScheme: 'light' | 'dark';
    bigIntArrayFlaw: boolean;
}

class Environment {
    #env: EnvironmentValues = {
        version: '0.0',
        manifestVersion: 2,
        permissions: [], // of extensions
        hostPermissions: [], //   "
        unsafeEval: false, // unsafe eval expressions are blocked, typically due to Manifest 3
        workersBlocked: false, // no Worker can be started, typically due to CSP restrictions
        preferedColorScheme: 'light',
        bigIntArrayFlaw: false, // in Firefox, BigInt64Arrays are not accessible when sent from worker
    };
    async init() {
        this.#env.unsafeEval = this.checkUnsafeEval();
        this.#env.preferedColorScheme = this.checkPreferedColorScheme();
        this.#env.manifestVersion = manifestVersion;
        this.colorSchemeQuery.addEventListener(
            'change',
            this.preferedColorSchemeChanged.bind(this),
        );
        if (this.workersBlocked === false) {
            messenger.register('checkFlawsResult', this.#boundCheckFlawsResult);
            messenger.post({ type: 'checkFlaws' });
        }
        messenger.register('getPermissionsResult', this.#boundGetPermissionsResult);
        messenger.post({ type: 'getPermissions' });
    }
    get version() {
        return this.#env.version;
    }
    get manifestVersion() {
        return this.#env.manifestVersion;
    }
    get permissions() {
        return this.#env.permissions;
    }
    get unsafeEval() {
        return this.#env.unsafeEval;
    }
    set workersBlocked(value) {
        this.#env.workersBlocked = value;
    }
    get workersBlocked() {
        return this.#env.workersBlocked;
    }
    get preferedColorScheme() {
        return this.#env.preferedColorScheme;
    }
    get bigIntArrayFlaw() {
        return this.#env.bigIntArrayFlaw;
    }
    get codeExecution() {
        return this.codeExecutionMethods.length > 0;
    }
    get codeExecutionMethods() {
        const methods: ExecutionMethod[] = [];
        for (const method of Object.keys(
            this.executionMethodConditions,
        ) as ExecutionMethod[]) {
            if (this.executionMethodConditions[method]()) {
                methods.push(method);
            }
        }
        return methods;
    }
    executionMethodConditions = {
        webworker: () => this.workersBlocked === false,
        unsafeEval: () => this.unsafeEval === true,
        userscript: () => this.permissions?.includes('userScripts'),
    };

    checkUnsafeEval() {
        try {
            Function()();
            return true;
        } catch (error) {
            if (error instanceof EvalError) {
                return false;
            } else {
                throw error;
            }
        }
    }
    colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    checkPreferedColorScheme() {
        return this.colorSchemeQuery.matches ? 'dark' : 'light';
    }
    preferedColorSchemeChanged() {
        this.#env.preferedColorScheme = this.checkPreferedColorScheme();
        appWindow.setColorScheme();
    }
    checkFlawsResult(message: Message) {
        if (message.type === 'checkFlawsResult') {
            this.#env.bigIntArrayFlaw =
                message.result.BigInt64Array?.length === undefined;
            messenger.unregister('checkFlawsResult', this.#boundCheckFlawsResult);
        }
    }
    #boundCheckFlawsResult = this.checkFlawsResult.bind(this);
    getPermissionsResult(message: Message) {
        if (message.type === 'getPermissionsResult') {
            this.#env = { ...this.#env, ...message.values };
        }
    }
    #boundGetPermissionsResult = this.getPermissionsResult.bind(this);
}

export default new Environment();
