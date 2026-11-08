/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { nothing } from 'lit';
import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

import textinput from '#components/parts/textinput';
import hintIcon from './hint-icon';
import optionsIcon from './options-icon';
import saveTextIcon from './save-text-icon';
import Field from './fields/field';
import { isTypedArrayType } from '#lib/datatypes';

export type FlexInputElement = HTMLInputElement | HTMLTextAreaElement;

export function isFlexInputNode(node?: Element): node is FlexInputElement {
    return isInputNode(node) && node.closest('div.flexinput-wrapper') !== null;
}

function isInputNode(node?: Element): node is HTMLInputElement | HTMLTextAreaElement {
    return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
}

export type FlexInputSettings = {
    textarea: { width: string; height: string };
};

type FlexInputArgs = FlexInputSettings & {
    validCheck: (v: string) => boolean;
    invalidHint: string;
};

type FlexInputState = FlexInputArgs & {
    caretPosition: number;
    lastValue: string;
};

type InputProps = {
    id: string;
    '@keydown': (ev: KeyboardEvent) => void;
    '@input': () => void;
    '@change': () => void;
    '?disabled': boolean;
};

const state = Symbol('flex-input state');

export default class FlexInput {
    field;
    wrapperNode: Ref<HTMLElement> = createRef();
    [state]: FlexInputState;
    constructor(field: Field, args: FlexInputArgs) {
        this.field = field;
        this[state] = { ...args, caretPosition: 0, lastValue: '' };
    }
    get state() {
        return this[state];
    }
    view(value: string) {
        return html`
            <div class="value">
                <div
                    class="flexinput-wrapper"
                    ${ref(this.wrapperNode)}
                    ${ref(this.render.bind(this, value))}
                ></div>
            </div>
        `;
    }
    render(value: string) {
        const node = this.wrapperNode.value;
        if (node === undefined) return;
        render(this.inputView(value), node);
    }
    inputView(value: string) {
        this[state].lastValue = value;
        const { inputMethod, type } = this.field.state;
        const enabled = inputMethod === 'form' && !this.field.formOptions().compacted;
        const hicon = enabled ? hintIcon(this.field, 'form') : nothing;
        const oicon = !isTypedArrayType(type) ? optionsIcon(this.field, 'form') : nothing;
        const sicon = saveTextIcon(this.field);
        const props = {
            id: this.field.valueInputId(),
            '@keydown': this.keydownHandler.bind(this),
            '@input': this.inputHandler.bind(this),
            '@change': this.field.handleFormChange.bind(this.field),
            '?disabled': !enabled,
        };
        const input = /[\n\r]/.test(value)
            ? this.textarea(value, props)
            : this.textinput(value, props);

        return html`
            ${input}
            <div class="value-icons">${oicon}${hicon}${sicon}</div>
        `;
    }
    textarea(value: string, props: InputProps) {
        const { width, height } = this[state].textarea;
        return html`
            <textarea
                ${spread(props)}
                .value=${live(value)}
                @pointerup=${this.pointerupHandler.bind(this)}
                class="string-textarea value"
                style="width:${width}; height:${height}"
                spellcheck="false"
                ${ref(this.nodeReady.bind(this))}
            ></textarea>
        `;
    }
    textinput(value: string, props: InputProps) {
        const title = !props['?disabled'] ? 'Ctrl-Return to insert a line feed' : '';
        return textinput({
            ...props,
            '.value': value,
            liveValue: true,
            classes: ['resizable'],
            style: 'width: 25ch;',
            refVar: this.nodeReady.bind(this),
            title,
        }).view();
    }
    nodeReady(node?: Element) {
        if (isInputNode(node)) {
            this.field.nodeInput = node;
            if (this.field.inputMethod !== 'form') return;
            requestAnimationFrame(() => {
                const pos = this.state.caretPosition;
                if (pos > 0) {
                    node.setSelectionRange(pos, pos);
                }
                this.validate(this.node.value);
                this.field.handleFormChange();
                node.focus();
            });
        }
    }
    get node() {
        const node = this.field.nodeInput;
        if (isInputNode(node)) {
            return node;
        } else throw Error('FlexInput not initialized!');
    }
    get isTextarea() {
        return this.field.nodeInput instanceof HTMLTextAreaElement;
    }
    keydownHandler(event: KeyboardEvent) {
        if (event.key === 'Enter' && event.ctrlKey === true && !this.isTextarea) {
            // insert \n and rerender as textarea
            event.preventDefault();
            event.stopPropagation();
            const { value, selectionStart } = this.node;
            const pos = selectionStart ?? value.length;
            this.state.caretPosition = pos + 1;
            const newValue = value.slice(0, pos) + '\n' + value.slice(pos);
            this.render(newValue);
        }
        if (event.key == 'Enter' && this.node.clientHeight <= 20) {
            // save & close
            event.preventDefault();
        } else {
            // insert character
            event.stopPropagation();
        }
    }
    inputHandler() {
        const value = this.node.value;
        if (value === this[state].lastValue) {
            return;
        }
        this[state].lastValue = value;
        this.validate(value);
    }
    pointerupHandler(event: Event) {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) return;
        const { width, height } = target.style;
        const { width: oldWidth, height: oldHeight } = this[state].textarea;
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
