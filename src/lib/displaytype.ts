/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { type AllowedType, stringFormatter } from './value-formatter.ts';

interface DisplayOptions {
    format: string;
    previewSize: number;
}

const display = (val: unknown, type: AllowedType, options: DisplayOptions) => {
    if (type in typesDisplayableAs && typesDisplayableAs[type].includes(options.format)) {
        const res = displayAs(val, type, options);
        if (res !== false) {
            return res;
        }
    }
    if (typeof val === 'string' && type === 'string' && val.length === 0) {
        return html`
            <span class="italic" title="empty string">""</span>
        `;
    }
    return stringFormatter.render(val, type);
};

const typesDisplayableAs: { [key: string]: string[] } = {
    string: ['url'],
    number: ['date'],
    blob: ['image'],
    file: ['image'],
} as const;

/**
 * for some types there are different kinds of display
 */
const displayAs = (val: unknown, type: AllowedType, options: DisplayOptions) => {
    const { format, previewSize } = options;
    if (format === 'url' && typeof val === 'string') {
        let href;
        if (uriSchemeRegExp.test(val)) {
            href = val;
        } else if (
            webAdressOneLabelRegExp.test(val) ||
            webAdressTwoLabelsRegExp.test(val)
        ) {
            href = `https://${val}`;
        }
        if (href) {
            return html`
                <a href=${href} target="_blank" title="string value formated as url">
                    ${val}
                </a>
            `;
        }
    }
    if (format === 'date' && typeof val === 'number' && Number.isInteger(val)) {
        let str: string = '';
        if (inMicroRange(val)) {
            str = `${new Date(val).toISOString()}`;
        } else if (inSecondsRange(val)) {
            str = `${new Date(val * 1000).toISOString()}`;
            str = `${str.slice(0, -5)}Z`;
        }
        if (str.length > 0) {
            return html`
                <span
                    class="italic"
                    title="number value ${val} formated as ISO 8601 date"
                >
                    ${str}
                </span>
            `;
        }
    }
    if (
        format === 'image' &&
        ['blob', 'file'].includes(type) &&
        imageMimeTypes.includes((val as Blob).type)
    ) {
        const url = URL.createObjectURL(val as Blob);
        const containerStyles = ['width', 'height', 'line-height'].map(
            (s) => `${s}: ${previewSize}px`,
        );
        const title = stringFormatter.render(val, type);
        const alt = `image preview of a ${type} value from type ${(val as Blob).type}`;
        return html`
            <div
                class="preview-box"
                title=${title}
                alt=${alt}
                style=${containerStyles.join(';')}
            >
                <img src="${url}" @load=${previewLoaded.bind(null, url)}>
                </img>
            </div>`;
    }
    return false;
};

const previewLoaded = (url: string, event: Event) => {
    URL.revokeObjectURL(url);
    const target = event.target as HTMLElement;
    const container = target.parentNode as HTMLElement;
    container.classList.add('center');
};

const uriSchemeRegExp = /^((https?)|(ftps?)|(file)):\/\//i;

// 2 labels + TLD + optional slash + optional path
const webAdressTwoLabelsRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,62})((\.[a-z0-9][a-z0-9-]{1,12})(\/[a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

// 1 label + TLD + mandatory slash + optional path
const webAdressOneLabelRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,12})\/(([a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

interface DateRange {
    from: number;
    to: number;
}

const date = new Date();

const dateMicroRange: DateRange = {
    from: date.setFullYear(date.getFullYear() - 10),
    to: date.setFullYear(date.getFullYear() + 20),
};
const dateSecondsRange: DateRange = {
    from: Math.floor(dateMicroRange.from / 1000),
    to: Math.floor(dateMicroRange.to / 1000),
};

const inMicroRange = (val: number) =>
    val > dateMicroRange.from && val < dateMicroRange.to;

const inSecondsRange = (val: number) =>
    val > dateSecondsRange.from && val < dateSecondsRange.to;

const imageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/bmp',
    'image/x-windows-bmp',
    'image/avif',
    'image/apng',
];

export default display;
