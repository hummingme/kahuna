/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { ref } from 'lit/directives/ref.js';
import { spread } from '@open-wc/lit-helpers';

import textinputWidths from '#lib/textinput-widths';
import { TextinputProps } from '#types';

class Textinput {
    props: TextinputProps;
    inputNode?: HTMLInputElement;
    startX = 0;
    startWidth = 0;
    boundMouseDown: (ev: MouseEvent) => void;
    boundMouseMove: (ev: MouseEvent) => void;
    boundMouseUp: () => void;
    constructor(props: TextinputProps) {
        this.props = props;
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
    }
    get isResizable() {
        const classes = this.props.classes;
        return !!classes && classes.includes('resizable');
    }
    get node() {
        if (!this.inputNode) {
            throw new Error('Textinput is not yet initialized');
        }
        return this.inputNode;
    }
    view() {
        const {
            type,
            id,
            classes,
            style,
            ['.value']: value,
            ['@input']: onInput,
            liveValue,
            refVar,
            tabIndex,
            isEphemeral,
            ...attributes
        } = this.props;
        const val = String(value ?? '');
        const input = html`
            <input
                type=${type ?? 'text'}
                id=${id}
                class=${this.cssClasses}
                style=${this.cssStyles()}
                ${ref(this.nodeReady.bind(this))}
                ${refVar ? ref(refVar) : nothing}
                tabindex=${tabIndex ?? '0'}
                .value=${liveValue ? live(val) : val}
                @input=${onInput ? (ev: InputEvent) => onInput(this, ev) : nothing}
                ${spread(attributes)}
                spellcheck="false"
            />
        `;
        return html`
            <div class="input-wrapper">${input}${this.resizeHandle()}</div>
        `;
    }
    cssStyles() {
        const { id, style } = this.props;
        const width = this.isResizable ? textinputWidths.get(id) : null;
        if (width && style) {
            const cleanedStyle = style
                .replace(/(?<![\w-])width\s*:\s*[^;]+;?\s*/gi, '')
                .trim();
            return `width: ${width}px; ${cleanedStyle}`;
        } else {
            return width ? `width: ${width}px;` : style;
        }
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLInputElement) {
            this.inputNode = node;
        }
    }
    get cssClasses() {
        const classes = this.props.classes;
        return classes && classes.length !== 0 ? classes.join(' ') : nothing;
    }
    resizeHandle() {
        return this.isResizable
            ? html`
                  <div class="resize-handle" @mousedown=${this.boundMouseDown}></div>
              `
            : nothing;
    }
    onMouseDown(ev: MouseEvent) {
        const target = ev.target;
        if (!(target instanceof HTMLDivElement)) return;
        if (!(target.previousElementSibling instanceof HTMLInputElement)) return;
        this.startX = ev.clientX;
        this.startWidth = this.node.offsetWidth;
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        ev.preventDefault();
    }
    onMouseMove(ev: MouseEvent) {
        const input = this.node;
        const newWidth = this.startWidth + (ev.clientX - this.startX);
        const min = parseInt(getComputedStyle(input).minWidth) || 30;
        const max = parseInt(getComputedStyle(input).maxWidth) || Infinity;
        input.style.width = Math.min(Math.max(newWidth, min), max) + 'px';
    }
    onMouseUp() {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        textinputWidths.save(
            {
                width: parseInt(getComputedStyle(this.node).width),
                id: this.node.id,
            },
            Boolean(this.props.isEphemeral),
        );
    }
    setCustomValidity(message = '') {
        this.node.setCustomValidity(message);
    }
}

export default function textinput(props: TextinputProps) {
    return new Textinput(props);
}
