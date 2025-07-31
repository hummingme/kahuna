/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */
import type { ContentScriptType } from '../contentscript.ts';
import { namespace, type NSPort } from './runtime.ts';
import { globalTarget } from './app-target.ts';
import { uniqueId } from './utils.ts';
import { type Message, isGroupMessage } from './types/messages.ts';

const ContentscriptMessenger = class {
    #actor;
    #backgroundPort: NSPort;
    constructor(actor: ContentScriptType) {
        this.#actor = actor;
        window.addEventListener('message', this.handleInjectedMessage.bind(this));
        this.#backgroundPort = namespace.runtime.connect({
            name: 'content',
        });
        this.#backgroundPort.onMessage.addListener(
            this.handleBackgroundMessage.bind(this),
        );
    }
    init() {
        this.post({
            type: 'requestSettings',
            key: { ...globalTarget, subject: 'globals' },
            id: uniqueId(),
        });
    }
    async handleInjectedMessage(msg: any) {
        if (
            this.#actor &&
            typeof msg === 'object' &&
            msg !== null &&
            Object.hasOwn(msg, 'origin') &&
            msg.origin === location.origin
        ) {
            const message = msg.data;
            if (isGroupMessage('toContent', message)) {
                if (message.type === 'changedDatabases') {
                    this.#actor.searchDatabases();
                }
            }
        }
    }
    handleBackgroundMessage(msg: unknown) {
        if (this.#actor && isGroupMessage('toContent', msg)) {
            if (['obtainSettings', 'saveSettings'].includes(msg.type)) {
                this.#actor.handleGlobalSettings(msg);
            } else if (msg.type === 'keepAlive') {
                this.#actor.keepBackgroundAlive();
            } else {
                throw `contentscript got unexpected message from background: ${msg.type}`;
            }
        }
    }
    post(msg: Message) {
        this.#backgroundPort.postMessage(msg);
    }
};

export default ContentscriptMessenger;
