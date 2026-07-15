/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { createRef, type Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';
import { isArgsNumbersList } from '#components/value-editor/checkings';
import { validateDOMPoint } from '#components/value-editor/validations';
import { requiredArgumentsList } from '#lib/value-formatter';

export default class DomquadField extends Field {
    nodeP1: Ref<HTMLInputElement> = createRef();
    nodeP2: Ref<HTMLInputElement> = createRef();
    nodeP3: Ref<HTMLInputElement> = createRef();
    nodeP4: Ref<HTMLInputElement> = createRef();
    view() {
        return html`
            <div class="value-controls">
                <div class="value">
                    ${textInput(
                        this,
                        {
                            id: 'p1-coordinates',
                            '.value': this.pointToFieldValue(this.value.p1),
                            label: 'p1',
                            refVar: this.nodeP1,
                        },
                        true,
                    )}
                    ${textInput(this, {
                        id: 'p2-coordinates',
                        '.value': this.pointToFieldValue(this.value.p2),
                        label: 'p2',
                        refVar: this.nodeP2,
                    })}
                    ${textInput(this, {
                        id: 'p3-coordinates',
                        '.value': this.pointToFieldValue(this.value.p3),
                        label: 'p3',
                        refVar: this.nodeP3,
                    })}
                    ${textInput(this, {
                        id: 'p4-coordinates',
                        '.value': this.pointToFieldValue(this.value.p4),
                        label: 'p4',
                        refVar: this.nodeP4,
                    })}
                </div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    get value(): DOMQuad {
        return this.state.value as DOMQuad;
    }
    set value(value: unknown) {
        let result = new DOMQuad();
        if (value instanceof DOMQuad) {
            result = DOMQuad.fromQuad(value);
        } else if (value instanceof DOMRectReadOnly) {
            result = DOMQuad.fromRect(value);
        }
        this.state.value = result;
    }
    toFormValue(): string {
        return '';
    }
    pointToFieldValue(point: DOMPoint) {
        return requiredArgumentsList([point.x, point.y, point.z, point.w], [0, 0, 0, 1]);
    }
    fromFormValue(): DOMQuad | undefined {
        const p1 = this.pointFromField(this.nodeP1.value?.value);
        const p2 = this.pointFromField(this.nodeP2.value?.value);
        const p3 = this.pointFromField(this.nodeP3.value?.value);
        const p4 = this.pointFromField(this.nodeP4.value?.value);
        return new DOMQuad(p1, p2, p3, p4);
    }
    pointFromField(value?: string) {
        let args: number[] = [];
        if (value && isArgsNumbersList(value, 4)) {
            args = value.split(',').map((arg) => Number(arg));
        }
        return new DOMPointReadOnly(...args);
    }
    validate() {
        const validities: boolean[] = [];
        for (const node of [this.nodeP1, this.nodeP2, this.nodeP3, this.nodeP4]) {
            validities.push(validateDOMPoint(node.value));
        }
        this.valid = validities.every((valid) => valid === true);
    }
    hints = {
        form: `The valid form inputs for the DomQuad
arguments p1 to p4 are DomPoint arguments
in the form of a comma separated list of
0 to 4 numbers: x, y, z, w.`,
    };
}
