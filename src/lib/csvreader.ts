/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

type ValueType = ReturnType<InstanceType<typeof CsvReader>['typedValue']>;

const CsvReader = class {
    #text = '';
    #idxData = 0;

    constructor() {}

    async init(file: string | Blob) {
        if (typeof file === 'string') {
            this.#text = file;
            return;
        } else if (file instanceof Blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result !== 'string') {
                        throw Error('CsvReader: error reading from file');
                    }
                    this.#text = reader.result;
                    resolve(true);
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
        const lineResult = lines.next().value;
        if (lineResult !== undefined) {
            const { row, idx }: { row: ValueType[]; idx: number } = lineResult;
            this.#idxData = idx;
            return row.map((val) => `${val}`);
        } else {
            throw Error('CsvReader: file is empty');
        }
    }

    getData() {
        const data = [];
        const lines = this.parseLines(this.#text, this.#idxData);
        for (const { row } of lines) {
            data.push(row);
        }
        return data;
    }

    *parseLines(text: string, idx: number) {
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

    *parseValues(text: string, idx: number) {
        let value: ValueType = '';
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
    quotedValueEnd(text: string, idx: number) {
        while (idx < text.length) {
            idx = this.nextValueEnd(text, idx, '",', '"\n');
            if (text[idx - 1] !== '"') {
                break;
            }
        }
        return idx < text.length ? idx : idx - 1;
    }

    unquotedValueEnd(text: string, idx: number) {
        return this.nextValueEnd(text, idx, ',', '\n');
    }

    nextValueEnd(text: string, idx: number, dl1: string, dl2: string) {
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
    typedValue(value: string) {
        const val = value.toLowerCase();
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (val === 'null') return null;
        if (val === 'undefined') return undefined;
        if (Number.isFinite(+value) && value.trim().length > 0) return +value;
        return value;
    }
};

export default CsvReader;
