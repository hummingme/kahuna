/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing, type TemplateResult } from 'lit-html';
import { RefOrCallback } from 'lit-html/directives/ref.js';

import configLayer from '#components/configlayer';
import { button } from '#components/parts/button';
import svgIcon from '#components/parts/svgicon';
import { AriaProps } from '#types';

type ToolButtonArgs = {
    label: string;
    topic: string;
    iconName: string;
    iconArgs?: Record<string, string>;
    panelOpen?: boolean;
    panelView?: () => TemplateResult;
    onClick?: () => void;
    refVar?: RefOrCallback;
    aria?: AriaProps;
};

export function toolEntry(args: ToolButtonArgs) {
    const {
        label,
        topic,
        panelOpen,
        iconName,
        iconArgs,
        panelView,
        onClick,
        aria,
        ...rest
    } = args;
    const panelId = `tool-${topic}-id`;

    const panel = panelView
        ? html`
              <div id=${panelId} class=${panelOpen ? nothing : 'hidden'}>
                  ${panelOpen ? panelView() : nothing}
              </div>
          `
        : nothing;

    return html`
        <p>
            ${button({
                ...rest, //  refVar
                '@click': onClick ?? configLayer.onTopicClicked,
                class: 'tool',
                'data-topic': topic,
                aria: aria ?? {
                    expanded: false,
                    controls: panelId,
                },
                content: html`
                    ${svgIcon(iconName, iconArgs)} ${label}
                `,
            })}
        </p>
        ${panel}
    `;
}

export function focusButton(node?: Element) {
    if (node instanceof HTMLButtonElement) {
        requestAnimationFrame(() => {
            node.focus();
        });
    }
}
