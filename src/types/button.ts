/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { TemplateResult } from 'lit-html';
import { RefOrCallback } from 'lit/directives/ref.js';

import { AriaProps } from '#types/aria';

export type ButtonProps = {
    content: TemplateResult | string;
    type?: 'button' | 'submit' | 'reset';
    refVar?: RefOrCallback;
    tabIndex?: number;
    aria?: AriaProps;
    [key: string]: unknown;
};

export type SymbolButtonProps = {
    icon: TemplateResult | string;
    classes?: string[];
    aria?: AriaProps;
    [key: string]: unknown;
};
