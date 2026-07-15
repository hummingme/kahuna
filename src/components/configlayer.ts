/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import appWindow from '#components/app-window';
import Layer from '#components/layer';
import appStore from '#lib/app-store';
import { button } from '#lib/button';
import Draggable from '#lib/draggable';
import { type Position, EMPTY_POSITION } from '#types';

interface ConfigLayerState {
    node?: HTMLElement;
    visible: boolean;
    view: (() => TemplateResult) | null;
    anchorPosition: Position;
    position: Position;
    keepMinimumTop: boolean;
    minimumTop: number;
    buttons: LayerButton[];
    confirmed: { [key: string]: () => void };
    topic: string | null;
}
interface ShowProps extends Partial<ConfigLayerState> {
    anchorId?: string;
    buttons?: LayerButton[];
}

interface PanelButton {
    label: string | TemplateResult;
    handler: (...args: any[]) => void;
}
interface LayerButton extends PanelButton {
    isClose?: boolean;
}
interface CloseOptions {
    force?: boolean;
    rerenderApp?: boolean;
}

const state = Symbol('configlayer state');
const stack = Symbol('configlayer stack');

class ConfigLayer {
    [state]: ConfigLayerState;
    [stack]: ConfigLayerState[];
    #layer;
    constructor() {
        this[state] = this.#initState;
        this[stack] = [];
        const DraggableLayer = Draggable(Layer);
        this.#layer = new DraggableLayer({
            closeHandler: this.close.bind(this),
            resizeHandler: this.fixPosition.bind(this),
        });
    }
    get #initState(): ConfigLayerState {
        return {
            visible: false,
            view: null,
            anchorPosition: EMPTY_POSITION,
            position: EMPTY_POSITION,
            keepMinimumTop: false,
            minimumTop: Number.MAX_VALUE,
            buttons: [{ label: 'close', handler: this.close.bind(this) }],
            confirmed: {},
            topic: null,
        };
    }
    get topic() {
        return this[state].topic;
    }
    getNode() {
        return this[state].node;
    }
    update(changes: Partial<ConfigLayerState>) {
        this[state] = { ...this[state], ...changes };
        this.render();
    }
    show(props: ShowProps): void {
        if (this[state].visible) {
            this[stack].push(this[state]);
        }
        const { buttons = [], ...otherProps } = props;
        const anchorPosition = this.anchorPosition(props);
        this[state] = {
            ...this.#initState,
            visible: true,
            anchorPosition,
            buttons: this.layerButtons(buttons),
            position: this.#layer.calculatePosition(anchorPosition),
            ...otherProps,
        };
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        this.#layer.addEscLayerHandler();
        this.#layer.addClickWindowHandler(appWindow.win);
        this.#layer.addResizeHandler();
        appStore.rerender();
    }
    anchorPosition(props: ShowProps) {
        const { anchorId, anchorPosition: anchorPos } = props;
        const anchorNode = anchorId
            ? appWindow.win.querySelector(`#${anchorId}`)
            : undefined;
        return anchorPos
            ? anchorPos
            : anchorNode
              ? this.#layer.anchorPosition(anchorNode)
              : EMPTY_POSITION;
    }
    layerButtons(buttons: LayerButton[]): LayerButton[] {
        return buttons && buttons.some((button) => button.isClose)
            ? buttons
            : [...this.#initState.buttons, ...(buttons || [])];
    }
    fixPosition(): void {
        if (this[state].node === undefined) return;
        if (this.#layer.wasDragged) return;
        const position = this.#layer.calculatePosition(
            this[state].anchorPosition,
            this.getNode(),
        );
        if (this[state].keepMinimumTop && position.y > this[state].minimumTop) {
            position.y = this[state].minimumTop;
        } else {
            this[state].minimumTop = position.y;
            this[state].node.style.top = `${position.y}px`;
            this[state].node.style.left = `${position.x}px`;
        }
    }
    close(options: CloseOptions = { force: false, rerenderApp: true }): void {
        const close = this[state].buttons.find((button) => button?.isClose === true);
        if (close) close.handler();
        const previousState = this[stack].pop();
        if (previousState && options.force === false) {
            this.update(previousState);
        } else {
            this.update(this.#initState);
            this.#layer.removeEscLayerHandler();
            this.#layer.removeClickWindowHandler(appWindow.win);
            this.#layer.removeResizeHandler();
            appWindow.addInputHandler();
            appWindow.hideOverlay();
            if (options.rerenderApp === true) {
                appStore.rerender();
            }
        }
        this.#layer.resetDraggable();
    }
    onTopicClicked = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const topic = target && target.closest('a')?.dataset.topic;
        if (topic) this.toggleTopic(topic);
    };
    toggleTopic(topic: string) {
        this.update({ topic: topic === configLayer[state].topic ? null : topic });
    }
    node() {
        if (this.#layer.wasDragged) {
            this[state].position = this.#layer.getPosition();
        }
        const top = `${this[state].position.y}px`;
        const left = `${this[state].position.x}px`;
        const maxHeight = `${window.innerHeight - 17}px`;
        return this[state].visible
            ? html`
                  <div
                      id="config-layer"
                      class="layer"
                      style=${styleMap({ top, left, maxHeight })}
                      ${ref(this.nodeReady.bind(this))}
                  ></div>
              `
            : '';
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLElement) {
            this[state].node = node;
            this.render();
        }
    }
    makeDraggable() {
        if (this[state].node) {
            this.#layer.makeDraggable(this[state].node);
        }
    }
    render() {
        if (this[state].node) {
            render(this.view(), this[state].node);
            requestAnimationFrame(() => this.fixPosition());
        }
    }
    view() {
        if (this[state].visible === false) {
            return '';
        }
        const { buttons, view } = this[state];
        const buttonResults: TemplateResult[] = [];
        for (const { label, handler, isClose, ...attributes } of buttons) {
            const clickHandler = () => {
                if (isClose) this.close.bind(this)();
                else if (handler) handler();
            };
            buttonResults.push(
                button({ content: label, '@click': clickHandler, ...attributes }),
            );
        }
        return html`
            <div id="config-stage">${view && view()}</div>
            <div class="button-wrapper">${buttonResults}</div>
        `;
    }
    panel(content: TemplateResult, contentButton: PanelButton) {
        const buttonView =
            contentButton !== undefined
                ? html`
                      <div class="button-wrapper">
                          ${button({
                              content: contentButton.label,
                              '@click': contentButton.handler,
                          })}
                      </div>
                  `
                : '';

        return html`
            <div class="panel">${content} ${buttonView}</div>
        `;
    }
    confirmedTopic = (topic: string): boolean =>
        Object.keys(this[state].confirmed).includes(topic);
    confirmYes() {
        const topic = this[state].topic;
        if (topic && this.confirmedTopic(topic)) {
            this[state].confirmed[topic]();
        }
    }
    confirmNo() {
        configLayer.update({ topic: null });
    }
    confirmOption(label: string, item: string, loading: boolean) {
        const buttons =
            loading === false
                ? [
                      button({
                          content: 'yes',
                          class: 'left',
                          '@click': configLayer.confirmYes.bind(this),
                      }),
                      button({
                          content: 'no',
                          class: 'right',
                          '@click': configLayer.confirmNo,
                      }),
                  ]
                : '...processing';
        return html`
            <div class="confirm panel">
                ${label}
                <i>${item}</i>
                ?
                <div class="clearfix">${buttons}</div>
            </div>
        `;
    }
    /*
     * used by databaseTools and tableTools to ensure that the row-icon
     * stays visible while the layer is open
     */
    handleButtonVisibility(anchorId: string): () => void {
        const button: HTMLButtonElement | null = appWindow.win.querySelector(
            `#${anchorId}`,
        );
        if (button && button.closest('table')) {
            button.style.visibility = 'visible';
            return () => {
                button.style.visibility = '';
            };
        }
        return () => {};
    }
}

const configLayer = new ConfigLayer();

export default configLayer;
