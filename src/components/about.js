/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import appWindow from './app-window.js';
import Layer from './layer.js';
import appStore from '../lib/app-store.js';
import env from '../lib/environment.js';
import * as build from 'buildinfo.js';
import { extensionUrl } from '../lib/runtime.js';

const state = Symbol('about state');

const About = class {
    constructor() {
        this[state] = this.#initState;
    }

    get #initState() {
        return {
            visible: false,
            position: { top: 0, left: 0 },
        };
    }

    fromState(prop) {
        return this[state][prop];
    }

    update(changes) {
        this[state] = { ...this[state], ...changes };
        appStore.rerender();
    }

    show(ev) {
        const anchor = ev.target;
        const rootNode = anchor.getRootNode();
        this.init(rootNode);
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.addEscLayerHandler();
        this.addClickWindowHandler();
        this.update({
            visible: true,
        });
    }

    close() {
        if (this[state].visible === true) {
            this.removeEscLayerHandler();
            this.removeClickWindowHandler();
            this.update(this.#initState);
            appWindow.addInputHandler();
            appWindow.hideOverlay();
        }
    }

    view() {
        if (this[state].visible) {
            const buildISO = new Date(build.timestamp * 1000).toISOString();
            const builddate = buildISO.slice(0, 10);
            const buildtime = buildISO.slice(11, 16);
            return html`
                <div id="about" class="layer">
                    <h1>Kahuna, the IndexedDB-Manager V${build.version}</h1>
                    <img id="kahuna-icon" src=${extensionUrl('icons/kahuna.svg')} />
                    ${this.paragraph(0)}
                    <h2>Main Features</h2>
                    ${this.itemsList(this.features)}
                    <h2>License</h2>
                    ${this.paragraph(2)}
                    <h2>Source Code</h2>
                    ${this.paragraph(1)}
                    <h2>Acknowledgments</h2>
                    ${this.itemsList(this.acknowledgments)}
                    <div class="footer" @click=${this.footerClicked}>
                        <p>build "${build.hash}", ${builddate}, ${buildtime} UTC</p>
                        <div class="env">
                            <p id="env-heading">Environment flags:</p>
                            <ul aria-labelledby="env-heading">
                                <li>bigIntArrayFlaw: ${env.bigIntArrayFlaw}</li>
                                <li>unsafeEval: ${env.unsafeEval}</li>
                                <li>workersBlocked: ${env.workersBlocked}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return '';
        }
    }
    itemsList(items) {
        return html`
            <ul>
                ${items.map(
                    (item) => html`
                        <li>${unsafeHTML(this.processLinks(item))}</li>
                    `,
                )}
            </ul>
        `;
    }
    paragraph(index) {
        return unsafeHTML(`<p>${this.processLinks(this.paragraphs[index])}</p>`);
    }
    linkRegExp = /\[([^\]]*)\]/g;
    processLinks(item) {
        return item.replaceAll(this.linkRegExp, this.replaceLink.bind(this));
    }
    replaceLink(match, key) {
        const link = this.links().get(key.toLowerCase());
        return link
            ? `<a href="${link}" title="${link}" target="_blank">${key}</a>`
            : match;
    }
    footerClicked(event) {
        const about = event.target.getRootNode().querySelector('div#about');
        const env = event.target.getRootNode().querySelector('div.env');
        env.style.display =
            window.getComputedStyle(env).display === 'none' ? 'block' : 'none';
        about.scrollTop = about.scrollHeight;
    }
    paragraphs = [
        `Kahuna is a browser extension for managing [IndexedDB] databases
         and is available for Firefox and Chromium based browsers, such as Google Chrome,
         Edge and Opera. Kahuna supports developers to manage databases and provides
         convenient access to the data they contain. Interested users can use Kahuna
         to satisfy their curiosity and find out what data the websites they visit
         permanently store in their browser.`,
        `The source code is [available on github]`,
        `Kahuna, the IndexedDB-Manager is © Lutz Brückner <dev@kahuna.rocks><br />
         and licensed under <strong>Mozilla Public License 2.0</strong> ([MPL-2.0])`,
    ];
    features = [
        "signals with its icon in the browser's address bar when IndexedDB databases exist for a visited website",
        'displays lists of the found databases and tables (object stores)',
        'imports and exports databases in dexie format',
        'can create new databases and delete existing databases',
        'tables can be created and deleted, the indexes of tables can be edited',
        'imported and exported tables in dexie, json and csv format, as well as selected data records in json and csv format',
        'displays the saved data of a table page by page and enables the editing and deletion of data records',
        'filters can be configured and combined for all data fields to display or export a selection of an object stores data',
        'enables the entry and execution of JavaScript code to modify databases, tables or data as desired',
    ];
    acknowledgments = [
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
};

Object.assign(About.prototype, Layer);

const about = new About();

export default about;
