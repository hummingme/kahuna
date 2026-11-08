/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import appWindow from '#components/app-window';
import Layer from '#components/layer';
import displayConfigControl from '#components/config/config-control';
import svgIcon from '#components/parts/svgicon';
import appStore from '#lib/app-store';
import { globalTarget } from '#lib/app-target';
import { EMPTY_POSITION, Position } from '#types';

type MainMenuState = {
    visible: boolean;
    position: Position;
};

const state = Symbol('menu state');

const MainMenu = class {
    [state]: MainMenuState;
    #layer;
    #anchor?: HTMLButtonElement;
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
        const anchor = event.currentTarget;
        if (!(anchor instanceof HTMLButtonElement)) return;
        this.#anchor = anchor;
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.#layer.addEscLayerHandler();
        this.#layer.addClickWindowHandler(appWindow.win);
        this.update({ visible: true, position: this.#layer.anchorPosition(anchor) });
    }
    close() {
        if (this[state].visible === true && this.#anchor) {
            this.#anchor.setAttribute('aria-expanded', 'false');
            this.#anchor.removeAttribute('aria-controls');
            this.#anchor.focus();
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
                    ${ref(this.nodeReady.bind(this))}
                >
                    <button type="button" data-subject="settings">Settings</button>
                    <a
                        href="https://hummingme.github.io/kahuna-docs/"
                        target="_blank"
                        tabindex="0"
                    >
                        Documentation ${svgIcon('tabler-external-link', { width: 14 })}
                    </a>
                    <a
                        href="https://github.com/hummingme/kahuna"
                        target="_blank"
                        tabindex="0"
                    >
                        Github ${svgIcon('tabler-external-link', { width: 14 })}
                    </a>
                    <button data-subject="about">About</button>
                </div>
            `;
        } else {
            return '';
        }
    }
    nodeReady(node?: Element) {
        const anchor = this.#anchor;
        if (node instanceof HTMLDivElement && anchor) {
            anchor.setAttribute('aria-controls', 'main-menu');
            anchor.setAttribute('aria-expanded', 'true');
            const item = node.firstElementChild;
            if (item instanceof HTMLButtonElement) {
                requestAnimationFrame(() => {
                    item.focus();
                });
            }
        }
    }
    click(event: MouseEvent): void {
        const target = event.target;

        if (target instanceof HTMLElement) {
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
