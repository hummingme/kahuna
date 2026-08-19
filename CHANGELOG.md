# v1.6.2
- released on 2026/08/19
- bugfix: the data and database import in Dexie format was fixed for Firefox browser.

# v1.6.1
- released on 2026/07/22
- bugfix: ensure that when editing data values, the correct column is updated, even if there are hidden columns.

# v1.6.0
- released on 2026/07/14
- added a Value Editor component. All 44 data types supported by IndexedDB can now be edited in forms, manipulated via JavaScript, and/or replaced by uploading data.
- in Firefox, import and export in Dexie format are now executed from a script injected into the website's MAIN context to avoid problems with dexie-export-import in the RESTRICTED context.
- escape invisible and non-printable characters in displayed string data.
- added image previews for the ImageData and ImageBitmap data types.
- all modal windows (Configuration, Schema Editor, Value Editor, About) are now draggable by their top edge.
- bugfix: applying the search filter to empty values (undefined, null, ...) no longer throws an error.
- bugfix: fixed data export in Dexie format from the Selection Tools when the table has an unnamed primary key.
- bugfix: empty array slots are no longer treated as undefined values when editing data.
- the minimum supported Firefox version is now 128.
- the setting for the table to load at startup is now saved on a per-host basis.
- in the Columns configuration, clicking 'reset to defaults' now clears the display format and marks all columns as visible.
- in the application configuration, a backup of all saved Kahuna settings can now be downloaded as a file in Dexie format. Backups can also be imported to restore the settings.
- the datatable scroll position is now restored after reloading.
- bugfix: regular expression search filters work again when the entered regular expression contains special characters.
- spell checking is now disabled for all text input fields.
- JavaScript code entered in the JavaScript Textarea now has access to a Dexie instance.
- bugfix: notifications that can be disabled via a checkbox are now hidden only for the current origin when the checkbox label indicates this.
- added a setting to the behavior configuration to control whether data queries are executed by web workers.

# v1.5.2
- released on 2026/01/17
- Case-insensitive 'equals' and 'startsWith' filters are accelerated by using equalsIgnoreCase() and startsWithIgnoreCase()
- Bugfix: the view of empty BigInt64Arrays values has been corrected
- Bugfix: the view of RegExp values has been corrected
- Bugfix: use template literals for strings including line terminator characters for the javascript source in edit data row (fixes [issue #1](https://github.com/hummingme/kahuna/issues/1))
- Improved error reporting when an error occurs during code execution in the worker
- Bugfix: avoid errors when displaying CryptoKey values

# v1.5.1
- released on 2025/10/17
- Highlight string and number values by color when displaying in the datatable
- Selecting the colors for strings and numeric values ​​in the application configuration
- Enlarged the range to -30 years .. +20 years in which integer values ​​are displayed as dates when `date` is selected as the display type 
- Improved sorting of filters to ensure that indexed filters are always considered first
- Prioritize additional indexes over composite primary keys when using named primary keys, as these are often better applied
- Bugfix: display the UpdateInfo for updates only, not for new installations
- Bugfix: for ArrayBuffer values, the formatting has been corrected for displaying and when editing data rows
- Bugfix: follow the `rows per page` setting on the initial view of an unfiltered and unsorted table
- Bugfix: never add an additional column `*key*` when copying tables and databases
- Bugfix: correct preparation of the `collection` variable for the javascript code to be executed from the textarea

# v1.5.0
- released on 2025/07/31
- Table tools: copy table added, optionally with or without their data
- Database tools: added functionality to copy databases, with or without data
- New `SchemaEditor` component for adding/deleting tables and modifying indexes
- Added new `UpdateInfo` component
- Behavior configuration: option to select execution method `unsafe-eval` (Firefox only)
- The 'display textarea' setting is now applied immediately when changed
- Application now reloads after a full settings reset
- Search filters for unnamed primary keys now accept strings and floats in addition to integers
- Image preview for values stored in `Blob` or `File`; can be enabled per column and the preview size is configurable
- When editing data rows, use `table.put()` and the value of the index in the statement
- Bugfix: escape RegExp special characters in RegExp filter input
- Bugfix: sorting data tables by nested properties or type-specific key paths now works correctly with active filters
- Bugfix: corrected day-of-month in date variable used for export file name templates
- Gray, inactive action icon is now shown on restricted pages where Kahuna cannot run
- Fixed error when displaying `Set` and `Map` values in Firefox
- Bugfix: when importing JSON, wait until it is ready before updating the view
- Bugfix: delete selection and export selection from tables with unnamed primary key
- Bugfix: replace `{table}` variable in selection export filename
- Replaced `CustomEvent` usage with message-based communication
- Migrated source code to TypeScript

# v1.0.1
- released on 2025/05/16
- bugfix: layer positioning for tableTools and databaseTools 
- bugfix: app window dragging after first render
- bugfix: initializing of search filter configuration
- bugfix: ensure format is dexie for database import
- bugfix: use formatted buttons in resetConfirmPanel
- bugfix: prevent errors in configuration when called by tableTools in a database list
- bugfix: open the create table area of the tableTools when the create link in an empty database is clicked
- bugfix: apply the configured setting for direct values name in csv and json exports
- clearer information about the use of the 'direct values ​​import' setting
- bugfix: use json mimeType for dexie exports
- more reliable visibility of column borders while resizing columns
- tidied up import configuration and adjusted default values
- added github link to the main menu
- bugfix: added info color definition for dark mode

# v.1.0.0.
- released on 2025/03/25
