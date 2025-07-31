/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

/**
 * used by SchemaEditor
 */
import { clamp } from '../lib/utils.ts';
import type { Position } from '../lib/types/common.ts';

class Layer {
    closeHandler;
    resizeHandler;
    boundKeydownHandler;
    boundClickWindowHandler;
    boundResizeHandler;

    constructor(props: { closeHandler: () => void; resizeHandler?: () => void }) {
        this.closeHandler = props.closeHandler;
        this.resizeHandler = props.resizeHandler;
        this.boundKeydownHandler = this.onKeydownOverlay.bind(this);
        this.boundClickWindowHandler = this.onClickWindow.bind(this);
        this.boundResizeHandler = this.onResize.bind(this);
    }
    calculatePosition(
        { x, y }: Position,
        layerNode?: HTMLElement,
        north?: boolean,
    ): Position {
        const layerDims = layerNode?.getBoundingClientRect() || {
            height: 0,
            width: 0,
        };
        if (north) {
            y = clamp(y - layerDims.height, 3, y);
        }
        if (y > window.innerHeight - layerDims.height) {
            y = window.innerHeight - layerDims.height - 3;
            if (y < 3) y = 3;
        }
        if (x > window.innerWidth - layerDims.width) {
            x = window.innerWidth - layerDims.width - 3;
            if (x < 3) x = 3;
        }
         return { y, x };
    }
    anchorPosition(anchor: Element): Position {
        const dims = anchor.getBoundingClientRect();
        return {
            x: dims.left + dims.width / 2,
            y: dims.y + dims.height / 2,
        };
    }
    addEscLayerHandler() {
        document.addEventListener('keydown', this.boundKeydownHandler, true);
    }
    removeEscLayerHandler() {
        document.removeEventListener('keydown', this.boundKeydownHandler, true);
    }
    onKeydownOverlay(event: KeyboardEvent) {
        if (event.key == 'Escape') {
            event.stopPropagation();
            this.closeHandler();
        }
    }
    addClickWindowHandler(node: HTMLElement) {
        node.addEventListener('click', this.boundClickWindowHandler, true);
    }
    removeClickWindowHandler(node: HTMLElement) {
        node.removeEventListener('click', this.boundClickWindowHandler, true);
    }
    onClickWindow() {
        this.closeHandler();
    }
    addResizeHandler() {
        window.addEventListener('resize', this.boundResizeHandler, true);
    }

    removeResizeHandler() {
        window.removeEventListener('resize', this.boundResizeHandler, true);
    }
    onResize() {
        if (this.resizeHandler) {
            this.resizeHandler();
        }
    }
}

export default Layer;
