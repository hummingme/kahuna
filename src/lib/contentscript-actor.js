/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import ApplicationConfigDefaults from '../components/config/application-defaults.js';
import { pickProperties } from './utils.js';

const state = Symbol('contentscript-actor state');

const ContentscriptActor = class {
    #messenger;
    constructor() {
        this[state] = {
            foundDBs: [],
            ...this.defaultSettings(),
        };
    }
    init(messenger) {
        this.#messenger = messenger;
        const boundSearchDatabases = this.searchDatabases.bind(this);
        setTimeout(boundSearchDatabases, 100); // early
        setTimeout(boundSearchDatabases, 3500); // when initialization should be finished
        setInterval(boundSearchDatabases, 10000); // recurring, every 30 second
    }
    defaultSettings() {
        return pickProperties(ApplicationConfigDefaults(), [
            'dontNotifyEmpty',
            'ignoreDatabases',
        ]);
    }
    async searchDatabases() {
        if (document.hidden === true) {
            return;
        }
        let dbs = await indexedDB.databases();
        dbs = dbs.filter((db) => this[state].ignoreDatabases.includes(db.name) === false);
        if (this[state].dontNotifyEmpty === true) {
            dbs = await this.filterEmptyDbs(dbs);
        }
        if (JSON.stringify(this[state].foundDBs.sort()) !== JSON.stringify(dbs.sort())) {
            this[state].foundDBs = dbs;
            this.#messenger.post({
                type: 'foundDatabases',
                origin: window.location.origin,
                databases: dbs,
            });
        }
    }
    async filterEmptyDbs(dbs) {
        function checkDatabase(name, version) {
            return new Promise((resolve, reject) => {
                function storesCheck(dbh) {
                    const stores = dbh.objectStoreNames;
                    dbh.close();
                    resolve(stores.length > 0 ? true : false);
                }
                const request = indexedDB.open(name, version);
                request.onupgradeneeded = (event) => {
                    storesCheck(event.target.result);
                };
                request.onsuccess = (event) => {
                    storesCheck(event.target.result);
                };
                request.onerror = (event) => {
                    reject(event.target.error);
                };
                request.onblocked = () => {
                    resolve(true);
                };
                request.onblocking = () => {
                    resolve(true);
                };
            });
        }
        const populated = [];
        for (const db of dbs) {
            // sometimes(?) databases without stores are reported by
            // objectStoreNames() with version 0. And opening a DB
            // with version 0 causes an error in Firefox
            const version = db.version > 0 ? db.version : 1;
            try {
                if (await checkDatabase(db.name, version)) {
                    populated.push(db.name);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log('Kahuna contentscript', dbs, error);
            }
        }
        return populated;
    }
    handleGlobalSettings(msg) {
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
    fromSaveGlobalSettings(msg) {
        return msg.type === 'saveSettings' && msg.data.subject === 'globals'
            ? msg.data.values
            : null;
    }
    fromObtainGlobalSettings(msg) {
        return msg.type === 'obtainSettings' &&
            (Object.hasOwn(msg.values, 'ignoreDatabases') ||
                Object.hasOwn(msg.values, 'dontNotifyEmpty'))
            ? msg.values
            : null;
    }
    pingInterval = null;
    keepBackgroundAlive() {
        if (this.pingInterval === null) {
            this.pingInterval = setInterval(() => {
                this.#messenger.post({ type: 'pingBackground' });
            }, 28 * 1000);
        }
    }
};

const actor = new ContentscriptActor();
export default actor;
