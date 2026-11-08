/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import type { ApplicationOptions } from '#components/config/application-defaults';
import type { BehaviorOptions } from '#components/config/behavior-defaults';
import type { ColumnsOptions } from '#components/config/columns-defaults';
import type { ExportOptions } from '#components/config/export-defaults';
import type { FiltersOptions } from '#components/config/filters-defaults';
import type { ImportOptions } from '#components/config/import-defaults';
import type { JsCodeareaConfigValues } from '#components/config/jscodearea-config';
import type { FieldSettings } from '#components/value-editor/fields/field';
import type { AppTarget, Column, Filter } from '#types';

export type SettingSubject =
    | 'behavior'
    | 'columns'
    | 'column-settings'
    | 'export'
    | 'filters'
    | 'filter-settings'
    | 'globals'
    | 'import'
    | 'jscodearea'
    | 'editorfield';

export type SettingObject = SettingKey & {
    values: Partial<SerializedSettingValues>;
};

export type WidthObject = { id: string; width: number };

export type SettingValues =
    | BehaviorSettingValues
    | ColumnsSettingValues
    | ColumnsValues
    | ExportSettingValues
    | FiltersSettingValues
    | FiltersValues
    | GlobalsSettingValues
    | ImportSettingValues
    | JsCodeareaSettingValues
    | EditorfieldSettingValues;

export type SettingValuesMap = {
    behavior: BehaviorSettingValues;
    columns: ColumnsValues;
    'column-settings': ColumnsSettingValues;
    export: ExportSettingValues;
    filters: FiltersValues;
    'filter-settings': FiltersSettingValues;
    globals: GlobalsSettingValues;
    import: ImportSettingValues;
    jscodearea: JsCodeareaSettingValues;
    editorfield: EditorfieldSettingValues;
};

export type SettingKey<S extends SettingSubject = SettingSubject> = AppTarget & {
    subject: S;
    detail?: string | undefined;
};

type BehaviorSettingValues = Omit<BehaviorOptions, 'onLoadTarget'>;
type ColumnsSettingValues = ColumnsOptions;
export type ColumnsValues = Pick<
    Column,
    'name' | 'visible' | 'width' | 'format' | 'deletedTS'
>[];
type ExportSettingValues = ExportOptions;
type FiltersSettingValues = FiltersOptions;
type FiltersValues = Filter[];
type GlobalsSettingValues = GlobalSettings;
type ImportSettingValues = ImportOptions;
type JsCodeareaSettingValues = JsCodeareaConfigValues;
type EditorfieldSettingValues = FieldSettings;

export type GlobalSettings = ApplicationOptions & {
    hiddenMessages: Map<string, HideableMessageType[]>;
    lastUpdateInfo: string;
    onLoadTargets: Map<string, AppTarget>;
    window: AppWindowSettings;
};

export type SerializedGlobalSettings = Omit<
    GlobalSettings,
    'hiddenMessages' | 'onLoadTargets'
> & {
    hiddenMessages: [string, HideableMessageType[]][];
    onLoadTargets: [string, AppTarget][];
};

export type SerializedSettingValues =
    | Exclude<SettingValues, GlobalsSettingValues>
    | SerializedGlobalSettings;

export type HideableMessageType = 'noCodeExecution' | 'incompleteQueryResult';

export type AppWindowSettings = {
    top: string;
    left: string;
    width: string;
    height: string;
    maximized: boolean;
};
