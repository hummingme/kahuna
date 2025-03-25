/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import messenger from '../lib/messenger.js';
import { startWorker } from './worker.js';

const SCRIPTNAME = 'contentscript_worker.js';

class AppWorker {
    #worker = null;
    constructor() {}
    async start() {
        this.#worker = await startWorker(SCRIPTNAME);
        messenger.worker = this.#worker;
        return this.#worker;
    }
    async restart() {
        this.terminate();
        return await this.start();
    }
    terminate() {
        this.#worker && this.#worker.terminate();
        this.#worker = null;
        messenger.worker = null;
    }
}
const appWorker = new AppWorker();
export default appWorker;
