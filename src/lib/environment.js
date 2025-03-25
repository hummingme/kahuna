/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import appWindow from '../components/app-window.js';
import messenger from './messenger.js';

class Environment {
    #env = {
        bigIntArrayFlaw: false, // in Firefox, BigInt64Arrays are not accessible when sent from worker
        unsafeEval: false, // unsafe eval expressions are blocked, typically due to Manifest 3
        workersBlocked: false, // no Worker can be started, typically due to CSP restrictions
        permissions: [], // of extensions
        hostPermissions: '', //   "
        preferedColorScheme: 'light',
    };
    constructor() {}
    async init() {
        this.#env.unsafeEval = this.checkUnsafeEval();
        this.#env.preferedColorScheme = this.checkPreferedColorScheme();
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
    get bigIntArrayFlaw() {
        return this.#env.bigIntArrayFlaw;
    }
    get permissions() {
        return this.#env.permissions;
    }
    get unsafeEval() {
        return this.#env.unsafeEval;
    }
    get preferedColorScheme() {
        return this.#env.preferedColorScheme;
    }
    set workersBlocked(value) {
        this.#env.workersBlocked = value;
    }
    get workersBlocked() {
        return this.#env.workersBlocked;
    }
    get codeExecution() {
        return this.workersBlocked === false || this.unsafeEval === true;
    }
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
    checkFlawsResult(message) {
        this.#env.bigIntArrayFlaw = message.result.BigInt64Array?.length === undefined;
        messenger.unregister('checkFlawsResult', this.#boundCheckFlawsResult);
    }
    #boundCheckFlawsResult = this.checkFlawsResult.bind(this);
    getPermissionsResult(message) {
        this.#env = { ...this.#env, ...message.values };
    }
    #boundGetPermissionsResult = this.getPermissionsResult.bind(this);
}

export default new Environment();
