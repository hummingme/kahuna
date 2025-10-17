/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { namespace, NSPort } from './runtime.ts';
import { sleep } from './utils.ts';
import { type Message } from './types/messages.ts';

let backgroundPort: NSPort | null = null;

export async function postToBackground(
    message: Message,
    handler: (msg: unknown) => void,
) {
    const port = await ensureBackgroundConnection(handler);
    if (!port) return;
    try {
        port.postMessage(message);
    } catch (_error) {
        // port dead, retry...
        backgroundPort = null;
        postToBackground(message, handler);
    }
}

async function ensureBackgroundConnection(handler: (msg: unknown) => void) {
    if (backgroundPort) {
        return backgroundPort;
    }
    try {
        backgroundPort = namespace.runtime.connect({ name: 'main' });
        backgroundPort.onMessage.addListener(handler);
        backgroundPort.onDisconnect.addListener(() => {
            backgroundPort = null;
        });
        // the bg wakes up immediately,
        // but dexie throws on the first select if it doesn't get a little time
        await sleep(100);
        return backgroundPort;
    } catch (error) {
        console.error('Failed to connect to background:', error); // eslint-disable-line no-console
        backgroundPort = null;
        return null;
    }
}
