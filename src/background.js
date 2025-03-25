/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { messageListener } from './lib/background.js';
import { action, namespace } from './lib/runtime.js';

const tabsReady = new Set();
const mainPorts = new Map();
const contentPorts = new Map();

// the extensions action icon got clicked
action.onClicked.addListener(async (tab) => {
    try {
        if (tabsReady.has(tab.id)) {
            const port = mainPorts.get(tab.id);
            port && port.postMessage({ type: 'toggleVisibility' });
        } else {
            namespace.scripting
                ? await namespace.scripting.executeScript({
                      target: { tabId: tab.id },
                      files: ['kahuna.js'],
                  })
                : await namespace.tabs.executeScript({
                      file: 'kahuna.js',
                  });
            tabsReady.add(tab.id);
        }
    } catch (err) {
        throw Error(`failed to execute script: ${err}`);
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
    port.name === 'main'
        ? mainPorts.set(port.sender.tab.id, port)
        : contentPorts.set(port.sender.tab.id, port);
    port.onMessage.addListener(messageListener.bind(null, port, contentPorts));
    port.onDisconnect.addListener((port) => {
        port.name === 'main'
            ? mainPorts.delete(port.sender.tab.id)
            : contentPorts.delete(port.sender.tab.id);
    });
});
