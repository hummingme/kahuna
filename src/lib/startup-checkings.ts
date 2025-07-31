/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import messageStack from '../components/messagestack.ts';
import UpdateInfo from '../components/update-info.ts';
import appStore from './app-store.ts';
import env from './environment.ts';
import settings from './settings.ts';

const startupCheckings = () => {
    if (env.codeExecution === false) {
        displayNoCodeExecutionInfo();
    }
    const lastUpdateInfo = settings.global('lastUpdateInfo');
    if (
        compareSemanticVersions(env.version, lastUpdateInfo) > 0 &&
        env.version === UpdateInfo.version
    ) {
        appStore.update({ updateInfoVisible: true });
    }
};
const compareSemanticVersions = (v1: string, v2: string) => {
    return v1.localeCompare(v2, undefined, { numeric: true });
};

const displayNoCodeExecutionInfo = () => {
    if (settings.global('hiddenMessages').has('noCodeExecution')) {
        return;
    }
    const origin = window.location.origin;
    const content = ` Execution of arbitrary javascript from strings and
starting webworkers is blocked on ${origin}. Therefore some features are not \
available on this origin.`;
    const checkbox = {
        label: "don't show this message again for this origin",
        '@change': hideNoCodeExecutionInfo,
    };
    messageStack.displayInfo(content, { checkbox });
};

const hideNoCodeExecutionInfo = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const hiddenMessages = settings.global('hiddenMessages');
    if (target.checked) {
        hiddenMessages.add('noCodeExecution');
    } else {
        hiddenMessages.delete('noCodeExecution');
    }
    settings.saveGlobals({ hiddenMessages });
};

export default startupCheckings;
