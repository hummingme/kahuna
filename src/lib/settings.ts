/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import applicationDefaultsOptions from '../components/config/application-defaults.ts';
import type { ApplicationOptions } from '../components/config/types.ts';
import { type AppTarget, globalTarget } from './app-target.ts';
import { getType } from './datatypes.ts';
import { defaultAppWindowSize } from './default-sizes.ts';
import messenger from './messenger.ts';
import { pickProperties, uniqueId } from './utils.ts';
import type { Message } from './types/messages.ts';
import type { PlainObject } from './types/common.ts';
import type { SettingKey, SettingObject, SettingSubject } from './types/settings.ts';

export interface GlobalSettings extends ApplicationOptions {
    hiddenMessages: Set<HideableMessageType>;
    lastUpdateInfo: string;
    onLoadTarget: AppTarget;
    window: AppWindowSettings;
}
export interface AppWindowSettings {
    top: string;
    left: string;
    width: string;
    height: string;
    maximized: boolean;
}
type HideableMessageType = 'noCodeExecution';

const Settings = class {
    #jobs: Map<string, { resolve: (value: any) => void; timeout: number }> = new Map();
    #globals: GlobalSettings;
    constructor() {
        this.#globals = this.#globalsDefaultSettings;
    }
    async init() {
        messenger.register('obtainSettings', this.#handleMessages.bind(this));
        let values = (await this.get({
            ...globalTarget,
            subject: 'globals',
        })) as PlainObject;
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
            hiddenMessages: new Set() as Set<HideableMessageType>,
            lastUpdateInfo: '',
            onLoadTarget: globalTarget,
            window: {
                maximized: false,
                left: '',
                top: '',
                ...defaultAppWindowSize(),
            },
            ...applicationDefaultsOptions(),
        };
    }
    #handleMessages(msg: Message) {
        if (msg.type === 'obtainSettings') {
            const job = this.#jobs.get(msg.id);
            if (job && typeof job.resolve === 'function') {
                clearTimeout(job.timeout);
                job.resolve(msg.values ?? {}); // resolve promise
                this.#jobs.delete(msg.id);
            }
        }
    }
    saveGlobals(diff: PlainObject) {
        this.#globals = { ...this.#globals, ...diff };
        const defaults = this.#globalsDefaultSettings;
        const values = this.cleanupSettings({ ...this.#globals }, defaults);
        this.saveSettings(values, defaults, globalTarget, 'globals');
    }
    global<K extends keyof GlobalSettings>(name: K): GlobalSettings[K] {
        return this.#globals[name];
    }
    saveSettings(
        values: PlainObject,
        defaults: PlainObject,
        target: AppTarget,
        subject: SettingSubject,
    ) {
        values = pickProperties(values, Object.keys(defaults));
        for (const key in values) {
            if (this.isEqualSetting(values[key], defaults[key])) {
                delete values[key];
            }
        }
        this.save({ ...target, subject, values });
    }
    save(data: SettingObject) {
        if (this.isSettingData(data)) {
            messenger.post({ type: 'saveSettings', data });
        } else {
            throw Error('Invalid settings data');
        }
    }
    async get(key: SettingKey): Promise<PlainObject> {
        const id = uniqueId();
        messenger.post({ type: 'requestSettings', key, id });
        const promise: Promise<PlainObject> = new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                reject();
                this.#jobs.delete(id);
            }, 1000);
            this.#jobs.set(id, { resolve, timeout });
        });
        return promise;
    }
    cleanupSettings(values: PlainObject, defaults: PlainObject) {
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
    isSettingData(setting: SettingObject): boolean {
        const { database, table, subject, values } = setting;
        return (
            Object.keys(setting).length === 4 &&
            typeof database === 'string' &&
            typeof table === 'string' &&
            typeof subject === 'string' &&
            ['array', 'object'].includes(typeof values)
        );
    }
    isEqualSetting(value: unknown, setting: unknown): boolean {
        if (getType(value) === 'set') {
            return (
                getType(setting) === 'set' &&
                JSON.stringify([...(value as Set<string>)]) ===
                    JSON.stringify([...(setting as Set<string>)])
            );
        } else {
            return value === setting || JSON.stringify(value) === JSON.stringify(setting);
        }
    }
    reset(target: AppTarget) {
        messenger.post({ type: 'resetSettings', target });
    }
};

export const settings = new Settings();

export default settings;
