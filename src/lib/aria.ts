/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { AriaProps } from '#types';

type ExpandedAria<T> = T & {
    [K in keyof AriaProps as `aria-${K & string}`]?: AriaProps[K];
};

export function expandAriaAttributes<T extends { aria?: AriaProps }>(
    props: T,
): ExpandedAria<Omit<T, 'aria'>> {
    const { aria, ...attributes } = props;
    if (!aria) return attributes as ExpandedAria<Omit<T, 'aria'>>;

    const ariaAttributes = Object.fromEntries(
        Object.entries(aria).map(([key, value]) => [`aria-${key}`, value]),
    );
    if (
        'title' in attributes &&
        typeof attributes.title === 'string' &&
        !ariaAttributes['aria-label']
    ) {
        ariaAttributes['aria-label'] = attributes['title'];
    }
    return { ...attributes, ...ariaAttributes } as ExpandedAria<Omit<T, 'aria'>>;
}

export function toggleAriaExpanded(node: HTMLElement) {
    const isExpanded = node.getAttribute('aria-expanded') === 'true';
    node.setAttribute('aria-expanded', String(!isExpanded));
    return !isExpanded;
}
