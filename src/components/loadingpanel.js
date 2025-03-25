/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import appWindow from './app-window.js';
import appStore from '../lib/app-store.js';
import { symbolButton } from '../lib/button.js';

const state = Symbol('loadingpanel state');

const LoadingPanel = class {
    #wrapper;

    constructor() {
        this[state] = {
            visible: false,
        };
        window.addEventListener('resize', this.adjustPosition.bind(this));
    }
    view({ loading: visible, loadingMsg, loadingStop }) {
        this[state].visible = visible;
        this[state].onStop = loadingStop;
        const display = visible ? 'flex' : 'none';
        const stopButton =
            typeof loadingStop === 'function'
                ? symbolButton({
                      title: `stop loading`,
                      icon: 'tabler-circle-x',
                      '@click': this.stopClicked.bind(this),
                  })
                : '';
        return html`
            <div
                class="loading-wrapper"
                style="display:${display}"
                ${ref(this.wrapperReady.bind(this))}
            >
                <div class="loading-content">
                    <div class="loading-bounce"></div>
                    <div class="loading-msg">${loadingMsg || 'loading...'}</div>
                    <div class="loading-stop">${stopButton}</div>
                </div>
            </div>
        `;
    }
    wrapperReady(node) {
        this.#wrapper = node;
        if (node && appWindow.win) {
            this.adjustPosition();
        }
    }
    async stopClicked() {
        if (this[state].onStop) {
            await this[state].onStop();
        } else {
            appStore.rerender();
        }
    }
    adjustPosition() {
        if (this[state].visible) {
            const win = appWindow.dims;
            let bottom = '0px';
            if (win.bottom > window.innerHeight) {
                bottom = `${win.bottom - window.innerHeight}px`;
            }
            this.#wrapper.style.bottom = bottom;
        }
    }
};

const loadingPanel = new LoadingPanel();

export default loadingPanel;
