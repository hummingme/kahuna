/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import type { FieldInputMethod } from '#lib/datatype-attributes';
import svgIcon from '#lib/svgicon';

export default function hintIcon(field: object, method: FieldInputMethod) {
    const text = hint(field, method);
    return text
        ? html`
              <span title=${text} class="value-icon">
                  ${svgIcon('tabler-info-circle')}
              </span>
          `
        : '';
}

function hint(field: object, inputMethod: FieldInputMethod): string | void {
    const hints: Partial<Record<FieldInputMethod, string | (() => string)>> | null =
        'hints' in field && typeof field.hints === 'object' && field.hints !== null
            ? field.hints
            : null;
    if (hints && inputMethod in hints) {
        const hint = hints[inputMethod];
        if (hint instanceof Function) {
            return hint();
        }
        if (typeof hint === 'string') {
            return hint;
        }
    }
}
