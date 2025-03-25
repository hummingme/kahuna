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
        throw Error(`browser action failed: ${err}`);
    }
});

namespace.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo?.status === 'complete') {
        tabsReady.delete(tabId);
    }
});

let pingGuard = null;
namespace.runtime.onConnect.addListener((port) => {
    port.name === 'main'
        ? mainPorts.set(port.sender.tab.id, port)
        : contentPorts.set(port.sender.tab.id, port);
    port.onMessage.addListener(messageListener.bind(null, port, contentPorts));
    port.onDisconnect.addListener((port) => {
        port.name === 'main'
            ? mainPorts.delete(port.sender.tab.id)
            : contentPorts.delete(port.sender.tab.id);
        if (pingGuard === port.sender.tab.id) {
            pingGuard = contentPorts.values().next().value || null;
            if (pingGuard) {
                pingGuard.postMessage({ type: 'keepAlive' });
            }
        }
    });
    if (pingGuard === null && port.name === 'content') {
        pingGuard = port.sender.tab.id;
        port.postMessage({ type: 'keepAlive' });
    }
});

if (namespace.runtime.getManifest().manifest_version === 3) {
    namespace.userScripts?.unregister().then(() =>
        namespace.userScripts.register([
            {
                id: 'idxdbm-executor',
                world: 'MAIN',
                matches: ['*://*/*'],
                runAt: 'document_end',
                js: [{ file: '/userscript.js' }],
            },
        ]),
    );
}
