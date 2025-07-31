/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.ts';
import Layer from './layer.ts';
import displayConfigControl from './config/config-control.ts';
import appStore from '../lib/app-store.ts';
import { globalTarget } from '../lib/app-target.ts';
import svgIcon from '../lib/svgicon.ts';
import { EMPTY_POSITION, Position } from '../lib/types/common.ts';

interface MainMenuState {
    visible: boolean;
    position: Position;
}

const state = Symbol('menu state');

const MainMenu = class {
    [state]: MainMenuState;
    #layer;
    constructor() {
        this[state] = this.#initState;
        this.#layer = new Layer({ closeHandler: this.close.bind(this) });
    }
    get #initState(): MainMenuState {
        return {
            visible: false,
            position: EMPTY_POSITION,
        };
    }
    update(changes: Partial<MainMenuState>) {
        this[state] = { ...this[state], ...changes };
        appStore.rerender();
    }
    show(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const anchor = target.closest('button');
        const position =
            anchor instanceof Element
                ? this.#layer.anchorPosition(anchor)
                : EMPTY_POSITION;

        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.#layer.addEscLayerHandler();
        this.#layer.addClickWindowHandler(appWindow.win);
        this.update({ visible: true, position });
    }
    close() {
        if (this[state].visible === true) {
            this.#layer.removeEscLayerHandler();
            this.#layer.removeClickWindowHandler(appWindow.win);
            appWindow.addInputHandler();
            appWindow.hideOverlay();
            this.update(this.#initState);
        }
    }
    view(): TemplateResult | string {
        if (this[state].visible) {
            const top = `${this[state].position.y}px`;
            const left = `${this[state].position.x}px`;
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
                    <a href="https://github.com/hummingme/kahuna" target="_blank">
                        Github ${svgIcon('tabler-external-link', { width: 14 })}
                    </a>
                    <a data-subject="about">About</a>
                </div>
            `;
        } else {
            return '';
        }
    }
    click(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.nodeName === 'A') {
            event.stopPropagation();
            this.close();
            const subject = target.dataset.subject;
            if (subject === 'about') {
                appStore.update({ aboutVisible: true });
            } else if (subject === 'settings') {
                displayConfigControl({
                    target: globalTarget,
                    realm: 'application',
                    anchorId: 'main-menu-button-id',
                });
            }
        }
    }
};

const mainMenu = new MainMenu();

export default mainMenu;
