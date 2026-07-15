/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import type { Ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import hintIcon from '#components/value-editor/hint-icon';
import textinput from '#lib/textinput';
import { type FieldInputMethod } from '#lib/datatype-attributes';

type TextInputArgs = {
    id: string;
    '.value'?: string | undefined | void;
    size?: number | undefined;
    maxLength?: number | undefined;
    type?: string | undefined;
    step?: string | undefined;
    refVar?: Ref<HTMLElement>;
    label?: string;
    list?: string | undefined;
    disabled?: boolean;
};
type TextInputProps = TextInputArgs & {
    liveValue: boolean;
    spellcheck: boolean;
    '?disabled': boolean;
    '@change': () => void;
    '@input'?: () => void;
};

export default function textInput(field: Field, args: TextInputArgs, withHint?: boolean) {
    const { id, maxLength, list, type, step } = args;
    const size = 'size' in args ? args.size : 20;
    const refVar = args.refVar || field.node;
    const disabled =
        args.disabled ||
        !isFormInput(field.inputMethod) ||
        field.state.formOptions.expanded === false;
    const props: TextInputProps = {
        id,
        '.value': '.value' in args ? args['.value'] : field.toFormValue(),
        size,
        maxLength,
        type,
        step,
        list,
        liveValue: true,
        spellcheck: false,
        '?disabled': disabled,
        '@change': field.handleFormChange.bind(field),
        refVar,
    };

    if ('validate' in field && field.validate instanceof Function) {
        props['@input'] = field.validate.bind(field);
    }

    const icon = withHint && field.inputMethod === 'form' ? hintIcon(field, 'form') : '';

    const label = args.label
        ? html`
              <label for="${id}">${args.label}</label>
          `
        : '';

    return html`
        <p>${textinput(props)} ${label}${icon}</p>
    `;
}

function isFormInput(inputMethod: FieldInputMethod) {
    return inputMethod === 'form' || inputMethod === 'ts' || inputMethod === 'ts/1000';
}
