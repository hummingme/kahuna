/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { valueToString } from './types';

const display = (val, format, type) => {
    if (format && typesDisplayableAs[type]?.includes(format)) {
        const res = displayAs(val, format);
        if (res !== false) {
            return res;
        }
    }
    if (type === 'string' && val?.length === 0) {
        return html`
            <span class="italic" title="empty string">""</span>
        `;
    }
    return valueToString(val, type);
};

/**
 * for some types there are different kinds of display
 */
const displayAs = (val, as) => {
    if (as === 'url') {
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
    if (as === 'date' && Number.isInteger(val)) {
        let str;
        if (inMicroRange(val)) {
            str = `${new Date(val).toISOString()}`;
        } else if (inSecondsRange(val)) {
            str = `${new Date(val * 1000).toISOString()}`;
            str = `${str.slice(0, -5)}Z`;
        }
        if (str !== undefined) {
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
    return false;
};

const typesDisplayableAs = {
    string: ['url'],
    number: ['date'],
};

const uriSchemeRegExp = /^((https?)|(ftps?)|(file)):\/\//i;

// 2 labels + TLD + optional slash + optional path
const webAdressTwoLabelsRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,62})((\.[a-z0-9][a-z0-9-]{1,12})(\/[a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

// 1 label + TLD + mandatory slash + optional path
const webAdressOneLabelRegExp =
    /^[a-z0-9]([a-z0-9-]{1,62})\.[a-z0-9]([a-z0-9-]{1,12})\/(([a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?)$/i;

const date = new Date();
const dateMicroRange = {
    from: date.setFullYear(date.getFullYear() - 10),
    to: date.setFullYear(date.getFullYear() + 20),
};
const dateSecondsRange = {
    from: Math.floor(dateMicroRange.from / 1000),
    to: Math.floor(dateMicroRange.to / 1000),
};

const inMicroRange = (val) => val > dateMicroRange.from && val < dateMicroRange.to;
const inSecondsRange = (val) => val > dateSecondsRange.from && val < dateSecondsRange.to;

export default display;
