/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, nothing, render } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { spread } from '@open-wc/lit-helpers';

import ChevronNavigation from '#components/chevron-navigation';
import messageStack from '#components/messagestack';
import BehaviorConfig from '#components/config/behavior-config';
import JsCodeareaConfig from '#components/config/jscodearea-config';
import { button, symbolButton } from '#components/parts/button';
import appStore from '#lib/app-store';
import appWorker from '#lib/app-worker';
import { decodeValue } from '#lib/data-wrapper';
import env from '#lib/environment';
import { executeCode } from '#lib/execute-code';
import messenger from '#lib/messenger';
import settings from '#lib/settings';
import type {
    ExecutionMethod,
    JsCodeareaOptions,
    JsCodeareaState,
    JsCodeareaUser,
    Message,
} from '#types';

const state = Symbol('JsCodearea state');

export const JsCodearea = class {
    [state]: JsCodeareaState = this.initialState;
    #options?: Omit<JsCodeareaOptions, 'user'>;
    #node?: HTMLElement;
    #textarea?: HTMLTextAreaElement;
    #saveIcon = createRef();
    #updateIcon = createRef();
    #forgetIcon?: HTMLElement; // set by ref callback this.forgetRendered()
    #boundCodeExecuted;
    #boundCodeErrorMessage;
    #boundRefresh;
    constructor() {
        this.#boundCodeExecuted = this.codeExecuted.bind(this);
        this.#boundCodeErrorMessage = this.codeErrorMessage.bind(this);
        this.#boundRefresh = this.refresh.bind(this);
        this.manageMessageHandler('register');
    }
    shutdown() {
        this.manageMessageHandler('unregister');
    }
    manageMessageHandler(action: 'register' | 'unregister') {
        messenger[action]('codeExecuted', this.#boundCodeExecuted);
        messenger[action]('idxdbmCodeExecuted', this.#boundCodeExecuted);
        messenger[action]('codeError', this.#boundCodeErrorMessage);
        messenger[action]('refreshCodearea', this.#boundRefresh);
    }
    async init(options: JsCodeareaOptions) {
        let user;
        ({ user, ...this.#options } = options);
        const { values } = await JsCodeareaConfig.getSettings(
            options.target,
            options.detail,
        );
        const code = values.savedIndex > -1 ? values.savedCode[values.savedIndex] : '';
        this[state] = {
            ...values,
            ...(await this.behaviorSettings()),
            user,
            code,
            saved: code.length > 0,
        };
    }
    get initialState(): JsCodeareaState {
        const executionMethod: ExecutionMethod = 'webworker';
        const user: JsCodeareaUser = 'datatable';
        return Object.assign(
            {
                user,
                code: '',
                executionMethod,
                saved: false,
            },
            JsCodeareaConfig.getDefaults(),
        );
    }
    get state() {
        return this[state];
    }
    get textarea() {
        if (this.#textarea === undefined) {
            throw Error('Unexpected error1: textarea not yet initialized');
        }
        return this.#textarea;
    }
    get options() {
        if (this.#options === undefined) {
            throw Error('Unexpected error2: JsCodearea not yet initialized');
        }
        return this.#options;
    }
    updateOptions(update: Partial<JsCodeareaOptions>) {
        this.#options = { ...this.options, ...update };
    }
    update(diff: Partial<JsCodeareaState>) {
        this[state] = { ...this[state], ...diff };
        const { detail, target } = this.options;
        settings.saveSettings(
            this[state],
            JsCodeareaConfig.getDefaults(detail),
            target,
            JsCodeareaConfig.subject,
            detail,
        );
        this.refreshIcons();
    }
    async refresh() {
        if (!this.#options) return;
        this.update({
            ...(await this.behaviorSettings()),
        });
    }
    async behaviorSettings() {
        const { codeExecutionMethod } = (
            await BehaviorConfig.getSettings(this.options.target)
        ).values;
        return {
            executionMethod: codeExecutionMethod,
        };
    }
    node() {
        return html`
            <div id="js-codearea-wrapper" ${ref(this.nodeReady.bind(this))}></div>
        `;
    }
    nodeReady(node?: Element) {
        if (node instanceof HTMLElement) {
            this.#node = node;
            this.render();
        }
    }
    render() {
        if (this.#node) {
            render(this.view(), this.#node);
        }
    }
    view = () => {
        const { width, height, code } = this[state];
        const closeButton = this.#options?.closeButton ?? nothing;
        const executeButton = button({
            content: 'execute',
            '@click': this.execute,
            title: 'execute javascript code',
        });
        const clearButton = button({
            content: 'clear',
            '@click': this.clear,
            title: 'clear textarea',
        });
        const placeholder = this.placeholder();
        const attributes = {
            id: 'js-codearea',
            spellcheck: false,
            '.value': code,
            '@pointerup': this.pointerUp.bind(this),
            '@focus': this.clearPlaceholder,
            '@blur': this.setPlaceholder.bind(this),
            '@input': this.input.bind(this),
            ...(placeholder ? { placeholder } : null),
        };
        const styles = width && height ? styleMap({ width, height }) : null;
        return html`
            <textarea
                ${ref(this.textareaRendered)}
                style=${styles}
                ${spread(attributes)}
            ></textarea>
            <div id="codearea-nav">
                ${this.savedCodeControl()}
                <div class="button-wrapper">
                    ${closeButton} ${clearButton} ${executeButton}
                </div>
            </div>
        `;
    };
    clearPlaceholder(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        target.removeAttribute('placeholder');
    }
    setPlaceholder(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        const placeholder = this.placeholder();
        if (placeholder) {
            target.setAttribute('placeholder', placeholder);
        }
    }
    placeholder() {
        const { code, user } = this[state];
        if (code) {
            return '';
        }
        const { database, table } = appStore.target();

        const lines = ['/* available predefined objects', ' *   Dexie : Dexie instance'];

        if (user !== 'origin') {
            lines.push(` *   db : Dexie database connection for ${database}`);
        }
        if (user !== 'origin' && user !== 'database') {
            lines.push(
                ` *   table : Dexie table instance of ${table}`,
                ' *   selection : Dexie collection instance of selected rows',
            );
        }
        if (user === 'editRow' || user === 'editValue') {
            lines.push(' *   row : data row that is being edited');
            if (user === 'editValue') {
                lines.push(
                    ' *   value : data value that is being edited',
                    ' *',
                    ' *   -> return the new field value',
                );
            }
        }
        lines.push(' */');
        return lines.join('\n');
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
    textareaRendered = (node?: Element) => {
        if (node instanceof HTMLTextAreaElement) {
            this.#textarea = node;
            requestAnimationFrame(() => node.focus());
        }
    };
    forgetRendered = (node?: Element) => {
        if (node !== undefined) {
            this.#forgetIcon = node as HTMLElement;
            this.refreshIcons();
        }
    };
    input = () => {
        this[state].code = this.textarea.value;
        this.refreshIcons();
    };
    refreshIcons = () => {
        const { saved, savedIndex, savedCode, code } = this[state];
        const isEmpty = code.trim().length === 0;
        let hide: ('save' | 'update' | 'forget')[];
        if (isEmpty) {
            hide = saved ? ['save', 'update'] : ['save', 'update', 'forget'];
        } else if (saved === true) {
            hide = code !== savedCode[savedIndex] ? [] : ['save', 'update'];
        } else {
            hide = ['update', 'forget'];
        }
        this.hideIcons(hide);
    };
    hideIcons = (hide: string[]) => {
        const saveIcon = this.#saveIcon.value;
        const updateIcon = this.#updateIcon.value;
        if (saveIcon instanceof HTMLElement && updateIcon instanceof HTMLElement) {
            saveIcon.style.display = hide.includes('save') ? 'none' : 'block';
            updateIcon.style.display = hide.includes('update') ? 'none' : 'block';
            if (this.#forgetIcon) {
                this.#forgetIcon.style.display = hide.includes('forget')
                    ? 'none'
                    : 'block';
            }
        }
    };
    chevronPosInfo = ({ offset, total }: { offset: number; total: number }) => {
        const unsaved = '<div title="unsaved code" class=u-indicator>u</div> ';
        return html`
            ${offset === 0 ? unsafeHTML(unsaved) : offset} (${total - 1})
        `;
    };
    chevronNavigate = (to: number) => {
        if (to === 0) {
            this.update({
                saved: false,
                savedIndex: -1,
                code: '',
            });
        } else {
            const idx = to - 1;
            const code = this[state].savedCode[to - 1];
            this.textarea.value = code;
            this.update({
                saved: true,
                savedIndex: idx,
                code,
            });
        }
        this.render();
    };
    pointerUp = (event: Event) => {
        const target = event.target as HTMLElement;
        const { width, height } = target.style;
        const { width: oldWidth, height: oldHeight } = this[state];
        if (width !== oldWidth || height !== oldHeight) {
            this.update({ width, height });
        }
    };
    rememberClicked = () => {
        const code = this.textarea.value;
        if (code.trim().length === 0) {
            return;
        }
        const savedCode = this[state].savedCode;
        const index = savedCode.findIndex((c) => c === code);
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
        this.render();
    };
    updateClicked = () => {
        const code = this.textarea.value;
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
        this.render();
    };

    /**
     * onClick of execute button
     */
    execute = async () => {
        const { target, selectorFields, requireVariables } = this.options;
        const code = this.textarea.value;
        this.update({ code });
        this.startLoading();
        const { selected, row, value } = requireVariables();
        const load = {
            code,
            target,
            selectorFields,
            selected,
            row,
            value,
            user: this[state].user,
            encodeResult: env.bigIntArrayFlaw === true,
        };
        const executionMethod = env.executionMethod(this[state].executionMethod);
        if (executionMethod === 'webworker') {
            messenger.post({ type: 'executeCode', load });
        } else if (executionMethod === 'unsafeEval') {
            try {
                const result = await executeCode(load);
                this.executed(result);
            } catch (error) {
                this.codeError(error as Error);
            }
        } else if (executionMethod === 'userscript') {
            messenger.post({ type: 'idxdbmExecuteCode', load });
        } else {
            this.codeError(Error('Sorry, no way to execute code.'));
        }
    };
    async abort() {
        if (env.workersBlocked === false) {
            await appWorker.restart();
        }
        this.stopLoading();
    }
    codeExecuted(message: Message) {
        if (
            (message.type === 'codeExecuted' || message.type === 'idxdbmCodeExecuted') &&
            message.user === this[state].user
        ) {
            this.executed(decodeValue(message.result));
        }
    }
    async executed(result: unknown) {
        await this.stopLoading();
        this.options.executed(result);
    }
    codeErrorMessage(msg: Message) {
        if (msg.type === 'codeError') {
            this.codeError(msg.error);
        }
    }
    codeError(error: Error) {
        this.stopLoading();
        const message = error.message.split('\n').shift();
        messageStack.displayError(`${error.name}: ${message}`);
    }
    clear = () => {
        this[state].code = '';
        this.textarea.value = '';
        this.textarea.focus();
        this.refreshIcons();
    };
    startLoading() {
        appStore.update({
            loading: true,
            loadingMsg: 'executing...',
            loadingStop: this.abort.bind(this),
        });
    }
    async stopLoading() {
        const loadTables = this[state].user === 'datatable';
        await appStore.update(
            {
                loading: false,
                loadingMsg: '',
                loadingStop: null,
            },
            { loadTables },
        );
    }
};

const jsCodearea = new JsCodearea();

export default jsCodearea;
