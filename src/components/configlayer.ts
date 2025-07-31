/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.ts';
import Layer from './layer.ts';
import { button } from '../lib/button.ts';
import { type Position, EMPTY_POSITION } from '../lib/types/common.ts';
import appStore from '../lib/app-store.ts';

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
    anchorId: string;
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
        this.#layer = new Layer({
            closeHandler: this.close.bind(this),
            resizeHandler: this.fixPosition.bind(this),
        });
    }
    get #initState(): ConfigLayerState {
        return {
            node: undefined,
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
        const { anchorId, buttons = [], ...otherProps } = props;
        const layer = this.#layer;
        const anchorNode = appWindow.win.querySelector(`#${anchorId}`);
        const anchorPosition = anchorNode
            ? layer.anchorPosition(anchorNode)
            : EMPTY_POSITION;
        this[state] = {
            ...this.#initState,
            visible: true,
            anchorPosition,
            buttons: this.layerButtons(buttons),
            position: layer.calculatePosition(anchorPosition),
            ...otherProps,
        };
        appWindow.removeInputHandler();
        appWindow.showOverlay();
        layer.addEscLayerHandler();
        layer.addClickWindowHandler(appWindow.win);
        layer.addResizeHandler();
        appStore.rerender();
    }
    layerButtons(buttons: LayerButton[]): LayerButton[] {
        return buttons && buttons.some((button) => button.isClose)
            ? buttons
            : [...this.#initState.buttons, ...(buttons || [])];
    }
    fixPosition(): void {
        if (this[state].node === undefined) return;
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
        if (node) {
            this[state].node = node as HTMLElement;
            this.render();
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
        const buttonResults = [];
        for (const { label, handler, isClose } of buttons) {
            const clickHandler = () => {
                if (isClose) this.close.bind(this)();
                else if (handler) handler();
            };
            buttonResults.push(button({ content: label, '@click': clickHandler }));
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
