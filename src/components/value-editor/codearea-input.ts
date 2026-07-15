/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { nothing } from 'lit';
import { html, render } from 'lit-html';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import optionsIcon from '#components/value-editor/options-icon';
import Field from '#components/value-editor/fields/field';
import { JsCodearea, type RequiredVariables } from '#components/js-codearea';
import type { AppTarget, UnknownRecord } from '#types';
import { isExpandable } from '#lib/datatype-attributes';

type InitArgs = {
    target: AppTarget;
    detail: string;
    selectorFields: string[];
    requireVariables: () => RequiredVariables;
};

export default class CodeareaInput {
    codearea: InstanceType<typeof JsCodearea>;
    node: Ref<HTMLElement> = createRef();
    field: Field;
    constructor(field: Field) {
        this.field = field;
        this.codearea = new JsCodearea();
    }
    async init(args: InitArgs) {
        await this.codearea.init({
            ...args,
            user: 'valueEditorField',
            enabled: true,
            executed: (result: unknown) => {
                this.field.valid = true;
                this.field.update(result, { updateCodearea: false });
            },
        });
        this.updateCode({ savedIndex: -1 });
    }
    get expanded() {
        return this.field.state.codeOptions.expanded;
    }
    updateCode(options: UnknownRecord = {}) {
        const code = this.field.toSourceValue(this.expanded);
        this.codearea.update(Object.assign({ code }, options));
    }
    isEmpty() {
        return this.codearea.state.code === '';
    }
    empty() {
        this.codearea.state.code = '';
    }
    view() {
        return html`
            <div
                class="codearea-wrapper"
                ${ref(this.node)}
                ${ref(this.renderCodearea.bind(this))}
            ></div>
        `;
    }
    renderCodearea() {
        const node = this.node.value;
        if (node === undefined) return;
        render(this.codeareaView(), node);
    }
    codeareaView() {
        const type = this.field.state.type;
        const oicon = isExpandable(type) ? optionsIcon(this.field, 'code') : nothing;
        return html`
            ${this.codearea.node()}
            <div class="value-icons">${oicon}</div>
        `;
    }
    shutdown() {
        this.codearea.shutdown();
    }
}
