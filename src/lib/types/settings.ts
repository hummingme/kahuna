/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import type { AppTarget } from '../app-target.ts';
import type { PlainObject } from './common.ts';

export interface SettingKey extends AppTarget {
    subject: SettingSubject;
}

export type SettingSubject =
    | 'application'
    | 'behavior'
    | 'columns'
    | 'column-settings'
    | 'export'
    | 'filters'
    | 'filter-settings'
    | 'globals'
    | 'import'
    | 'jscodearea';

export interface SettingObject {
    database: string;
    table: string;
    subject: SettingSubject;
    values: PlainObject;
}
