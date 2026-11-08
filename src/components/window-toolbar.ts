/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, type TemplateResult } from 'lit-html';

import appWindow from '#components/app-window';
import Database from '#components/database';
import datatable from '#components/datatable';
import mainMenu from '#components/main-menu';
import Origin from '#components/origin';
import { button, symbolButton } from '#components/parts/button';
import svgIcon from '#components/parts/svgicon';
import { print } from '#lib/escape-string';
import { KDatabase, SymbolButtonProps } from '#types';

type ToolbarArgs = {
    selectedDB?: number | undefined;
    selectedTable?: number | undefined;
    databases: KDatabase[];
};

const view = (args: ToolbarArgs): TemplateResult => {
    const { selectedDB, selectedTable, databases } = args;
    const separator = html`
        <div class="separator" aria-hidden="true">&gt;</div>
    `;
    const items: TemplateResult[] = [
        symbolButton({
            title: 'application menu',
            id: 'main-menu-button-id',
            '@click': mainMenu.show.bind(mainMenu),
            aria: {
                haspopup: true,
                expanded: false,
                label: 'application menu',
            },
            icon: svgIcon('tabler-menu-2', { width: 16 }),
        }),
    ];
    pageIcons(selectedDB, selectedTable).forEach((icon) => {
        items.push(symbolButton(icon));
    });

    const origin = window.location.origin;
    const title = `${selectedDB === undefined ? 're' : ''}load list of databases`;
    items.push(
        button({
            content: `origin: ${origin}`,
            title,
            class: 'breadcrumb',
            '@click': Origin.summon,
            aria: { label: title },
        }),
    );
    if (typeof selectedDB === 'number') {
        const databaseName = print(databases[selectedDB].name);
        const title = `${selectedTable === undefined ? 're' : ''}load list of tables`;
        items.push(
            separator,
            button({
                content: `database: ${databaseName}`,
                title,
                class: 'breadcrumb',
                '@click': Database.summon.bind(null, selectedDB),
                aria: { label: title },
            }),
        );
    }
    if (typeof selectedTable === 'number' && datatable.table) {
        const tableName = print(datatable.table.name);
        const title = 'reload table';
        items.push(
            separator,
            button({
                content: `table: ${tableName}`,
                title,
                class: 'breadcrumb',
                '@click': () => datatable.summon(selectedTable),
                aria: { label: title },
            }),
        );
    }
    return html`
        <nav id="toolbar" aria-label="application toolbar">
            <div>${items} ${appWindow.maximizeButton()}</div>
        </nav>
    `;
};

const pageIcons = (selectedDB?: number, selectedTable?: number): SymbolButtonProps[] => {
    let icons;
    if (selectedDB === undefined) {
        icons = Origin.toolbarIcons();
    } else if (selectedTable === undefined) {
        icons = Database.toolbarIcons();
    } else {
        icons = datatable.toolbarIcons;
    }
    return icons;
};

const WindowToolbar = {
    view,
};

export default WindowToolbar;
