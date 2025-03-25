/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { selectbox } from '../../lib/selectbox.js';
import { selfMap } from '../../lib/utils.js';

/*
 * mixin with shared methods for ImportConfig and ExportConfig
 */
const ImportExport = {
    formatSelectView(name, label) {
        const formatLabel = this.optionLabel(name, label);
        const formatSelect = selectbox({
            name,
            options: selfMap(this.dataFormats),
            selected: this.state[name],
            '@change': this.inputOptionChanged.bind(this, name),
        });
        return html`
            <p>${formatSelect}${formatLabel}</p>
        `;
    },
    dataFormats: ['json', 'csv', 'dexie'],
    emptyAs: ['empty string', 'null', 'undefined', 'exclude'],
};

export default ImportExport;
