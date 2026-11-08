/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { symbolButton } from '#components/parts/button';
import { print } from '#lib/escape-string';
import { downloadFile } from '#lib/utils';

export default function saveFileIcon(file: File) {
    const title = `save file ${print(file.name)}`;
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
