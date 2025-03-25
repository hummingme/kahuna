/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

const Column = class {
    name = '';
    indexed = false;
    compoundHead = false; // first part of compound index acts like an index for some methods
    visible = true;
    width = 100;
    format = null;
    innerValue = false; // innerValue (property) of object ?
    discoveredTS = null;
    deletedTS = null;
    constructor() {
        Object.seal(this);
    }
};

export { Column };
