/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import executeCode from './lib/execute-code.ts';
import { encodeQueryResult } from './lib/data-wrapper.ts';
import { queryData } from './lib/querydata.ts';

self.onmessage = async (event) => {
    const { type: topic, params } = event.data;
    try {
        if (topic === 'queryData') {
            const result = { ...(await queryData(params)), encoded: false };
            if (params.encodeQueryResult) {
                Object.assign(result, encodeQueryResult(result.data));
            }
            self.postMessage({ type: 'queryResult', result });
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('catched', (error as Error).message);
        self.postMessage({ type: 'queryError', error });
    }
    if (topic === 'executeCode') {
        try {
            await executeCode(event.data.load);
            self.postMessage({ type: 'codeExecuted' });
        } catch (error) {
            self.postMessage({ type: 'codeError', error });
        }
    } else if (topic === 'checkFlaws') {
        self.postMessage({
            type: 'checkFlawsResult',
            result: {
                BigInt64Array: new BigInt64Array([1n]),
            },
        });
    }
};
