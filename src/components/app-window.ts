/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render, TemplateResult } from 'lit-html';
import { ref, createRef, type Ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import About from './about.ts';
import configLayer from './configlayer.ts';
import { loadingPanel, type LoadingViewParams } from './loadingpanel.ts';
import mainMenu from './main-menu.ts';
import messageStack from './messagestack.ts';
import schemaEditor from './schema-editor.ts';
import tooltip from './tooltip.ts';
import UpdateInfo from './update-info.ts';
import appStore from '../lib/app-store.ts';
import { button } from '../lib/button.ts';
import env from '../lib/environment.ts';
import messenger from '../lib/messenger.ts';
import { extensionUrl } from '../lib/runtime.ts';
import { AppWindowSettings, settings } from '../lib/settings.ts';
import svgIcon from '../lib/svgicon.ts';
import { clamp, between, fetchFile, pickProperties } from '../lib/utils.ts';

interface AppWindowState {
    visible: boolean;
    dim: AppWindowSettings;
    dragging: boolean;
    resizing: boolean;
    start: ActionStart;
    moveHandler: ExternMoveHandler | null;
    keyHandler: ExternKeyHandler | null;
}
interface ActionStart {
    x: number;
    y: number;
    w: number;
    h: number;
    dims: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    direction: string;
}
interface Resizers {
    border: HTMLElement | null;
    bottom: HTMLElement | null;
    nesw: HTMLElement | null;
    nwse: HTMLElement | null;
}
interface ExternMoveHandler {
    isTarget: (event: MouseEvent) => boolean;
    start: (event: MouseEvent) => void;
    moving: (posX: number) => void;
    stop: (event: MouseEvent) => void;
}
interface ExternKeyHandler {
    down: (Event: KeyboardEvent) => void;
}

const AppWindow = class {
    #state: AppWindowState;
    #host: HTMLDivElement; // host node of application
    #root: ShadowRoot; // shadowRoot added to #host
    #winRef: Ref<HTMLDivElement> = createRef(); // own root node of this appwindow
    #overlayRef: Ref<HTMLDivElement> = createRef(); // node of application overlay
    #winOverlayRef: Ref<HTMLDivElement> = createRef(); // node of appwindow overlay
    #main: HTMLElement | null = null; // main stage inside of #win
    #resizers: Resizers = {
        // nodes of resize-handles
        border: null,
        bottom: null,
        nesw: null,
        nwse: null,
    };
    #bodyStyles = {
        // from document.body, save/restore when kahuna is shown/hidden
        overflow: '',
        userSelect: '',
    };
    constructor() {
        this.#state = this.initialState;
        this.#host = this.createHost();
        this.#root = this.#host.attachShadow({ mode: 'open' });
    }
    get initialState(): AppWindowState {
        return {
            visible: true,
            dim: {
                top: '0px',
                left: '0px',
                width: '0px',
                height: '0px',
                maximized: false,
            },
            dragging: false,
            resizing: false,
            start: this.initialActionStart,
            moveHandler: null, // external handler, used by datatable for column resizing
            keyHandler: null, // external handler, used by datatable for column ordering
        };
    }
    get initialActionStart(): ActionStart {
        return {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            dims: { left: 0, top: 0, width: 0, height: 0 },
            direction: '',
        };
    }
    init() {
        this.#state.dim = settings.global('window');
        fetchFile(extensionUrl('static/kahuna.css')).then((css) => {
            const style = document.createElement('style');
            style.innerText = css;
            this.#root.appendChild(style);
        });
        fetchFile(extensionUrl('static/icons.svg')).then((svg) => {
            const template = document.createElement('template');
            template.innerHTML = svg;
            const svgElement = Array.from(template.content.childNodes).find(
                (node) => node.nodeName === 'svg',
            );
            this.#root.appendChild(svgElement!);
        });
        messenger.register('toggleVisibility', this.toggleVisibility.bind(this));
        this.setColorScheme();
        this.setColors();
        this.render();
        this.show();
    }
    createHost() {
        const host = document.createElement('div');
        host.setAttribute('tabindex', '0');
        Object.assign(host.style, {
            display: 'block',
            position: 'fixed',
            top: '0px',
            left: '0px',
            width: '100vw',
            height: '100vh',
            zIndex: 2147483001,
        });
        document.querySelector('body')?.appendChild(host);
        return host;
    }
    setColors() {
        const colorScheme = this.#host.getAttribute('data-color-theme');
        const [colorString, colorNumber] =
            colorScheme === 'light'
                ? [
                      settings.global('colorStringLightmode'),
                      settings.global('colorNumberLightmode'),
                  ]
                : [
                      settings.global('colorStringDarkmode'),
                      settings.global('colorNumberDarkmode'),
                  ];
        this.#host.style.setProperty('--nice-colored-string', colorString);
        this.#host.style.setProperty('--nice-colored-number', colorNumber);
    }
    setColorScheme() {
        const colorSchemeOrigin = settings.global('colorSchemeOrigin');
        const colorScheme = settings.global('colorScheme');
        if (['dark', 'light'].includes(colorSchemeOrigin)) {
            this.#host.setAttribute('data-color-theme', colorSchemeOrigin);
        } else if (['dark', 'light'].includes(colorScheme)) {
            this.#host.setAttribute('data-color-theme', colorScheme);
        } else {
            this.#host.setAttribute('data-color-theme', env.preferedColorScheme);
        }
    }
    reset() {
        this.#state.dim = settings.global('window');
        this.setColorScheme();
    }
    #update(diff: Partial<AppWindowState>) {
        this.#state = { ...this.#state, ...diff };
    }
    get root() {
        return this.#root;
    }
    get win() {
        return this.#winRef.value as HTMLDivElement;
    }
    get main() {
        if (this.#main === null) {
            this.#main = this.#root.getElementById('main');
        }
        return this.#main;
    }
    get overlay() {
        return this.#overlayRef.value;
    }
    get winOverlay() {
        return this.#winOverlayRef.value;
    }
    render() {
        render(this.template(), this.#root);
        return this.win;
    }
    template() {
        const { top, left, width, height, maximized } = this.#state.dim;
        const transform = top !== '' ? 'translate(0, 0)' : null;
        const styles = maximized
            ? { width: '100%', height: '100%' }
            : { top, left, width, height, transform };
        const loadingParams = pickProperties(appStore.state, [
            'loading',
            'loadingMsg',
            'loadingStop',
        ]) as LoadingViewParams;
        return html`
            <div id="app">
                <div
                    id="overlay"
                    class="overlay-cover"
                    @click=${this.onClickOverlay}
                    ${ref(this.#overlayRef)}
                ></div>
                <div
                    id="window"
                    style=${styleMap(styles)}
                    @pointerdown=${this.onPointerDown}
                    ${ref(this.#winRef)}
                >
                    <div id="resize-border" ${ref(this.resizersReady.bind(this))}>
                        <div id="resize-cover"></div>
                        <div id="resize-nesw"></div>
                        <div id="resize-bottom"></div>
                        <div id="resize-nwse"></div>
                    </div>
                    ${messageStack.view()} ${loadingPanel.view(loadingParams)}
                    <div
                        id="window-overlay"
                        class="overlay-cover hidden"
                        ${ref(this.#winOverlayRef)}
                    ></div>
                </div>
                ${this.componentViews()}
            </div>
        `;
    }
    aboutView: TemplateResult | string = '';
    updateInfoView: TemplateResult | string = '';
    componentViews() {
        const { aboutVisible, updateInfoVisible } = appStore.state;
        if (aboutVisible === false) {
            this.aboutView = '';
        } else if (this.aboutView === '') {
            this.aboutView = new About().view();
        }
        if (updateInfoVisible === false) {
            this.updateInfoView = '';
        } else if (this.updateInfoView === '') {
            this.updateInfoView = new UpdateInfo().view();
        }
        return html`
            ${mainMenu.view()} ${this.aboutView} ${this.updateInfoView}
            ${schemaEditor.node()} ${configLayer.node()} ${tooltip.node()}
        `;
    }
    resizersReady(node?: Element) {
        if (node !== undefined) {
            const children = [...node.children];
            this.#resizers = {
                border: node as HTMLElement,
                bottom: children.find(
                    (node) => node.id === 'resize-bottom',
                ) as HTMLElement,
                nesw: children.find((node) => node.id === 'resize-nesw') as HTMLElement,
                nwse: children.find((node) => node.id === 'resize-nwse') as HTMLElement,
            };
        }
    }
    toggleVisibility() {
        if (this.visible()) {
            this.hide();
        } else {
            this.show();
        }
    }
    visible() {
        return this.#host.style.display === 'block';
    }
    show() {
        this.#bodyStyles.overflow = document.body.style.overflow;
        this.#bodyStyles.userSelect = document.body.style.userSelect;
        Object.assign(document.body.style, { overflow: 'hidden', userSelect: 'none' });
        this.#host.style.display = 'block';
        this.enableUserSelect();
        this.addInputHandler();
        this.#host.focus();
    }
    hide() {
        this.#host.style.display = 'none';
        this.removeInputHandler();
        Object.assign(document.body.style, this.#bodyStyles);
    }
    showOverlay(cursor?: string) {
        if (this.winOverlay) {
            this.winOverlay.classList.remove('hidden');
            if (cursor) {
                Object.assign(this.winOverlay.style, { cursor });
            }
        }
    }
    hideOverlay() {
        if (this.winOverlay) {
            this.winOverlay.classList.add('hidden');
            Object.assign(this.winOverlay.style, { cursor: 'auto' });
        }
    }
    get dims() {
        return this.win.getBoundingClientRect() as DOMRect;
    }
    get fontFamily() {
        return window.getComputedStyle(this.win).fontFamily;
    }
    set externMoveHandler(handler: ExternMoveHandler | null) {
        this.#state.moveHandler = handler;
    }
    set externKeyHandler(handler: ExternKeyHandler) {
        this.#state.keyHandler = handler;
    }
    setPointerHandlers(moving: boolean) {
        const func = moving ? 'addEventListener' : 'removeEventListener';
        [this.overlay, this.win].forEach((node) => {
            if (node) {
                node[func]('pointermove', this.onPointerMove, true);
                node[func]('pointerup', this.onPointerUp, true);
                node[func]('pointercancel', this.onPointerUp, true);
            }
        });
    }
    addInputHandler() {
        this.#host.addEventListener('keydown', this.onKeydown, false);
        this.#host.addEventListener('paste', this.onPaste, false);
    }
    removeInputHandler() {
        this.#host.removeEventListener('keydown', this.onKeydown, false);
        this.#host.removeEventListener('paste', this.onPaste, false);
    }
    onClickOverlay = () => {
        this.hide();
        this.#update({ visible: false });
    };
    onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.hide();
        }
        if (this.#state.keyHandler !== null) {
            this.#state.keyHandler.down(event);
        }
        event.stopPropagation();
    };
    onPointerDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const dragger = this.#root.querySelector('nav#menu > div');
        const dragging = target === dragger ? true : false;
        let resizing = false;
        let direction = '',
            cursor = 'initial';
        if (Object.values(this.#resizers).includes(target)) {
            resizing = true;
            [direction, cursor] = this.resizeDirection(target, event.clientX);
        }
        if (dragging || resizing) {
            const bbox = this.dims;
            const start = {
                // position of mouse on start
                x: event.clientX - bbox.left, // distance from left window border
                y: event.clientY - bbox.top, // distance from top window border
                w: event.clientX - bbox.width, // distance from right window border
                h: event.clientY - bbox.height, // distance from bottom
                dims: {
                    left: bbox.left,
                    top: bbox.top,
                    width: bbox.width,
                    height: bbox.height,
                },
                direction,
            };
            this.showOverlay(dragging ? 'move' : cursor);
            this.#update({ dragging, resizing, start });
            this.setPointerHandlers(true);
            this.disableUserSelect();
        }
        if (this.#state.moveHandler && this.#state.moveHandler.isTarget(event)) {
            this.#state.moveHandler.start(event);
            this.setPointerHandlers(true);
            this.disableUserSelect();
        }
    };
    onPointerMove = (event: Event) => {
        const { clientX, clientY } = event as MouseEvent;
        const state = { ...this.#state };
        if (state.dragging || state.resizing) {
            const start = state.start;
            const de = document.documentElement;
            const bbox = this.dims;
            let left = 0,
                top = 0,
                width = 0,
                height = 0;
            if (state.dragging === true) {
                left = clamp(clientX - start.x, -bbox.width + 100, de.clientWidth - 100);
                top = clamp(clientY - start.y, 0, de.clientHeight - 25);
                width = start.dims.width;
                height = start.dims.height;
            } else if (state.resizing === true) {
                ({ left, width, height } = start.dims);
                if (['left', 'nesw'].includes(start.direction)) {
                    left = clamp(clientX - start.x, 0, bbox.right - 150);
                    width = width + start.dims.left - left - 2;
                }
                if (['right', 'nwse'].includes(start.direction)) {
                    width = clamp(clientX - start.w, 150, de.clientWidth - bbox.left) - 2;
                }
                if (['down', 'nesw', 'nwse'].includes(start.direction)) {
                    height =
                        clamp(clientY - start.h, 110, de.clientHeight - bbox.top) - 2;
                }
                top = start.dims.top;
            }
            const winStyles = {
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
            };
            Object.assign(this.win.style, winStyles, { transform: 'translate(0, 0)' });
            this.#update({
                dim: { ...winStyles, maximized: false },
            });
            loadingPanel.adjustPosition();
            messageStack.adjustPosition();
        } else if (state.moveHandler) {
            state.moveHandler.moving(clientX);
        }
    };
    onPointerUp = (event: Event) => {
        this.hideOverlay();
        this.enableUserSelect();
        this.setPointerHandlers(false);
        this.#update({
            dragging: false,
            resizing: false,
            start: this.initialActionStart,
        });
        if (
            this.#state.moveHandler &&
            this.#state.moveHandler.isTarget(event as MouseEvent)
        ) {
            this.#state.moveHandler.stop(event as MouseEvent);
        } else {
            settings.saveGlobals({ window: this.#state.dim });
        }
    };
    resizeDirection(node: Node, xpos: number): [string, string] {
        switch (node) {
            case this.#resizers.border:
                {
                    const dims = this.dims;
                    if (between(xpos, dims.left, dims.left + 4)) {
                        return ['left', 'ew-resize'];
                    }
                    if (between(xpos, dims.right - 4, dims.right)) {
                        return ['right', 'ew-resize'];
                    }
                }
                break;
            case this.#resizers.bottom:
                return ['down', 'ns-resize'];
            case this.#resizers.nesw:
                return ['nesw', 'sw-resize'];
            case this.#resizers.nwse:
                return ['nwse', 'se-resize'];
        }
        return ['', 'initial'];
    }
    onPaste(event: ClipboardEvent) {
        event.stopPropagation();
    }
    maximizeButton() {
        const icon = svgIcon('tabler-maximize', {
            width: 14,
            height: 14,
            id: 'window-maximize',
            'aria-hidden': true,
        });
        const title = this.#state.dim.maximized
            ? 'restore window size'
            : 'maximize window';
        return button({
            content: icon,
            title,
            'aria-label': title,
            class: 'maximize-window',
            '@click': this.toggleMaximized.bind(this),
        });
    }
    toggleMaximized() {
        this.#update({
            dim: {
                ...this.#state.dim,
                maximized: !this.#state.dim.maximized,
            },
        });
        loadingPanel.adjustPosition();
        settings.saveGlobals({ window: this.#state.dim });
        appStore.rerender();
    }
    disableUserSelect() {
        this.changeUserSelect('none');
    }
    enableUserSelect() {
        this.changeUserSelect('text');
    }
    changeUserSelect(value: 'text' | 'none') {
        Object.assign(this.win.style, { userSelect: value });
    }
};

const appWindow = new AppWindow();

export default appWindow;
