/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import appWindow from './components/app-window.js';
import Breadcrumb from './components/breadcrumb.js';
import configLayer from './components/configlayer.js';
import Database from './components/database.js';
import Origin from './components/origin.js';
import appStore from './lib/app-store.js';
import appWorker from './lib/app-worker.js';
import env from './lib/environment.js';
import startupCheckings from './lib/startup-checkings.js';
import settings from './lib/settings.js';

const DEVEL = false;
if (DEVEL) {
    window.setTimeout(() => {
        appWindow.root.querySelector('button[title="database tools"]').click();
        window.setTimeout(() => {
            appWindow.root.querySelector('a[data-topic="edit"]').click();
        }, 500);
    }, 500);
}

// eslint-disable-next-line no-useless-catch
try {
    let _oldState = {};
    const init = async () => {
        appStore.addEventListener(
            'change',
            (ev) => {
                renderApp(appWindow, ev.detail.state);
            },
            false,
            true,
        ); // useCapture: false, wantsUntrusted: true

        configLayer.addEventListener(
            'change',
            (ev) => {
                renderApp(appWindow, appStore.state);
                if (ev.detail.state.view === null) {
                    appWindow.addInputHandler();
                    appWindow.hideOverlay();
                } else {
                    appWindow.removeInputHandler();
                    appWindow.showOverlay();
                }
            },
            false,
            true,
        );
        window.addEventListener('error', function (event) {
            handleGlobalError(event);
        });
        window.addEventListener('unhandledrejection', function (event) {
            handleGlobalError(event);
        });
        window.addEventListener('securitypolicyviolation', function (event) {
            handleGlobalError(event);
        });
        await settings.init();
        const worker = await appWorker.start();
        if (!worker) {
            env.workersBlocked = true;
        }
        env.init();
        appWindow.init();
        await appStore.init();
        startupCheckings();
        return;
    };
    init();
} catch (error) {
    // try/catch is necessary in firefox to get notice of top level errors
    throw error;
}

const renderApp = (appwin, state) => {
    const winNode = appwin.render();

    let stage;
    if (state.selectedTable !== null) {
        stage = state.datatable.template(state);
    } else if (state.selectedDB !== null) {
        stage = Database.template(state);
    } else {
        stage = Origin.template(state);
    }

    render(
        html`
            ${Breadcrumb.view(state)}
            <div id="main">${stage}</div>
        `,
        winNode,
    );
};

const handleGlobalError = (event) => {
    if (
        event.type === 'securitypolicyviolation' &&
        event.violatedDirective === 'worker-src' &&
        event.blockedURI === 'blob'
    ) {
        env.workersBlocked = true;
        appWorker.terminate();
        appStore.init();
    } else {
        // eslint-disable-next-line no-console
        console.error('catched global error', event);
    }
};
