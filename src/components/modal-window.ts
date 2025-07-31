/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import appWindow from './app-window.ts';
import Layer from './layer.ts';
import appStore from '../lib/app-store.ts';

interface ModalWindowState {
    visible: boolean;
}
interface ModalWindowOptions {
    closeHandler?: () => void;
    visibilityProperty?: string;
}

const state = Symbol('modal window state');

class ModalWindow {
    [state]: ModalWindowState;
    #layer: Layer;
    #options: ModalWindowOptions;

    constructor(options: ModalWindowOptions = {}) {
        this[state] = this.#initState;
        this.#options = options;
        this.#layer = new Layer({ closeHandler: this.close.bind(this) });
    }
    get #initState() {
        return {
            visible: false,
        };
    }
    get visible() {
        return this[state].visible;
    }
    update(changes: Partial<ModalWindowState>) {
        this[state] = { ...this[state], ...changes };
    }
    show() {
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.#layer.addEscLayerHandler();
        this.#layer.addClickWindowHandler(appWindow.win);
        this.update({
            visible: true,
        });
    }
    close() {
        if (this.visible === true) {
            if (this.#options.closeHandler) {
                this.#options.closeHandler();
            }
            this.#layer.removeEscLayerHandler();
            this.#layer.removeClickWindowHandler(appWindow.win);
            this.update(this.#initState);
            appWindow.addInputHandler();
            appWindow.hideOverlay();
            if (this.#options.visibilityProperty) {
                const propertyName = this.#options.visibilityProperty;
                appStore.update({ [propertyName]: false });
            }
        }
    }
    node(content: TemplateResult) {
        if (this.visible === false) {
            this.show();
        }
        return html`
            <div class="modal-window layer">${content}</div>
        `;
    }
}

export default ModalWindow;
