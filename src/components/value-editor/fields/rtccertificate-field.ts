/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { html, TemplateResult } from 'lit-html';

import Field from '#components/value-editor/fields/field';
import textInput from '#components/value-editor/text-input';

export default class RtccertificateField extends Field {
    view() {
        const formView =
            this.value instanceof RTCCertificate
                ? html`
                      ${textInput(this, {
                          id: 'rtccert-expires',
                          '.value': new Date(this.value.expires).toISOString(),
                          label: 'expires',
                          disabled: true,
                      })}
                      ${this.fingerprintsTable()}
                  `
                : '-';
        return html`
            <div class="value-controls">
                <div class="value">${formView}</div>
                ${this.inputMethodView()}
            </div>
        `;
    }
    fingerprintsTable() {
        const fingerprints = this.value.getFingerprints();
        const rows: TemplateResult[] = [];
        fingerprints.forEach((fp) => {
            rows.push(html`
                <tr>
                    <td>${fp.algorithm}</td>
                    <td>
                        <textarea
                            .value=${fp.value}
                            rows="1"
                            cols="30"
                            disabled=""
                        ></textarea>
                    </td>
                </tr>
            `);
        });
        return html`
            <table id="rtccert-fingerprints">
                <tr>
                    <th>algorithm</th>
                    <th>fingerprint</th>
                </tr>
                ${rows}
            </table>
        `;
    }
    get value(): RTCCertificate {
        return this.state.value as RTCCertificate;
    }
    set value(value: unknown) {
        if (this.isRTCCertificate(value)) {
            this.state.value = value;
        }
    }
    toFormValue() {
        return '';
    }
    fromFormValue() {}
    override toSourceValue() {
        return 'return value;';
    }
    isRTCCertificate(value: unknown): value is RTCCertificate {
        return (
            typeof value === 'object' &&
            value !== null &&
            'expires' in value &&
            typeof value.expires === 'number' &&
            'getFingerprints' in value &&
            typeof value.getFingerprints === 'function' &&
            Object.prototype.toString.call(value) === '[object RTCCertificate]'
        );
    }
}
