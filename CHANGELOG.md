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
- Bugfix: with Chromium, manifest version 3, reconnect message port if the background worker is sleeping

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
