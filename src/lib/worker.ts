/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { fetchFile } from './utils.ts';
import { extensionUrl } from './runtime.ts';

export const startWorker = async (scriptname: string): Promise<Worker | null> => {
    const src = await fetchFile(extensionUrl(scriptname));
    const blob = new Blob([src]);
    const url = window.URL.createObjectURL(blob);
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
