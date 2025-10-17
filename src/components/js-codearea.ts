/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { spread } from '@open-wc/lit-helpers';

import ChevronNavigation from './chevron-navigation.ts';
import messageStack from './messagestack.ts';
import BehaviorConfig from './config/behavior-config.ts';
import JsCodeareaConfig, {
    type JsCodeareaConfigValues,
} from './config/jscodearea-config.ts';
import appStore from '../lib/app-store.ts';
import appWorker from '../lib/app-worker.ts';
import { button, symbolButton } from '../lib/button.ts';
import env from '../lib/environment.ts';
import executeCode from '../lib/execute-code.ts';
import messenger from '../lib/messenger.ts';
import settings from '../lib/settings.ts';
import svgIcon from '../lib/svgicon.ts';
import { type AppTarget } from '../lib/app-target.ts';
import { Message } from '../lib/types/messages.ts';
import { type SettingSubject } from '../lib/types/settings.ts';
import { ExecutionMethod, PlainObject } from '../lib/types/common.ts';

interface JsCodeareaState extends JsCodeareaConfigValues {
    enabled: boolean;
    code: string;
    placeholder: boolean;
    executionMethod: ExecutionMethod;
    saved: boolean;
}
interface JsCodeareaOptions {
    enabled: boolean;
    target: AppTarget;
    selectorFields: string[];
    executed: () => Promise<void>;
    requiredVariables: () => Promise<RequiredVariables>;
}
interface RequiredVariables {
    selected: Set<string | number>;
    row?: PlainObject;
}
const state = Symbol('JsCodearea state');

