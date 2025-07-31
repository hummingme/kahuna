/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import messenger from '../lib/messenger.ts';
import { startWorker } from './worker.ts';

const SCRIPTNAME = 'contentscript_worker.js';

class AppWorker {
    #worker: Worker | null = null;
    constructor() {}
    async start(): Promise<Worker | null> {
        this.#worker = await startWorker(SCRIPTNAME);
        messenger.worker = this.#worker;
        return this.#worker;
    }
    async restart(): Promise<Worker | null> {
        this.terminate();
        return await this.start();
    }
    terminate() {
        if (this.#worker) this.#worker.terminate();
        this.#worker = null;
        messenger.worker = null;
    }
}
const appWorker = new AppWorker();
export default appWorker;
