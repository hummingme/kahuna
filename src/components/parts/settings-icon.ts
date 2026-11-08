/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import displayConfigControl from '#components/config/config-control';
import { isDatabase, isGlobal } from '#lib/app-target';
import { AppTarget, SymbolButtonProps } from '#types';

/*
 * breadcrumb icon used by the origin, database and datatable components
 */
export default class SettingsIcon {
    props(target: AppTarget): SymbolButtonProps {
        const subject = isGlobal(target)
            ? 'origin'
            : isDatabase(target)
              ? 'database'
              : 'table';
        const title = `${subject} settings and configuration`;
        return {
            title,
            id: SettingsIcon.settingsButtonId,
            '@click': () => this.#settingsClicked(target),
            aria: {
                haspopup: true,
                expanded: false,
                label: title,
            },
            icon: 'tabler-adjustments',
        };
    }
    #settingsClicked(target: AppTarget) {
        displayConfigControl({
            target: target,
            anchorId: SettingsIcon.settingsButtonId,
        });
    }
    static settingsButtonId = 'settings-button-id' as const;
}
