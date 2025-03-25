/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import settings from '../../lib/settings.js';

const JsCodeareaConfig = class {
    static subject = 'jscodearea';
    static async getSettings(target) {
        const defaults = JsCodeareaConfig.getDefaults(target);
        let values = await settings.get({
            ...target,
            subject: JsCodeareaConfig.subject,
        });
        values = settings.cleanupSettings(values, defaults);
        return { values, defaults };
    }
    static getDefaults() {
        return {
            width: '400px',
            height: '70px',
            savedIndex: -1,
            savedCode: [],
        };
    }
};

export default JsCodeareaConfig;
