/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import appWindow from './app-window.js';
import Layer from './layer.js';
import { button } from '../lib/button.js';
import { shallowEqual } from '../lib/types.js';

const state = Symbol('configlayer state');
const stack = Symbol('configlayer stack');

const ConfigLayer = class extends EventTarget {
    constructor() {
        super();
        this[state] = this.#initState;
        this[stack] = [];
    }
    get #initState() {
        return {
            node: null,
            visible: false,
            view: null,
            anchorPosition: { top: 0, left: 0 },
            position: { top: 0, left: 0 },
            keepMinimumTop: false,
            minimumTop: Number.MAX_VALUE,
            buttons: [{ label: 'close', handler: this.close.bind(this) }],
            confirmed: [],
            topic: null,
        };
    }
    get node() {
        return this[state].node;
    }
    fromState(prop) {
        return this[state][prop];
    }
    update(changes) {
        this[state] = { ...this[state], ...changes };
        this.#changed();
    }
    #changed() {
        const ev = new CustomEvent('change', { detail: { state: { ...this[state] } } });
        this.dispatchEvent(ev);
    }
    show(props) {
        if (this[state].visible) {
            this[stack].push(this[state]);
        }
        const { anchorId, buttons, ...moreProps } = props;
        this.init(appWindow.root);
        const anchorPosition = this.anchorPosition(
            this.winNode.querySelector(`#${props.anchorId}`),
        );
        this[state] = {
            ...this.#initState,
            visible: true,
            anchorPosition,
            buttons: this.layerButtons(buttons),
            position: this.calculatePosition(anchorPosition),
            ...moreProps,
        };
        this.#changed();
        this.fixPosition();
        this.addEscLayerHandler();
        this.addClickWindowHandler();
        this.addResizeHandler();
    }
    layerButtons(buttons) {
        return buttons && buttons.some((button) => button.isClose)
            ? buttons
            : [...this.#initState.buttons, ...(buttons || [])];
    }
    fixPosition() {
        const position = this.calculatePosition(this[state].anchorPosition);
        if (!shallowEqual(position, this[state].position)) {
            if (this[state].keepMinimumTop && position.top > this[state].minimumTop) {
                position.top = this[state].minimumTop;
            } else {
                this[state].minimumTop = position.top;
                this[state].position = position;
                this.#changed();
            }
        }
    }
    close() {
        const close = this[state].buttons.find((button) => button?.isClose === true);
        close?.handler && close.handler();
        const previousState = this[stack].pop();
        if (previousState) {
            this.update(previousState);
        } else {
            this.removeEscLayerHandler();
            this.removeClickWindowHandler();
            this.removeResizeHandler();
            this.update(this.#initState);
        }
    }
    onTopicClicked = (ev) => {
        const topic = ev.target.closest('a').dataset.topic;
        this.toggleTopic(topic);
    };

    toggleTopic(topic) {
        if (topic === configLayer[state].topic) {
            topic = null;
        }
        this.update({ topic });
        this.fixPosition();
    }

    view() {
        if (this[state].visible === false) {
            return '';
        }
        const buttons = [];
        for (const { label, handler, isClose } of this[state].buttons) {
            const clickHandler = () => {
                if (isClose) this.close.bind(this)();
                else if (handler) handler();
            };
            buttons.push(button({ content: label, '@click': clickHandler }));
        }
        const top = `${this[state].position.top}px`;
        const left = `${this[state].position.left}px`;
        const maxHeight = `${window.innerHeight - 17}px`;
        return html`
            <div
                id="config-layer"
                class="layer"
                style=${styleMap({ top, left, maxHeight })}
                ${ref(this.nodeReady.bind(this))}
            >
                <div id="config-stage">${this[state].view()}</div>
                <div class="button-wrapper">${buttons}</div>
            </div>
        `;
    }
    nodeReady(node) {
        if (node) {
            this[state].node = node;
        }
    }
    panel(content, contentButton) {
        const buttonView =
            contentButton !== undefined
                ? html`
                      <div class="button-wrapper">
                          ${button({
                              content: contentButton.text,
                              '@click': contentButton.click,
                          })}
                      </div>
                  `
                : '';

        return html`
            <div class="panel">${content} ${buttonView}</div>
        `;
    }

    confirmedTopic = (topic) => Object.keys(this[state].confirmed).includes(topic);

    confirmYes() {
        const topic = this[state].topic;
        if (this.confirmedTopic(topic)) {
            this[state].confirmed[topic]();
        }
    }

    confirmNo() {
        configLayer.update({ topic: null });
    }

    confirmOption(label, item, loading) {
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
    handleButtonVisibility(anchorId) {
        const button = appWindow.win.querySelector(`#${anchorId}`);
        if (button.closest('table')) {
            button.style.visibility = 'visible';
            return () => {
                button.style.visibility = '';
            };
        }
    }
};

Object.assign(ConfigLayer.prototype, Layer);

const configLayer = new ConfigLayer();

export default configLayer;
