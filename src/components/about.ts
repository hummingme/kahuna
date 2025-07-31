/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import appWindow from './app-window.ts';
import ModalWindow from './modal-window.ts';
import appStore from '../lib/app-store.ts';
import env from '../lib/environment.ts';
import { extensionUrl } from '../lib/runtime.ts';
import { itemsList, paragraph } from '../lib/text-output.ts';
// @ts-expect-error TS2307
import * as build from 'buildinfo.js';

class About extends ModalWindow {
    constructor() {
        super({ visibilityProperty: 'aboutVisible' });
    }
    view() {
        const buildISO = new Date(build.timestamp * 1000).toISOString();
        const builddate = buildISO.slice(0, 10);
        const buildtime = buildISO.slice(11, 16);
        const content = html`
            <div class="about">
                <h1>Kahuna, the IndexedDB-Manager V${build.version}</h1>
                <img id="kahuna-icon" src=${extensionUrl('icons/kahuna.svg')} />
                ${paragraph(this.paragraphs[0], this.links())}
                <h2>Main Features</h2>
                ${itemsList(this.features, this.links())}
                <h2>License</h2>
                ${paragraph(this.paragraphs[1], this.links())}
                <h2>Source Code</h2>
                ${paragraph(this.paragraphs[2], this.links())}
                <h2>Acknowledgments</h2>
                ${itemsList(this.acknowledgments, this.links())}
                <div class="footer">
                    <div @click=${this.buildInfoClicked}>
                        build "${build.hash}", ${builddate}, ${buildtime} UTC
                        <div class="env">
                            <p id="env-heading">Environment flags:</p>
                            <ul aria-labelledby="env-heading">
                                <li>bigIntArrayFlaw: ${env.bigIntArrayFlaw}</li>

                                <li>unsafeEval: ${env.unsafeEval}</li>
                                <li>workersBlocked: ${env.workersBlocked}</li>
                            </ul>
                        </div>
                    </div>
                    &bull;
                    <div @click=${this.updateInfoClicked}>UpdateInfo</div>
                </div>
            </div>
        `;
        return super.node(content);
    }
    buildInfoClicked() {
        const modal = appWindow.root.querySelector('div.modal-window');
        const env = appWindow.root.querySelector('div.env');
        if (env && modal) {
            (env as HTMLElement).style.display =
                window.getComputedStyle(env).display === 'none' ? 'block' : 'none';
            modal.scrollTop = modal.scrollHeight;
        }
    }
    updateInfoClicked() {
        appStore.update({
            aboutVisible: false,
            updateInfoVisible: true,
        });
    }
    readonly paragraphs = [
        `Kahuna is a browser extension for managing [IndexedDB] databases
         and is available for Firefox and Chromium based browsers, such as Google Chrome,
         Edge and Opera. Kahuna supports developers to manage databases and provides
         convenient access to the data they contain. Interested users can use Kahuna
         to satisfy their curiosity and find out what data the websites they visit
         permanently store in their browser.`,
        `Kahuna, the IndexedDB-Manager is © Lutz Brückner <dev@kahuna.rocks><br />
         and licensed under <strong>Mozilla Public License 2.0</strong> ([MPL-2.0])`,
        `The source code is [available on github]`,
    ];
    readonly features = [
        "signals with its icon in the browser's address bar when IndexedDB databases exist for a visited website",
        'displays lists of the found databases and tables (object stores)',
        'imports and exports databases in dexie format',
        'can create new databases, as well as copy and delete existing databases',
        'its schema editor can be used to create and delete tables, and to modify the indexes of tables',
        'imports and exports tables in dexie, json and csv format, as well as selected data records in json and csv format',
        'displays the saved data of a table page by page and enables the editing and deletion of data records',
        'filters can be configured and combined for all data fields to display or export a selection of an object stores data',
        'enables the entry and execution of JavaScript code to modify databases, tables or data',
    ];
    readonly acknowledgments = [
        '[Dexie] wrapper library for the IndexedDB browser API',
        '[lit-html], the templating engine of the lit web components library',
        '[tabler] svg icons',
        'and the great tools of the Javascript ecosystem: esbuild, eslint, prettier, and more',
    ];
    links() {
        return new Map([
            [
                'indexeddb',
                'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
            ],
            ['firefox', 'https://www.mozilla.org/de/firefox/'],
            ['google chrome', 'https://www.google.com/intl/en_uk/chrome/'],
            ['dexie', 'https://dexie.org/'],
            ['lit-html', 'https://lit.dev/docs/templates/overview/'],
            ['tabler', 'https://tabler.io/icons'],
            ['available on github', 'https://github.com/hummingme/kahuna'],
            ['mpl-2.0', 'https://mozilla.org/MPL/2.0/'],
        ]);
    }
}

export default About;
