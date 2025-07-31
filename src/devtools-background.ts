/* eslint-disable */
// @ts-nocheck

/*
 * When we receive the message, execute the given script in the given tab.
 */
function handleMessage(request: any, sender: any, sendResponse: any) {
    if (sender.url != browser.runtime.getURL('/devtools/panel/panel.html')) {
        return;
    }
    browser.tabs.executeScript(request.tabId, {
        code: request.script,
    });
}

/**
 * Listen for messages from our devtools panel.
 */
browser.runtime.onMessage.addListener(handleMessage);
