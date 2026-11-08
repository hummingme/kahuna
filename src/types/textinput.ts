/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { RefOrCallback } from 'lit/directives/ref.js';
import { TemplateResult } from 'lit-html';

export type Textinput = {
    node: HTMLInputElement;
    view: () => TemplateResult;
    setCustomValidity: (msg: string) => void;
};

export type TextinputProps = {
    id: string;
    type?: string | undefined;
    classes?: string[] | undefined;
    style?: string | undefined;
    refVar?: RefOrCallback | undefined;
    tabIndex?: number;
    '.value'?: unknown;
    liveValue?: boolean;
    '@input'?: (input: Textinput, ev: InputEvent) => void;
    isEphemeral?: boolean; // true: don't save the element width permanently
    [key: string]: unknown;
};
