import { TemplateResult } from 'lit-html';
import { ConfigControl, CONFIG_REALMS } from './config-control.ts';
import applicationDefaultOptions from './application-defaults.ts';
import { exportDefaultOptions } from './export-config.ts';
import { behaviorDefaultOptions } from './behavior-config.ts';
import { columnsDefaultOptions } from './columns-config.ts';
import { filtersDefaultOptions } from './filters-config.ts';
import { importDefaultOptions } from './import-config.ts';
import { PlainObjectOf } from '../../lib/types/common.ts';

export type ControlInstance = InstanceType<typeof ConfigControl>;

export interface ConfigActor {
    view: () => TemplateResult;
    isDefault: () => boolean;
    isChanged: () => boolean;
    setDefaults: () => void;
    undoChanges: () => void;
}

export type ConfigRealm = (typeof CONFIG_REALMS)[number];

export type RealmOptions =
    | ApplicationOptions
    | BehaviorOptions
    | ColumnsOptions
    | ExportOptions
    | FiltersOptions
    | ImportOptions;
export type OptionKey = keyof RealmOptions;

export type AllOptions = ApplicationOptions &
    BehaviorOptions &
    ColumnsOptions &
    ExportOptions &
    FiltersOptions &
    ImportOptions;
export type OptionName = keyof AllOptions;

export interface Option {
    name: OptionName;
    label: string;
}
export interface SelectOption extends Option {
    options: PlainObjectOf<string>;
    selected?: string;
    '@change'?: (event: Event) => void;
}
export interface InputOption extends Option {
    size?: number;
    class?: string;
    '@change'?: (event: Event) => void;
}

export type ApplicationOptions = ReturnType<typeof applicationDefaultOptions>;
export type BehaviorOptions = ReturnType<typeof behaviorDefaultOptions>;
export type ColumnsOptions = ReturnType<typeof columnsDefaultOptions>;
export type FiltersOptions = ReturnType<typeof filtersDefaultOptions>;
export type ExportOptions = ReturnType<typeof exportDefaultOptions>;
export type ImportOptions = ReturnType<typeof importDefaultOptions>;
