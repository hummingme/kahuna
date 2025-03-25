/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import appWindow from './app-window.js';
import mainMenu from './main-menu.js';
import Origin from './origin.js';
import Database from './database.js';
import datatable from './datatable.js';
import { symbolButton } from '../lib/button.js';
import svgIcon from '../lib/svgicon.js';

const view = (state) => {
    const separator = html`
        <div class="separator">&gt;</div>
    `;
    const items = [
        symbolButton({
            title: 'application menu',
            icon: svgIcon('tabler-menu-2', { width: 16 }),
            id: 'main-menu-button-id',
            '@click': mainMenu.show.bind(mainMenu),
        }),
    ];
    pageIcons(state.selectedDB, state.selectedTable).forEach((icon) => {
        items.push(symbolButton(icon));
    });

    const origin = window.location.origin;
    const title = `${state.selectedDB === null ? 're' : ''}load list of databases`;
    items.push(html`
        <a title=${title} @click=${Origin.summon}>origin: ${origin}</a>
    `);
    if (state.selectedDB !== null) {
        const database = state.databases[state.selectedDB].name;
        const title = `${state.selectedTable === null ? 're' : ''}load list of tables`;
        items.push(
            separator,
            html`
                <a title=${title} @click=${Database.summon.bind(null, state.selectedDB)}>
                    database: ${database}
                </a>
            `,
        );
    }
    if (state.selectedTable !== null && datatable.table) {
        const table = datatable.table.name;
        const title = 'reload table';
        items.push(
            separator,
            html`
                <a title=${title} @click=${() => datatable.summon(state.selectedTable)}>
                    table: ${table}
                </a>
            `,
        );
    }

    return html`
        <nav id="menu">
            <div>
                ${items.map(
                    (item) => html`
                        ${item}
                    `,
                )}
                ${appWindow.maximizeIcon()}
            </div>
        </nav>
    `;
};

const pageIcons = (db, table) => {
    let icons;
    if (db === null) {
        icons = Origin.breadcrumbIcons;
    } else if (table === null) {
        icons = Database.breadcrumbIcons();
    } else {
        icons = datatable.breadcrumbIcons;
    }
    return icons;
};

const Breadcrumb = {
    view,
};

export default Breadcrumb;
