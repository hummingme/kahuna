/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import Field from '#components/value-editor/fields/field';

export default class NullField extends Field {
    formView() {
        return html`
            <em>null</em>
        `;
    }
    get value() {
        return null;
    }
    set value(_v: unknown) {
        this.state.value = null;
    }
    toFormValue() {
        return '';
    }
    fromFormValue() {
        return null;
    }
}
