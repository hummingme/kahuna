/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { EMPTY_POSITION } from '#types';

type GConstructor<T> = new (...args: any[]) => T;
type Layer = GConstructor<object>;

export default function Draggable<TBase extends Layer>(Base: TBase) {
    return class Draggable extends Base {
        #layerNode?: HTMLElement;
        #dragNode = document.createElement('div');
        #isDragging = false;
        #offsetX = 0;
        #offsetY = 0;
        #wasDragged = false;
        #position = EMPTY_POSITION;
        makeDraggable(layerNode: HTMLElement) {
            this.#layerNode = layerNode;
            const dragger = this.#dragNode;
            dragger.classList.add('drag-handle');
            dragger.addEventListener('pointerdown', this.dragStart.bind(this));
            dragger.addEventListener('pointermove', this.dragMove.bind(this));
            dragger.addEventListener('pointerup', this.dragStop.bind(this));
            layerNode.append(dragger);
        }
        dragStart(event: PointerEvent) {
            event.stopPropagation();
            if (!this.#layerNode) return;
            this.#isDragging = true;
            const rect = this.#layerNode.getBoundingClientRect();
            this.#offsetX = event.clientX + window.scrollX - rect.left;
            this.#offsetY = event.clientY + window.scrollY - rect.top;
            this.#dragNode.style.cursor = 'move';
            this.#dragNode.setPointerCapture(event.pointerId);
        }
        dragMove(event: PointerEvent) {
            if (!this.#isDragging || !this.#layerNode) return;
            const x = event.clientX + window.scrollX - this.#offsetX;
            const y = event.clientY + window.scrollY - this.#offsetY;
            this.#layerNode.style.left = `${x}px`;
            this.#layerNode.style.top = `${y}px`;
            this.#layerNode.style.transform = 'translate(0)';
            this.#position = { x, y };
        }
        dragStop(event: PointerEvent) {
            this.#isDragging = false;
            this.#wasDragged = true;
            this.#dragNode.style.cursor = 'grab';
            this.#dragNode.releasePointerCapture(event.pointerId);
        }
        get wasDragged() {
            return this.#wasDragged;
        }
        getPosition() {
            return this.#position;
        }
        resetDraggable() {
            this.#wasDragged = false;
            this.#position = EMPTY_POSITION;
        }
    };
}
