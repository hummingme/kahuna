/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, render } from 'lit-html';
import { styleMap } from 'lit/directives/style-map.js';
import about from './about.js';
import configLayer from './configlayer.js';
import loadingPanel from './loadingpanel.js';
import mainMenu from './main-menu.js';
import messageStack from './messagestack.js';
import tooltip from './tooltip.js';
import appStore from '../lib/app-store.js';
import env from '../lib/environment.js';
import messenger from '../lib/messenger.js';
import { extensionUrl } from '../lib/runtime.js';
import settings from '../lib/settings.js';
import svgIcon from '../lib/svgicon.js';
import { clamp, between, fetchFile } from '../lib/utils.js';

const AppWindow = class {
    #host; // host node of application
    #root; // shadowRoot added to #host
    #win; // own root node of this appwindow
    #main; // main stage inside of #win
    #overlay; // node of application overlay
    #winOverlay; // node of appwindow overlay
    #dragger; // node of drag-handle
    #resizer = {
        // nodes of resize-handles
        border: null,
        bottom: null,
        nesw: null,
        nwse: null,
    };
    #bodyStyles = {
        // save/restore when shown/hidden
        overflow: null,
        userSelect: null,
    };
    #state = {
        visible: true,
        dim: {},
        dragging: false,
        resizing: false,
        start: {}, // used while dragging / resizing
        moveHandler: null, // external handler, used by datatable for column resizing
        keyHandler: null, // external handler, used by datatable for column ordering
    };
    constructor() {}
    init() {
        this.#state.dim = settings.global('window');
        this.#host = this.createHost();
        this.#root = this.#host.attachShadow({ mode: 'open' });
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
            this.#root.appendChild(svgElement);
        });
        messenger.register('toggleVisibility', this.toggleVisibility.bind(this));
        this.setColorScheme();
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
        document.querySelector('body').appendChild(host);
        return host;
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
    #update(diff) {
        this.#state = { ...this.#state, ...diff };
    }
    get root() {
        return this.#root;
    }
    get win() {
        return this.#win;
    }
    get main() {
        if (this.#main === undefined) {
            this.#main = this.#root.getElementById('main');
        }
        return this.#main;
    }
    get winOverlay() {
        return this.#winOverlay;
    }
    render() {
        render(this.template(), this.#root);

        this.#overlay = this.#root.getElementById('overlay');
        this.#overlay.addEventListener('click', this.onClickOverlay, true);

        this.#win = this.#root.getElementById('window');
        this.#win.addEventListener('pointerdown', this.onPointerDown, true);

        this.#winOverlay = this.#root.getElementById('window-overlay');
        this.#dragger = this.#root.querySelector('nav#menu > div');
        this.#resizer = {
            border: this.#root.querySelector('#resize-border'),
            bottom: this.#root.querySelector('#resize-bottom'),
            nesw: this.#root.querySelector('#resize-nesw'),
            nwse: this.#root.querySelector('#resize-nwse'),
        };
        return this.#win;
    }
    template() {
        const { top, left, width, height, maximized } = this.#state.dim;
        const transform = top !== null ? 'translate(0, 0)' : null;
        const styles = maximized
            ? { width: '100%', height: '100%' }
            : { top, left, width, height, transform };
        return html`
            <div id="app">
                <div id="overlay" class="overlay-cover"></div>
                <div id="window" style=${styleMap(styles)}>
                    <div id="resize-border">
                        <div id="resize-cover"></div>
                        <div id="resize-nesw"></div>
                        <div id="resize-bottom"></div>
                        <div id="resize-nwse"></div>
                    </div>
                    ${messageStack.view()} ${loadingPanel.view(appStore.state)}
                    <div id="window-overlay" class="overlay-cover hidden"></div>
                </div>
                ${mainMenu.view()} ${configLayer.view()} ${tooltip.view()} ${about.view()}
            </div>
        `;
    }
    toggleVisibility() {
        this.visible() ? this.hide() : this.show();
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
    showOverlay(cursor) {
        this.#winOverlay.classList.remove('hidden');
        if (cursor) {
            Object.assign(this.#winOverlay.style, { cursor });
        }
    }
    hideOverlay() {
        this.#winOverlay.classList.add('hidden');
        Object.assign(this.#winOverlay.style, { cursor: 'auto' });
    }
    get dims() {
        return this.#win.getBoundingClientRect();
    }
    get fontFamily() {
        return window.getComputedStyle(this.#win).fontFamily;
    }
    set externMoveHandler(handler) {
        this.#state.moveHandler = handler;
    }
    set externKeyHandler(handler) {
        this.#state.keyHandler = handler;
    }
    setPointerHandlers(moving) {
        const func = moving ? 'addEventListener' : 'removeEventListener';
        [this.#overlay, this.#win].forEach((node) => {
            node[func]('pointermove', this.onPointerMove, true);
            node[func]('pointerup', this.onPointerUp, true);
            node[func]('pointercancel', this.onPointerUp, true);
        });
    }
    addInputHandler() {
        this.#host.addEventListener('keydown', this.onKeydown, false);
        this.#host.addEventListener('paste', (ev) => ev.stopPropagation(), false);
    }
    removeInputHandler() {
        this.#host.removeEventListener('keydown', this.onKeydown, false);
        this.#host.removeEventListener('paste', this.onKeydown, false);
    }
    onClickOverlay = () => {
        this.hide();
        this.#update({ visible: false });
    };
    onKeydown = (ev) => {
        if (ev.key === 'Escape') {
            this.hide();
        }
        if (this.#state.keyHandler !== null) {
            this.#state.keyHandler.down(ev);
        }
        ev.stopPropagation();
    };
    onPointerDown = (ev) => {
        const dragging = ev.target === this.#dragger ? true : false;
        let resizing = false;
        let direction, cursor;
        if (Object.values(this.#resizer).includes(ev.target)) {
            resizing = true;
            [direction, cursor] = this.resizeDirection(ev.target, ev.clientX);
        }

        let start = {};
        if (dragging || resizing) {
            const bbox = this.dims;
            start = {
                // position of mouse on start
                x: ev.clientX - bbox.left, // distance from left window border
                y: ev.clientY - bbox.top, // distance from top window border
                w: ev.clientX - bbox.width, // distance from right window border
                h: ev.clientY - bbox.height, // distance from bottom
                dims: {
                    left: `${bbox.left}px`,
                    top: `${bbox.top}px`,
                    width: `${bbox.width}px`,
                    height: `${bbox.height}px`,
                },
                direction,
            };
            this.showOverlay(dragging ? 'move' : cursor);
            this.#update({ dragging, resizing, start });
            this.setPointerHandlers(true);
            this.disableUserSelect();
        }
        if (this.#state.moveHandler && this.#state.moveHandler.isTarget(ev)) {
            this.#state.moveHandler.start(ev);
            this.setPointerHandlers(true);
            this.disableUserSelect();
        }
    };
    onPointerMove = (ev) => {
        const state = { ...this.#state };
        if (state.dragging || state.resizing) {
            const start = state.start;
            const de = document.documentElement;
            const bbox = this.dims;
            let left, top, width, height;
            if (state.dragging === true) {
                left = `${clamp(ev.clientX - start.x, -bbox.width + 100, de.clientWidth - 100)}px`;
                top = `${clamp(ev.clientY - start.y, 0, de.clientHeight - 25)}px`;
                width = start.dims.width;
                height = start.dims.height;
            } else if (state.resizing === true) {
                ({ left, width, height } = start.dims);
                if (['left', 'nesw'].includes(start.direction)) {
                    left = `${clamp(ev.clientX - start.x, 0, bbox.right - 150)}px`;
                    width = `${parseInt(width) + parseInt(start.dims.left) - parseInt(left) - 2}px`;
                }
                if (['right', 'nwse'].includes(start.direction)) {
                    width = `${clamp(ev.clientX - start.w, 150, de.clientWidth - bbox.left) - 2}px`;
                }
                if (['down', 'nesw', 'nwse'].includes(start.direction)) {
                    height = `${clamp(ev.clientY - start.h, 110, de.clientHeight - bbox.top) - 2}px`;
                }
                top = start.dims.top;
            }
            Object.assign(this.#win.style, {
                left,
                top,
                width,
                height,
                transform: 'translate(0, 0)',
            });
            this.#update({
                dim: { left, top, width, height, maximized: false },
            });
            loadingPanel.adjustPosition();
            messageStack.adjustPosition();
        } else if (state.moveHandler) {
            state.moveHandler.moving(ev.clientX, ev.clientY);
        }
    };
    onPointerUp = (ev) => {
        this.hideOverlay();
        this.enableUserSelect();
        this.setPointerHandlers(false);
        this.#update({ dragging: false, resizing: false, start: {} });
        if (this.#state.moveHandler && this.#state.moveHandler.isTarget(ev)) {
            this.#state.moveHandler.stop(ev.clientX, ev.clientY);
        } else {
            settings.saveGlobals({ window: this.#state.dim });
        }
    };
    resizeDirection(node, xpos) {
        switch (node) {
            case this.#resizer.border:
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
            case this.#resizer.bottom:
                return ['down', 'ns-resize'];
            case this.#resizer.nesw:
                return ['nesw', 'sw-resize'];
            case this.#resizer.nwse:
                return ['nwse', 'se-resize'];
            default:
                return [null, 'initial'];
        }
    }
    maximizeIcon() {
        const title = this.#state.dim.maximized
            ? 'restore window size'
            : 'maximize window';
        return html`
            <a
                class="maximize-icon"
                title=${title}
                @click=${this.toggleMaximized.bind(this)}
            >
                ${svgIcon('tabler-maximize', {
                    width: 14,
                    height: 14,
                    id: 'window-maximize',
                })}
            </a>
        `;
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
    changeUserSelect(value) {
        Object.assign(this.#win.style, { userSelect: value });
    }
};

const appWindow = new AppWindow();

export default appWindow;
