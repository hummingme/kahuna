/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import appWindow from '#components/app-window';
import configLayer from '#components/configlayer';
import Layer from '#components/layer';
import appStore from '#lib/app-store';
import calculateDistance from '#lib/calculate-distance';
import { type Position, EMPTY_POSITION } from '#types';

type TooltipArgs = {
    view: (() => TemplateResult) | null;
    anchor: Element | null;
    north?: boolean;
    hideDistance?: number;
};

type TooltipState = Omit<TooltipArgs, 'anchor'> & {
    node?: HTMLElement;
    visible: boolean;
    anchorPosition: Position;
    layerNode: HTMLElement | undefined;
};

const state = Symbol('tooltip state');

class Tooltip {
    [state]: TooltipState;
    #layer;
    #boundMousemove;
    constructor() {
        this[state] = this.initState;
        this.#layer = new Layer({ closeHandler: this.close.bind(this) });
        this.#boundMousemove = this.onMousemove.bind(this);
    }
    get initState(): TooltipState {
        return {
            visible: false,
            north: false,
            view: null,
            anchorPosition: EMPTY_POSITION,
            hideDistance: 20,
            layerNode: undefined,
        };
    }
    get visible() {
        return this[state].visible;
    }
    update(changes: Partial<TooltipState>) {
        this[state] = { ...this[state], ...changes };
    }
    show(props: TooltipArgs): void {
        const layer = this.#layer;
        const clNode = configLayer.getNode();
        const layerNode = clNode && appWindow.root.contains(clNode) ? clNode : undefined;
        const anchorPosition =
            props.anchor instanceof Element
                ? layer.anchorPosition(props.anchor)
                : EMPTY_POSITION;
        this.update({
            view: props.view,
            anchorPosition,
            north: props.north ?? false,
            visible: true,
            hideDistance: props.hideDistance || 20,
            layerNode,
        });
        layer.addEscLayerHandler();
        appStore.rerender();
    }
    close() {
        if (this[state].visible) {
            this.#layer.removeEscLayerHandler();
            this.removeMousemoveHandler(appWindow.win);
            if (this[state].layerNode) {
                this.removeMousemoveHandler(this[state].layerNode);
            }
            this.update(this.initState);
            appStore.rerender();
        }
    }
    node() {
        const { view, visible } = this[state];
        if (view && visible) {
            return html`
                <div id="tooltip" class="layer" ${ref(this.nodeReady.bind(this))}></div>
            `;
        } else {
            return nothing;
        }
    }
    nodeReady(node?: Element) {
        if (node) {
            this[state].node = node as HTMLElement;
            this.render();
        }
    }
    render() {
        const { anchorPosition, layerNode, node, north } = this[state];
        if (node) {
            render(this.view(), node);
            requestAnimationFrame(() => {
                const layer = this.#layer;
                const { x, y } = layer.calculatePosition(anchorPosition, node, north);
                node.style.top = `${y}px`;
                node.style.left = `${x}px`;
                this.addMousemoveHandler(appWindow.win);
                if (layerNode) this.addMousemoveHandler(layerNode);
            });
        }
    }
    rerender() {
        if (this[state].node) {
            render(this.view(), this[state].node);
        }
    }
    view() {
        if (this[state].view) {
            return this[state].view();
        }
    }
    addMousemoveHandler(target: HTMLElement) {
        target.addEventListener('mousemove', this.#boundMousemove, true);
    }
    removeMousemoveHandler(target: HTMLElement) {
        target.removeEventListener('mousemove', this.#boundMousemove, true);
    }
    onMousemove(event: MouseEvent) {
        const { node, hideDistance } = this[state];
        if (node) {
            const distance = calculateDistance(node, {
                x: event.clientX,
                y: event.clientY,
            });
            if (hideDistance && distance > hideDistance) {
                this.close();
            }
        }
    }
}

const tooltip = new Tooltip();

export default tooltip;
