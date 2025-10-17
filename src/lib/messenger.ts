/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { postToBackground } from './post-background.ts';
import {
    isGroupMessage,
    isTopicInGroup,
    type Message,
    type MessageTopic,
} from './types/messages.ts';

interface Handler {
    (message: Message): void | Promise<void>;
}

const Messenger = class {
    #worker: Worker | null = null;
    #handlers: Map<MessageTopic, Handler[]> = new Map();
    constructor() {
        window.addEventListener('message', this.handleContentMessage.bind(this));
    }
    set worker(worker: Worker | null) {
        this.#worker = worker;
        if (this.#worker) {
            this.#worker.onmessage = this.handleWorkerMessage.bind(this);
        }
    }
    getTopicHandlers(topic: MessageTopic): Handler[] | [] {
        return this.#handlers.get(topic) || [];
    }
    register(topic: MessageTopic, handler: Handler) {
        if (this.#handlers.has(topic) === false) {
            this.#handlers.set(topic, []);
        }
        const topicHandlers = this.#handlers.get(topic) || [];
        if (!topicHandlers.includes(handler)) {
            topicHandlers.push(handler);
        }
    }
    unregister(topic: MessageTopic, handler: Handler) {
        if (this.#handlers.has(topic)) {
            const topicHandlers = this.getTopicHandlers(topic).filter(
                (entry: Handler) => entry !== handler,
            );
            if (topicHandlers.length > 0) {
                this.#handlers.set(topic, topicHandlers);
            } else {
                this.#handlers.delete(topic);
            }
        }
    }
    handleContentMessage(message: MessageEvent) {
        if (message.origin === location.origin) {
            if (isGroupMessage('fromContent', message)) {
                this.callHandlers(message.data.type, message.data);
            }
        }
    }
    handleBackgroundMessage(message: unknown) {
        if (isGroupMessage('fromBackground', message)) {
            this.callHandlers(message.type, message);
        }
    }
    handleWorkerMessage(message: MessageEvent) {
        if (isGroupMessage('fromWorker', message)) {
            this.callHandlers(message.data.type, message.data);
        }
    }
    handleLocalMessage(message: Message) {
        if (isGroupMessage('local', message)) {
            this.callHandlers(message.type, message);
        }
    }
    async callHandlers(topic: MessageTopic, message: Message) {
        const handlers = this.getTopicHandlers(topic);
        handlers.forEach(async (handler) => {
            await handler(message);
        });
    }
    post(message: Message) {
        if (isTopicInGroup('toBackground', message.type)) {
            const handler = this.handleBackgroundMessage.bind(this);
            postToBackground(message, handler);
        } else if (isTopicInGroup('toWorker', message.type)) {
            if (this.#worker) {
                this.#worker.postMessage(message);
            } else {
                console.error('cannot post to worker', message); // eslint-disable-line no-console
            }
        } else if (isTopicInGroup('toContent', message.type)) {
            window.postMessage(message);
        } else if (isTopicInGroup('local', message.type)) {
            this.handleLocalMessage(message);
        } else {
            throw Error(`messenger.post: unknown topic ${message.type}`);
        }
    }
};

export default new Messenger();
