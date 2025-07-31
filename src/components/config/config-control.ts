/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, TemplateResult } from 'lit-html';
import { nothing } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import ApplicationConfig from './application-config.ts';
import BehaviorConfig from './behavior-config.ts';
import ColumnsConfig from './columns-config.ts';
import ExportConfig from './export-config.ts';
import FiltersConfig from './filters-config.ts';
import ImportConfig from './import-config.ts';
import type { ConfigActor, ConfigRealm, RealmOptions } from './types.ts';
import configLayer from '../configlayer.ts';
import messenger from '../../lib/messenger.ts';
import tooltip from '../tooltip.ts';
import appStore from '../../lib/app-store.ts';
import {
    type AppTarget,
    globalTarget,
    isGlobal,
    isDatabase,
    isTable,
} from '../../lib/app-target.ts';
import svgIcon from '../../lib/svgicon.ts';
import { hasIntersection } from '../../lib/utils.ts';

interface ConfigControlState {
    target: AppTarget;
    realm: ConfigRealm;
    actor: ConfigActor;
    remembered: Map<string, RealmOptions>;
    hasChanged: Set<ConfigRealm>;
}
type ConfigLevel = 'global' | 'database' | 'table';

const state = Symbol('config-control state');

export const ConfigControl = class {
    [state]: ConfigControlState;
    #node?: HTMLElement;
    constructor() {
        this[state] = {
            target: globalTarget,
            realm: 'application',
            actor: {} as ConfigActor,
            remembered: new Map(),
            hasChanged: new Set(),
        };
    }
    async summon({
        target,
        realm,
        anchorId,
    }: {
        target: AppTarget;
        realm: ConfigRealm;
        anchorId: string;
    }) {
        this[state] = { ...this[state], target, realm };
        this[state].actor = (await this.activateActor(realm)) as ConfigActor;
        configLayer.show({
            view: this.node.bind(this),
            buttons: this.layerButtons(),
            anchorId,
            keepMinimumTop: true,
        });
        this.adjustLayerButtons();
    }
    get isGlobal() {
        return isGlobal(this[state].target);
    }
    get isDatabase() {
        return isDatabase(this[state].target);
    }
    get isTable() {
        return isTable(this[state].target);
    }
    get target() {
        return this[state].target;
    }
    get appTarget() {
        return appStore.target();
    }
    get realm() {
        return this[state].realm;
    }
    get realmKey() {
        return JSON.stringify({ ...this.target, realm: this.realm });
    }
    get actor() {
        return this[state].actor;
    }
    remember(settings: RealmOptions) {
        if (!this.remembered.has(this.realmKey)) {
            this.remembered.set(this.realmKey, settings);
        }
    }
    get remembered() {
        return this[state].remembered;
    }
    get rememberedSettings() {
        return this.remembered.get(this.realmKey);
    }
    get realms() {
        const realms = CONFIG_REALMS;
        return this.isGlobal ? realms : realms.toSpliced(0, 1);
    }
    async activateActor(realm: ConfigRealm) {
        if (this.actors[realm]) {
            return await this.actors[realm].activate(this);
        }
    }
    actors = {
        application: ApplicationConfig,
        behavior: BehaviorConfig,
        columns: ColumnsConfig,
        filters: FiltersConfig,
        import: ImportConfig,
        export: ExportConfig,
    } as const;
    isChanged(realm: ConfigRealm) {
        return this[state].hasChanged.has(realm);
    }
    layerButtons() {
        return [
            {
                label: 'reset to defaults',
                handler: this.setDefaultsHandler.bind(this),
            },
            {
                label: 'undo changes',
                handler: this.undoChangesHandler.bind(this),
            },
            {
                label: 'ready',
                handler: this.closeHandler.bind(this),
                isClose: true,
            },
        ];
    }
    layerButtonNodes() {
        const layerNode = configLayer.getNode();
        return (
            layerNode
                ? Array.from(layerNode.querySelectorAll('div.button-wrapper button'))
                : []
        ) as HTMLButtonElement[];
    }
    adjustLayerButtons() {
        const buttons = this.layerButtonNodes();
        const noActor = !this[state].actor;
        if (buttons.length === 3) {
            buttons[0].disabled = noActor || this[state].actor.isDefault() === true;
            buttons[1].disabled = noActor || this[state].actor.isChanged() === false;
        }
    }
    setDefaultsHandler() {
        this[state].actor.setDefaults();
    }
    undoChangesHandler() {
        this[state].actor.undoChanges();
    }
    closeHandler() {
        this.layerButtonNodes().map((button) => (button.disabled = false));
        if (this[state].actor.isChanged()) {
            this[state].hasChanged.add(this.realm);
        }
        if (this.isChanged('application') && isGlobal(this.appTarget)) {
            messenger.post({ type: 'reloadOrigin' });
        }
        if (this.isChanged('behavior')) {
            messenger.post({ type: 'refreshMessagestack' });
            if (isTable(this.appTarget)) {
                messenger.post({ type: 'refreshCodearea' });
            }
        }
        const tableRealms = new Set(['behavior', 'columns', 'filters']);
        if (
            hasIntersection(this[state].hasChanged, tableRealms) &&
            isTable(this.appTarget)
        ) {
            messenger.post({ type: 'refreshDatatable' });
        }
        if (this.isChanged('import')) {
            messenger.post({ type: 'refreshImporter' });
        }
        if (this.isChanged('export')) {
            messenger.post({ type: 'refreshExporter' });
        }
        lastRealm = this[state].realm;
    }
    node() {
        return html`
            <div id="config-control" ${ref(this.nodeReady.bind(this))}></div>
        `;
    }
    nodeReady(node?: Element) {
        if (node) {
            this.#node = node as HTMLElement;
            this.render();
        }
    }
    render() {
        if (this.#node) {
            render(this.view(), this.#node);
            this.adjustLayerButtons();
            configLayer.fixPosition();
        }
    }
    view() {
        return html`
            ${this.headlineView()} ${this.realmTabsView()} ${this.realmView()}
        `;
    }
    realmTabsView() {
        const tabs = this.realms.map((realm) => {
            const className = realm === this[state].realm ? 'active-realm' : null;
            return html`
                <li data-realm=${realm} class=${className || nothing}>${realm}</li>
            `;
        });
        return html`
            <ul class="tabs-nav" @click=${this.realmTabClicked.bind(this)}>
                ${tabs}
            </ul>
        `;
    }
    headlineView() {
        const realm = this[state].realm;
        const switchIcon =
            appStore.isGlobal || (this.isTable && !isTable(this.appTarget))
                ? ''
                : svgIcon('tabler-square-rounded-chevron-down', {
                      '@mouseover': this.switchMouseOver.bind(this),
                  });
        let headline: TemplateResult;
        if (realm === 'application') {
            headline = html`
                Application settings of Kahuna, the IndexedDB-Manager
            `;
        } else if (this.isGlobal) {
            headline = html`
                Global settings, used as defaults for all databases and tables
            `;
        } else if (this.isDatabase) {
            headline = html`
                Settings for database
                <i>${this[state].target.database}</i>
                and the default settings for included tables
            `;
        } else {
            headline = html`
                Settings for table
                <i>${this[state].target.table}</i>
                in database
                <i>${this[state].target.database}</i>
            `;
        }
        return html`
            <h1 class="precis">${headline}${switchIcon}</h1>
        `;
    }
    realmView() {
        const realmView = this[state].actor.view.bind(this[state].actor);
        return html`<form id=config-form>${realmView()}</form)`;
    }
    async realmTabClicked(event: Event) {
        const target = event.target as HTMLElement;
        const realm = target.closest('li')?.dataset.realm as ConfigRealm;
        if (CONFIG_REALMS.includes(realm)) {
            if (this[state].actor && this[state].actor.isChanged()) {
                this[state].hasChanged.add(this.realm);
            }
            this[state].realm = realm;
            this[state].actor = (await this.activateActor(realm)) as ConfigActor;
            this.render();
        }
    }
    switchMouseOver(event: Event) {
        const target = event.target as HTMLElement;
        tooltip.show({
            view: this.switchTooltipView.bind(this),
            anchor: target.closest('svg'),
        });
    }
    switchTooltipView() {
        const { database, table } = this.appTarget;
        const switchTargets = [];
        if (!this.isGlobal) {
            switchTargets.push(
                this.switchTargetView('global', 'application and defaults'),
            );
        }
        if (!this.isDatabase && database !== '*') {
            switchTargets.push(this.switchTargetView('database', database));
        }
        if (!this.isTable && table !== '*') {
            switchTargets.push(this.switchTargetView('table', table));
        }
        return html`
            switch to settings for
            <ul>
                ${switchTargets}
            </ul>
        `;
    }
    switchTargetView(level: ConfigLevel, name: string) {
        return html`
            <li>
                ${level}
                <em>
                    <a @click=${this.switchTargetClicked.bind(this, level)}>${name}</a>
                </em>
            </li>
        `;
    }
    async switchTargetClicked(level: ConfigLevel) {
        let target;
        if (level === 'global') {
            target = { database: '*', table: '*' };
        } else {
            target = appStore.target();
            if (level === 'database') {
                target.table = '*';
            }
            if (this[state].realm === 'application') {
                this[state].realm = 'behavior';
            }
        }
        this[state].target = target;
        this[state].actor = (await this.activateActor(this[state].realm)) as ConfigActor;
        tooltip.close();
        this.render();
    }
};

export const CONFIG_REALMS = [
    'application',
    'behavior',
    'columns',
    'filters',
    'import',
    'export',
] as const;

let lastRealm: ConfigRealm = 'behavior'; // changed by closeHandler

const displayConfigControl = async ({
    target,
    anchorId,
    realm,
}: {
    target: AppTarget;
    anchorId: string;
    realm?: ConfigRealm;
}) => {
    const configControl = new ConfigControl();
    if (!realm) {
        realm = !isGlobal(target) && lastRealm === 'application' ? 'behavior' : lastRealm;
    }
    await configControl.summon({ target, realm, anchorId });
};

export default displayConfigControl;
