/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

const CsvReader = class {
    #text;
    #idxData;

    constructor() {}

    async init(file) {
        if (typeof file === 'string') {
            this.#text = file;
            return;
        } else if (file instanceof Blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    this.#text = reader.result;
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        } else {
            throw Error('CsvReader: init() called with neither blob nor string');
        }
    }

    getHeads() {
        const lines = this.parseLines(this.#text, 0);
        const { row, idx } = lines.next().value;
        this.#idxData = idx;
        return row;
    }

    getData() {
        const data = [];
        const lines = this.parseLines(this.#text, this.#idxData || 0);
        for (const { row } of lines) {
            data.push(row);
        }
        return data;
    }

    *parseLines(text, idx) {
        while (idx < text.length) {
            const values = this.parseValues(text, idx);
            const row = [];
            let value;
            for ({ value, idx } of values) {
                row.push(value);
            }
            yield { row, idx };
        }
        return;
    }

    *parseValues(text, idx) {
        let value = '';
        let lineend = false;
        while (!lineend && idx < text.length) {
            if (text[idx] === '"') {
                const eidx = this.quotedValueEnd(text, idx);
                value = text.slice(idx + 1, eidx);
                value = value.replaceAll('""', '"');
                idx = eidx + 2;
            } else {
                const eidx = this.unquotedValueEnd(text, idx);
                value = text.slice(idx, eidx);
                value = this.typedValue(value);
                idx = eidx + 1;
            }
            if (text[idx - 1] === '\n') {
                lineend = true;
            }
            yield { value, idx };
        }
        return;
    }

    // -> end of field is single '"' followed by ',' or '\n' or <eof>
    quotedValueEnd(text, idx) {
        while (idx < text.length) {
            idx = this.nextValueEnd(text, idx, '",', '"\n');
            if (text[idx - 1] !== '"') {
                break;
            }
        }
        return idx < text.length ? idx : idx - 1;
    }

    unquotedValueEnd(text, idx) {
        return this.nextValueEnd(text, idx, ',', '\n');
    }

    nextValueEnd(text, idx, dl1, dl2) {
        const idx1 = text.indexOf(dl1, idx);
        const idx2 = text.indexOf(dl2, idx);
        if (idx1 !== -1 && idx2 !== -1) {
            return Math.min(idx1, idx2);
        }
        if (idx1 === -1 && idx2 === -1) {
            return text.length;
        }
        return idx1 !== -1 ? idx1 : idx2;
    }
    typedValue(value) {
        const val = value.toLowerCase();
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (val === 'null') return null;
        if (val === 'undefined') return undefined;
        if (isFinite(value) && value.trim().length > 0) return +value;
        return value;
    }
};

export default CsvReader;
