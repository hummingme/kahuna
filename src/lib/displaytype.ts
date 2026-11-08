/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import { getType, sizeOrLength } from '#lib/datatypes';
import { compactedFrom } from '#lib/datatype-attributes';
import env from '#lib/environment';
import { isLMTOffset } from './format-date';
import { realNumbersNames, specialNumbers } from './special-numbers';
import { type AllowedType, formatterOptions, ValueFormatter } from '#lib/value-formatter';
import { ColumnFormat } from '#types/column';

type DisplayOptions = {
    format: ColumnFormat;
    previewSize: number;
    escapeNonAscii: boolean;
    useLocalTimezone: boolean;
};

const stringFormatter = new ValueFormatter('string');

const display = (val: unknown, type: AllowedType, options: DisplayOptions) => {
    if (type in typesDisplayableAs && typesDisplayableAs[type].includes(options.format)) {
        const res = displayAs(val, type, options);
        if (res !== false) {
            return res;
        }
    }

    const renderOptions = getRenderOptions(type, val, options);
    const renderedValue = stringFormatter.render(val, type, renderOptions);
    if (typeof val === 'string') {
        if (val.length === 0) {
            return html`
                <span class="italic" title="empty string">""</span>
            `;
        } else {
            return html`
                <span title="String({ length: ${val.length})">${renderedValue}</span>
            `;
        }
    }
    if (type in valueTitle) {
        const title = valueTitle[type](val, renderedValue, options);
        return title
            ? html`
                  <span class="italic" title="${title}">${renderedValue}</span>
              `
            : renderedValue;
    }
    return renderedValue;
};

function getRenderOptions(type: AllowedType, val: unknown, options: DisplayOptions) {
    const { escapeNonAscii, useLocalTimezone } = options;
    const renderOptions = formatterOptions({
        escapeNonCharacters: true,
        escapeNonAscii,
        escapeCr: true,
        escapeLf: true,
        useLocalTimezone,
    });
    if (type === 'string') {
        return { ...renderOptions, trimLength: 500 };
    }
    const size = sizeOrLength(val);
    if (typeof size === 'number' && size >= compactedFrom(type)) {
        renderOptions.compacted = true;
    }
    return renderOptions;
}

const typesDisplayableAs: { [key: string]: ColumnFormat[] } = {
    string: ['url'],
    number: ['date', 'date/1000'],
    blob: ['image'],
    file: ['image'],
    imagedata: ['image'],
    imagebitmap: ['image'],
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
    if (
        (format === 'date' || format === 'date/1000') &&
        typeof val === 'number' &&
        Number.isInteger(val) &&
        ((format === 'date' && Math.abs(val) <= 8.64e15) || // ±100000000 days from epoch
            (format === 'date/1000' && Math.abs(val) <= 8.64e12))
    ) {
        const date = new Date(format === 'date' ? val : val * 1000);
        const str = stringFormatter.render(
            date,
            'date',
            getRenderOptions(type, val, options),
        );
        return html`
            <span
                class="italic"
                title="number value ${val} formatted as ${dateValueTitle(
                    date,
                    options.useLocalTimezone,
                )}"
            >
                ${str}
            </span>
        `;
    }
    if (format === 'image') {
        if (
            val instanceof Blob && // also true for File values
            imageMimeTypes.includes(val.type)
        ) {
            const url = URL.createObjectURL(val);
            const title = stringFormatter.render(val, type);
            const alt = `image preview of a ${type.toUpperCase()} value of type ${val.type}`;
            const content = html`
                <img src="${url}" @load=${revokeImageUrl} />
            `;
            return imagePreviewBox(content, title, alt, previewSize);
        } else if (val instanceof ImageData) {
            const title = stringFormatter.render(val, type, { compacted: true });
            const alt = `image preview of an ImageData value`;
            const content = html`
                <img
                    ${ref((el) => injectImageDataDataUrl(el, val))}
                    @load=${revokeImageUrl}
                />
            `;
            return imagePreviewBox(content, title, alt, previewSize);
        } else if (val instanceof ImageBitmap) {
            const title = stringFormatter.render(val, type);
            const alt = `image preview of an ImageBitmap value`;
            const content = html`
                <canvas ${ref((el) => drawImageBitmap(el, val, previewSize))} />
            `;
            return imagePreviewBox(content, title, alt, previewSize);
        }
    }
    return false;
};

function imagePreviewBox(
    content: TemplateResult,
    title: string,
    alt: string,
    previewSize: number,
) {
    const containerStyles = ['width', 'height', 'line-height'].map(
        (s) => `${s}: ${previewSize}px`,
    );
    return html`
        <div class="preview-wrapper" style="${containerStyles.join(';')}">
            <div
                class="preview-box"
                title=${title}
                alt=${alt}
                style=${containerStyles.join(';')}
            >
                ${content}
            </div>
        </div>
    `;
}

function drawImageBitmap(node?: Element, bitmap?: ImageBitmap, previewSize = 20) {
    if (!(node instanceof HTMLCanvasElement) || !bitmap) return;
    const ctx = node.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    node.width = previewSize * dpr;
    node.height = previewSize * dpr;
    node.style.width = `${previewSize}px`;
    node.style.height = `${previewSize}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset + scale
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const scale = Math.min(previewSize / bitmap.width, previewSize / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    const dx = (previewSize - drawWidth) / 2;
    const dy = (previewSize - drawHeight) / 2;
    ctx.drawImage(bitmap, dx, dy, drawWidth, drawHeight);
}

async function injectImageDataDataUrl(node?: Element, val?: ImageData) {
    if (node instanceof HTMLImageElement === false || !val) return;
    const canvas = new OffscreenCanvas(val.width, val.height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(val, 0, 0);
    const blob = await canvas.convertToBlob();
    node.setAttribute('src', URL.createObjectURL(blob));
}

function revokeImageUrl(this: HTMLImageElement) {
    URL.revokeObjectURL(this.src);
}

const uriSchemeRegExp = /^((https?)|(ftps?)|(file)):\/\//i;

// 2 labels + TLD + optional slash + optional path
const webAdressTwoLabelsRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,62})((\.[a-z0-9][a-z0-9-]{1,12})(\/[a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

// 1 label + TLD + mandatory slash + optional path
const webAdressOneLabelRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,12})\/(([a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

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

const valueTitle: Record<
    string,
    (val: unknown, renderedVal?: string, options?: DisplayOptions) => string
> = {
    date: (val, _renderedVal, options) => {
        if (!(val instanceof Date)) return '';
        return dateValueTitle(val, Boolean(options?.useLocalTimezone));
    },
    number: (_val, renderedVal) => {
        if (renderedVal && realNumbersNames.has(renderedVal)) {
            return String(specialNumbers.get(renderedVal));
        }
        return '';
    },
    cryptokey: (val) => {
        if (!(val instanceof CryptoKey)) return '';
        return (['type', 'usages', 'algorithm', 'extractable'] as const)
            .map(
                (prop) =>
                    `${prop}: ${stringFormatter.render(val[prop], getType(val[prop]))}`,
            )
            .join('\n');
    },
};
if (env.manifestVersion === 2) {
    // firefox can't access the properties if the CryptoKey originates from the database.
    delete valueTitle.cryptokey;
}

const dateValueTitle = (date: Date, useLocalTimezone: boolean) => {
    return useLocalTimezone
        ? isLMTOffset(date, env.timeZone)
            ? `LMT date for timezone ${env.timeZone}`
            : `local date for timezone ${env.timeZone}`
        : 'UTC date';
};

export default display;
