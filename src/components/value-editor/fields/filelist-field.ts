/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { nothing } from 'lit';
import { html, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit/directives/ref.js';

import Field from '#components/value-editor/fields/field';
import saveFileIcon from '#components/value-editor/save-file-icon';
import { symbolButton } from '#lib/button';
import { getType } from '#lib/datatypes';

export default class FilelistField extends Field {
    view() {
        return html`
            <div class="value-controls">
                <div
                    class="value"
                    ${ref(this.node)}
                    ${ref(this.renderFileTable.bind(this))}
                ></div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    renderFileTable() {
        const node = this.node.value;
        if (node === undefined) return;
        render(this.fileTable(), node);
    }
    fileTable() {
        const fileRows: TemplateResult[] = this.fileRows();
        return html`
            <table id="filelist-files">
                <tr>
                    <th>fileName</th>
                    <th>type</th>
                    <th>size</th>
                    <th>lastModified</th>
                    <th class="icon-col"></th>
                </tr>
                ${fileRows}
                <tr><td colspan="5">${this.addButton()}</td></tr>
            </table>
        `;
    }
    fileRows() {
        const rows: TemplateResult[] = [];
        for (let idx = 0; idx < this.value.length; idx++) {
            const file = this.value.item(idx);
            if (!file) continue;
            const modified = new Date(file.lastModified).toISOString();
            const dropButton =
                this.inputMethod === 'form'
                    ? symbolButton({
                          icon: 'tabler-trash',
                          title: 'drop file',
                          //classes: ['right'],
                          '@click': this.dropFile.bind(this, idx),
                      })
                    : nothing;
            const saveButton = this.inputMethod === 'form' ? saveFileIcon(file) : nothing;
            rows.push(html`
                <tr>
                    <td>${file.name}</td>
                    <td>${file.type}</td>
                    <td class="right">${file.size}</td>
                    <td>${modified}</td>
                    <td>${dropButton}${saveButton}</td>
                </tr>
            `);
        }
        return rows;
    }
    addButton() {
        return this.inputMethod === 'form'
            ? html`
                  ${symbolButton({
                      icon: 'tabler-square-rounded-plus',
                      title: 'add file',
                      classes: ['right'],
                      '@click': this.clickFileInput,
                  })}
                  <input
                      type="file"
                      id="field-upload"
                      @change=${this.addFile.bind(this)}
                      class="hidden"
                      multiple=""
                  />
              `
            : nothing;
    }
    clickFileInput(event: Event) {
        event.preventDefault();
        const target = event.target as HTMLElement;
        const input = target.closest('button')?.nextElementSibling;
        if (input instanceof HTMLInputElement) input.click();
    }
    dropFile(dropIdx: number) {
        const dt = new DataTransfer();
        for (let idx = 0; idx < this.value.length; idx++) {
            const file = this.value.item(idx);
            if (file && idx !== dropIdx) {
                dt.items.add(file);
            }
        }
        this.update(dt.files);
        this.renderFileTable();
    }
    addFile(event: Event) {
        const target = event.target;
        if (
            target instanceof HTMLInputElement === false ||
            target.files?.length === undefined
        ) {
            return;
        }
        const dt = new DataTransfer();
        for (let idx = 0; idx < this.value.length; idx++) {
            const file = this.value.item(idx);
            if (file) {
                dt.items.add(file);
            }
        }
        for (const file of target.files) {
            dt.items.add(file);
        }
        this.update(dt.files);
        this.renderFileTable();
    }
    get value(): FileList {
        return this.state.value as FileList;
    }
    set value(value: unknown) {
        let result: FileList = new DataTransfer().files;
        if (getType(value) === 'filelist') {
            result = value as FileList;
        }
        this.state.value = result;
    }
    toFormValue() {}
    fromFormValue(): undefined {}
    override toSourceValue(): string {
        return 'return value;';
    }
}
