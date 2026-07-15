# Kahuna, the IndexedDB-Manager

Kahuna is a browser extension for Firefox and Chromium based browsers to manage IndexedDB databases. It can be used to create databases and modify their structure, as well as to view, query, edit, import and export the data they contain.

<p align="center">
  <img alt="Kahuna at work" src="https://hummingme.github.io/kahuna-docs/assets/screenshots/kahuna-at-work-1920x1200.png">
</p>

## Features
* Designed for debugging, testing, data migration, inspection and modification of IndexedDB databases.
* Opens as an overlay on top of the visited website, toggled by the extension icon or a keyboard shortcut.
* Displays lists of databases and tables (aka object stores) stored for an origin.
* Create new databases, as well as copy and delete existing databases. Create empty copies that preserve only the schema.
* Edit the database schema: add or remove tables and indexes on existing tables.
* Displays table data in a paginated, sortable grid with configurable, reorderable, and hideable columns. Select records for editing, deletion or export.
* Combinable filters per field, including equals, comparison, starts/ends-with, contains, empty, and regular expression matches.
* Includes a JavaScript console to modify databases, tables or data by code and via Dexie's API.
* Edit values of every IndexedDB type supported by browsers, including Arrays, Objects, Maps, Sets, Dates, RegExps, typed arrays, Blobs, Files, ImageData, Undefined, and 24 more.
* For editing values, switch between form-based editors and editable JavaScript source code for complex values. Type conversion is performed for compatible types when the value type is switched.
* Upload files to replace String, Blob, File, ArrayBuffer, DataView, ImageBitmap, ImageData values. Upload CSV or JSON files as data for Object, Set, Array and typed array values.
* Auto-formats columns as dates, URLs, or image previews where the data fits.
* Import and export complete databases in Dexie format.
* Import and export tables in Dexie, JSON and CSV format, as well as selected data records in JSON and CSV format.
* Configure display options, editor behavior, filtering, import and export globally, per database or per table.
* Indicates with a badge on it's toolbar icon the number of IndexedDB databases stored for the currently visited origin.
* Works with both Firefox and Chromium-based browsers while respecting the capabilities and restrictions of each browser.

## Installation
Please download and install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/kahuna/ilafpdbgcaodnkdklgemggjamhpdjile) for Chrome and Chromium based browsers such as Edge, Brave, and Opera, and from the [Firefox Addons Page](https://addons.mozilla.org/en-US/firefox/addon/kahuna-the-indexeddb-manager) for Firefox.
<div align="center" width="200">
      <a href="https://chromewebstore.google.com/detail/kahuna/ilafpdbgcaodnkdklgemggjamhpdjile">
        <img src="https://hummingme.github.io/kahuna-docs/assets/icons/chrome-logo.svg" width="64" alt="install Kahuna for Chrome" /></a>
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="40">
      <a href="https://addons.mozilla.org/en-US/firefox/addon/kahuna-the-indexeddb-manager/">
        <img src="https://hummingme.github.io/kahuna-docs/assets/icons/firefox-logo.svg" width="64" alt="install Kahuna for Firefox" /></a>
</div>


## Documentation
The documentation for the latest version is available at [hummingme.github.io/kahuna-docs/](https://hummingme.github.io/kahuna-docs/).

## Build and Install from Source
```sh
git clone https://github.com/hummingme/kahuna.git
cd kahuna
npm install 
npm run release firefox & npm run release chromium
```
Afterwards the packages _firefox\.zip_ and _chromium\.zip_ are located within the _build/_ directory. The subdirectories _build/firefox/_ and _build/chromium/_ contain the unpacked extensions.

To install Kahuna on Chrome, follow this [instructions for unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked). 

With Firefox, the packed extension _firefox.zip_ can be installed in ESR-, Developer- and Nightly releases after toggling `xpinstall.signatures.required: false` in `about:config`. Installing the unpacked extension is also possible by visiting `about:debugging#/runtime/this-firefox` and using _Load Temporary Addon_, but this must be repeated after each restart.

## Contributing
For bug reports and feature requests please [open an issue](https://github.com/hummingme/kahuna/issues) in this repository. 

The development does not take place on github.com, but in a private repository. Pull requests are welcome too, but they will not be integrated here. Instead, after review and if appropriate, transferred to the private repository. For more complex code contributions, please contact me in advance.

## Acknowledgements
* [Dexie](https://dexie.org/) wrapper library for the IndexedDB browser API
* [lit-html](https://lit.dev/docs/templates/overview/), the templating engine of the lit web components library
* [tabler](https://tabler.io/icons) svg icons
* and the greats tools of the JavaScript ecosystem: esbuild, eslint, prettier, and more

## License
Kahuna, the IndexedDB-Manager is © Lutz Brückner <dev@kahuna.rocks>  and licensed under Mozilla Public License Version 2.0, [MPL-2.0](https://mozilla.org/MPL/2.0/).
