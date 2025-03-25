/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.js';
import about from './about.js';
import Layer from './layer.js';
import displayConfigControl from './config/config-control.js';
import appStore from '../lib/app-store.js';
import svgIcon from '../lib/svgicon.js';
import { globalTarget } from '../lib/utils.js';

const state = Symbol('menu state');

const MainMenu = class {
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

    show(event) {
        const anchor = event.target.closest('button');
        this.init(appWindow.root);
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.addEscLayerHandler();
        this.addClickWindowHandler();
        this.update({
            visible: true,
            position: this.anchorPosition(anchor),
        });
    }

    close(cleanup) {
        if (this[state].visible === true) {
            if (cleanup === true) {
                this.removeEscLayerHandler();
                this.removeClickWindowHandler();
                appWindow.addInputHandler();
                appWindow.hideOverlay();
            }
            this.update(this.#initState);
        }
    }

    view() {
        if (this[state].visible) {
            const top = `${this[state].position.top}px`;
            const left = `${this[state].position.left}px`;
            return html`
                <div
                    id="main-menu"
                    class="layer"
                    style=${styleMap({ top, left })}
                    @click=${this.click.bind(this)}
                >
                    <a data-subject="settings">Settings</a>
                    <a href="https://hummingme.github.io/kahuna-docs/" target="_blank">
                        Documentation ${svgIcon('tabler-external-link', { width: 14 })}
                    </a>
                    <a data-subject="about">About</a>
                </div>
            `;
        } else {
            return '';
        }
    }

    click(event) {
        if (event.target.nodeName === 'A') {
            event.stopPropagation();
            const subject = event.target.dataset.subject;
            if (subject === 'about') {
                about.show(event);
                this.close(false);
            } else if (subject === 'settings') {
                displayConfigControl({
                    target: globalTarget,
                    realm: 'application',
                    anchorId: 'main-menu-button-id',
                });
                this.close(false);
            } else {
                this.close(true);
            }
        }
    }
};

Object.assign(MainMenu.prototype, Layer);

const mainMenu = new MainMenu();

export default mainMenu;
