/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { namespace } from './runtime.js';

const Messenger = class {
    #worker = null;
    #backgroundPort = null;
    #handlers = new Map();

    // between indexedb-manager.js and contentscript.js
    postTopics = new Set(['changedDatabases', 'idxdbmExecuteCode']);
    receiveTopics = new Set(['idxdbmCodeExecuted']);

    // between indexedb-manager.js and background.js/background_worker.js
    toBackgroundTopics = new Set([
        'getPermissions',
        'requestSettings',
        'resetSettings',
        'saveSettings',
        'tableDropped',
        'databaseDropped',
    ]);
    fromBackgroundTopics = new Set([
        'getPermissionsResult',
        'obtainSettings',
        'toggleVisibility',
    ]);

    // between indexedb-manager.js and contentscript_worker.js
    toWorkerTopics = new Set(['abortQuery', 'checkFlaws', 'executeCode', 'queryData']);
    fromWorkerTopics = new Set([
        'checkFlawsResult',
        'codeError',
        'codeExecuted',
        'queryResult',
        'queryError',
    ]);
    localTopics = new Set([
        'refreshDatatable',
        'refreshExporter',
        'refreshImporter',
        'refreshMessagestack',
        'reloadOrigin',
    ]);

    constructor() {
        window.addEventListener('message', this.handleMessage.bind(this));
        this.#backgroundPort = namespace.runtime.connect({
            name: 'main',
        });
        this.#backgroundPort.onMessage.addListener(
            this.handleBackgroundMessage.bind(this),
        );
    }
    set worker(worker) {
        this.#worker = worker;
        if (worker) {
            this.#worker.onmessage = this.handleWorkerMessage.bind(this);
        }
    }
    register(topic, handler) {
        this.#handlers.has(topic) || this.#handlers.set(topic, []);
        const topicHandlers = this.#handlers.get(topic);
        if (!topicHandlers.includes(handler)) {
            topicHandlers.push(handler);
        }
    }
    unregister(topic, handler) {
        if (this.#handlers.has(topic)) {
            const topicHandlers = this.#handlers
                .get(topic)
                .filter((entry) => entry !== handler);
            topicHandlers.length > 0
                ? this.#handlers.set(topic, topicHandlers)
                : this.#handlers.delete(topic);
        }
    }
    handleMessage(message) {
        if (message.origin === location.origin) {
            const topic = message.data.type;
            if (this.receiveTopics.has(topic) && this.#handlers.has(topic)) {
                this.callHandlers(this.#handlers.get(topic), message);
            }
        }
    }
    handleBackgroundMessage(message) {
        const topic = message.type;
        if (this.fromBackgroundTopics.has(topic) && this.#handlers.has(topic)) {
            this.callHandlers(this.#handlers.get(topic), message);
        }
    }
    handleWorkerMessage(event) {
        const topic = event.data.type;
        if (this.fromWorkerTopics.has(topic) && this.#handlers.has(topic)) {
            this.callHandlers(this.#handlers.get(topic), event.data);
        }
    }
    handleLocalMessage(message) {
        const topic = message.type;
        if (this.#handlers.has(message.type)) {
            this.callHandlers(this.#handlers.get(topic), message);
        }
    }
    callHandlers(handlers, result) {
        handlers.forEach(async (handler) => {
            handler[Symbol.toStringTag] === 'AsyncFunction'
                ? await handler(result)
                : handler(result);
        });
    }
    post(message) {
        if (this.toBackgroundTopics.has(message.type)) {
            this.#backgroundPort.postMessage(message);
        } else if (this.toWorkerTopics.has(message.type)) {
            this.#worker
                ? this.#worker.postMessage(message)
                : console.warn('cannot post to worker', message); // eslint-disable-line no-console
        } else if (this.postTopics.has(message.type)) {
            window.postMessage(message);
        } else if (this.localTopics.has(message.type)) {
            this.handleLocalMessage(message);
        } else {
            throw Error(`messenger.post: unknown topic ${message.type}`);
        }
    }
};

export default new Messenger();
