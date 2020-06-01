# Steam Trade Offer Enhancer

Fork of [Steam Trade Offer Enhancer by scholtzm](https://github.com/scholtzm/steam-trade-offer-enhancer) with extra features and performance enhancements. This userscript has many features useful for Team Fortress 2 trading.

## Requirements
* [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) (Chrome)
* [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) (Firefox)

## Installation
1. Ensure that you have Tampermonkey installed.
2. Download the script [`steam.trade.offer.enhancer.user.js`](steam.trade.offer.enhancer.user.js?raw=true).
3. Confirm that you want to install the script.
4. The script should now be installed and ready to use.

## Features

![Screenshot of Steam Trade Offer Links](/images/1.8.0_offers_1.png?raw=true)

### ```https://steamcommunity.com/tradeoffer```
- Quickly add multiple items. You can specify the amount or starting index for the items you want to add.
- Quickly clear items from trade offer.
- Add items by ID. Use hotkey "P" to show field to add items by ID. You can specify multiple IDs by seperating the IDs by commas (e.g. "1,2,3,4,5").
- Option to add only keys or metal.
- Automatically adds item if `for_item` URL parameter is present. This is generated from trade offer links on backpack.tf stats/classifieds pages.
- Adds an option to add currencies from listing if `listing_intent` URL parameter is present. This is generated from trade offer links on backpack.tf stats/classifieds pages.
- Unusual effect images are displayed on items with effects.
- Uncraftable items are displayed with a dashed border.
- Strangified items (e.g. "Strange Unusual" items) have an orange colored border.
- Spelled items display an icon.

### ```https://steamcommunity.com/profiles/<steamid>/tradeoffers```<br/>```https://steamcommunity.com/id/<id>/tradeoffers```
- Quick links to backpack.tf and Rep.tf pages on offers.
- Summary for trade offers.
- Unusual effect images are displayed on items with effects.
- Uncraftable items are displayed with a dashed border.
- Strangified items (e.g. "Strange Unusual" items) have an orange colored border.
- Spelled items display an icon.

### ```https://steamcommunity.com/profiles/<steamid>/inventory```<br/>```https://steamcommunity.com/id/<id>/inventory```
- Unusual effect images are displayed on items with effects.
- Uncraftable items are displayed with a dashed border.
- Strangified items (e.g. "Strange Unusual" items) have an orange colored border.
- Spelled items display an icon.

### ```https://backpack.tf/profiles/<steamid>```
- Total values are displayed in keys rather than refined.
- Auto-select items on load by ID from `select` URL parameter.
- Easily change between days on comparisons. Use "W" and "S" keys.
- Easily change inventory sorting. Use "1", "2", and "3" keys.
- Copy IDs of currently selected items. Use "P" key.

### ```https://backpack.tf/classifieds```<br/>```https://backpack.tf/stats```
- Auto-generate links on listings for use in trade offers.