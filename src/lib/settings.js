/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import ApplicationConfigDefaults from '../components/config/application-defaults.js';
import { defaultAppWindowSize } from './default-sizes.js';
import messenger from './messenger.js';
import { globalTarget, pickProperties, uniqueId } from './utils.js';

const Settings = class {
    #jobs;
    #globals;
    constructor() {
        this.#jobs = new Map();
    }
    async init() {
        messenger.register('obtainSettings', this.#handleMessages.bind(this));
        let values = await this.get({ ...globalTarget, subject: 'globals' });
        values = this.cleanupSettings(values, this.#globalsDefaultSettings);
        this.#globals = {
            ...this.#globalsDefaults,
            ...values,
        };
    }
    get #globalsDefaults() {
        return {
            ...this.#globalsDefaultSettings,
        };
    }
    get #globalsDefaultSettings() {
        return {
            hiddenMessages: [],
            onLoadTarget: globalTarget,
            window: {
                maximized: false,
                left: null,
                top: null,
                ...defaultAppWindowSize(),
            },
            ...ApplicationConfigDefaults(),
        };
    }
    #handleMessages(msg) {
        if (msg.type === 'obtainSettings') {
            const job = this.#jobs.get(msg.id);
            if (job && typeof job.resolve === 'function') {
                clearTimeout(job.timeout);
                job.resolve(msg.values ?? {}); // resolve promise
                this.#jobs.delete(msg.id);
            }
        }
    }
    saveGlobals(diff) {
        this.#globals = { ...this.#globals, ...diff };
        const defaults = this.#globalsDefaultSettings;
        const values = this.cleanupSettings({ ...this.#globals }, defaults);
        this.saveSettings(values, defaults, globalTarget, 'globals');
    }
    global(name) {
        return this.#globals[name] || null;
    }
    saveSettings(values, defaults, target, subject) {
        values = pickProperties(values, Object.keys(defaults));
        for (const key in values) {
            if (this.isEqualSetting(values[key], defaults[key])) {
                delete values[key];
            }
        }
        this.save({
            ...target,
            subject,
            values,
        });
    }
    save(data) {
        if (this.isSettingData(data)) {
            messenger.post({ type: 'saveSettings', data });
        } else {
            throw Error('Invalid settings data');
        }
    }
    async get(key) {
        const id = uniqueId();
        messenger.post({ type: 'requestSettings', key, id });
        const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject();
                this.#jobs.delete(id);
            }, 1000);
            this.#jobs.set(id, { resolve, timeout });
        });
        return promise;
    }
    cleanupSettings(values, defaults) {
        const defaultKeys = Object.keys(defaults);
        for (const key of Object.keys(values)) {
            if (
                !defaultKeys.includes(key) ||
                typeof values[key] !== typeof defaults[key]
            ) {
                delete values[key];
                continue;
            }
        }
        return Object.assign(structuredClone(defaults), structuredClone(values));
    }
    isSettingData({ database, table, subject, values }) {
        return (
            Object.values(arguments[0]).length === 4 &&
            typeof database === 'string' &&
            typeof table === 'string' &&
            typeof subject === 'string' &&
            ['array', 'object'].includes(typeof values)
        );
    }
    isEqualSetting(value, setting) {
        return value === setting || JSON.stringify(value) === JSON.stringify(setting);
    }
    reset(target) {
        messenger.post({ type: 'resetSettings', target });
    }
};

const settings = new Settings();

export default settings;
