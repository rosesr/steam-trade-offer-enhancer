# Steam Trade Offer Enhancer

Fork of [Steam Trade Offer Enhancer by scholtzm](https://github.com/scholtzm/steam-trade-offer-enhancer) with extra features and performance enhancements. This userscript has many features useful for Team Fortress 2 trading.

![Screenshot of Steam Trade Offer Links](/images/screenshot.png?raw=true)

## Requirements
* [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) (Chrome)

## Installation
1. Ensure that you have either Tampermonkey installed.
2. Download the script [`steam.trade.offer.enhancer.user.js`](steam.trade.offer.enhancer.user.js?raw=true).
3. Confirm that you want to install the script.
4. The script should now be installed and ready to use.

## Features

### Trade Offer Pages
- Quickly add multiple items. You can specify the amount or starting index for the items you want to add.
- Quickly clear items from from trade offer.
- Add items by ID. Use hotkey "P" to show field to add items by ID. You can specify multiple IDs by seperating the IDs by commas (e.g. "1,2,3,4,5").
- Option to add only keys or metal.
- Unusual effect images are displayed on items that have Unusual effects.
- Automatically adds item if `for_item` URL parameter is present. This is generated from trade offer links on backpack.tf stats/classifieds pages.
- Adds an option to add currencies from listing if `listing_intent` URL parameter is present. This is generated from trade offer links on backpack.tf stats/classifieds pages.

### Trade Offers Pages
- Quick links to backpack.tf and Rep.tf pages on offers.
- Summary for trade offers. Use the "Summary" button below the trade offer to reveal.
- Unusual effect images are displayed on Unusual items that have Unusual effects (minor, but Community Sparkle on Lugermorphs is not available).

### backpack.tf Inventory Pages
- Auto-select items on load by ID from `select` URL parameter.
- Easily change between days on comparisons. Use "W" and "S" keys.
- Easily change inventory sorting. Use "1", "2", and "3" keys.
- Copy IDs of currently selected items. Use "P" key.

### backpack.tf Classifieds & Stats Pages
- Auto-generate links on listings for use in trade offers.