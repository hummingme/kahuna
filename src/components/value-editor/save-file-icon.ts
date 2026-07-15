/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { escapeUnicode } from '#lib/escape-unicode';
import { downloadFile } from '#lib/utils';
import { symbolButton } from '#lib/button';

export default function saveFileIcon(file: File) {
    const title = `save ${escapeUnicode(file.name)} as file`;
    return symbolButton({
        icon: 'tabler-device-floppy',
        title,
        '@click': saveValue.bind(null, file),
        classes: ['value-icon'],
    });
}

function saveValue(file: File) {
    const { name, type } = file;
    downloadFile(file, name, type);
}
