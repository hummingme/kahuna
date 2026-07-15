/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import settings from '#lib/settings';
import type { HideableMessageType } from '#types/settings';

export function hideMessageType(type: HideableMessageType, event: Event) {
    const target = event.target as HTMLInputElement;
    let hiddenMessagesOrigin = getHiddenMessagesOrigin();
    if (target.checked) {
        hiddenMessagesOrigin.push(type);
    } else {
        hiddenMessagesOrigin = hiddenMessagesOrigin.filter((t) => t !== type);
    }
    setHiddenMessagesOrigin(hiddenMessagesOrigin);
}

export function getHiddenMessagesOrigin() {
    const hiddenMessages = settings.global('hiddenMessages');
    return hiddenMessages.get(location.origin) || [];
}

export function setHiddenMessagesOrigin(messageTypes: HideableMessageType[]) {
    const hiddenMessages = settings.global('hiddenMessages');
    hiddenMessages.set(location.origin, messageTypes);
    settings.saveGlobals({ hiddenMessages });
}
