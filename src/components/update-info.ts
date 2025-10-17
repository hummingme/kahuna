/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import ModalWindow from './modal-window.ts';
import { button } from '../lib/button.ts';
import settings from '../lib/settings.ts';
import { paragraph } from '../lib/text-output.ts';

// @ts-expect-error TS2307
import * as build from 'buildinfo.js';

class UpdateInfo extends ModalWindow {
    constructor() {
        super({
            closeHandler: () =>
                settings.saveGlobals({ lastUpdateInfo: UpdateInfo.version }),
            visibilityProperty: 'updateInfoVisible',
        });
    }
    static version = '1.5.1';
    view() {
        const content = html`
            <div class="update-info">
                <div>
                    <h1>Kahuna has been updated to version ${build.version} 🌞</h1>
                    ${paragraph(this.paragraphs[0], this.links())}
                    ${paragraph(this.paragraphs[1], this.links())}
                    ${paragraph(this.paragraphs[2], this.links())}
                    <p>Have a good day and happy building!</p>
                    <div class="center">
                        ${button({ content: 'close', '@click': super.close.bind(this) })}
                    </div>
                </div>
            </div>
        `;
        return super.node(content);
    }
    readonly paragraphs = [
        `I felt like it was time for a maintenance release and so the bug fixes and
        smaller improvements from the last 2 months are collected in this version.
        As an immediately visible change, strings and numbers are now highlighted
        in color when displayed. The colors used can be [configured] according to
        personal preferences. The full list of changes and bug fixes can be found
        in the [CHANGELOG].`,
        `I'd love to hear your feedback! If you enjoy using Kahuna, please consider
        rating on the [Chrome Web Store] or the [Firefox Add-ons] site. Or show your
        support with a ⭐ on [GitHub]!`,
        `Something not working as expected? Missing a feature you really need? Opening
        an [issue or feature request] on GitHub with as much detail as possible is the
        first step to getting it resolved.`,
    ];
    links(): Map<string, string> {
        return new Map([
            [
                'configured',
                'https://hummingme.github.io/kahuna-docs/configuration/#application',
            ],
            ['changelog', 'https://github.com/hummingme/kahuna/blob/main/CHANGELOG.md'],
            [
                'chrome web store',
                'https://chromewebstore.google.com/detail/kahuna/ilafpdbgcaodnkdklgemggjamhpdjile',
            ],
            [
                'firefox add-ons',
                'https://addons.mozilla.org/en-US/firefox/addon/kahuna-the-indexeddb-manager/',
            ],
            ['github', 'https://github.com/hummingme/kahuna'],
            ['issue or feature request', 'https://github.com/hummingme/kahuna/issues'],
        ]);
    }
}

export default UpdateInfo;
