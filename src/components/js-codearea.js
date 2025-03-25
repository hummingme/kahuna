/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { spread } from '@open-wc/lit-helpers';

import ChevronNavigation from './chevron-navigation.js';
import messageStack from './messagestack.js';
import BehaviorConfig from './config/behavior-config.js';
import JsCodeareaConfig from './config/jscodearea-config.js';
import appStore from '../lib/app-store.js';
import appWorker from '../lib/app-worker.js';
import { button, symbolButton } from '../lib/button.js';
import env from '../lib/environment.js';
import executeCode from '../lib/execute-code.js';
import messenger from '../lib/messenger.js';
import settings from '../lib/settings.js';
import svgIcon from '../lib/svgicon.js';

const state = Symbol('JsCodearea state');

const JsCodearea = class {
    #options;
    #job;
    #textarea = createRef();
    #saveIcon = createRef();
    #updateIcon = createRef();
    #forgetIcon; // set by ref callback this.forgetRendered()

    constructor() {
        messenger.register('codeExecuted', this.executed.bind(this));
        messenger.register('codeError', this.codeErrorMessage.bind(this));
        messenger.register('idxdbmCodeExecuted', this.executed.bind(this));
    }
    async init(options) {
        let enabled;
        ({ enabled = true, ...this.#options } = options);
        this.#job =
            Object.hasOwn(options, 'dbname') && options.dbname !== null
                ? 'schema'
                : 'code';
        const { values } = await JsCodeareaConfig.getSettings(this.#options.target);
        const code = values.savedIndex > -1 ? values.savedCode[values.savedIndex] : '';
        this[state] = {
            ...values,
            placeholder: await this.hasPlaceholder(),
            enabled,
            code,
            saved: false,
        };
    }
    get state() {
        return this[state];
    }
    disable() {
        this[state].enabled = false;
    }
    update(diff) {
        this[state] = { ...this[state], ...diff };
        settings.saveSettings(
            this[state],
            JsCodeareaConfig.getDefaults(),
            this.#options.target,
            JsCodeareaConfig.subject,
        );
        this.refreshIcons();
    }
    async refresh() {
        this[state].placeholder = await this.hasPlaceholder();
    }
    async hasPlaceholder() {
        const { codeareaPlaceholder } = (
            await BehaviorConfig.getSettings(this.#options.target)
        ).values;
        return codeareaPlaceholder;
    }
    view = () => {
        const { enabled, width, height, code } = this[state];
        if (enabled === false) {
            return '';
        }
        const savedCodeControl = this.#job === 'code' ? this.savedCodeControl() : '';
        const executeButton = button({
            content: svgIcon('tabler-check'),
            '@click': this.execute.bind(this),
            title: this.#job === 'code' ? 'execute javascript code' : 'modify schema',
        });
        const clearButton = button({
            content: svgIcon('tabler-x'),
            '@click': this.clear,
            title: this.#job === 'code' ? 'clear textarea' : 'cancel',
        });
        const attributes = {
            id: 'js-codearea',
            spellcheck: false,
            '.value': code,
            '@pointerup': this.pointerUp.bind(this),
            placeholder: this.placeholder(),
        };
        if (this[state].placeholder) {
            Object.assign(attributes, {
                '@focus': this.clearPlaceholder,
                '@blur': this.setPlaceholder.bind(this),
            });
        }
        return html`
            <div style="display: inline-block;">
                <textarea
                    ${ref(this.textareaRendered)}
                    style=${styleMap({ width, height })}
                    ${spread(attributes)}
                ></textarea>
                <div id="codearea-nav">
                    ${savedCodeControl}
                    <div class="button-wrapper">${executeButton} ${clearButton}</div>
                </div>
            </div>
        `;
    };
    clearPlaceholder(event) {
        event.target.placeholder = '';
    }
    setPlaceholder(event) {
        event.target.placeholder = this.placeholder();
    }
    placeholder() {
        const { database, table } = appStore.target();
        return this[state].placeholder && this[state].code === '' && table !== '*'
            ? `/* available global variables:
 *   db (Dexie database connection for ${database})
 *   table (Dexie table instance of ${table})
 *   selection (Dexie collection instance of selected rows, if any)
 */`
            : '';
    }
    savedCodeControl = () => {
        const { savedIndex, savedCode } = this[state];
        const chevronNavigation =
            savedCode.length > 0
                ? new ChevronNavigation({
                      offset: savedIndex === -1 ? 0 : savedIndex + 1,
                      step: 1,
                      min: 0,
                      max: savedCode.length,
                      sparse: true,
                      navigate: this.chevronNavigate,
                      posInfo: this.chevronPosInfo,
                  }).view()
                : '';
        const saveIcon = symbolButton({
            icon: 'tabler-stack-push',
            '@click': this.rememberClicked.bind(this),
            title: 'remember code',
            refVar: this.#saveIcon,
        });
        const updateIcon = symbolButton({
            icon: 'tabler-stack-middle',
            '@click': this.updateClicked.bind(this),
            title: 'update code',
            refVar: this.#updateIcon,
        });
        const forgetIcon = symbolButton({
            icon: 'tabler-stack-pop',
            '@click': this.forgetClicked.bind(this),
            title: 'forget code',
            refVar: this.forgetRendered,
        });
        return html`
            ${chevronNavigation} ${saveIcon} ${updateIcon} ${forgetIcon}
        `;
    };
    textareaRendered = (textarea) => {
        this.#textarea = textarea;
        if (textarea !== undefined) {
            textarea.addEventListener('focus', () => {
                textarea.addEventListener('keyup', this.keyUp.bind(this));
            });
            textarea.addEventListener('blur', () => {
                textarea.removeEventListener('keyup', this.keyUp);
            });
        }
    };
    forgetRendered = (icon) => {
        if (icon !== undefined) {
            this.#forgetIcon = icon;
            this.refreshIcons();
        }
    };
    keyUp = (_event) => {
        this[state].code = this.#textarea.value;
        this.refreshIcons();
    };
    refreshIcons = () => {
        if (this.#job === 'schema' || this.#saveIcon.value === undefined) {
            return;
        }
        const { saved, savedIndex, savedCode, code } = this[state];
        const isEmpty = code.trim().length === 0;
        let toHide = [];
        if (isEmpty) {
            toHide = saved ? ['save', 'update'] : ['save', 'update', 'forget'];
        } else if (saved === true) {
            toHide = code !== savedCode[savedIndex] ? [] : ['save', 'update'];
        } else {
            toHide = ['update', 'forget'];
        }
        this.hideIcons(toHide);
    };
    hideIcons = (names) => {
        this.#saveIcon.value.style.display = names.includes('save') ? 'none' : 'block';
        this.#updateIcon.value.style.display = names.includes('update')
            ? 'none'
            : 'block';
        this.#forgetIcon.style.display = names.includes('forget') ? 'none' : 'block';
    };
    chevronPosInfo = ({ offset, total }) => {
        const unsaved = '<div title="unsaved code" class=u-indicator>u</div> ';
        return html`
            ${offset === 0 ? unsafeHTML(unsaved) : offset} (${total - 1})
        `;
    };
    chevronNavigate = (to) => {
        if (to === 0) {
            this.update({
                saved: false,
                savedIndex: -1,
                code: '',
            });
        } else {
            const idx = to - 1;
            const code = this[state].savedCode[to - 1];
            this.#textarea.value = code;
            this.update({
                saved: true,
                savedIndex: idx,
                code,
            });
        }
        appStore.rerender();
    };
    pointerUp = (ev) => {
        const { width, height } = ev.target.style;
        const { width: w, height: h } = this[state];
        if (width !== w || height !== h) {
            this.update({ width, height });
        }
    };
    rememberClicked = () => {
        const code = this.#textarea.value;
        if (code.trim().length === 0) {
            return;
        }
        const savedCode = this[state].savedCode;
        let index = savedCode.findIndex((c) => c === code);
        if (index !== 0) {
            if (index !== -1) {
                savedCode.splice(index, 1);
            }
            savedCode.unshift(code);
            this.update({
                saved: true,
                savedIndex: 0,
                savedCode,
                code,
            });
        }
        appStore.rerender();
    };
    updateClicked = () => {
        const code = this.#textarea.value;
        if (code.trim().length === 0) {
            this.forgetClicked();
        }
        const { savedIndex, savedCode } = this[state];
        savedCode[savedIndex] = code;
        this.update({
            saved: true,
            savedCode,
            code,
        });
    };
    forgetClicked = () => {
        const { savedIndex, savedCode } = this[state];
        savedCode.splice(savedIndex, 1);
        this.update({
            saved: false,
            savedIndex: -1,
            savedCode,
            code: '',
        });
        appStore.rerender();
    };

    /**
     * onClick of execute button
     */
    execute = async () => {
        const options = this.#options;
        const code = this.#textarea.value;
        this.update({ code });
        this.startLoading();
        if (options.execute) {
            try {
                await options.execute(code);
                options.executed();
            } catch (error) {
                this.codeError(error);
            }
        } else {
            const vars = await options.exposedVariables();
            const varNames = [...Object.keys(vars)];
            const varsList = varNames.join(', ');
            const asyncCode =
                `async function f(${varsList}) { ${code}; };` + `return f(${varsList})`;
            const { selected, selectorFields } = options;
            const load = {
                asyncCode,
                varNames,
                selected,
                selectorFields,
                row: vars.row,
                ...options.target,
            };
            const accessDom = false; // env.permissions.includes('userScripts'); TODO, needs userScripts permisson
            if (env.workersBlocked === false || accessDom === true) {
                messenger.post({
                    type: accessDom ? 'idxdbmExecuteCode' : 'executeCode',
                    load,
                });
            } else if (env.unsafeEval === true) {
                try {
                    await executeCode(load);
                } catch (error) {
                    this.codeError(error);
                }
                this.executed();
            } else {
                this.codeError(Error('Sorry, no way to execute code.'));
            }
        }
    };
    async abort() {
        if (env.workersBlocked === false) {
            await appWorker.restart();
        }
        this.stopLoading();
    }
    async executed() {
        await this.#options.executed();
        this.stopLoading();
    }
    codeErrorMessage(msg) {
        this.codeError(msg.error);
    }
    codeError(error) {
        this.stopLoading();
        messageStack.displayError(error.toString());
    }
    clear = () => {
        this[state].code = '';
        this.#textarea.value = '';
        if (this.#job === 'schema') {
            this.#options.executed();
        } else {
            this.#textarea.focus();
            this.refreshIcons();
        }
    };
    startLoading() {
        appStore.update({
            loading: true,
            loadingMsg: 'executing...',
            loadingStop: this.abort.bind(this),
        });
    }
    stopLoading() {
        appStore.update({
            tables: true,
            loading: false,
            loadingMsg: '',
            loadingStop: null,
        });
    }
};

const jsCodearea = new JsCodearea();

export default jsCodearea;
