/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import type { RefOrCallback } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import hintIcon from '#components/value-editor/hint-icon';
import textinput from '#components/parts/textinput';
import { TextinputProps } from '#types';

type TextInputArgs = {
    id?: string;
    '.value'?: string | undefined | void;
    style?: string | undefined;
    classes?: string[];
    maxLength?: number | undefined;
    type?: string | undefined;
    step?: string | undefined;
    min?: number | undefined;
    max?: number | undefined;
    refVar?: RefOrCallback;
    label?: string;
    list?: string | undefined;
    disabled?: boolean;
};

/**
 * used by DateField, ArraybufferField, DataviewField, BlobField, CryptokeyField,
 *         DomexceptionField, DommatrixreadonlyField, ErrorField, FileField,
 *         FilesystemdirectoryhandleField, FilesystemfilehandleField,
 *         ImagebitmapField, ImagedataField, RegexpField
 */
export default function textInput(
    field: Field,
    args: TextInputArgs = {},
    withHint = false,
) {
    const { id, style, classes, maxLength, list, type, step, min, max } = args;
    const refVar = args.refVar || field.setNodeInput;
    const disabled =
        args.disabled || !field.usesFormInput() || field.formOptions().compacted;

    const validate =
        'validate' in field && field.validate instanceof Function
            ? field.validate.bind(field)
            : undefined;

    const handleFormChange = field.handleFormChange.bind(field);
    const change = validate
        ? () => {
              validate();
              handleFormChange();
          }
        : handleFormChange;

    const props: TextinputProps = {
        id: id ?? field.valueInputId(),
        '.value': '.value' in args ? args['.value'] : field.toFormValue(),
        style,
        classes,
        maxLength,
        type,
        step,
        min,
        max,
        list,
        liveValue: true,
        spellcheck: false,
        '?disabled': disabled,
        '@change': change,
        ...(validate && { '@input': validate }),
        refVar,
    };

    const icon = withHint && field.inputMethod === 'form' ? hintIcon(field, 'form') : '';

    const label = args.label
        ? html`
              <label for="${id}">${args.label}</label>
          `
        : '';

    return html`
        <p>${textinput(props).view()} ${label}${icon}</p>
    `;
}
