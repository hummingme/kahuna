/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import messageStack from '../components/messagestack.js';
import env from './environment.js';
import settings from './settings.js';

const startupCheckings = () => {
    if (env.codeExecution === false) {
        displayNoCodeExecutionInfo();
    }
};

const displayNoCodeExecutionInfo = () => {
    if (settings.global('hiddenMessages').includes('noCodeExecution')) {
        return;
    }
    const origin = window.location.origin;
    const content = ` Execution of arbitrary javascript from strings and
starting webworkers is blocked on ${origin}. Therefore some features are not \
available on this origin.`;
    const checkbox = {
        label: "don't show this message again for this origin",
        changeFunc: hideNoCodeExecutionInfo,
    };
    messageStack.displayInfo({ content, checkbox });
};

const hideNoCodeExecutionInfo = (event) => {
    const hiddenMessages = settings.global('hiddenMessages');
    if (event.target.checked) {
        hiddenMessages.push('noCodeExecution');
        settings.saveGlobals({ hiddenMessages });
    } else {
        settings.saveGlobals({
            hiddenMessages: hiddenMessages.filter((type) => type !== 'noCodeExecution'),
        });
    }
};

export default startupCheckings;
