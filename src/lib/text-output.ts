/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

type LinksMap = Map<string, string>;

export const paragraph = (paragraph: string, links: LinksMap) => {
    return unsafeHTML(`<p>${processLinks(paragraph, links)}</p>`);
};
export const itemsList = (items: string[], links: LinksMap) => {
    return html`
        <ul>
            ${items.map(
                (item) => html`
                    <li>${unsafeHTML(processLinks(item, links))}</li>
                `,
            )}
        </ul>
    `;
};

const processLinks = (item: string, links: LinksMap): string => {
    const linkRegExp = /\[([^\]]*)\]/g;
    const replacer = (links: LinksMap) => {
        return (match: string, key: string) => replaceLink(match, key, links);
    };
    return item.replaceAll(linkRegExp, replacer(links));
};

const replaceLink = (match: string, key: string, links: LinksMap): string => {
    const link = links.get(key.toLowerCase());
    return link ? `<a href="${link}" title="${link}" target="_blank">${key}</a>` : match;
};
