/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { ApplicationOptions } from './application-defaults';
import type { BehaviorAllOptions, BehaviorOptions } from './behavior-defaults';
import type { ColumnsOptions } from './columns-defaults';
import type { ConfigControl } from './config-control';
import type { ExportOptions } from './export-defaults';
import type { FiltersOptions } from './filters-defaults';
import type { ImportOptions } from './import-defaults';
import type { AppTarget, RecordOf } from '#types';

export type ControlInstance = InstanceType<typeof ConfigControl>;

export type AllOptions = ApplicationOptions &
    (BehaviorAllOptions & { onLoadTarget: AppTarget }) &
    ColumnsOptions &
    ExportOptions &
    FiltersOptions &
    ImportOptions;

export type OptionName = keyof AllOptions;

export type ConfigOptions =
    | ApplicationOptions
    | (BehaviorOptions | { onLoadTarget: AppTarget })
    | ColumnsOptions
    | ExportOptions
    | FiltersOptions
    | ImportOptions;

export type Option = {
    name: OptionName;
    label: string;
};
export type SelectOption = Option & {
    options: RecordOf<string>;
    selected?: string;
    '@change'?: (event: Event) => void;
};
export type InputOption = Option & {
    id: string;
    size?: number;
    class?: string | undefined;
    type?: 'text' | 'number';
    '@change'?: (event: Event) => void;
};
