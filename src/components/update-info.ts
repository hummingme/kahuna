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
    static version = '1.5.2';
    view() {
        const content = html`
            <div class="update-info">
                <div>
                    <h1>Kahuna has been updated to version ${build.version} 🍻</h1>
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
        `It's been a while, so I thought it was time for a new maintenance release
        with the bug fixes from the last few weeks. There's nothing particularly
        exciting here, except perhaps the fix for an error that occurred when
        editing data containing a string with line breaks. Plus, some
        case-insensitive filters were accelerated. The full list of changes and bug
        fixes can be found in the [CHANGELOG].`,

        `What are your biggest pain points when developing with IndexedDB databases,
        and how could Kahuna help eliminate them? Are there any features in this
        extension that you find buggy or incomplete? I can't promise anything, but
        if you tell me about it, there's a good chance that a solution can be found.
        Just open an [issue or feature request] on GitHub.`,

        `Also, if you enjoy using Kahuna, please consider leaving a rating on the
        [Chrome Web Store] or the [Firefox Add-ons] site. Or show your support with
        a ⭐ on [GitHub]!`,
    ];
    links(): Map<string, string> {
        return new Map([
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
