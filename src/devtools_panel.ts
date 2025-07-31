const injectScript = `
     const script = document.createElement("script");
     script.textContent = \`
       (async () => {
     const dbs = (await indexedDB.databases()).map(db => db.name);
           window.postMessage({ type: "DEVTOOLS_IDB_LIST", dbs }, window.origin);
           script.remove();
         })();\`;
         document.documentElement.appendChild(script);
`;

document.getElementById('load-button')?.addEventListener('click', () => {
    (async () => {
        await browser.devtools.inspectedWindow.eval(injectScript);
    })();
});

browser.runtime.onMessage.addListener((event) => {
    if (event.source !== window) return;
    if (event.data.type === 'DEVTOOLS_IDB_LIST') {
        // eslint-disable-next-line no-console
        console.log('page’s IndexedDB list:', event.data.dbs);
    }
    if (event.data.type === 'DEVTOOLS_IDB_ERROR') {
        // eslint-disable-next-line no-console
        console.error('couldn’t list databases:', event.data.error);
    }
});
