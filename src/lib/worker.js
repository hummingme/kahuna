/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { fetchFile } from './utils.js';
import { extensionUrl } from './runtime.js';

export const startWorker = async (scriptname) => {
    const src = await fetchFile(extensionUrl(scriptname));
    var blob = new Blob([src]);
    var url = window.URL.createObjectURL(blob);
    try {
        return new Worker(url);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') {
            return null;
        } else {
            throw error;
        }
    }
};
