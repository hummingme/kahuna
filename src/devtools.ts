/* eslint-disable */
// @ts-nocheck

/**
This script is run whenever the devtools are open.
In here, we can create our panel.
*/
import { namespace } from './lib/runtime.ts';

function handleShown() {
    console.log('panel is being shown');
}

function handleHidden() {
    console.log('panel is being hidden');
}

/**
Create a panel, and add listeners for panel show/hide events.
*/
namespace.devtools.panels
    .create('Kahuna', '/icons/kahuna-32.png', '/static/devtools-panel.html', (panel) =>
        console.log('p', panel),
    )
    .then((newPanel) => {
        newPanel.onShown.addListener(handleShown);
        newPanel.onHidden.addListener(handleHidden);
    });
