/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import appWindow from '#components/app-window';
import mainMenu from '#components/main-menu';
import Origin from '#components/origin';
import Database from '#components/database';
import datatable from '#components/datatable';
import { symbolButton } from '#lib/button';
import { escapeUnicode } from '#lib/escape-unicode';
import svgIcon from '#lib/svgicon';
import { KDatabase } from '#types';

interface BreadcrumbArgs {
    selectedDB?: number | undefined;
    selectedTable?: number | undefined;
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
        const databaseName = escapeUnicode(databases[selectedDB].name);
        const title = `${selectedTable === undefined ? 're' : ''}load list of tables`;
        items.push(
            separator,
            html`
                <a title=${title} @click=${Database.summon.bind(null, selectedDB)}>
                    database: ${databaseName}
                </a>
            `,
        );
    }
    if (typeof selectedTable === 'number' && datatable.table) {
        const tableName = escapeUnicode(datatable.table.name);
        const title = 'reload table';
        items.push(
            separator,
            html`
                <a title=${title} @click=${() => datatable.summon(selectedTable)}>
                    table: ${tableName}
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
