# Changelog

## [1.4.8] - 2018-06-10
### Added
- "Add keys" button.
- "Add metal" button.
- "Add listing price" button.
- Index field

### Changed
- Rate of which items are added.

### Removed
- Gift tag warnings as they are not needed since gift tags can be removed from items.

## [1.4.9] - 2018-07-08
### Added
- Summaries now link to the user's backpack with item's in offer filtered.
- backpack.tf inventory item filtering using URL query parameter "select" as comma-seperated array of item IDs.
- Refined values on backpack.tf are now displayed in keys rather than refined when available.

### Changed
- Rate of which items are removed.
- Filtering for items like keys and metal is now much faster.
- Other performance enhancements.

## [1.5.0] - 2018-11-13
### Added
- Refreshing summaries after every 5 seconds.

### Changed
- Listing intents on backpack.tf being written as "buy" or "sell" on listings rather than 1 or 0.

## [1.5.1] - 2019-04-05
### Added
- Add items by ID (only available through console in current state).

## [1.6.0] - 2019-04-11
### Changed
- Cleaned code.

## [1.6.1] - 2019-04-11
### Fixed
- Summary descriptions having a single quote.
- Issue with adding by ID.
- Spacing in summaries.

### Changed
- Cleaned code.
- Some optimization here and there.
- Interval period when adding multiple items (from 10 to 20).

## [1.6.2] - 2019-04-12
### Added
- Field to add by ID, just press "P" outside of a text field to access it.

### Removed
- Dependencies.

### Fixed
- Warnings not working.
- RegExp in includes.

### Changed
- Some spacing with elements.
- More optimizations.
- Used MutationObserver for checking when backpack on backpack.tf is loaded rather than waitForKeyElements. The function is now called instantly when the backpack is loaded.