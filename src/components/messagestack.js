/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { keyed } from 'lit/directives/keyed.js';
import appWindow from './app-window.js';
import BehaviorConfig from './config/behavior-config.js';
import appStore from '../lib/app-store.js';
import checkbox from '../lib/checkbox.js';
import messenger from '../lib/messenger.js';
import svgIcon from '../lib/svgicon.js';
import { equalTarget } from '../lib/utils.js';

const state = Symbol('message stack state');

const MessageStack = class {
    #node;
    constructor() {
        this[state] = {
            messages: [],
            order: 1,
            autoHide: 0,
            target: {},
        };
        window.addEventListener('resize', this.adjustPosition.bind(this));
        messenger.register('refreshMessagestack', this.updateSettings.bind(this));
    }
    async getSettings() {
        if (equalTarget(appStore.target(), this[state].target) === false) {
            await this.updateSettings();
        }
        return { autoHide: this[state].autoHide };
    }
    async updateSettings() {
        const target = appStore.target();
        const {
            values: { hideMessagesSeconds: autoHide },
        } = await BehaviorConfig.getSettings(target);
        this[state] = { ...this[state], autoHide, target };
    }
    view() {
        return html`
            <div id="message-stack-host" ${ref(this.nodeReady.bind(this))}></div>
        `;
    }
    nodeReady(node) {
        this.#node = node;
        if (node && !this.#node && appWindow.win) {
            this.render();
        }
    }
    async render() {
        render(await this.stackView(), this.#node);
        this.adjustPosition();
    }
    async stackView() {
        if (this[state].messages.length === 0) {
            return '';
        }
        await this.getSettings();
        const messageItems = this[state].messages.map((message) =>
            this.messageItem(message),
        );
        return html`
            <div id="message-stack">${messageItems}</div>
        `;
    }
    messageItem(message) {
        const icon =
            message.type === 'error'
                ? svgIcon('tabler-mood-wrrr', { width: 24, height: 24, class: 'error' })
                : svgIcon('tabler-info-circle', { width: 24, height: 24, class: 'info' });
        const close = svgIcon('tabler-circle-x', {
            width: 24,
            height: 24,
            title: 'click message to remove',
        });
        const repeat = message.count > 1 ? `(${message.count}x)` : '';
        const itemCheckbox = message.checkbox
            ? html`
                  <div class="msg-checkbox">${checkbox(message.checkbox)}</div>
              `
            : '';
        return keyed(
            message.order,
            html`<div class="message-item ${message.type}"
                      @click=${this.messageClicked.bind(this)}
                      data-order=${message.order}
                      style=order:${message.order}
                      ${ref(this.itemReady.bind(this, message.order))}
                    >
                      <div class="msg-icon">${icon}</div>
                      <div class=msg-content>
                        <div>
                          ${message.content}
                          ${itemCheckbox}
                        </div>
                        <div class=msg-repeat>${repeat}</div>
                      </div>
                      <div class=msg-close title="click to remove message">${close}</a>
                   </div>`,
        );
    }
    itemReady(order, node) {
        if (node && this[state].autoHide > 0) {
            const message = this[state].messages.find((msg) => msg.order === order);
            if (message && !message.timer) {
                message.timer = setTimeout(
                    (node, message) => {
                        Object.assign(node.style, {
                            opacity: 0,
                            transition: `opacity 500ms linear`,
                        });
                        message.timer = setTimeout(
                            (order) => {
                                const index = this[state].messages.findIndex(
                                    (msg) => msg.order === order,
                                );
                                this[state].messages.splice(index, 1);
                                this.render();
                            },
                            500,
                            message.order,
                        );
                    },
                    this[state].autoHide * 1000,
                    node,
                    message,
                );
            }
        }
    }
    displayError(args) {
        this.display('error', args);
    }
    displayInfo(args) {
        this.display('info', args);
    }
    display(type, args) {
        if (typeof args === 'string') {
            args = { content: args };
        }
        let message = { type, ...args };
        const index = this[state].messages.findIndex(
            (msg) => msg.content === message.content,
        );
        if (index !== -1) {
            message = this[state].messages[index];
            const itemSelector = `div[data-order="${message.order}"]`;
            if (message.timer) {
                message.timer = clearTimeout(message.timer);
                this.#node.querySelector(itemSelector).style.opacity = 1;
            }
            message.count++;
            const repeat = this.#node.querySelector(`${itemSelector} div.msg-repeat`);
            repeat.classList.remove('signal-error');
            setTimeout(() => repeat.classList.add('signal-error'), 1);
        } else {
            message.count = 1;
            message.order = this[state].order++;
            this[state].messages.unshift(message);
        }
        this.render();
    }
    messageClicked(event) {
        if (['INPUT', 'LABEL'].includes(event.target.tagName)) {
            event.stopPropagation();
        } else {
            const order = parseInt(
                event.target.closest('div.message-item').dataset.order,
            );
            const index = this[state].messages.findIndex((msg) => msg.order === order);
            const removed = this[state].messages.splice(index, 1);
            if (removed.length === 1 && removed[0].timer) {
                clearTimeout(removed[0].timer);
            }
            this.render();
        }
    }
    adjustPosition() {
        if (this[state].messages.length > 0) {
            const win = appWindow.dims;
            let bottom = '0px';
            if (win.bottom > window.innerHeight) {
                bottom = `${win.bottom - window.innerHeight}px`;
            }
            this.#node.style.bottom = bottom;
        }
    }
};
const messageStack = new MessageStack();

export default messageStack;
