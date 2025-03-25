/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

/**
 * mixin for ConfigLayer and Tooltip
 */
import { clamp } from '../lib/utils';

const Layer = {
    winNode: null,
    winOverlayNode: null,
    configlayerNode: null,

    init(rootNode) {
        this.configlayerNode = rootNode.getElementById('config-layer');
        this.winNode = rootNode.getElementById('window');
        this.winOverlayNode = rootNode.getElementById('window-overlay');
        if (this.boundKeydownHandler === undefined) {
            this.boundKeydownHandler = this.onKeydownOverlay.bind(this);
            this.boundClickWindow = this.onClickWindow.bind(this);
            this.boundMousemove = this.onMousemove.bind(this);
            this.boundResize = this.onResize.bind(this);
        }
    },
    calculatePosition({ top, left }, north = false) {
        const layerDims = this.fromState('node')?.getBoundingClientRect() || {
            height: 0,
            width: 0,
        };
        if (north) {
            top = clamp(top - layerDims.height, 3, top);
        }
        if (top > window.innerHeight - layerDims.height) {
            top = window.innerHeight - layerDims.height - 3;
            if (top < 3) top = 3;
        }

        if (left > window.innerWidth - layerDims.width) {
            left = window.innerWidth - layerDims.width - 3;
            if (left < 3) left = 3;
        }
        return { top, left };
    },
    anchorPosition(anchor) {
        const dims = anchor.getBoundingClientRect();
        return {
            top: dims.y + dims.height / 2,
            left: dims.left + dims.width / 2,
        };
    },
    addEscLayerHandler() {
        document.addEventListener('keydown', this.boundKeydownHandler, true);
    },

    removeEscLayerHandler() {
        document.removeEventListener('keydown', this.boundKeydownHandler, true);
    },

    onKeydownOverlay(event) {
        if (event.key == 'Escape') {
            event.stopPropagation();
            this.close();
        }
    },

    addClickWindowHandler() {
        this.winOverlayNode.addEventListener('click', this.boundClickWindow, true);
    },

    removeClickWindowHandler() {
        this.winOverlayNode.removeEventListener('click', this.boundClickWindow, true);
    },

    onClickWindow() {
        this.close(true);
    },

    addMousemoveHandler(target) {
        target.addEventListener('mousemove', this.boundMousemove, true);
    },

    removeMousemoveHandler(target) {
        target.removeEventListener('mousemove', this.boundMousemove, true);
    },

    onMousemove(event) {
        const distance = this.calculateDistance(
            this.fromState('node'),
            event.clientX,
            event.clientY,
        );
        if (distance > this.fromState('hideDistance')) {
            this.hide();
        }
    },

    addResizeHandler() {
        window.addEventListener('resize', this.boundResize, true);
    },

    removeResizeHandler() {
        window.removeEventListener('resize', this.boundResize, true);
    },

    onResize() {
        this.fixPosition();
    },
};

export default Layer;
