/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import applicationDefaultsOptions from '#components/config/application-defaults';
import { globalTarget } from '#lib/app-target';
import { getType } from './datatypes';
import { defaultAppWindowSize } from '#lib/default-sizes';
import messenger from '#lib/messenger';
import { pickByKeys, uniqueId } from '#lib/utils';
import type {
    AppTarget,
    GlobalSettings,
    Message,
    PlainObject,
    SerializedGlobalSettings,
    SerializedSettingValues,
    SettingKey,
    SettingObject,
    SettingSubject,
    SettingValues,
    SettingValuesMap,
} from '#types';

const Settings = class {
    #jobs: Map<string, { resolve: (value: SettingValues) => void; timeout: number }> =
        new Map();
    #globals: GlobalSettings;
    constructor() {
        this.#globals = this.#globalsDefaultSettings;
    }
    async init() {
        messenger.register('obtainSettings', this.#handleMessages.bind(this));
        this.#globals = await this.#initGlobals();
    }
    async #initGlobals(): Promise<GlobalSettings> {
        let values = (await this.get({
            ...globalTarget,
            subject: 'globals',
        })) as PlainObject;
        if (Array.isArray(values.onLoadTargets)) {
            values.onLoadTargets = new Map(values.onLoadTargets);
        }
        if (Array.isArray(values.hiddenMessages)) {
            values.hiddenMessages = new Map(values.hiddenMessages);
        }
        values = this.cleanupSettings(values, this.#globalsDefaultSettings);
        return {
            ...this.#globalsDefaultSettings,
            ...values,
        };
    }
    get #globalsDefaultSettings(): GlobalSettings {
        return {
            hiddenMessages: new Map(),
            lastUpdateInfo: '',
            onLoadTargets: new Map(),
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
            if (job) {
                clearTimeout(job.timeout);
                job.resolve(msg.values);
                this.#jobs.delete(msg.id);
            }
        }
    }
    saveGlobals(diff: Partial<GlobalSettings>) {
        this.#globals = { ...this.#globals, ...diff };

        const defaults: SerializedGlobalSettings = {
            ...this.#globalsDefaultSettings,
            hiddenMessages: [],
            onLoadTargets: [],
        };

        const values: SerializedGlobalSettings = this.cleanupSettings(
            {
                ...this.#globals,
                hiddenMessages: Array.from(this.#globals.hiddenMessages),
                onLoadTargets: Array.from(this.#globals.onLoadTargets),
            },
            defaults,
        );
        this.saveSettings(values, defaults, globalTarget, 'globals');
    }

    global<K extends keyof GlobalSettings>(name: K): GlobalSettings[K] {
        return this.#globals[name];
    }
    saveSettings(
        values: Partial<SerializedSettingValues>,
        defaults: SerializedSettingValues,
        target: AppTarget,
        subject: SettingSubject,
        detail?: string,
    ) {
        values = pickByKeys(values, defaults);
        for (const key in values) {
            const k = key as keyof typeof values;
            if (this.isEqualSetting(values[k], defaults[k])) {
                delete values[k];
            }
        }
        this.save({ ...target, subject, detail, values });
    }
    save(data: SettingObject) {
        if (this.isSettingData(data)) {
            messenger.post({ type: 'saveSettings', data });
        } else {
            throw Error(`Invalid settings data: ${JSON.stringify(data)}`);
        }
    }

    async get<S extends SettingSubject>(
        key: SettingKey<S>,
    ): Promise<SettingValuesMap[S]> {
        const id = uniqueId();
        key.detail ??= '';
        messenger.post({ type: 'requestSettings', key, id });

        const promise = new Promise<SettingValuesMap[S]>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                reject();
                this.#jobs.delete(id);
            }, 1000);

            this.#jobs.set(id, {
                resolve: resolve as unknown as (value: SettingValues) => void,
                timeout,
            });
        });

        return promise;
    }
    cleanupSettings<T extends PlainObject>(values: T, defaults: T): T {
        const defaultKeys = Object.keys(defaults);
        for (const key of Object.keys(values)) {
            if (
                !defaultKeys.includes(key) ||
                (getType(values[key]) !== getType(defaults[key]) &&
                    defaults[key] !== null)
            ) {
                delete values[key];
                continue;
            }
        }
        return Object.assign(structuredClone(defaults), structuredClone(values)) as T;
    }
    isSettingData(setting: SettingObject): boolean {
        const { database, table, subject, detail, values } = setting;
        return (
            [4, 5].includes(Object.keys(setting).length) &&
            typeof database === 'string' &&
            typeof table === 'string' &&
            typeof subject === 'string' &&
            (typeof detail === 'string' || typeof detail === 'undefined') &&
            ['array', 'object'].includes(typeof values)
        );
    }
    isEqualSetting(value: unknown, setting: unknown): boolean {
        if (value instanceof Set) {
            return (
                setting instanceof Set &&
                JSON.stringify([...value]) === JSON.stringify([...setting])
            );
        } else if (value instanceof Map) {
            return (
                setting instanceof Map &&
                JSON.stringify([...value]) === JSON.stringify([...setting])
            );
        } else {
            return value === setting || JSON.stringify(value) === JSON.stringify(setting);
        }
    }
};

export const settings = new Settings();

export default settings;
