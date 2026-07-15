/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import ModalWindow from '#components/modal-window';
import { button } from '#lib/button';
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
    static version = '1.6';
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
        `Wow, that was a lot more work than I expected. But ultimately, data values
        in Kahuna can now be edited directly with the [Value Editor] by clicking on
        them in the datatable view. All 44 data types supported by IndexedDB can be
        edited in a form, manipulated using JavaScript, and/or replaced via uploads.
        Along the way, I went down every rabbit hole I could find and got lost more
        than once. But the final result is something I am truly proud of!`,
        `And there have been other changes as well. For instance, filtering by empty
        values is working again, there is a preview in the datatable for ImageData
        and ImageBitmap values, and the configuration data can be exported and
        imported. The full list of changes and bug fixes can be found in the
        [CHANGELOG].`,
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
                'value editor',
                'https://hummingme.github.io/kahuna-docs/datatable#value-editor',
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
