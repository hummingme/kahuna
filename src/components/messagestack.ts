/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import { keyed } from 'lit/directives/keyed.js';
import appWindow from './app-window.ts';
import BehaviorConfig from './config/behavior-config.ts';
import appStore from '../lib/app-store.ts';
import type { AppTarget } from '../lib/app-target.ts';
import { emptyTarget, equalTarget } from '../lib/app-target.ts';
import checkbox, { type CheckboxProps } from '../lib/checkbox.ts';
import messenger from '../lib/messenger.ts';
import svgIcon from '../lib/svgicon.ts';

interface MessageStackState {
    messages: StackMessage[];
    order: number;
    autoHide: number;
    target: AppTarget;
}
interface StackMessage {
    content: string;
    type: StackMessageType;
    count: number;
    order: number;
    timer?: number;
    checkbox?: CheckboxProps;
}
type StackMessageType = 'success' | 'info' | 'warn' | 'error';

const state = Symbol('messagestack state');

const MessageStack = class {
    [state]: MessageStackState;
    #node: HTMLElement | undefined;
    constructor() {
        this[state] = {
            messages: [],
            order: 1,
            autoHide: 0,
            target: emptyTarget,
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
    emptyStackMessage(): StackMessage {
        return {
            content: '',
            type: 'info',
            count: 0,
            order: 0,
        };
    }
    view() {
        return html`
            <div id="message-stack-host" ${ref(this.nodeReady.bind(this))}></div>
        `;
    }
    nodeReady(node?: Element) {
        if (node !== undefined) {
            this.#node = node as HTMLElement;
        }
    }
    async render() {
        if (this.#node) {
            render(await this.stackView(), this.#node);
            this.adjustPosition();
        }
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
    messageItem(message: StackMessage) {
        const icon = this.messageIcon(message);
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
    messageIcon({ type }: { type: StackMessageType }) {
        const iconNames = {
            success: 'tabler-thumb-up',
            info: 'tabler-info-circle',
            warn: 'tabler-alert-triangle',
            error: 'tabler-mood-wrrr',
        };
        return svgIcon(iconNames[type], { width: 24, height: 24, class: type });
    }
    itemReady(order: number, node?: Element) {
        if (node && this[state].autoHide > 0) {
            const message = this[state].messages.find((msg) => msg.order === order);
            if (message && !message.timer) {
                message.timer = window.setTimeout(
                    (node: HTMLElement, message: StackMessage) => {
                        Object.assign(node.style, {
                            opacity: 0,
                            transition: `opacity 500ms linear`,
                        });
                        message.timer = window.setTimeout(
                            (order: number) => {
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
    displayError(error: unknown) {
        const message =
            typeof error === 'string'
                ? error
                : error instanceof Error
                  ? `${error.name}: ${error.message}`
                  : `Unknown Error: ${JSON.stringify(error)}`;
        this.displayType('error', message);
    }
    displayWarning(message: string) {
        this.displayType('warn', message);
    }
    displayInfo(message: string, args?: Partial<StackMessage>) {
        this.displayType('info', message, args);
    }
    displaySuccess(message: string) {
        this.displayType('success', message);
    }
    displayType(
        type: StackMessageType,
        message: string,
        args: Partial<StackMessage> = {},
    ) {
        this.display(Object.assign({ content: message, type }, args));
    }
    display(message: Partial<StackMessage>) {
        const index = this[state].messages.findIndex(
            (msg) => msg.content === message.content,
        );
        if (index !== -1) {
            message = this[state].messages[index];
            const itemSelector = `div[data-order="${message.order}"]`;
            if (message.timer) {
                window.clearTimeout(message.timer);
                message.timer = undefined;
                const item = this.#node?.querySelector(itemSelector) as HTMLElement;
                if (item) item.style.opacity = '1';
            }
            if (message.count) {
                message.count++;
            } else {
                message.count = 1;
            }
            const repeat = this.#node?.querySelector(
                `${itemSelector} div.msg-repeat`,
            ) as HTMLElement;
            if (repeat) {
                repeat.classList.remove('signal-error');
                setTimeout(() => repeat.classList.add('signal-error'), 0);
            }
        } else {
            message.count = 1;
            message.order = this[state].order++;
            this[state].messages.unshift({ ...this.emptyStackMessage(), ...message });
        }
        this.render();
    }
    messageClicked(event: Event) {
        const target = event.target as HTMLElement;
        if (['INPUT', 'LABEL'].includes(target.tagName)) {
            event.stopPropagation();
        } else {
            const item = target.closest('div.message-item') as HTMLElement;
            const order = parseInt(item?.dataset?.order || '');
            if (Number.isInteger(order)) {
                const index = this[state].messages.findIndex(
                    (msg) => msg.order === order,
                );
                if (index !== -1) {
                    const removed = this[state].messages.splice(index, 1);
                    if (removed.length === 1 && removed[0].timer) {
                        clearTimeout(removed[0].timer);
                    }
                }
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
            if (this.#node) this.#node.style.bottom = bottom;
        }
    }
};
const messageStack = new MessageStack();

export default messageStack;
