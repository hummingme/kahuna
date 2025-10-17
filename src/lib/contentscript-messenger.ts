/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */
import type { ContentScriptType } from '../contentscript.ts';
import { globalTarget } from './app-target.ts';
import { postToBackground } from './post-background.ts';
import { uniqueId } from './utils.ts';
import { type Message, isGroupMessage } from './types/messages.ts';

const ContentscriptMessenger = class {
    #actor;
    constructor(actor: ContentScriptType) {
        this.#actor = actor;
        window.addEventListener('message', this.handleInjectedMessage.bind(this));
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
            } else {
                throw `contentscript got unexpected message from background: ${msg.type}`;
            }
        }
    }
    post(message: Message) {
        const handler = this.handleBackgroundMessage.bind(this);
        postToBackground(message, handler);
    }
};

export default ContentscriptMessenger;
