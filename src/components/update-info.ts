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
    static version = '1.5';
    view() {
        const content = html`
            <div class="update-info">
                <div>
                    <h1>Kahuna has been updated to version ${build.version} 🎉</h1>
                    ${paragraph(this.paragraphs[0], this.links())}
                    ${paragraph(this.paragraphs[1], this.links())}
                    ${paragraph(this.paragraphs[2], this.links())}
                    <p>Have fun and happy building!</p>
                    <div class="center">
                        ${button({ content: 'close', '@click': super.close.bind(this) })}
                    </div>
                </div>
            </div>
        `;
        return super.node(content);
    }
    readonly paragraphs = [
        `The highlights of this release include a brand-new database [schema editor],
        as well as handy tools for [copying databases] and [copying tables]. The full
        list of changes and bug fixes can be found in the [CHANGELOG].`,
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
                'schema editor',
                'https://hummingme.github.io/kahuna-docs/database/#edit-schema',
            ],
            [
                'copying databases',
                'https://hummingme.github.io/kahuna-docs/database/#copy-database',
            ],
            [
                'copying tables',
                'https://hummingme.github.io/kahuna-docs/datatable/#copy-table',
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
