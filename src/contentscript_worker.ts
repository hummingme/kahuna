/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025-2026 Lutz Brückner <dev@kahuna.rocks>
 */

import { executeCode } from '#lib/execute-code';
import { encodeQueryResult, encodeValue } from '#lib/data-wrapper';
import { queryData } from '#lib/querydata';
import { Message } from '#types';

self.onmessage = async (event) => {
    const message: Message = event.data;
    const type = message.type;
    if (type === 'queryData') {
        const load = message.load;
        try {
            const result = { ...(await queryData(load)), encoded: false };
            if (load.encodeQueryResult) {
                Object.assign(result, encodeQueryResult(result.data));
            }
            self.postMessage({ type: 'queryResult', result });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('catched', (error as Error).message);
            self.postMessage({ type: 'queryError', error });
        }
    }
    if (type === 'executeCode') {
        try {
            const load = message.load;
            const result = await executeCode(load);
            self.postMessage({
                type: 'codeExecuted',
                client: load.client,
                result: load.encodeResult ? encodeValue(result) : result,
            });
        } catch (error) {
            self.postMessage({ type: 'codeError', error });
        }
    } else if (type === 'checkFlaws') {
        self.postMessage({
            type: 'checkFlawsResult',
            result: {
                BigInt64Array: new BigInt64Array([1n]),
            },
        });
    }
};
