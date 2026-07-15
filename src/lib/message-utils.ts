/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { Message, MessageTopic, MESSAGE_TOPICS, TopicGroup } from '#types';

export function isGroupMessage<T extends TopicGroup>(
    group: T,
    message: any,
): message is Message {
    const topic: MessageTopic =
        message[Symbol.toStringTag] === 'MessageEvent' ? message.data.type : message.type;
    return (
        typeof message === 'object' &&
        message !== null &&
        typeof topic === 'string' &&
        [...MESSAGE_TOPICS[group]].includes(topic)
    );
}

export function isTopicInGroup<T extends TopicGroup>(
    group: T,
    topic: MessageTopic,
): topic is (typeof MESSAGE_TOPICS)[T][number] {
    const groupValues = [...MESSAGE_TOPICS[group]];
    return groupValues.includes(topic);
}
