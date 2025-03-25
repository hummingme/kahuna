/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.js';
import configLayer from './configlayer.js';
import Layer from './layer.js';
import appStore from '../lib/app-store.js';

const state = Symbol('tooltip state');

const Tooltip = class {
    constructor() {
        this[state] = this.#initState;
    }

    get #initState() {
        return {
            node: null,
            visible: false,
            view: null,
            anchor: null,
            parent: null,
            position: { top: 0, left: 0 },
            anchorPosition: { top: 0, left: 0 },
            hideDistance: 20,
        };
    }

    fromState(prop) {
        return this[state][prop];
    }

    update(changes) {
        this[state] = { ...this[state], ...changes };
        appStore.rerender();
    }

    show(props) {
        if (props.anchor === null || props.anchor === this[state].anchor) {
            return;
        }
        this.init(appWindow.root);
        const anchorPosition = this.anchorPosition(props.anchor);
        const layerNode = configLayer.fromState('visible')
            ? configLayer.fromState('node')
            : null;
        this.update({
            view: props.view,
            anchor: props.anchor,
            anchorPosition,
            position: this.calculatePosition(anchorPosition, props.north),
            visible: true,
            hideDistance: props.hideDistance || 20,
            layerNode,
        });
        this.addMousemoveHandler(appWindow.win);
        layerNode && this.addMousemoveHandler(layerNode);

        this[state].node = appWindow.root.getElementById('tooltip');
        this.update({
            position: this.calculatePosition(this[state].anchorPosition, props.north),
        });
    }

    hide() {
        if (this[state].visible) {
            this.removeMousemoveHandler(appWindow.win);
            this[state].layerNode && this.removeMousemoveHandler(this[state].layerNode);
            this.update(this.#initState);
        }
    }

    view() {
        if (this[state] && this[state].visible) {
            const top = `${this[state].position.top}px`;
            const left = `${this[state].position.left}px`;
            return html`
                <div id="tooltip" class="layer" style=${styleMap({ top, left })}>
                    ${this[state].view()}
                </div>
            `;
        } else {
            return '';
        }
    }

    calculateDistance(node, x, y) {
        const from = { x, y };
        const off = node.getBoundingClientRect();
        const ny1 = off.top; // top
        const ny2 = ny1 + node.offsetHeight; // bottom
        const nx1 = off.left; // left
        const nx2 = nx1 + node.offsetWidth; // right
        const maxX1 = Math.max(x, nx1);
        const minX2 = Math.min(x, nx2);
        const maxY1 = Math.max(y, ny1);
        const minY2 = Math.min(y, ny2);
        const intersectX = minX2 >= maxX1;
        const intersectY = minY2 >= maxY1;
        const to = {
            x: intersectX ? x : nx2 < x ? nx2 : nx1,
            y: intersectY ? y : ny2 < y ? ny2 : ny1,
        };
        const distX = to.x - from.x;
        const distY = to.y - from.y;
        const distance = Math.floor((distX ** 2 + distY ** 2) ** (1 / 2));
        return distance;
    }
};
Object.assign(Tooltip.prototype, Layer);

const tooltip = new Tooltip();

export default tooltip;
