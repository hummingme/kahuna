/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */
import type { ContentScriptType } from '../contentscript';
import { globalTarget } from '#lib/app-target';
import { isGroupMessage } from './message-utils';
import { postToBackground } from '#lib/post-background';
import { uniqueId } from '#lib/utils';
import { Message } from '#types';

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
    async handleInjectedMessage(msg: MessageEvent) {
        if (this.#actor && msg.origin === location.origin) {
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
