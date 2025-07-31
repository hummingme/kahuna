/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import appWindow from './app-window.ts';
import appStore from '../lib/app-store.ts';
import { symbolButton } from '../lib/button.ts';

interface LoadingPanelState {
    visible: boolean;
    onStop: (() => Promise<void>) | null;
}
export interface LoadingViewParams {
    loading: boolean;
    loadingMsg: string;
    loadingStop: (() => Promise<void>) | null;
}

const state = Symbol('loadingpanel state');

const LoadingPanel = class {
    [state]: LoadingPanelState;
    #node?: HTMLElement;
    constructor() {
        this[state] = {
            visible: false,
            onStop: null,
        };
        window.addEventListener('resize', this.adjustPosition.bind(this));
    }
    view({ loading: visible, loadingMsg, loadingStop }: LoadingViewParams) {
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
                ${ref(this.nodeReady.bind(this))}
            >
                <div class="loading-content">
                    <div class="loading-bounce"></div>
                    <div class="loading-msg">${loadingMsg || 'loading...'}</div>
                    <div class="loading-stop">${stopButton}</div>
                </div>
            </div>
        `;
    }
    nodeReady(node?: Element) {
        if (node !== undefined) {
            this.#node = node as HTMLElement;
            if (node && appWindow.win) {
                this.adjustPosition();
            }
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
        if (this.#node && this[state].visible) {
            const win = appWindow.dims;
            let bottom = '0px';
            if (win.bottom > window.innerHeight) {
                bottom = `${win.bottom - window.innerHeight}px`;
            }
            this.#node.style.bottom = bottom;
        }
    }
};

export const loadingPanel = new LoadingPanel();
