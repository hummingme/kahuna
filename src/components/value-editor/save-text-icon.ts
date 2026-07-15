/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { nothing } from 'lit';
import type Field from '#components/value-editor/fields/field';
import { encodeString } from '#lib/encode-string';

import svgIcon from '#lib/svgicon';
import { isSBCS } from '#lib/charsets';
import { downloadFile } from '#lib/utils';

export default function saveTextIcon(field: Field) {
    const { type, downloadCharset } = field.state;
    const title = `save as ${downloadCharset} encoded file`;
    const encodable =
        ['utf-8', 'utf-16le', 'utf-16be'].includes(downloadCharset) ||
        isSBCS(downloadCharset);
    return type === 'string' && encodable
        ? html`
              <span
                  title=${title}
                  class="value-icon"
                  @click=${saveValue.bind(null, field)}
              >
                  ${svgIcon('tabler-device-floppy')}
              </span>
          `
        : nothing;
}

function saveValue(field: Field) {
    const { downloadCharset, fieldName } = field.state;
    const bytes = encodeString(String(field.value), downloadCharset);
    downloadFile(bytes, `${fieldName}.txt`, `text/plain; charset=${downloadCharset}`);
}
