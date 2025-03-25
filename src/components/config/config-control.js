/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import { nothing } from 'lit-html';
import { ref } from 'lit/directives/ref.js';
import ApplicationConfig from './application-config.js';
import BehaviorConfig from './behavior-config.js';
import ColumnsConfig from './columns-config.js';
import ExportConfig from './export-config.js';
import FiltersConfig from './filters-config.js';
import ImportConfig from './import-config.js';
import configLayer from '../configlayer.js';
import messenger from '../../lib/messenger.js';
import tooltip from '../tooltip.js';
import appStore from '../../lib/app-store.js';
import svgIcon from '../../lib/svgicon.js';
import { isGlobal, isDatabase, isTable } from '../../lib/utils.js';

const state = Symbol('config-control state');

const ConfigControl = class {
    #node;
    constructor() {
        this[state] = {
            target: { database: '*', table: '*' },
            realm: 'application',
            actor: null,
            remembered: new Map(),
            hasChanged: new Set(),
        };
    }
    async summon({ target, realm, anchorId }) {
        this[state] = { ...this[state], target, realm };
        this[state].actor = await this.activateActor(realm, true);
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
    remember(settings) {
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
        const realms = [
            'application',
            'behavior',
            'columns',
            'filters',
            'import',
            'export',
        ];
        return this.isGlobal ? realms : realms.toSpliced(0, 1);
    }
    async activateActor(realm) {
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
    };
    isChanged(realm) {
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
        return Array.from(configLayer.node.querySelectorAll('div.button-wrapper button'));
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
        }
        const tableRealms = new Set(['behavior', 'columns', 'filters']);
        if (
            this[state].hasChanged.intersection(tableRealms).size > 0 &&
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
    nodeReady(node) {
        if (node) {
            this.#node = node;
            this.render();
        }
    }
    render() {
        render(this.view(), this.#node);
        this.adjustLayerButtons();
        configLayer.fixPosition();
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
        let headline = '';
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
        if (this[state].actor) {
            const realmView = this[state].actor.view.bind(this[state].actor);
            return html`<form id=config-form>${realmView()}</form)`;
        } else {
            return html`
                <div class="lonely">
                    actor for ${this[state].realm} is not yet implemented
                </div>
            `;
        }
    }
    async realmTabClicked(event) {
        const realm = event.target.closest('li')?.dataset.realm;
        if (realm) {
            if (this[state].actor && this[state].actor.isChanged()) {
                this[state].hasChanged.add(this.realm);
            }
            this[state].realm = realm;
            this[state].actor = await this.activateActor(realm);
            this.render();
        }
    }
    switchMouseOver(event) {
        tooltip.show({
            view: this.switchTooltipView.bind(this),
            anchor: event.target.closest('svg'),
        });
    }
    switchTooltipView() {
        const appTarget = this.appTarget;
        const switchTargets = [];
        if (!this.isGlobal) {
            switchTargets.push(
                this.switchTargetView('global', 'application and defaults'),
            );
        }
        if (!this.isDatabase && appTarget.database !== '*') {
            switchTargets.push(this.switchTargetView('database', appTarget.database));
        }
        if (!this.isTable && appTarget.table !== '*') {
            switchTargets.push(this.switchTargetView('table', appTarget.table));
        }
        return html`
            switch to settings for
            <ul>
                ${switchTargets}
            </ul>
        `;
    }
    switchTargetView(type, name) {
        return html`
            <li>
                ${type}
                <em>
                    <a @click=${this.switchTargetClicked.bind(this, type)}>${name}</a>
                </em>
            </li>
        `;
    }
    async switchTargetClicked(type) {
        let target;
        if (type === 'global') {
            target = { database: '*', table: '*' };
        } else {
            target = appStore.target();
            if (type === 'database') {
                target.table = '*';
            }
            if (this[state].realm === 'application') {
                this[state].realm = 'behavior';
            }
        }
        this[state].target = target;
        this[state].actor = await this.activateActor(this[state].realm);
        tooltip.hide();
        this.render();
    }
};

let lastRealm = 'behavior'; // changed by closeHandler

const displayConfigControl = async ({ target, realm, anchorId }) => {
    const configControl = new ConfigControl();
    if (!realm) {
        realm = !isGlobal(target) && lastRealm === 'application' ? 'behavior' : lastRealm;
    }
    await configControl.summon({ target, realm, anchorId });
};

export default displayConfigControl;
