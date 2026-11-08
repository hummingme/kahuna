/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';

import configLayer from '#components/configlayer';
import jsCodearea from '#components/js-codearea';
import { button } from '#components/parts/button';
import { pkToString } from '#lib/dexie-utils';
import { print } from '#lib/escape-string';
import { JsConsoleOptions } from '#types';

type JsConsoleState = JsConsoleOptions & {
    selectorFields: string[];
};

const state = Symbol('js-console state');

class JsConsole {
    [state]: JsConsoleState;
    constructor(args: JsConsoleOptions) {
        this[state] = { selectorFields: [], ...args };
    }
    async summon() {
        const {
            anchorId,
            user,
            target,
            selectorFields,
            requireVariables,
            executed,
            codeareaUpdate,
        } = this[state];
        await jsCodearea.init({
            user,
            target,
            selectorFields,
            requireVariables,
            executed,
            closeButton: button({
                content: 'close',
                '@click': () => configLayer.close(),
                title: 'close',
            }),
        });
        if (codeareaUpdate) {
            jsCodearea.update(codeareaUpdate);
        }
        configLayer.show({
            anchorId,
            view: this.view.bind(this),
            hideButtons: true,
        });
        configLayer.makeDraggable();
    }
    view() {
        return html`
            <div id="js-console">
                <h1 class="precis">${this.headline()}</h1>
                ${jsCodearea.node()}
            </div>
        `;
    }
    headline() {
        const { target, user, selectorFields, rowSelector } = this[state];
        switch (user) {
            case 'origin':
                return html`
                    JavaScript Console for origin:
                    <em>${location.origin}</em>
                `;
            case 'database':
                return html`
                    JavaScript Console for database:
                    <em>${print(target.database)}</em>
                `;
            case 'datatable':
                return html`
                    JavaScript Console for table:
                    <em>${print(target.table)}</em>
                `;
            case 'editRow':
                return rowSelector
                    ? html`
                          Edit row for primary key:
                          <em>${pkToString(selectorFields, rowSelector)}</em>
                      `
                    : '';
            default:
                return '';
        }
    }
}
function displayJsConsole(args: JsConsoleOptions) {
    new JsConsole(args).summon();
}

export default displayJsConsole;
