/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { nothing } from 'lit';
import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import hintIcon from './hint-icon';
import optionsIcon from './options-icon';
import saveTextIcon from './save-text-icon';
import Field from './fields/field';
import { isTypedArrayType } from '#lib/datatypes';

export type TextareaInputSettings = {
    width: string;
    height: string;
};

type TextareaInputArgs = TextareaInputSettings & {
    validCheck: (v: string) => boolean;
    invalidHint: string;
};

const state = Symbol('textarea-input state');

export default class TextareaInput {
    field;
    wrapperNode: Ref<HTMLElement> = createRef();
    [state]: TextareaInputArgs;
    constructor(field: Field, args: TextareaInputArgs) {
        this.field = field;
        this[state] = args;
    }
    get state() {
        return this[state];
    }
    view(value: string) {
        return html`
            <div class="value">
                <div
                    class="textarea-wrapper"
                    ${ref(this.wrapperNode)}
                    ${ref(this.renderTextarea.bind(this, value))}
                ></div>
            </div>
        `;
    }
    renderTextarea(value: string) {
        const node = this.wrapperNode.value;
        if (node === undefined) return;
        render(this.textareaView(value), node);
    }
    textareaView(value: string) {
        const { inputMethod } = this.field.state;
        const { width, height } = this[state];
        const enabled = inputMethod === 'form' && this.field.state.formOptions.expanded;
        const hicon = enabled ? hintIcon(this.field, 'form') : nothing;
        const oicon = !isTypedArrayType(this.field.state.type)
            ? optionsIcon(this.field, 'form')
            : nothing;
        const sicon = saveTextIcon(this.field);
        return html`
            <textarea
                id="field-value"
                .value=${live(value)}
                @keydown=${this.keydownHandler.bind(this)}
                @keyup=${this.keyupHandler.bind(this)}
                @change=${this.field.handleFormChange.bind(this.field)}
                @pointerup=${this.pointerupHandler.bind(this)}
                class="string-textarea value"
                style="width:${width}; height:${height}"
                spellcheck="false"
                ?disabled=${!enabled}
                ${ref(this.field.node)}
                ${ref(this.nodeReady.bind(this))}
            ></textarea>
            <div class="value-icons">${oicon}${hicon}${sicon}</div>
        `;
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLTextAreaElement) {
            this.adjustField(node);
            this.validate(this.node.value);
        }
    }
    get node() {
        const textarea = this.field.node.value;
        if (textarea instanceof HTMLTextAreaElement) {
            return textarea;
        } else throw Error('TextareaInput not initialized!');
    }
    adjustField(node?: HTMLElement) {
        node ||= this.field.node.value;
        if (!node) return;
        requestAnimationFrame(() => {
            if (this.isResized()) return;
            const scrollHeight = node.scrollHeight;
            if (scrollHeight > 20) {
                const height = scrollHeight > 75 ? 75 : scrollHeight;
                node.style.height = `${height}px`;
            }
        });
    }
    isResized() {
        const { width, height } = this[state];
        const { width: defaultWidth, height: defaultHeight } =
            this.field.defaultSettings().textarea;
        return width !== defaultWidth || height !== defaultHeight;
    }
    keydownHandler(event: KeyboardEvent) {
        if (event.key == 'Enter' && this.node.clientHeight <= 20) {
            // save & close
            event.preventDefault();
        } else {
            // enter character
            event.stopPropagation();
        }
    }
    keyupHandler() {
        this.validate(this.node.value);
    }
    pointerupHandler(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        const { width, height } = target.style;
        const { width: oldWidth, height: oldHeight } = this[state];
        if (width !== oldWidth || height !== oldHeight) {
            Object.assign(this[state], { width, height });
            this.field.saveSettings();
        }
    }
    validate(value: string) {
        if (this.field.state.inputMethod !== 'form') return true;
        let result = false;
        try {
            result = this[state].validCheck(value);
        } catch {} // eslint-disable-line no-empty
        const validity = result ? '' : this[state].invalidHint;
        this.node.setCustomValidity(validity);
        this.field.valid = result;
    }
    formHint() {
        return 'hints' in this.field &&
            this.field.hints &&
            typeof this.field.hints === 'object' &&
            'form' in this.field.hints &&
            typeof this.field.hints.form === 'string'
            ? this.field.hints.form
            : null;
    }
}
