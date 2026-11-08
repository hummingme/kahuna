/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { type AllowedType } from '#lib/value-formatter';

export type RememberedValue = {
    type: AllowedType;
    value: unknown;
    absent: boolean;
};
