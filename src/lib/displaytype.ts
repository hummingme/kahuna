/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import { getType, sizeOrLength } from '#lib/datatypes';
import { compactedFrom } from '#lib/datatype-attributes';
import env from '#lib/environment';
import { type AllowedType, formatterOptions, ValueFormatter } from '#lib/value-formatter';

type DisplayOptions = {
    format: string;
    previewSize: number;
};

const stringFormatter = new ValueFormatter('string');

const display = (val: unknown, type: AllowedType, options: DisplayOptions) => {
    if (type in typesDisplayableAs && typesDisplayableAs[type].includes(options.format)) {
        const res = displayAs(val, type, options);
        if (res !== false) {
            return res;
        }
    }
    if (typeof val === 'string' && val.length === 0) {
        return html`
            <span class="italic" title="empty string">""</span>
        `;
    }
    if (type in valueTitle) {
        return html`
            <span class="italic" title="${valueTitle[type](val)}">
                ${stringFormatter.render(val, type)}
            </span>
        `;
    }
    const result = stringFormatter.render(val, type, displayOptions(type, val));
    return typeof val === 'string'
        ? html`
              <span title="String({ length: ${val.length})">${result}</span>
          `
        : result;
};

function displayOptions(type: AllowedType, val: unknown) {
    const options = formatterOptions({
        escapeNonCharacters: true,
        unescapedLineFeeds: false,
    });
    if (type === 'string') {
        options.trimLength = 500;
    } else if ((sizeOrLength(val) || Infinity) >= compactedFrom(type)) {
        options.expanded = false;
    }
    return options;
}

const typesDisplayableAs: { [key: string]: string[] } = {
    string: ['url'],
    number: ['date'],
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
    if (format === 'date' && typeof val === 'number' && Number.isInteger(val)) {
        let str = '';
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
            const title = stringFormatter.render(val, type, { expanded: false });
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

interface DateRange {
    from: number;
    to: number;
}

const date = new Date();

const dateMicroRange: DateRange = {
    from: date.setFullYear(date.getFullYear() - 30),
    to: date.setFullYear(date.getFullYear() + 50),
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

const valueTitle: Record<string, (val: unknown) => string> = {
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

export default display;
