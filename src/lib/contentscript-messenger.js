/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { namespace } from './runtime.js';
import { globalTarget, uniqueId } from './utils.js';

const ContentscriptMessenger = class {
    #actor = null;
    #backgroundPort = null;
    constructor() {
        window.addEventListener('message', this.handleInjectedMessage.bind(this));
        this.#backgroundPort = namespace.runtime.connect({
            name: 'content',
        });
        this.#backgroundPort.onMessage.addListener(
            this.handleBackgroundMessage.bind(this),
        );
    }
    init(actor) {
        this.#actor = actor;
        this.post({
            type: 'requestSettings',
            key: { ...globalTarget, subject: 'globals' },
            id: uniqueId(),
        });
    }
    async handleInjectedMessage(msg) {
        if (msg.origin === location.origin) {
            if (msg.data.type === 'changedDatabases') {
                this.#actor.searchDatabases();
            }
        }
    }
    handleBackgroundMessage(msg) {
        if (['obtainSettings', 'saveSettings'].includes(msg.type)) {
            this.#actor.handleGlobalSettings(msg);
        } else if (msg.type === 'keepAlive') {
            this.#actor.keepBackgroundAlive();
        } else {
            throw `contentscript got unexpected message from background: ${msg.type}`;
        }
    }
    post(msg) {
        this.#backgroundPort.postMessage(msg);
    }
};

const messenger = new ContentscriptMessenger();
export default messenger;
