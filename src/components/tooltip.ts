/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.ts';
import configLayer from './configlayer.ts';
import Layer from './layer.ts';
import appStore from '../lib/app-store.ts';
import calculateDistance from '../lib/calculate-distance.ts';
import { type Position, EMPTY_POSITION } from '../lib/types/common.ts';

interface TooltipState {
    node?: HTMLElement;
    visible: boolean;
    north: boolean;
    view: (() => TemplateResult) | null;
    anchor: Element | null;
    position: Position;
    hideDistance: number;
    layerNode?: HTMLElement;
}

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
            node: undefined,
            visible: false,
            north: false,
            view: null,
            anchor: null,
            position: EMPTY_POSITION,
            hideDistance: 20,
            layerNode: undefined,
        };
    }
    update(changes: Partial<TooltipState>) {
        this[state] = { ...this[state], ...changes };
    }
    show(props: Partial<TooltipState>): void {
        if (props.anchor === null || props.anchor === this[state].anchor) {
            return;
        }
        const layer = this.#layer;
        const anchorPosition =
            props.anchor instanceof Element
                ? layer.anchorPosition(props.anchor)
                : EMPTY_POSITION;
        const clNode = configLayer.getNode();
        const layerNode = clNode && appWindow.root.contains(clNode) ? clNode : undefined;
        const position = layer.calculatePosition(
            anchorPosition,
            this[state].node,
            props.north,
        );
        this.update({
            view: props.view,
            anchor: props.anchor,
            position,
            north: props.north,
            visible: true,
            hideDistance: props.hideDistance || 20,
            layerNode,
        });
        layer.addEscLayerHandler();
        this.addMousemoveHandler(appWindow.win);
        if (layerNode) this.addMousemoveHandler(layerNode);
        this.update({
            position: layer.calculatePosition(
                anchorPosition,
                this[state].node,
                props.north,
            ),
        });
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
            const top = `${this[state].position.y}px`;
            const left = `${this[state].position.x}px`;
            return html`
                <div
                    id="tooltip"
                    class="layer"
                    style=${styleMap({ top, left })}
                    ${ref(this.nodeReady.bind(this))}
                ></div>
            `;
        } else {
            return '';
        }
    }
    nodeReady(node?: Element) {
        if (node) {
            this[state].node = node as HTMLElement;
            this.render();
        }
    }
    render() {
        if (this[state].node) {
            render(this.view(), this[state].node!);
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
        if (this[state].node) {
            const distance = calculateDistance(this[state].node, {
                x: event.clientX,
                y: event.clientY,
            });
            if (distance > this[state].hideDistance) {
                this.close();
            }
        }
    }
}

const tooltip = new Tooltip();

export default tooltip;
