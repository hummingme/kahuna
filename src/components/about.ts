/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import appWindow from '#components/app-window';
import ModalWindow from '#components/modal-window';
import appStore from '#lib/app-store';
import env from '#lib/environment';
import { extensionUrl } from '#lib/runtime';
import { itemsList, paragraph } from '#lib/text-output';
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
        'Designed for debugging, testing, data migration, inspection and modification of IndexedDB databases.',
        'Opens as an overlay on top of the visited website, toggled by the extension icon or a keyboard shortcut.',
        'Displays lists of databases and tables (aka object stores) stored for an origin.',
        'Create new databases, as well as copy and delete existing databases. Create empty copies that preserve only the schema.',
        'Edit the database schema: add or remove tables and indexes on existing tables.',
        'Displays table data in a paginated, sortable grid with configurable, reorderable, and hideable columns. Select records for editing, deletion or export.',
        'Combinable filters per field, including equals, comparison, starts/ends-with, contains, empty, and regular expression matches.',
        "Includes a JavaScript console to modify databases, tables or data by code and via Dexie's API.",
        'Edit values of every IndexedDB type supported by browsers, including Arrays, Objects, Maps, Sets, Dates, RegExps, typed arrays, Blobs, Files, ImageData, Undefined, and 24 more.',
        'For editing values, switch between form-based editors and editable JavaScript source code for complex values. Type conversion is performed for compatible types when the value type is switched.',
        'Upload files to replace String, Blob, File, ArrayBuffer, DataView, ImageBitmap, ImageData values. Upload CSV or JSON files as data for Object, Set, Array and typed array values.',
        'Auto-formats columns as dates, URLs, or image previews where the data fits.',
        'Import and export complete databases in Dexie format.',
        'Import and export tables in Dexie, JSON and CSV format, as well as selected data records in JSON and CSV format.',
        'Configure display options, editor behavior, filtering, import and export globally, per database or per table.',
        "Indicates with a badge on it's toolbar icon the number of IndexedDB databases stored for the currently visited origin.",
        'Works with both Firefox and Chromium-based browsers while respecting the capabilities and restrictions of each browser.',
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
