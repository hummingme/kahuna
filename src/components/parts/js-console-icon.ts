/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import displayJsConsole from '#components/js-console';
import { JsConsoleIconOptions, SymbolButtonProps } from '#types';

/*
 * breadcrumb icon used by the origin, database and datatable components
 */
export default class JsConsoleIcon {
    props(args: JsConsoleIconOptions): SymbolButtonProps {
        return {
            title: 'javascript console',
            id: JsConsoleIcon.jsConsoleButtonId,
            '@click': () => this.#jsConsoleClicked(args),
            aria: {
                haspopup: true,
                expanded: false,
                label: 'javascript console',
            },
            icon: 'tabler-terminal-2',
        };
    }
    #jsConsoleClicked(args: JsConsoleIconOptions) {
        const jsConsoleArgs = {
            ...{
                anchorId: JsConsoleIcon.jsConsoleButtonId,
                requireVariables: () => ({
                    selected: new Set<string | number>(),
                    row: undefined,
                }),
            },
            ...args,
        };
        displayJsConsole(jsConsoleArgs);
    }
    static jsConsoleButtonId = 'js-console-button-id' as const;
}
