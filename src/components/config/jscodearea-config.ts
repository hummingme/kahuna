/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import settings from '#lib/settings';
import { AppTarget, SettingSubject } from '#types';

const JsCodeareaConfig = class {
    static subject: SettingSubject = 'jscodearea';

    static async getSettings(target: AppTarget, detail?: string) {
        const defaults = JsCodeareaConfig.getDefaults(detail);
        let values = await settings.get({
            ...target,
            subject: 'jscodearea', //JsCodeareaConfig.subject,
            detail,
        });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static getDefaults(detail?: string): JsCodeareaConfigValues {
        const defaults = jsCodeareaDefaultOptions();
        if (typeof detail === 'string') {
            defaults.width = '';
            defaults.height = '';
        }
        return defaults;
    }
};

export type JsCodeareaConfigValues = {
    width: string;
    height: string;
    savedIndex: number;
    savedCode: string[];
};

export const jsCodeareaDefaultOptions = (): JsCodeareaConfigValues => {
    return {
        width: '400px',
        height: '70px',
        savedIndex: -1,
        savedCode: [],
    };
};
export default JsCodeareaConfig;
