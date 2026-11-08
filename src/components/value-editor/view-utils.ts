/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

export function focusForceVisible(
    node?: HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | null,
) {
    if (!node) return;
    requestAnimationFrame(() => node.focus());
    node.classList.add('force-focus-visible');
    node.addEventListener(
        'blur',
        () => {
            node.classList.remove('force-focus-visible');
        },
        { once: true },
    );
}
