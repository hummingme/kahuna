/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { type AppTarget } from '../../lib/app-target.ts';
import settings from '../../lib/settings.ts';
import { type SettingSubject } from '../../lib/types/settings.ts';

export type JsCodeareaConfigValues = ReturnType<typeof JsCodeareaConfig.getDefaults>;

const JsCodeareaConfig = class {
    static subject: SettingSubject = 'jscodearea';

    static async getSettings(target: AppTarget) {
        const defaults: JsCodeareaConfigValues = JsCodeareaConfig.getDefaults();
        let values = (await settings.get({
            ...target,
            subject: JsCodeareaConfig.subject,
        })) as JsCodeareaConfigValues;
        values = settings.cleanupSettings(values, defaults) as JsCodeareaConfigValues;
        return { values, defaults };
    }
    static getDefaults() {
        return {
            width: '400px',
            height: '70px',
            savedIndex: -1,
            savedCode: [] as string[],
        };
    }
};

export default JsCodeareaConfig;
