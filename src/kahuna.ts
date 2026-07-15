/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';

import appWindow from '#components/app-window';
import Breadcrumb from '#components/breadcrumb';
import configLayer from '#components/configlayer';
import Database from '#components/database';
import datatable from '#components/datatable';
import Origin from '#components/origin';
import appStore, { type AppState } from '#lib/app-store';
import appWorker from '#lib/app-worker';
import env from '#lib/environment';
import messenger from '#lib/messenger';
import settings from '#lib/settings';
import startupCheckings from '#lib/startup-checkings';
import { sleep } from '#lib/utils';

const DEVEL = false;
if (DEVEL) {
    window.setTimeout(() => {
        const button = appWindow?.root?.querySelector<HTMLButtonElement>(
            'button[title="database tools"]',
        );
        button?.click();
        window.setTimeout(() => {
            const topic =
                appWindow?.root?.querySelector<HTMLAnchorElement>('a[data-topic="edit"]');
            topic?.click();
        }, 500);
    }, 500);
}

// try/catch is necessary in firefox to get notice of top level errors
// eslint-disable-next-line no-useless-catch
try {
    const init = async () => {
        messenger.register('reloadApp', reloadApp);
        messenger.register('rerenderApp', rerenderApp);
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
    throw error;
}

function rerenderApp() {
    renderApp(appWindow, appStore.state);
}

function renderApp(appwin: typeof appWindow, state: AppState) {
    const { selectedDB, selectedTable, databases } = state;
    const winNode = appwin.render();
    let stage;
    if (typeof selectedTable === 'number') {
        stage = datatable.template();
    } else if (typeof selectedDB === 'number') {
        stage = Database.template(state.tables);
    } else {
        stage = Origin.template(state.databases);
    }
    render(
        html`
            ${Breadcrumb.view({ selectedDB, selectedTable, databases })}
            <div id="main">${stage}</div>
        `,
        winNode,
    );
}

async function reloadApp() {
    await settings.init();
    appWindow.reset();
    configLayer.close({ force: true });
    const { selectedDB, selectedTable } = appStore.state;
    if (typeof selectedTable === 'number') {
        datatable.summon(selectedTable);
    } else if (typeof selectedDB === 'number') {
        Database.summon(selectedDB);
    } else {
        Origin.summon();
    }
}

type GlobalErrorEvent = ErrorEvent | PromiseRejectionEvent | SecurityPolicyViolationEvent;

const handleGlobalError = async (event: GlobalErrorEvent) => {
    if (isSecurityPolicyViolationEvent(event)) {
        env.workersBlocked = true;
        appWorker.terminate();
        await sleep(100);
        reloadApp();
    } else {
        // eslint-disable-next-line no-console
        console.error('catched global error', event);
    }
};

const isSecurityPolicyViolationEvent = (
    event: GlobalErrorEvent,
): event is SecurityPolicyViolationEvent => {
    return (
        event.type === 'securitypolicyviolation' &&
        'violatedDirective' in event &&
        'blockedURI' in event &&
        event.violatedDirective === 'worker-src' &&
        event.blockedURI === 'blob'
    );
};
