/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import messageStack from '#components/messagestack';
import UpdateInfo from '#components/update-info';
import appStore from '#lib/app-store';
import env from '#lib/environment';
import { hideMessageType, getHiddenMessagesOrigin } from './hidden-messages';
import settings from '#lib/settings';

const startupCheckings = () => {
    if (env.codeExecution === false) {
        displayNoCodeExecutionInfo();
    }
    const lastUpdateInfo = settings.global('lastUpdateInfo');
    if (
        lastUpdateInfo.length > 0 &&
        compareSemanticVersions(env.version, lastUpdateInfo) > 0 &&
        env.version === UpdateInfo.version
    ) {
        appStore.update({ updateInfoVisible: true });
    }
    if (lastUpdateInfo.length === 0) {
        settings.saveGlobals({ lastUpdateInfo: env.version });
    }
};
const compareSemanticVersions = (v1: string, v2: string) => {
    return v1.localeCompare(v2, undefined, { numeric: true });
};

const displayNoCodeExecutionInfo = () => {
    if (getHiddenMessagesOrigin().includes('noCodeExecution')) {
        return;
    }
    const origin = window.location.origin;
    const content = ` Execution of arbitrary javascript from strings and
starting webworkers is blocked on ${origin}. Therefore some features are not \
available on this origin.`;
    const checkbox = {
        label: "don't show this message again for this origin",
        '@change': hideMessageType.bind(null, 'noCodeExecution'),
    };
    messageStack.displayInfo(content, { checkbox });
};

export default startupCheckings;
