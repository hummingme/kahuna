/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import ModalWindow from '#components/modal-window';
import { button } from '#components/parts/button';
import settings from '#lib/settings';
import { paragraph } from '#lib/text-output';

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
    static version = '1.7.0';
    view() {
        const content = html`
            <div class="update-info">
                <div>
                    <h1>Kahuna has been updated to version ${build.version} 🍻</h1>
                    ${paragraph(this.paragraphs[0], this.links())}
                    ${paragraph(this.paragraphs[1], this.links())}
                    ${paragraph(this.paragraphs[2], this.links())}
                    ${paragraph(this.paragraphs[3], this.links())}
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
        `Yo, here we go again! I've been working hard and put together a nice list
        of new features, improvements, and bug fixes for this release. Here are a
        few highlights, and as usual, you can find the complete list in the
        [CHANGELOG].`,

        `The JavaScript textarea below the data table grid is gone, replaced by the
        [JavaScript console]. You can open it via an icon in the window bar, not only
        in the data table view, but also in the origin and database views.`,

        `All text input fields can now be resized with the mouse, so long names and
        extensive index specs are always fully visible. Date pickers are now
        available for [filtering data by date], and you can choose whether to search
        for a specific point in time or a time period. The [value editor], introduced
        in the previous release, has also received several improvements.`,

        `I'd love to hear your feedback! If you enjoy using Kahuna, please consider
        leaving a rating in the [Chrome Web Store] or on the [Firefox Add-ons] site.
        Or show your support by giving the project a ⭐ on [GitHub]!`,

        `Something not working as expected? Missing a feature you really need?
        Opening an [issue or feature request] on GitHub, with as much detail as
        possible, is the first step toward getting it resolved.`,
    ];
    links(): Map<string, string> {
        return new Map([
            [
                'value editor',
                'https://hummingme.github.io/kahuna-docs/datatable/#value-editor',
            ],
            [
                'javascript console',
                'https://hummingme.github.io/kahuna-docs/javascript-console/',
            ],
            [
                'filtering data by date',
                'https://hummingme.github.io/kahuna-docs/configuration/#point-date-filter',
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
