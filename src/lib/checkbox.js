/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';

const checkbox = (
    props,
) /* { id, name, label, class, checked, changeFunc, refVar } */ => {
    return html`
        <label for=${props.id ?? nothing}>
            <input
                type="checkbox"
                name=${props.name ?? nothing}
                class=${props.class ?? nothing}
                ${props.refVar ? ref(props.refVar) : ''}
                id=${props.id ?? nothing}
                .checked=${props.checked ?? false}
                @change=${props.changeFunc ?? nothing}
                ?disabled=${props.disabled}
            />
            ${props.label}
        </label>
    `;
};

export default checkbox;
