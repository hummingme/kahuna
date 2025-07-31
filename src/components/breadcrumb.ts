/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';
import appWindow from './app-window.ts';
import mainMenu from './main-menu.ts';
import Origin from './origin.ts';
import Database from './database.ts';
import datatable from './datatable.ts';
import { symbolButton } from '../lib/button.ts';
import svgIcon from '../lib/svgicon.ts';
import { KDatabase } from '../lib/types/common.ts';

interface BreadcrumbArgs {
    selectedDB?: number;
    selectedTable?: number;
    databases: KDatabase[];
}

const view = (args: BreadcrumbArgs): TemplateResult => {
    const { selectedDB, selectedTable, databases } = args;
    const separator = html`
        <div class="separator">&gt;</div>
    `;
    const items: TemplateResult[] = [
        symbolButton({
            title: 'application menu',
            icon: svgIcon('tabler-menu-2', { width: 16 }),
            id: 'main-menu-button-id',
            '@click': mainMenu.show.bind(mainMenu),
        }),
    ];
    pageIcons(selectedDB, selectedTable).forEach((icon) => {
        items.push(symbolButton(icon));
    });

    const origin = window.location.origin;
    const title = `${selectedDB === undefined ? 're' : ''}load list of databases`;
    items.push(html`
        <a title=${title} @click=${Origin.summon}>origin: ${origin}</a>
    `);
    if (typeof selectedDB === 'number') {
        const database = databases[selectedDB].name;
        const title = `${selectedTable === undefined ? 're' : ''}load list of tables`;
        items.push(
            separator,
            html`
                <a title=${title} @click=${Database.summon.bind(null, selectedDB)}>
                    database: ${database}
                </a>
            `,
        );
    }
    if (typeof selectedTable === 'number' && datatable.table) {
        const table = datatable.table.name;
        const title = 'reload table';
        items.push(
            separator,
            html`
                <a title=${title} @click=${() => datatable.summon(selectedTable)}>
                    table: ${table}
                </a>
            `,
        );
    }
    return html`
        <nav id="menu">
            <div>${items} ${appWindow.maximizeButton()}</div>
        </nav>
    `;
};

const pageIcons = (selectedDB?: number, selectedTable?: number) => {
    let icons;
    if (selectedDB === undefined) {
        icons = Origin.breadcrumbIcons;
    } else if (selectedTable === undefined) {
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
