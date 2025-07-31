/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { messageListener } from './lib/background.ts';
import { action, namespace, NSPort } from './lib/runtime.ts';

type PortMap = Map<number, NSPort>;

const tabsReady: Set<number> = new Set();
const mainPorts: PortMap = new Map();
const contentPorts: PortMap = new Map();

// the extensions action icon got clicked
action.onClicked.addListener(async (tab, info?) => {
    if (
        tab.id === undefined ||
        tab.url === undefined ||
        (info as browser.action.OnClickData)?.button !== 0
    ) {
        return;
    }
    const tabId = tab.id;
    if (tabsReady.has(tabId)) {
        const port = mainPorts.get(tabId);
        if (port) port.postMessage({ type: 'toggleVisibility' });
    } else {
        try {
            if (namespace.scripting) {
                await namespace.scripting.executeScript({
                    target: { tabId },
                    files: ['kahuna.js'],
                });
            } else {
                await namespace.tabs.executeScript({
                    file: 'kahuna.js',
                });
            }
        } catch (err) {
            throw Error(`failed to execute script: ${err}`);
        }
        tabsReady.add(tabId);
    }
});

namespace.tabs.onUpdated.addListener(
    (tabId, changeInfo) => {
        if (changeInfo?.status === 'complete') {
            tabsReady.delete(tabId);
        }
    },
    { properties: ['status'] },
);

namespace.runtime.onConnect.addListener((port) => {
    if (!port?.sender?.tab?.id) return;
    const tabId = port.sender.tab.id;
    if (port.name === 'main') {
        mainPorts.set(tabId, port);
    } else {
        contentPorts.set(tabId, port);
    }
    port.onMessage.addListener(messageListener.bind(null, port, contentPorts));
    port.onDisconnect.addListener((port) => {
        if (port.name === 'main') {
            mainPorts.delete(tabId);
        } else {
            contentPorts.delete(tabId);
        }
    });
});
