/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { datepickerTypeOptions } from '#lib/datepicker-types';

export type DatepickerType = (typeof datepickerTypeOptions)[number];
