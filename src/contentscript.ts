/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import ApplicationConfigDefaults from './components/config/application-defaults.ts';
import { pickProperties } from './lib/utils.ts';
import ContentscriptMessenger from './lib/contentscript-messenger.ts';
import { type Message } from './lib/types/messages.ts';

export interface ContentScriptType {
    handleGlobalSettings: (msg: Message) => void;
    searchDatabases: () => void;
    keepBackgroundAlive: () => void;
}

interface ContentScriptState extends ContentScriptSettings {
    foundDBs: string[];
}
interface ContentScriptSettings {
    dontNotifyEmpty: boolean;
    ignoreDatabases: string[];
}

const state = Symbol('contentscript state');

const ContentScript = class {
    [state]: ContentScriptState;
    #messenger;
    #pingInterval: number | null = null;
    constructor() {
        this.#messenger = new ContentscriptMessenger(this);
        this[state] = {
            foundDBs: [],
            ...this.defaultSettings(),
        };
    }
    init() {
        const boundSearchDatabases = this.searchDatabases.bind(this);
        setTimeout(boundSearchDatabases, 100); // early
        setTimeout(boundSearchDatabases, 3500); // when initialization should be finished
        setInterval(boundSearchDatabases, 15000); // recurring, every 15 second
        this.#messenger.post({ type: 'kahunaAlive' });
    }
    defaultSettings(): ContentScriptSettings {
        return pickProperties(ApplicationConfigDefaults(), [
            'dontNotifyEmpty',
            'ignoreDatabases',
        ]) as ContentScriptSettings;
    }
    async searchDatabases() {
        if (document.hidden === true) {
            return;
        }
        let dbs = await indexedDB.databases();
        dbs = dbs.filter(
            (db) => db.name && this[state].ignoreDatabases.includes(db.name) === false,
        );
        const databases =
            this[state].dontNotifyEmpty === true
                ? await this.filterEmptyDbs(dbs)
                : dbs.map((db) => db.name!);
        if (
            JSON.stringify(this[state].foundDBs.sort()) !==
            JSON.stringify(databases.sort())
        ) {
            this[state].foundDBs = databases;
            this.#messenger.post({
                type: 'foundDatabases',
                databases,
            });
        }
    }
    async filterEmptyDbs(dbs: IDBDatabaseInfo[]): Promise<string[]> {
        function checkDatabase(name: string, version: number) {
            return new Promise((resolve, reject) => {
                function storesCheck(dbh: IDBDatabase) {
                    const stores = dbh.objectStoreNames;
                    dbh.close();
                    resolve(stores.length > 0 ? true : false);
                }
                // With typescript, what is the type of an IDBVersionChangeEvent's target?
                const request = indexedDB.open(name, version);
                request.onupgradeneeded = (event) => {
                    const target = event.target as IDBOpenDBRequest;
                    storesCheck(target.result);
                };
                request.onsuccess = (event) => {
                    const target = event.target as IDBOpenDBRequest;
                    storesCheck(target.result);
                };
                request.onerror = (event) => {
                    const target = event.target as IDBOpenDBRequest;
                    reject(target.error);
                };
                request.onblocked = () => {
                    resolve(true);
                };
            });
        }
        const populated: string[] = [];
        for (const db of dbs) {
            // sometimes(?) databases without stores are reported by
            // objectStoreNames() with version 0. And opening a DB
            // with version 0 causes an error in Firefox
            const version = db.version && db.version > 0 ? db.version : 1;
            try {
                if (db.name && (await checkDatabase(db.name, version))) {
                    populated.push(db.name);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log('Kahuna contentscript', dbs, error);
            }
        }
        return populated;
    }
    handleGlobalSettings(msg: Message) {
        const settings =
            this.fromSaveGlobalSettings(msg) || this.fromObtainGlobalSettings(msg);
        if (settings) {
            const oldState = JSON.stringify(this[state]);
            const defaults = this.defaultSettings();
            for (const key in settings) {
                if (!(key in defaults)) delete settings[key];
            }
            this[state] = {
                ...this[state],
                ...defaults,
                ...settings,
            };
            if (JSON.stringify(this[state]) !== oldState) {
                this.searchDatabases();
            }
        }
    }
    fromSaveGlobalSettings(msg: Message) {
        return msg.type === 'saveSettings' && msg.data.subject === 'globals'
            ? msg.data.values
            : null;
    }
    fromObtainGlobalSettings(msg: Message) {
        return msg.type === 'obtainSettings' &&
            (Object.hasOwn(msg.values, 'ignoreDatabases') ||
                Object.hasOwn(msg.values, 'dontNotifyEmpty'))
            ? msg.values
            : null;
    }
    pingInterval = null;
    keepBackgroundAlive() {
        if (this.#pingInterval === null) {
            this.#pingInterval = window.setInterval(() => {
                this.#messenger.post({ type: 'pingBackground' });
            }, 28 * 1000);
        }
    }
};

new ContentScript().init();
