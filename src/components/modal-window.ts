/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import appWindow from '#components/app-window';
import Layer from '#components/layer';
import appStore from '#lib/app-store';
import Draggable from '#lib/draggable';

type ModalWindowState = {
    visible: boolean;
};
type ModalWindowOptions = {
    closeHandler?: () => void;
    visibilityProperty?: string;
};

const state = Symbol('modal window state');

class ModalWindow {
    [state]: ModalWindowState;
    #layer;
    #options: ModalWindowOptions;

    constructor(options: ModalWindowOptions = {}) {
        this[state] = this.#initState;
        this.#options = options;
        const DraggableLayer = Draggable(Layer);
        this.#layer = new DraggableLayer({ closeHandler: this.close.bind(this) });
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
        // on initial load the appWindow node may not yet exist
        setTimeout(() => this.#layer.addClickWindowHandler(appWindow.win), 100);
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
            <div class="modal-window layer" ${ref(this.nodeReady.bind(this))}>
                ${content}
            </div>
        `;
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLElement) {
            this.#layer.makeDraggable(node);
        }
    }
}

export default ModalWindow;
