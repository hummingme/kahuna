/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import applicationDefaultOptions from './application-defaults';
import { behaviorDefaultOptions } from './behavior-config';
import { columnsDefaultOptions } from './columns-default';
import { ConfigControl, CONFIG_REALMS } from './config-control';
import { exportDefaultOptions } from './export-config';
import { filtersDefaultOptions } from './filters-config';
import { importDefaultOptions } from './import-config';
import { AppTarget, RecordOf } from '#types';

export type ControlInstance = InstanceType<typeof ConfigControl>;

export type ConfigRealm = (typeof CONFIG_REALMS)[number];

export type AllOptions = ApplicationOptions &
    (BehaviorOptions & { onLoadTarget: AppTarget }) &
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
    size?: number;
    class?: string | undefined;
    '@change'?: (event: Event) => void;
};

export type ApplicationOptions = ReturnType<typeof applicationDefaultOptions>;
export type BehaviorOptions = ReturnType<typeof behaviorDefaultOptions>;
export type ColumnsOptions = ReturnType<typeof columnsDefaultOptions>;
export type FiltersOptions = ReturnType<typeof filtersDefaultOptions>;
export type ExportOptions = ReturnType<typeof exportDefaultOptions>;
export type ImportOptions = ReturnType<typeof importDefaultOptions>;
