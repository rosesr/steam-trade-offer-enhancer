// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @description Browser script to enhance Steam trade offers.
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @include     /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(?:id|profiles)\/.*/
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require     https://cdn.rawgit.com/juliarose/c285ec7f12f3f91375abb9b7a02902fe/raw/8124f481e6139609e7e5b96669037dca9dd8eebb/backpacktf_price_tools.js
// @version     1.6.1
// @run-at      document-end
// @author      HusKy (modified by Julia)
// ==/UserScript==

(function() {
    'use strict';
    
    // all of the code that runs when the page is loaded is here
    function ready() {
        [
            // trade offer pages
            {
                pattern: /^https?:\/\/steamcommunity\.com\/tradeoffer.*/,
                fn: getTradeOfferWindow
            },
            // classified pages
            {
                pattern: /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(stats|classifieds).*/,
                fn: getClassifieds
            },
            // inventory pages
            {
                pattern: /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(?:id|profiles)\/.*/,
                fn: getInventory
            }
        ].find((mode) => {
            // will call function when something matches, then stop
            return mode.pattern.test(location.href) && (mode.fn() || true);
        });
    }
    
    /**
     * Get URL parameters
     * @returns {Object} Object containing url parameters e.g. { 'item': 'Fruit Shoot' }
     */
    function getURLParams() {
        let params = {};
        let pattern = /[?&]+([^=&]+)=([^&]*)/gi;
        
        window.location.search.replace(pattern, (str, key, value) => {
            params[key] = decodeURIComponent(value);
        });
        
        return params;
    }
    
    /**
     * Check if a variable is undefined, null, or an empty string ('')
     * @param {*} value - Value to check
     * @returns {Boolean} Is empty?
     */
    function isEmpty(value) {
        return value === undefined || value === null || value === '';
    }
    
    /**
     * Get a list of IDs from a comma-seperated string
     * @param {String} str - Comma-seperated string
     * @returns {(Array|null)} Array if string is valid, null if not
     */
    function getIDsFromString(str) {
        if (/(\d+)(,\s*\d+)*/.test(str)) {
            return str.split(',');
        }
        
        return null;
    }
    
    function getTradeOfferWindow() {
        const $ = unsafeWindow.jQuery;
        const URLPARAMS = getURLParams();
        const page = {
            $body: $('body'),
            $yourSlots: $('#your_slots'),
            $theirSlots: $('#their_slots'),
            $inventories: $('#inventories'),
            $inventoryBox: $('#inventory_box'),
            $inventorySelectYour: $('#inventory_select_your_inventory'),
            $inventorySelectTheir: $('#inventory_select_their_inventory'),
            $inventoryDisplayControls: $('#inventory_displaycontrols'),
            $tradeBoxContents: $('#inventory_box div.trade_box_contents'),
            $appSelectOption: $('.appselect_options .option')
        };
        // get jquery elements which are constantly changing based on page state
        const get = {
            $inventory: () => $('.inventory_ctn:visible'),
            $activeInventoryTab: () => $('.inventory_user_tab.active'),
            $modifyTradeOffer: () => $('div.modify_trade_offer:visible'),
            $imgThrobber: () => $('img[src$="throbber.gif"]:visible'),
            $appSelectImg: () => $('#appselect_activeapp img'),
            $deadItem: () => $('a[href$="_undefined"]')
        };
        let tradeOfferWindow = (function() {
            /**
             * Get inventory for user
             * @param {Boolean} my - Is this my inventory?
             * @returns {Object} Your inventory if 'yours' is true, otherwise their inventory
             */
            function getInventory(my) {
                let myInventory = unsafeWindow.g_rgAppContextData;
                let themInventory = unsafeWindow.g_rgPartnerAppContextData;
                
                return my ? myInventory : themInventory;
            }
            
            /**
             * Get summary of items
             * @param {Object} $items - jQuery object of collection of items
             * @param {Boolean} my - Are these my items?
             * @returns {(Object|null)} Summary of items, null if inventory is not properly loaded
             */
            function evaluateItems($items, my) {
                const WARNINGS = [
                    {
                        name: 'rare TF2 key',
                        check: function(item) {
                            let appdata = item.appdata;
                            // array of rare TF2 keys (defindexes)
                            let rare440Keys = [
                                '5049', '5067', '5072', '5073',
                                '5079', '5081', '5628', '5631',
                                '5632', '5713', '5716', '5717',
                                '5762'
                            ];
                            let defindex = appdata && appdata.def_index;
                            
                            return typeof defindex === 'string' &&
                                item.appid === '440' &&
                                rare440Keys.indexOf(defindex) !== -1;
                        }
                    },
                    {
                        name: 'uncraftable item',
                        check: function(item) {
                            let descriptions = item.descriptions;
                            let isUncraftable = (description) => {
                                return description.value.indexOf('Not Usable in Crafting') !== -1;
                            };
                            
                            return typeof descriptions === 'object' &&
                                item.appid === '440' &&
                                descriptions.some(isUncraftable);
                        }
                    },
                    {
                        name: 'restricted gift',
                        check: function(item) {
                            let fraudwarnings = item.fraudwarnings || [];
                            let isRestricted = (text) => {
                                return text.indexOf('restricted gift') !== -1;
                            };
                            
                            return typeof fraudwarnings === 'object' &&
                                item.appid === '753' && 
                                fraudwarnings.some(isRestricted);
                        }
                    }
                ];
                let $slotInner = $items.find('.slot_inner').filter((i, el) => {
                    // get all slots that contain contents
                    return !isEmpty(el.innerHTML.trim());
                });
                let inventory = getInventory(my);
                let result = {
                    total: $slotInner.length,
                    item: {},
                    apps: {},
                    warnings: []
                };
                
                $slotInner.each((i, el) => {
                    // get the info for the item
                    let $slot = $(el);
                    let $item = $slot.find('.item');
                    // array containing item identifiers e.g. ['440', '2', '123']
                    let split = $item.attr('id').replace('item', '').split('_'); 
                    let [appid, contextid, assetid] = split; 
                    let img = $item.find('img').attr('src');
                    let quality = $item.css('border-top-color');
                    let hasApp =  result.apps[appid] && result.apps[appid][contextid];
                    let inventoryItem = inventory[appid] &&
                        inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid];
                    
                    if (!inventoryItem) {
                        // not properly loaded
                        result = null;
                        return true; 
                    }
                    
                    if (!hasApp) {
                        // create new array for app
                        result.apps[appid] = result.apps[appid] || {};
                        result.apps[appid][contextid] = [];
                    }
                    
                    result.item[img] = (result.item[img] || {});
                    result.item[img][quality] = (result.item[img][quality] || 0) + 1;
                    result.apps[appid][contextid].push(assetid);
                    
                    WARNINGS.forEach((warning) => {
                        let warningText = `Offer contains ${warning.name}(s).`;
                        let addWarning = result.warnings.indexOf(warningText) === -1 &&
                            warning.check(inventoryItem);
                            
                        if (addWarning) {
                            result.warnings.push(warningText);
                        }
                    });
                });
                
                return result;
            }
            
            /**
             * Get summary HTML
             * @param {String} type - Name of user e.g. "Your" or "Their"
             * @param {(Object|null)} items - Result from evaluateItems
             * @param {Object} User - User object from steam that the items belong to
             * @returns {String} Summary HTML
             */
            function dumpSummary(type, items, User) {
                if (items === null || items.total === 0) return ''; // no summary or no items
                
                function getHeader() {
                    let itemsStr = items.total === 1 ? 'item' : 'items';
                    
                    return `${type} summary (${items.total} ${itemsStr}):<br/>`;
                }
                
                function getSummary() {
                    /**
                     * Wrap HTML in backpack.tf link for items
                     * @param {String} html - HTML contents to wrap around
                     * @param {Array} ids - Array of IDs to include in URL
                     * @returns {String} HTML with link wrapped around
                     */
                    function wrapBackpackLink(html, ids) {
                        let steamid = User.strSteamId;
                        let url = `https://backpack.tf/profiles/${steamid}?select=${ids.join(',')}`;
                        
                        return `<a title="Open on backpack.tf" href="${url}" target="_blank">${html}</a>`;
                    }
                    
                    function getItems() {
                        let html = '';
                        
                        function getItem(img, quality, count) {
                            let styles = `background-image: url(${img}); border-color: ${quality};`;
                            let badge = `<span class="summary_badge">${count}</span>`;
                            
                            return `<span class="summary_item" style="${styles}">${badge}</span>`;
                        }
                        
                        // item counts
                        for (let img in items.item) {
                            for (let quality in items.item[img]) {
                                let count = items.item[img][quality];
                                
                                html += getItem(img, quality, count);
                            }
                        }
                        
                        return html;
                    }
                    
                    let ids = items.apps['440'] && items.apps['440']['2'];
                    
                    if (ids) {
                        // return summary items with backpack.tf link wrapped around, if tf2 items are in offer
                        return wrapBackpackLink(getItems(), ids);
                    } else {
                        return getItems();
                    }
                }
                
                function getWarnings() {
                    if (items.warnings.length === 0) return ''; // no warnings to display
                    
                    // so that descriptions are always in the same order
                    let descriptions = items.warnings.sort().join('<br/>');
                    
                    return `<span class="warning"><br/>Warning:<br/>${descriptions}</span>`;
                }
                
                // build html piece-by-piece
                return [
                    getHeader(),
                    getSummary(),
                    getWarnings()
                ].join('');
            }
            
            function summarize() {
                let myItems = evaluateItems(page.$yourSlots, true);
                let otherItems = evaluateItems(page.$theirSlots, false);
                // whether to add spacing or not
                let addSpace =  myItems && myItems.total > 0 &&
                    otherItems && otherItems.total > 0; 
                // generate the summary HTML
                let html = [
                    dumpSummary('My', myItems, unsafeWindow.UserYou),
                    addSpace ? '<br/><br/>' : '',
                    dumpSummary('Their', otherItems, unsafeWindow.UserThem)
                ].join('');
                
                page.$offerSummary.html(html);
            }
            
            function ready() {
                function pollRefresh() {
                    // refresh every x seconds
                    setInterval(summarize, 30 * 1000);
                }
                
                // call userchanged on current active tab
                userChanged(get.$activeInventoryTab()); 
                
                // just a short delay to ensure everything is loaded
                setTimeout(() => {
                    summarize();
                    pollRefresh();
                }, 100);
            }
            
            // clear items that were added to the offer
            function clear($addedItems) {
                let interval = 100; // amount of time for each item
                let $items = $addedItems.find('div.itemHolder div.item');
                
                for (let i = 0, n = $items.length; i < n; i++) {
                    setTimeout(unsafeWindow.MoveItemToInventory, i * interval, $items[i]);
                }
                
                setTimeout(summarize, ($items.length * interval) + 500);
            }
            
            // update button display
            function updateDisplay(my, appid) {
                /**
                 * Update state of button dependent on boolean value
                 * @param {Object} $btn - jQuery element
                 * @param {Boolean} show - Whether to show or hide or '$btn'
                 * @returns {undefined}
                 */
                function updateState($btn, show) {
                    if (show) {
                        $btn.show();
                    } else {
                        $btn.hide();
                    }
                }
                
                let isTF2 = appid === '440';
                let isCSGO = appid === '730';
                // "0" = buy order
                // "1" = sell order
                let listingIntent = URLPARAMS.listing_intent;
                // we are selling to a buy order, show button on their inventory
                let isSelling = !my && listingIntent === '0'; 
                // we are buying from a sell order, show button on my inventory
                let isBuying = my && listingIntent === '1';
                let showKeys = isTF2 || isCSGO;
                let showMetal = isTF2;
                let showListingButton = isTF2 && (isBuying || isSelling);
                
                updateState(page.btns.$items, true); 
                updateState(page.btns.$keys, showKeys);
                updateState(page.btns.$metal, showMetal);
                updateState(page.btns.$listing, showListingButton);
            }
            
            // user inventory changed
            function userChanged(el) {
                // fallback option for getting appid
                function appIdFallback() {
                    let src = get.$appSelectImg().attr('src') || ''; // fallback to appid from image
                    let match = src.match(/public\/images\/apps\/(\d+)/);
                    
                    return match && match[1];
                }
                
                let $inventory = get.$inventory();
                let $inventoryTab = $(el);
                let my = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
                let match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
                let appid = (match && match[1]) || appIdFallback();
                
                // now update the dispaly
                updateDisplay(my, appid);
            }
            
            function init() {
                function itemParamLoaded() {
                    // our partner's inventory is also loading at this point
                    // format: for_item=<appId>_<contextId>_<itemId>
                    let item = URLPARAMS.for_item.split('_');
                    let steamid = unsafeWindow.UserThem.strSteamId;
                    let $inventory = $(`#inventory_${steamid}_${item[0]}_${item[1]}`);
                    
                    return $inventory.length > 0;
                }
                
                function deadItem() {
                    let deadItemExists = get.$deadItem().length > 0;
                    let item = URLPARAMS.for_item.split('_');
                    
                    if (deadItemExists) {
                        unsafeWindow.g_rgCurrentTradeStatus.them.assets = [];
                        unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                        alert(
                            `Seems like the item you are looking to buy (ID: ${item[2]}) is no longer available. ` +
                            'You should check other user\'s backpack and see if it\'s still there.'
                        );
                    } else {
                        // Something was loading very slowly, restart init...
                        init();
                    }
                }
                
                // check if there are spinners on page to indicate whether the inventory is loaded
                function isReady() {
                    return get.$imgThrobber().length <= 0;
                }
                     
                // something is loading
                let hasItemParam = URLPARAMS.for_item !== undefined;
                let hasBeenLoaded = !hasItemParam || itemParamLoaded();
                let loaded = isReady() && hasBeenLoaded;
                let checkForDeadItem = hasItemParam && hasBeenLoaded;
                
                if (loaded) {
                    ready();
                    return;
                } else if (checkForDeadItem) {
                    // check for dead item and return
                    setTimeout(deadItem, 5000);
                    return;
                }
                
                // re-check
                setTimeout(init, 250);
            }
            
            return {
                init, summarize, clear, updateDisplay, userChanged
            };
        }());
        // used for identifying items
        const IDENTIFIERS = {
            // item is key
            IS_KEY: function(item) {
                switch (item.appid) {
                    case 440:
                        return item.market_hash_name === 'Mann Co. Supply Crate Key';
                    case 730:
                        return IDENTIFIERS.HAS_TAG(item, 'Tool', 'Key');
                }
                
                return null;
            },
            // item has tag
            HAS_TAG: function(item, tagName, tagValue) {
                if (!item.tags) return null;
                
                let tags = item.tags;
                
                for (let i = 0, n = tags.length; i < n; i++) {
                    let tag = tags[i];
                    let hasTag = tag.category === tagName &&
                        tagValue === tag.name;
    
                    if (hasTag) {
                        return true;
                    }
                }
                
                return null;
            }
        };
        // used for finding items
        // these are somewhat expensive
        // might make this faster later on
        const FINDERS = {
            // return items using finder method
            ITEMS: function(finder, user) {
                let $inventory = get.$inventory();
                let match = ($inventory.attr('id') || '').match(/(\d+)_(\d+)$/);
                
                // inventory must be present
                if ($inventory.length === 0 || !match) return;
                
                // default to currently active user
                user = user || (
                    page.$inventorySelectYour.hasClass('active') ?
                    unsafeWindow.UserYou :
                    unsafeWindow.UserThem
                );
                
                let $items = (
                    user === unsafeWindow.UserYou ?
                    page.$yourSlots.find('.item') :
                    page.$theirSlots.find('.item')
                );
                let [ ,appid, contextid] = match;
                let inventory = user.rgAppInfo[appid].rgContexts[contextid].inventory.rgInventory;
                // get list of id's in trade offer so we don't repeat any items
                let elIds = $items.map((index, el) => el.id).get();
                let items = Object.keys(inventory).map(k => inventory[k]).filter((item) => {
                    return elIds.indexOf(itemToElId(item)) === -1 && finder(item);
                }).sort((a, b) => a.pos - b.pos); // sort items by position
                
                return items;
            },
            METAL: (function() {
                function hasName(item, name) {
                    return item.appid == 440 && item.market_hash_name === name;
                }
                
                // find each type of metal
                return {
                    'Refined Metal': function() {
                        return FINDERS.ITEMS((item) => hasName(item, 'Refined Metal'));
                    },
                    'Reclaimed Metal': function() {
                        return FINDERS.ITEMS((item) => hasName(item, 'Reclaimed Metal'));
                    },
                    'Scrap Metal': function() {
                        return FINDERS.ITEMS((item) => hasName(item, 'Scrap Metal'));
                    }
                };
            }()),
            // return items by array of id's
            ID: function(ids) {
                let finder = FINDERS.ITEMS;
                let items = finder((item) => {
                    return ids.indexOf(item.id) !== -1;
                }).sort((a,b) => {
                    return ids.indexOf(a.id) - ids.indexOf(b.id);
                });
                
                return items;
            }
        };
        
        /**
         * Get an item's element ID using details from asset
         * @param {Object} item - Asset from Steam
         * @returns {String} Element ID for item
         */
        function itemToElId(item) {
            return `item${item.appid}_${item.contextid}_${item.id}`;
        }
        
        /**
         * Callback when items have finished adding
         * @callback addItems-callback
         * @param {Boolean} satisfied - Whether the amount to add was satisfied
         */
        
        /**
         * Add items to trade
         * @param {String} mode - Mode
         * @param {Number} amount - Number of items to add
         * @param {Number} index - Beginning index to select items at (negative to select from back)
         * @param {addItems-callback} callback - Callback when items have finished adding
         * @returns {undefined}
         */
        function addItems(mode, amount, index, callback = function() {}) {
            if (
                // amount is 0 or negative
                amount <= 0 ||
                // an inventory is not selected
                !(/(\d+)_(\d+)$/.test(get.$inventory().attr('id'))) ||
                // the offer cannot be modified
                get.$modifyTradeOffer().length > 0
            ) {
                // don't do anything
                return callback();
            }
            
            // move item to trade window
            function moveItem(item) {
                unsafeWindow.MoveItemToTrade(item);
            }
            
            // modified from steam's source
            // should be a little more optimized for adding multiple items
            function addMultiItems(items, callback) {
                if (items.length === 0) {
                    return callback();
                }
                
                let timeout = 20;
                
                // Add all items
                for (let i = 0, amount = items.length; i < amount; i++) {
                    setTimeout(moveItem, i * timeout, items[i]);
                }
                
                // Refresh summaries
                setTimeout(() => {
                    tradeOfferWindow.summarize();
                    return callback();
                }, (amount * timeout) + 100);
            }
            
            // map items to array of jQuery objects
            function mapItemsToJQ(items) {
                if (items.length === 0) return [];
                
                let elIds = items.map(itemToElId);
                let elIdFinder = elIds.map((id) => '#' + id).join(',');
                let $elements = page.$inventories.find(elIdFinder).toArray().sort((a, b) => {
                    return elIds.indexOf(a.id) - elIds.indexOf(b.id);
                });
                
                return $elements;
            }
            
            /**
             * Pick metal from items based on value in refined metal
             * @param {Number} value - Value to make
             * @param {Number} index - Index to add at
             * @returns {Object} Object containing items to add, and whether the value was met
             */
            function getItemsForMetal(value, index) {
                // rounds to nearest scrap value
                function scrapMetal(num) {
                    return Math.floor(Math.round(num * 9) / 9 * 100) / 100;
                }
                
                // value was met
                function valueMet() {
                    return total === value;
                }
                
                function getMetal(type) {
                    if (valueMet()) {
                        // empty array
                        return []; 
                    }
                    
                    let items = metal[type](); // get array of metal
                    let curValue = values[type];
                    // round each value for clean division
                    let count = Math.min(
                        // get number of metal to add based on how much more we need to add
                        // as well as the value of the metal we are adding
                        Math.floor(scrapMetal(value - total) / scrapMetal(curValue)),
                        // there isn't quite enough there...
                        items.length
                    ); 
                    let metalIndex = offsetIndex(index, count, items.length);
                    
                     // add it to the total
                    total = scrapMetal(total + (count * curValue));
                    
                    // splice each individual type of metal
                    return items.splice(metalIndex, count); 
                }
                
                let metal = FINDERS.METAL;
                let values = {
                    'Refined Metal': 1,
                    'Reclaimed Metal': 1 / 3,
                    'Scrap Metal': 1 / 9
                };
                let total = 0; // total to be added to
                let items = flatten(Object.keys(values).map(getMetal));
                
                return {
                    items: items,
                    satisfied: total === value
                };
            }
            
            /**
             * Offset index to pick items at based on amount and number of items available
             * @param {Number} index - Index
             * @param {Number} amount - Amount of items to pick
             * @param {Number} length - Number of items to pick from
             * @returns {Number} Modified index
             */
            function offsetIndex(index, amount, length) {
                if (index < 0) {
                    // pick from back if index is negative
                    return Math.max(0, length - (amount + index + 1));
                } else if (index + amount >= length) {
                    // offset if index + the amount is greater than the number of items we can pick
                    return length - amount;
                } else {
                    return index; // no offset needed
                }
            }
            
            /**
             * Offset amount based on the number of items available
             * @param {Number} value - Amount to add
             * @param {Number} length - Maximum number of items to pick from
             * @returns {Number} Modified amount
             */
            function modifyAmount(value, length) {
                return Math.min(Math.floor(value), length);
            }
            
            /**
             * Pick items from 'items'
             * @param {Array} items - Array of items to pick from
             * @param {Number} amount - Number of items to pick
             * @param {Number} index - Index to start picking items at
             * @returns {Array} Array of jQuery objects for items
             */
            function pickItems(items, amount, index) {
                
                amount = modifyAmount(amount, items.length);
                index = offsetIndex(index, amount, items.length);
                items = items.splice(index, amount); // get first "count" starting at "start"
                
                // check if item is inventory item
                if (items.length && items[0].appid) {
                    // wrap items to jquery elements
                    items = mapItemsToJQ(items);
                }
                
                return items;
            }
            
            function flatten(arrays) {
                return [].concat(...arrays);
            }
            
            /**
             * Collect items based on conditions
             * @param {String} mode - Mode
             * @param {Number} amount - Number of items to pick
             * @param {Number} index - Index to start picking items at
             * @returns {Array} First value is an array of items, second is whether the amount was satisfied
             */
            function getItems(mode, amount, index) {
                // check if an element's display is not set to "none"
                function isVisible(i, el) {
                    return $(el).css('display') !== 'none';
                }
                
                // get the original amount before it is changed
                let items, satisfied;
                
                switch (mode) {
                    case 'keys': {
                        let found = FINDERS.ITEMS(IDENTIFIERS.IS_KEY) || [];
                        
                        items = pickItems(found, amount, index);
                        satisfied = amount === items.length;
                    } break;
                    case 'metal': {
                        let found = getItemsForMetal(amount, index);
                        
                        items = mapItemsToJQ(found.items);
                        satisfied = found.satisfied;
                    } break;
                    case 'id': {
                        // list of id's is passed through index
                        let ids = index; 
                        let found = FINDERS.ID(ids);
                        
                        items = pickItems(found, found.length, 0);
                        satisfied = ids.length === items.length;
                    } break;
                    case 'items':
                    default: {
                        // select all visible items from active inventory
                        let found = get.$inventory().find('div.item').filter(isVisible);
                        
                        items = pickItems(found, amount, index);
                        satisfied = amount === items.length;
                    } break;
                }
                
                return [
                    items,
                    satisfied
                ];
            }
            
            let [items, satisfied] = getItems(mode, amount, index);
            
            addMultiItems(items, () => callback(satisfied));
        }
        
        function ready() {
            // add elements to page
            function addElements() {
                function getStyles() {
                    return `
                        .tradeoffer_items_summary { color: #FFFFFF; font-size: 12px; }
                        .warning { color: #ff4422; }
                        .info { padding: 1px 3px; border-radius: 4px; background-color: #1155FF; border: 1px solid #003399; font-size: 14px; }
                        .summary_item { padding: 3px; margin: 0 2px 2px 0; background-color: #3C352E; background-position: center; background-size: 48px 48px; background-repeat: no-repeat; border: 1px solid; font-size: 16px; width: 48px; height: 48px; display: inline-block; }
                        .summary_badge { padding: 1px 3px; border-radius: 4px; background-color: #0099CC; border: 1px solid #003399; font-size: 12px; }
                        .filter_full { width: 200px }
                        .btn_custom { margin-right: 6px; }
                        .btn_keys { background-color: #709D3C; }
                        .btn_metal { background-color: #676767; }
                        .btn_listing { background-color: #2E4766; }
                    `;
                }
                
                function getControls() {
                    return `
                        <div class="trade_rule selectableNone"/>
                        <div class="selectableNone">Add multiple items:</div>
                        <div class="filter_ctn">
                            <input id="amount_control" class="filter_search_box" type="number" step="any" min="0" placeholder="amount">
                            <input id="index_control" class="filter_search_box" type="number" min="0" placeholder="index">
                        </div>
                        <button id="btn_additems" type="button" class="btn_items btn_custom btn_add btn_black btn_small"><span>Add</span></button>
                        <button id="btn_addkeys" type="button" class="btn_keys btn_add btn_custom btn_black btn_small"><span>Add Keys</span></button>
                        <button id="btn_addmetal" type="button" class="btn_metal btn_add btn_custom btn_black btn_small"><span>Add Metal</span></button>
                        <button id="btn_addlisting" type="button" class="btn_listing btn_add btn_custom btn_black btn_small"><span>Add Listing</span></button>
                        
                        <br>
                        <br>
                        <div id="btn_clearmyitems" type="button" class="btn_custom btn_black btn_small"><span>Clear my items</span></div>
                        <div id="btn_cleartheiritems" type="button" class="btn_custom btn_black btn_small"><span>Clear their items</span></div>
                        <br/>
                        <br/>
                    `;
                }
                
                function getIDControls() {
                    return  `
                        <div id="id_fields">
                            <div class="filter_ctn">
                                <div class="filter_control_ctn">
                                    <input id="ids_control" class="filter_search_box filter_full" type="text" placeholder="ids" />
                                </div>
                                <div class="filter_tag_button_ctn filter_right_controls">
                                    <div id="btn_addids" type="button" class="btn_ids_add btn_custom btn_black btn_small"><span>Add</span></div>
                                    <div id="btn_getids" type="button" class="btn_ids_get btn_custom btn_black btn_small"><span>Get</span></div>
                                </div>
                                <div style="clear: both;"></div>
                            </div>
                        </div>
                        <div class="trade_rule selectableNone"/>
                    `;
                }
                
                function addStyles(styles) {
                    $(`<style type="text/css">${styles}</style>`).appendTo('head');
                }
                
                function addControls() {
                    let $tradeBox = page.$tradeBoxContents;
                    let $tradeBoxParent = $tradeBox.parent();
                    
                    $tradeBox.append(getControls());
                    // disabled
                    // $tradeBox.append(getIDControls());
                    
                    $tradeBox.append('<div class="tradeoffer_items_summary"/>');
                    $tradeBox.appendTo($tradeBoxParent); // re-add to parent
                }
                
                addStyles(getStyles());
                addControls();
            }
                
            // add newly created elements to page object
            function getPageElements() {
                page.$offerSummary = $('.tradeoffer_items_summary');
                page.controls = {
                    $amount: $('#amount_control'),
                    $index: $('#index_control'),
                    $ids: $('#ids_control')
                };
                page.btns = {
                    $clearMy: $('#btn_clearmyitems'),
                    $clearTheir: $('#btn_cleartheiritems'),
                    $items: $('#btn_additems'),
                    $keys: $('#btn_addkeys'),
                    $metal: $('#btn_addmetal'),
                    $listing: $('#btn_addlisting'),
                    $addIDs: $('#btn_addids'),
                    $getIDs: $('#btn_getids')
                };
            }
            
            function bindEvents() {
                // the user change from one app to another
                function appChanged(el) {
                    let $el = $(el);
                    let id = $el.attr('id');
                    let match = id.match(/appselect_option_(you|them)_(\d+)_(\d+)/);
                    
                    if (match) {
                        let my = match[1] === 'you';
                        let appid = match[2];
                        let contextid = match[3];
                        
                        tradeOfferWindow.updateDisplay(my, appid, contextid);
                    }
                }
                
                /**
                 * Callback when items have finished adding
                 * @callback addCurrencies-callback
                 * @param {Array} reasons - Array of reasons if value was not met for each currency
                 */
                
                /**
                 * Add currencies to the trade
                 * @param {Object} currencies - Object containing currencies
                 * @param {addCurrencies-callback} callback - Callback when all items have been added
                 * @returns {undefined}
                 */
                function addCurrencies(currencies, callback) {
                    let names = Object.keys(currencies).filter((currency) => {
                        return currencies[currency] > 0;
                    });
                    let reasons = [];
                    
                    function addCurrency(callback) {
                        let currency = names.shift(); // get first name and remove it from array
                        let amount = currencies[currency];
                        
                        if (currency) {
                            addItems(currency, amount, 0, (satisfied) => {
                                if (!satisfied) {
                                    reasons.push(`not enough ${currency}`);
                                }
                                
                                addCurrency(callback); // recurse
                            });
                        } else {
                            return callback(reasons);
                        }
                    }
                    
                    addCurrency(callback);
                }
                
                // add the listing price
                function addListingPrice() {
                    // make sure inventory has loaded first
                    if (page.$inventoryBox.find('img[src$="throbber.gif"]:visible').length > 0) {
                        return;
                    }
                    
                    addCurrencies({
                        keys: parseInt(URLPARAMS.listing_currencies_keys) || 0,
                        metal: parseFloat(URLPARAMS.listing_currencies_metal) || 0
                    }, (reasons) => {
                        if (reasons.length > 0) {
                            // display message if any currencies were not met
                            alert(`Listing value could not be met: ${reasons.join(' and ')}`);
                        }
                    });
                }
                
                /**
                 * Add items by list of IDs
                 * @param {String} idsStr - Comma-seperated list of IDs
                 * @returns {undefined}
                 */
                function addIDs(idsStr) {
                    let ids = getIDsFromString(idsStr);
                    
                    if (ids) {
                        addItems('id', 1, ids);
                    }
                }
                
                // get default amount and index value based on fields
                function getDefaults() {
                    return [
                        // amount
                        parseFloat(page.controls.$amount.val()) || 1,
                        // index
                        parseInt(page.controls.$index.val()) || 0
                    ];
                }
                
                page.$body.on('dblclick', '#mainContent .trade_area .item', () => {
                    setTimeout(() => {
                        tradeOfferWindow.summarize();
                    }, 50);
                });
                
                page.$appSelectOption.click((e) => {
                    appChanged(e.target);
                });
                
                page.$inventorySelectYour.click(() => {
                    tradeOfferWindow.userChanged(page.$inventorySelectYour);
                });
                
                page.$inventorySelectTheir.click(() => {
                    tradeOfferWindow.userChanged(page.$inventorySelectTheir);
                });
                
                page.btns.$clearMy.click(() => {
                    tradeOfferWindow.clear(page.$yourSlots);
                });
                
                page.btns.$clearTheir.click(() => {
                    tradeOfferWindow.clear(page.$theirSlots);
                });
                
                page.btns.$items.click(() => {
                    addItems('items', ...getDefaults());
                });
                
                page.btns.$keys.click(() => {
                    addItems('keys', ...getDefaults());
                });
                
                page.btns.$metal.click(() => {
                    addItems('metal', ...getDefaults());
                });
                
                page.btns.$listing.click(() => {
                    addListingPrice();
                });
                
                page.btns.$addIDs.click(() => {
                    addIDs(page.controls.$ids.val());
                });
                
                unsafeWindow.addIDs = addIDs; // expose...
            }
            
            function configure() {
                function initTradeOfferWindow() {
                    tradeOfferWindow.init();
                    tradeOfferWindow.userChanged(get.$activeInventoryTab());
                }
                
                // hack to fix empty space under inventory
                // TODO get rid of this if they ever fix it
                function fixHeight() {
                    if (page.$inventoryDisplayControls.height() <= 50) return;
                    
                    if (page.$inventories.css('marginBottom') === '8px') {
                        page.$inventories.css('marginBottom', '7px');
                    } else {
                        page.$inventories.css('marginBottom', '8px');
                    }
                }
                
                function checkURLParam(param) {
                    if (param === undefined) return;
                    
                    let [ appid, contextid, assetid ] = param.split('_');
                    let item = {
                        appid,
                        contextid,
                        assetid,
                        amount: 1
                    };
                    
                    unsafeWindow.g_rgCurrentTradeStatus.them.assets.push(item);
                    unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                }
                
                checkURLParam(URLPARAMS.for_item);
                initTradeOfferWindow();
                setInterval(fixHeight, 500);
            }
            
            addElements();
            getPageElements();
            bindEvents();
            configure();
        }
        
        // perform actions
        ready();
    }
    
    function getClassifieds() {
        const page = {
            $listing: $('.listing')
        };
        
        function stringToCurrencies(string) {
            if (string) {
                let prices = string.split(',');
                let currencies = {};
                let currencyNames = {
                    'metal': 'metal',
                    'ref': 'metal',
                    'keys': 'keys',
                    'key': 'keys'
                };
                
                for (let i = 0, length = prices.length; i < length; i++) {
                    // match currencies - the first value is the amount
                    // the second value is the currency name
                    let match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
                    let currency = match && currencyNames[match[2]];
                    
                    if (currency) {
                        currencies[currency] = parseFloat(match[1]);
                    } else {
                        // something is missing
                        return null;
                    }
                }
                
                if (Object.keys(currencies).length) {
                    return currencies;
                }
            }
            
            return null;
        }
        
        function modifyLinks() {
            function getQuery(intent, currencies) {
                let params = {
                    listing_intent: intent === 'buy' ? 0 : 1
                };
                
                for (let k in currencies) {
                    params['listing_currencies_' + k] = currencies[k];
                }
                
                return Object.keys(params).map((k) => {
                    return k + '=' + params[k];
                });
            }
            
            page.$listing.each((i, el) => {
                let $listing = $(el);
                let $item = $listing.find('.item');
                let $link = $listing.find('.listing-buttons a.btn:last');
                let href = $link.attr('href');
                let price = $item.attr('data-listing_price');
                let intent = $item.attr('data-listing_intent');
                let currencies = stringToCurrencies(price);
                
                if (currencies) {
                    let query = getQuery(intent, currencies);
                    let url = [href, ...query].join('&'); // url with query added
                    
                    $link.attr('href', url);
                }
            });
        }
        
        function ready() {
            modifyLinks();
        }
        
        // perform actions
        ready();
    }
    
    function getInventory() {
        const URLPARAMS = getURLParams();
        const page = {
            $backpack: $('#backpack'),
            $refined: $('.refined-value')
        };
        const get = {
            $listedItems: () => $('.item:visible').not('.unselected').filter('[data-listing_price]'),
            $firstSelectPage: () => $('.select-page').first(),
            $sortByPrice: () => $('li[data-value=price]'),
            $backpackPage: () => $('.backpack-page')
        };
        
        function sortByPrice() {
            get.$sortByPrice().trigger('click');
        }
        
        function updateTotals() {
            // hackish way of updating totals
            get.$firstSelectPage().trigger('click');
            get.$firstSelectPage().trigger('click');
        }
        
        // obvserve changes to refined value
        function observeRefinedValue() {
            function refinedValueChanged() {
                // get pretty value in keys
                function getKeyValue(val) {
                    return Math.round(Price.valueInKeys(val) * 10) / 10;
                }
                
                /**
                 * Update the refined field
                 * @param {Number} keys - Total key value of all selected items
                 * @param {Number} keysListed - Total listed value in keys of all selected items
                 * @returns {undefined}
                 */
                function update(keys, keysListed) {
                    let listedValue = `${keysListed} keys listed value`;
                    
                    $refined.text(keys);
                    $refined.attr({
                        'title': listedValue,
                        'data-original-title': listedValue
                    });
                    // clear title
                    $refined.attr('title', ''); 
                    // change the text from "refined" to "keys"
                    $refined.closest('li').find('small').text('keys'); 
                }
                
                function observeRefChanges() {
                    // observe changes to ref value
                    observer.observe(page.$refined[0], {
                        childList: true,
                        attributes: true,
                        subtree: true
                    });
                }
                
                // get total value of all items in keys by converting ref value
                function getKeys() {
                    let text = $refined.text().replace(/,/g, '').trim();
                    let refined = parseFloat(text);
                    
                    return getKeyValue(refined);
                }
                
                function getKeysListed() {
                    let prices = $listedItems.map((i, el) => {
                        // get refined value of listing price
                        return new Price(el.dataset.listing_price).getRefinedValue();
                    }).get();
                    let refined = prices.reduce((a, b) => a + b, 0);
                    
                    return getKeyValue(refined);
                }
                
                let $refined = page.$refined;
                let $listedItems = get.$listedItems();
                let hasChanged = ( 
                    // ref value has changed
                    $refined.text() != last.ref ||
                    // number of listed items selected has changed
                    $listedItems.length != last.listed 
                );
                
                // ensure the refined value is different from the previous value
                // this will prevent re-calculation when hovering over ref value
                if (hasChanged) {
                    // disconnect so we can modify the object
                    // without calling this function again
                    observer.disconnect();
                    // update the ref value
                    update(getKeys(), getKeysListed());
                    // observe changes again
                    observeRefChanges(); 
                    
                    // get values to detect for changes on next check
                    last = {
                        ref: $refined.text(),
                        listed: $listedItems.length
                    };
                }
            }
        
            let observer = new MutationObserver(refinedValueChanged);
            let last = {};
            
            refinedValueChanged();
        }
        
        function backpackLoaded() {
            // ids are comma-seperated in select param
            let select = getIDsFromString(URLPARAMS.select);  
            let session = unsafeWindow.Session;
            let rawValue = session &&
                session.rawCurrency &&
                session.rawCurrency.value;
            
            if (rawValue) {
                Price.setup(rawValue);
                observeRefinedValue();
            }
            
            if (select) {
                selectItems(select); // select items if select param is present
            }
        }
        
        function hideEmptyPages() {
            get.$backpackPage().each((i, el) => {
                let $page = $(el);
                let $items = $page.find('.item-list .item');
                
                if ($items.length === 0) {
                    $page.hide();
                }
            });
        }
        
        // select items in inventory by id's
        function selectItems(ids) {
            let $backpack = page.$backpack;
            let $items = $backpack.find('.item:not(.spacer)');
            let selectors = ids.map(id => `[data-id="${id}"]`);
            let $filtered = $items.filter(selectors.join(',')); // select items
            
            if ($filtered.length) {
                let $unfiltered = $items.not($filtered);
                let $spacers = $backpack.find('.spacer');
                // all hidden items are moved to a temp page
                let $tempPage = $('<div class="temp-page" style="display:none;"/>'); 
                
                sortByPrice(); // sort
                $backpack.append($tempPage); // then add the temp page, it will be hidden
                $spacers.appendTo($tempPage); // remove spacers
                $unfiltered.appendTo($tempPage); // add the unfiltered items to the temp page
                hideEmptyPages(); // hide pages that contain no items
                updateTotals(); // then update totals
            }
        }
        
        function ready() {
            // wait until items are loaded, call "backpackLoaded" only once
            waitForKeyElements('#backpack > .backpack-page:first', backpackLoaded, true);
        }
        
        // perform actions
        ready();
    }
    
    // perform actions
    ready();
}());