const JsCodearea = class {
    [state]: JsCodeareaState = this.initialState;
    #options?: Omit<JsCodeareaOptions, 'enabled'>;
    #textarea?: HTMLTextAreaElement;
    #saveIcon = createRef();
    #updateIcon = createRef();
    #forgetIcon?: HTMLElement; // set by ref callback this.forgetRendered()
    constructor() {
        messenger.register('codeExecuted', this.executed.bind(this));
        messenger.register('codeError', this.codeErrorMessage.bind(this));
        messenger.register('idxdbmCodeExecuted', this.executed.bind(this));
        messenger.register('refreshCodearea', this.refresh.bind(this));
    }
    async init(options: JsCodeareaOptions) {
        let enabled;
        ({ enabled = true, ...this.#options } = options);
        const { values } = await JsCodeareaConfig.getSettings(options.target);
        const code = values.savedIndex > -1 ? values.savedCode[values.savedIndex] : '';
        this[state] = {
            ...values,
            ...(await this.behaviorSettings()),
            enabled,
            code,
            saved: code.length > 0,
        };
    }
    get initialState(): JsCodeareaState {
        const executionMethod: ExecutionMethod = 'webworker';
        return Object.assign(
            {
                enabled: true,
                code: '',
                placeholder: true,
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
            throw Error('Unexpected error: textarea not yet initialized');
        }
        return this.#textarea;
    }
    get options() {
        if (this.#options === undefined) {
            throw Error('Unexpected error: textarea not yet initialized');
        }
        return this.#options;
    }
    disable() {
        this[state].enabled = false;
    }
    update(diff: Partial<JsCodeareaState>) {
        this[state] = { ...this[state], ...diff };
        settings.saveSettings(
            this[state],
            JsCodeareaConfig.getDefaults(),
            this.options.target,
            JsCodeareaConfig.subject as SettingSubject,
        );
        this.refreshIcons();
    }
    async refresh() {
        this.update({
            ...(await this.behaviorSettings()),
        });
    }
    async behaviorSettings() {
        const { codeareaPlaceholder, codeExecutionMethod, displayCodearea } = (
            await BehaviorConfig.getSettings(this.options.target)
        ).values;
        return {
            enabled: displayCodearea,
            executionMethod: codeExecutionMethod,
            placeholder: codeareaPlaceholder,
        };
    }
    view = () => {
        const { enabled, width, height, code } = this[state];
        if (enabled === false) {
            return '';
        }
        const executeButton = button({
            content: svgIcon('tabler-check'),
            '@click': this.execute.bind(this),
            title: 'execute javascript code',
        });
        const clearButton = button({
            content: svgIcon('tabler-x'),
            '@click': this.clear,
            title: 'clear textarea',
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
                    ${this.savedCodeControl()}
                    <div class="button-wrapper">${executeButton} ${clearButton}</div>
                </div>
            </div>
        `;
    };
    clearPlaceholder(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        target.placeholder = '';
    }
    setPlaceholder(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        target.placeholder = this.placeholder();
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
    textareaRendered = (node?: Element) => {
        if (node !== undefined) {
            this.#textarea = node as HTMLTextAreaElement;
            node.addEventListener('focus', () => {
                node.addEventListener('keyup', this.keyUp.bind(this));
            });
            node.addEventListener('blur', () => {
                node.removeEventListener('keyup', this.keyUp);
            });
        }
    };
    forgetRendered = (node?: Element) => {
        if (node !== undefined) {
            this.#forgetIcon = node as HTMLElement;
            this.refreshIcons();
        }
    };
    keyUp = () => {
        this[state].code = this.textarea.value;
        this.refreshIcons();
    };
    refreshIcons = () => {
        const { saved, savedIndex, savedCode, code } = this[state];
        const isEmpty = code.trim().length === 0;
        let hide = [];
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
        const saveIcon = this.#saveIcon.value as HTMLElement;
        saveIcon.style.display = hide.includes('save') ? 'none' : 'block';
        const updateIcon = this.#updateIcon.value as HTMLElement;
        updateIcon.style.display = hide.includes('update') ? 'none' : 'block';
        if (this.#forgetIcon) {
            this.#forgetIcon.style.display = hide.includes('forget') ? 'none' : 'block';
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
        appStore.rerender();
    };
    pointerUp = (event: Event) => {
        const target = event.target as HTMLElement;
        const { width, height } = target.style;
        const { width: w, height: h } = this[state];
        if (width !== w || height !== h) {
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
        appStore.rerender();
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
        appStore.rerender();
    };

    /**
     * onClick of execute button
     */
    execute = async () => {
        const options = this.options;
        const code = this.textarea.value;
        this.update({ code });
        this.startLoading();
        const { selected, row } = await options.requiredVariables();
        const load = {
            code,
            selected,
            selectorFields: options.selectorFields,
            row,
            ...options.target,
        };
        const executionMethod = this.executionMethod();
        if (executionMethod === 'webworker') {
            messenger.post({ type: 'executeCode', load });
        } else if (executionMethod === 'unsafeEval') {
            try {
                await executeCode(load);
            } catch (error) {
                this.codeError(error as Error);
            }
            this.executed();
        } else if (executionMethod === 'userscript') {
            messenger.post({ type: 'idxdbmExecuteCode', load });
        } else {
            this.codeError(Error('Sorry, no way to execute code.'));
        }
    };
    executionMethod() {
        const desiredMethod = this[state].executionMethod;
        const availableMethods = env.codeExecutionMethods;
        if (availableMethods.includes(desiredMethod)) {
            return desiredMethod;
        }
        return availableMethods.shift();
    }
    async abort() {
        if (env.workersBlocked === false) {
            await appWorker.restart();
        }
        this.stopLoading();
    }
    async executed() {
        await this.options.executed();
        this.stopLoading();
    }
    codeErrorMessage(msg: Message) {
        if (msg.type === 'codeError') {
            this.codeError(msg.error);
        }
    }
    codeError(error: Error) {
        this.stopLoading();
        messageStack.displayError(error.toString());
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
    stopLoading() {
        appStore.update(
            {
                loading: false,
                loadingMsg: '',
                loadingStop: null,
            },
            { loadTables: true },
        );
    }
};

const jsCodearea = new JsCodearea();

export default jsCodearea;
