/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import messenger from '#lib/messenger';
import type { Message, WidthObject } from '#types';

class TextinputWidths {
    widths: { [key: string]: number } = {};
    boundWidthsResult;
    constructor() {
        this.boundWidthsResult = this.widthsResult.bind(this);
        messenger.register('textinputWidthsResults', this.boundWidthsResult);
        messenger.post({ type: 'requestTextinputWidths' });
    }
    widthsResult(msg: Message) {
        if (msg.type === 'textinputWidthsResults') {
            this.widths = msg.widths;
            messenger.unregister('textinputWidthsResults', this.boundWidthsResult);
        }
    }
    get(id: string): number | undefined {
        return this.widths[id];
    }
    save(width: WidthObject, isEphemeral: boolean) {
        this.widths[width.id] = width.width;
        if (!isEphemeral) {
            messenger.post({ type: 'saveTextinputWidth', width });
        }
    }
}

const textinputWidths = new TextinputWidths();

export default textinputWidths;
