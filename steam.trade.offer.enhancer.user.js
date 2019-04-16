// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @author      Julia
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @description Browser script to enhance Steam trade offers.
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
// @version     1.7.0
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // all of the code that runs when the page is loaded is here
    function ready() {
        [
            // trade offer window pages
            {
                pattern: /^https?:\/\/steamcommunity\.com\/tradeoffer.*/,
                fn: getTradeOfferWindow
            },
            // trade offers pages
            {
                pattern: /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/,
                fn: getTradeOffers
            },
            // classified pages
            {
                pattern: /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(stats|classifieds).*/,
                fn: getClassifieds
            },
            // inventory pages
            {
                pattern: /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/,
                fn: getInventory
            }
        ].find((mode) => {
            // will call function when something matches, then stop
            return mode.pattern.test(location.href) && (mode.fn() || true);
        });
    }
    
    function getTradeOfferWindow() {
        const $ = unsafeWindow.jQuery;
        const URLPARAMS = Utils.getURLParams();
        const STEAMID = unsafeWindow.UserYou.strSteamId;
        const PARTNER_STEAMID = unsafeWindow.UserThem.strSteamId;
        const page = {
            $document: $(document),
            $body: $('body'),
            $yourSlots: $('#your_slots'),
            $theirSlots: $('#their_slots'),
            $inventories: $('#inventories'),
            $inventoryBox: $('#inventory_box'),
            $inventoryDisplayControls: $('#inventory_displaycontrols'),
            $inventorySelectYour: $('#inventory_select_your_inventory'),
            $inventorySelectTheir: $('#inventory_select_their_inventory'),
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
            $deadItem: () => $('a[href$="_undefined"]'),
            $tradeItemBox: () => page.$tradeBoxContents.find('div.trade_item_box')
        };
        let tradeOfferWindow = (function() {
            /**
             * Get inventory for user
             * @param {Boolean} you - Is this your inventory?
             * @returns {Object} Your inventory if 'yours' is true, otherwise their inventory
             */
            function getInventory(you) {
                let myInventory = unsafeWindow.g_rgAppContextData;
                let themInventory = unsafeWindow.g_rgPartnerAppContextData;
                
                return you ? myInventory : themInventory;
            }
            
            /**
             * Get summary of items
             * @param {Object} $items - jQuery object of collection of items
             * @param {Boolean} you - Are these your items?
             * @returns {(Object|null)} Summary of items, null if inventory is not properly loaded
             */
            function evaluateItems($items, you) {
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
                                item.appid === 440 &&
                                rare440Keys.indexOf(defindex) !== -1;
                        }
                    },
                    {
                        name: 'uncraftable item',
                        check: function(item) {
                            let descriptions = item.descriptions;
                            let isUncraftable = (description) => {
                                return !description.color &&
                                    description.value === '( Not Usable in Crafting )';
                            };
                            
                            return typeof descriptions === 'object' &&
                                item.appid === 440 &&
                                descriptions.some(isUncraftable);
                        }
                    },
                    {
                        name: 'spelled item',
                        check: function(item) {
                            let descriptions = item.descriptions;
                            let isSpelled = (description) => {
                                return description.color === '7ea9d1' &&
                                    description.value.indexOf('(spell only active during event)') !== -1;
                            };
                            
                            return typeof descriptions === 'object' &&
                                item.appid === 440 &&
                                descriptions.some(isSpelled);
                        }
                    },
                    {
                        name: 'restricted gift',
                        check: function(item) {
                            let fraudwarnings = item.fraudwarnings;
                            let isRestricted = (text) => {
                                return text.indexOf('restricted gift') !== -1;
                            };
                            
                            return typeof fraudwarnings === 'object' &&
                                item.appid === 753 && 
                                fraudwarnings.some(isRestricted);
                        }
                    }
                ];
                let inventory = getInventory(you);
                let total = $items.length;
                let apps = {};
                let items = {};
                let warnings = [];
                let valid = true;
                
                $items.each((i, item) => {
                    // get the info for the item
                    // array containing item identifiers e.g. ['440', '2', '123']
                    let split = item.id.replace('item', '').split('_'); 
                    let [appid, contextid, assetid] = split;
                    let img = item.getElementsByTagName('img')[0].getAttribute('src');
                    let quality = item.style.borderColor;
                    let inventoryItem = inventory[appid] &&
                        inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid];
                    
                    if (!inventoryItem) {
                        // not properly loaded
                        return (valid = false); 
                    }
                    
                    if (!apps[appid]) {
                        apps[appid] = [];
                    }
                    
                    items[img] = items[img] || {};
                    items[img][quality] = (items[img][quality] || 0) + 1;
                    apps[appid].push(assetid);
                    
                    WARNINGS.forEach((warning) => {
                        let warningText = `Offer contains ${warning.name}(s).`;
                        let addWarning = warnings.indexOf(warningText) === -1 &&
                            warning.check(inventoryItem);
                            
                        if (addWarning) {
                            warnings.push(warningText);
                        }
                    });
                });
                
                if (valid) {
                    return { total, apps, items, warnings };
                } else {
                    return null;
                }
            }
            
            /**
             * Get summary HTML
             * @param {String} type - Name of user e.g. "Your" or "Their"
             * @param {(Object|null)} summary - Result from evaluateItems
             * @param {Object} User - User object from steam that the items belong to
             * @returns {String} Summary HTML
             */
            function dumpSummary(type, summary, user) {
                if (summary === null || summary.total === 0) return ''; // no summary or no items
                
                function getHeader() {
                    let itemsStr = total === 1 ? 'item' : 'items';
                    
                    return `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;
                }
                
                function getSummary() {
                    /**
                     * Wrap HTML in backpack.tf link for items
                     * @param {String} html - HTML contents to wrap around
                     * @param {Array} ids - Array of IDs to include in URL
                     * @returns {String} HTML with link wrapped around
                     */
                    function wrapBackpackLink(html, ids) {
                        let steamid = user.strSteamId;
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
                        for (let img in items) {
                            for (let quality in items[img]) {
                                let count = items[img][quality];
                                
                                html += getItem(img, quality, count);
                            }
                        }
                        
                        return html;
                    }
                    
                    let ids = apps['440'];
                    
                    if (ids) {
                        // if tf2 items are in offer
                        // return summary items with backpack.tf link wrapped around 
                        return wrapBackpackLink(getItems(), ids);
                    } else {
                        return getItems();
                    }
                }
                
                function getWarnings() {
                    if (warnings.length === 0) return ''; // no warnings to display
                    
                    // so that descriptions are always in the same order
                    let descriptions = warnings.sort().join('<br/>');
                    
                    return `<div class="warning">${descriptions}</span>`;
                }
                
                // unpack summary...
                let { total, apps, items, warnings } = summary;
                
                // build html piece-by-piece
                return [
                    getHeader(),
                    getSummary(),
                    getWarnings()
                ].join('');
            }
            
            function summarize(you) {
                function getSummary(config) {
                    let $items = config.$slots.find('div.item');
                    let summary = evaluateItems($items, config.you);
                    let html = dumpSummary(config.name, summary, config.user);
                    
                    return html;
                }
                
                let config = {
                    you: {
                        you: true,
                        name: 'My',
                        user: unsafeWindow.UserYou,
                        $slots: page.$yourSlots,
                        $container: page.$yourSummary
                    },
                    them: {
                        you: false,
                        name: 'Their',
                        user: unsafeWindow.UserThem,
                        $slots: page.$theirSlots,
                        $container: page.$theirSummary
                    }
                }[you ? 'you' : 'them'];
                
                config.$container.html(getSummary(config));
            }
            
            // clear items that were added to the offer
            function clear($addedItems) {
                let items = $addedItems.find('div.item').get();
                
                // remove all at once
                unsafeWindow.GTradeStateManager.RemoveItemsFromTrade(items.reverse());
                
                // remove by each item
                // let Clear = unsafeWindow.MoveItemToInventory;
                // chain(items.reverse(), 100, Clear, summarize);
            }
            
            function addItems(items, callback) {
                let MoveItem = unsafeWindow.MoveItemToTrade;
                
                chain(items, 20, MoveItem, callback);
            }
            
            // update button display
            function updateDisplay(you, appid) {
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
                
                let isTF2 = appid == 440;
                let isCSGO = appid == 730;
                let listingIntent = URLPARAMS.listing_intent;
                let showKeys = isTF2 || isCSGO;
                let showMetal = isTF2;
                // 0 = buy order
                // 1 = sell order
                // we are buying, add items from our inventory
                let buying = you && listingIntent == 1;
                let selling = !you && listingIntent == 0;
                let showListingButton = isTF2 && (buying || selling);
                
                updateState(page.btns.$items, true); 
                updateState(page.btns.$keys, showKeys);
                updateState(page.btns.$metal, showMetal);
                updateState(page.btns.$listing, showListingButton);
            }
            
            // user inventory changed
            function userChanged($inventoryTab) {
                // fallback option for getting appid
                function appIdFallback() {
                    let src = get.$appSelectImg().attr('src') || ''; // fallback to appid from image
                    let match = src.match(/public\/images\/apps\/(\d+)/);
                    
                    return match && match[1];
                }
                
                let $inventory = get.$inventory();
                let you = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
                let match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
                let appid = (match && match[1]) || appIdFallback();
                
                // now update the dispaly
                updateDisplay(you, appid);
            }
            
            function ready() {
                // call userchanged on current active tab
                userChanged(get.$activeInventoryTab()); 
            }
            
            return {
                ready, summarize, clear, addItems, updateDisplay, userChanged
            };
        }());
        const inventoryManager = (function() {
            let inventories = {};
            let users = {};
            
            users[STEAMID] = [];
            users[PARTNER_STEAMID] = [];
            inventories[STEAMID] = {};
            inventories[PARTNER_STEAMID] = {};
            
            function addApp(steamid, appid, fn) {
                if (!inventories[steamid][appid]) {
                    inventories[steamid][appid] = [];
                }
                
                inventories[steamid][appid].push(fn);
            }
            
            function call(steamid, appid) {
                let actions = [
                    ...users[steamid],
                    ...(inventories[steamid][appid] || [])
                ];
                
                // clear
                users[steamid] = [];
                inventories[steamid][appid] = [];
                // call all functions
                actions.forEach(fn => fn());
            }
            
            function register(steamid, appid, fn) {
                if (appid) {
                    addApp(...arguments);
                } else {
                    users[steamid].push(fn);
                }
            }
            
            return {
                register, call
            };
        }());
        // used for identifying items
        const IDENTIFIERS = {
            // item is key
            IS_KEY: function(item) {
                switch (parseInt(item.appid)) {
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
            ITEMS: function(finder, you, both) {
                function getInventory(user) {
                    return (user.rgAppInfo[appid] &&
                        user.rgAppInfo[appid].rgContexts[contextid].inventory &&
                        user.rgAppInfo[appid].rgContexts[contextid].inventory.rgInventory
                    ) || {};
                }
                
                function getItems(you) {
                    let user = you ? unsafeWindow.UserYou : unsafeWindow.UserThem;
                    let $items = (you ? page.$yourSlots : page.$theirSlots).find('.item');
                    let inventory = getInventory(user);
                    // get list of id's in trade offer so we don't repeat any items
                    let elIds = $items.map((index, el) => el.id).get();
                    let items = Object.keys(inventory).map(k => inventory[k]).filter((item) => {
                        return elIds.indexOf(itemToElId(item)) === -1 && finder(item);
                    }).sort((a, b) => a.pos - b.pos); // sort items by position
                    
                    return items;
                }
                
                let $inventory = get.$inventory();
                let match = ($inventory.attr('id') || '').match(/(\d+)_(\d+)$/);
                let [ ,appid, contextid] = (match || []);
                
                // inventory must be present
                if (!appid) return;
                
                if (both) {
                    // get items for both users
                    return Utils.flatten([ true, false ].map(getItems));
                } else {
                    let test = (
                        (you !== undefined && you !== null) ?
                        you === true :
                        page.$inventorySelectYour.hasClass('active')
                    );
                    
                    // get items for user based on test
                    return getItems(test);
                }
            },
            METAL: (function() {
                function hasMetal(item, name) {
                    return item.appid == 440 && item.market_hash_name === name;
                }
                
                // find each type of metal
                return {
                    'Refined Metal': function(you) {
                        return FINDERS.ITEMS((item) => hasMetal(item, 'Refined Metal'), you);
                    },
                    'Reclaimed Metal': function(you) {
                        return FINDERS.ITEMS((item) => hasMetal(item, 'Reclaimed Metal'), you);
                    },
                    'Scrap Metal': function(you) {
                        return FINDERS.ITEMS((item) => hasMetal(item, 'Scrap Metal'), you);
                    }
                };
            }()),
            // return items by array of id's
            ID: function(ids, you) {
                let finder = FINDERS.ITEMS;
                let items = finder((item) => {
                    return ids.indexOf(item.id) !== -1;
                }, you, true).sort((a,b) => {
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
         * Callback when chain has finished
         * @callback chain-callback
         */
        
        /**
         * Call function for each item one after another
         * @param {Array} items - Array
         * @param {Number} Number - Time between each call
         * @param {Function} fn - Function to call on item
         * @param {chain-callback} [callback] - Callback when chain has finished
         * @returns {undefined}
         */
        function chain(items, timeout, fn, callback) {
            function getNext(callback) {
                let item = items.shift();
                
                if (item) {
                    fn(item);
                    setTimeout(getNext, timeout, callback);
                } else {
                    return callback();
                }
            }
            
            getNext(callback);
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
         * @param {Boolean} [you] - Add to your side?
         * @param {addItems-callback} [callback] - Callback when items have finished adding
         * @returns {undefined}
         */
        function addItems(mode, amount, index, you, callback = function() {}) {
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
             * @param {Boolean} [you] - Add to your side?
             * @returns {Array} First value is an array of items, second is whether the amount was satisfied
             */
            function getItemsForMetal(value, index, you) {
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
                    
                    let items = metal[type](you); // get array of metal
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
                let items = mapItemsToJQ(Utils.flatten(Object.keys(values).map(getMetal)));
                let satisfied = total === value;
                
                return [ items, satisfied ];
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
            
            /**
             * Collect items based on conditions
             * @param {String} mode - Mode
             * @param {Number} amount - Number of items to pick
             * @param {Number} index - Index to start picking items at
             * @param {Boolean} [you] - Add to your side?
             * @returns {Array} First value is an array of items, second is whether the amount was satisfied
             */
            function getItems(mode, amount, index, you) {
                // check if an element's display is not set to "none"
                function isVisible(i, el) {
                    return $(el).css('display') !== 'none';
                }
                
                let items, satisfied;
                
                switch (mode) {
                    case 'keys': {
                        let found = FINDERS.ITEMS(IDENTIFIERS.IS_KEY, you);
                        
                        items = pickItems(found, amount, index);
                        satisfied = amount === items.length;
                    } break;
                    case 'metal': {
                        [ items, satisfied ] = getItemsForMetal(amount, index, you);
                    } break;
                    case 'id': {
                        // list of id's is passed through index
                        let ids = index; 
                        let found = FINDERS.ID(ids, you);
                        
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
                
                return [ items,  satisfied ];
            }
            
            let [items, satisfied] = getItems(mode, amount, index, you);
            
            tradeOfferWindow.addItems(items, () => {
                callback(satisfied);
            });
        }
        
        function ready() {
            // add elements to page
            function addElements() {
                // trim empty spaces
                function trim(string) {
                    return string.replace(/\s{2,}/g, ' ');
                }
                
                function getStyles() {
                    return trim(`
                        #tradeoffer_items_summary {
                            font-size: 12px;
                            color: #FFFFFF;
                        }
                        .warning {
                            color: #ff4422;
                        }
                        .info {
                            padding: 1px 3px;
                            border-radius: 4px;
                            font-size: 14px;
                            background-color: #1155FF;
                            border: 1px solid #003399;
                        }
                        .summary_item {
                            display: inline-block;
                            width: 48px;
                            height: 48px;
                            padding: 3px;
                            margin: 0 2px 2px 0;
                            border: 1px solid;
                            background-color: #3C352E;
                            background-position: center;
                            background-size: 48px 48px;
                            background-repeat: no-repeat;
                        }
                        .summary_badge {
                            padding: 1px 3px;
                            border-radius: 4px;
                            background-color: #0099CC;
                            border: 1px solid #003399;
                            font-size: 12px;
                        }
                        .items_summary {
                            margin-top: 8px
                        }
                        .summary_header {
                            margin-bottom: 4px;
                        }
                        .filter_full {
                            width: 200px;
                        }
                        .filter_number {
                            width: 110px;
                        }
                        .btn_custom {
                            margin-right: 6px;
                        }
                        .btn_keys {
                            background-color: #709D3C;
                        }
                        .btn_metal {
                            background-color: #676767;
                        }
                        .btn_listing {
                            background-color: #2E4766;
                        }
                        .control_fields {
                            margin-top: 8px
                        }
                    `);
                }
                
                function getControls() {
                    return trim(`
                        <div id="controls">
                            <div class="trade_rule selectableNone"/>
                            <div class="selectableNone">Add multiple items:</div>
                            <div class="filter_ctn">
                                <input id="amount_control" class="filter_search_box filter_number" type="number" step="any" min="0" placeholder="amount">
                                <input id="index_control" class="filter_search_box filter_number" type="number" min="0" placeholder="index">
                            </div>
                            <div id="add_btns" class="control_fields">
                                <button id="btn_additems" type="button" class="btn_items btn_custom btn_add btn_black btn_small"><span>Add</span></button>
                                <button id="btn_addkeys" type="button" class="btn_keys btn_add btn_custom btn_black btn_small"><span>Add Keys</span></button>
                                <button id="btn_addmetal" type="button" class="btn_metal btn_add btn_custom btn_black btn_small"><span>Add Metal</span></button>
                                <button id="btn_addlisting" type="button" class="btn_listing btn_add btn_custom btn_black btn_small"><span>Add Listing</span></button>
                            </div>
                            <div id="clear_btns" class="control_fields">
                                <div id="btn_clearmyitems" type="button" class="btn_custom btn_black btn_small"><span>Clear my items</span></div>
                                <div id="btn_cleartheiritems" type="button" class="btn_custom btn_black btn_small"><span>Clear their items</span></div>
                            </div>
                        </div>  
                    `);
                }
                
                function getIDControls() {
                    return  trim(`
                        <div id="id_fields" class="control_fields" style="display: none;">
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
                    `);
                }
                
                function getItemSummary() {
                    return trim(`
                        <div id="tradeoffer_items_summary">
                            <div class="items_summary" id="your_summary"></div>
                            <div class="items_summary" id="their_summary"></div>
                        </div>
                    `);
                }
                
                function addStyles(styles) {
                    $(`<style type="text/css">${styles}</style>`).appendTo('head');
                }
                
                function addControls() {
                    let $tradeBox = page.$tradeBoxContents;
                    let html = [
                        getControls(),
                        getIDControls(),
                        getItemSummary()
                    ].join('');
                    
                    $tradeBox.append(html);
                }
                
                addStyles(getStyles());
                addControls();
            }
                
            // add newly created elements to page object
            function getPageElements() {
                page.$offerSummary = $('#tradeoffer_items_summary');
                page.$yourSummary = $('#your_summary');
                page.$theirSummary = $('#their_summary');
                page.controls = {
                    $amount: $('#amount_control'),
                    $index: $('#index_control'),
                    $ids: $('#ids_control')
                };
                page.fields = {
                    $ids: $('#id_fields'),
                    $controls: $('#controls')
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
                        let you = match[1] === 'you';
                        let appid = match[2];
                        let contextid = match[3];
                        
                        tradeOfferWindow.updateDisplay(you, appid, contextid);
                    }
                }
                
                /**
                 * Callback when items have finished adding
                 * @callback addCurrencies-callback
                 * @param {Array} reasons - Array of reasons if value was not met for each currency
                 */
                
                /**
                 * Add currencies to the trade
                 * @param {Boolean} [you] - Are we adding from your inventory?
                 * @param {Object} currencies - Object containing currencies
                 * @param {addCurrencies-callback} callback - Callback when all items have been added
                 * @returns {undefined}
                 */
                function addCurrencies(you, currencies, callback) {
                    let names = Object.keys(currencies).filter((currency) => {
                        return currencies[currency] > 0;
                    });
                    let reasons = [];
                    
                    function addCurrency(callback) {
                        let currency = names.shift(); // get first name and remove it from array
                        let amount = currencies[currency];
                        
                        if (currency) {
                            addItems(currency, amount, 0, you, (satisfied) => {
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
                    // 0 = buy order
                    // 1 = sell order
                    let listingIntent = URLPARAMS.listing_intent;
                    // we are buying, add items from our inventory
                    let you = listingIntent == 1;
                    
                    addCurrencies(you, {
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
                    let ids = Utils.getIDsFromString(idsStr);
                    
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
                
                function toggleIDFields() {
                    let $controls = page.fields.$ids.toggle();
                    let isVisible  = $controls.is(':visible') ? 1 : 0;
                    
                    Utils.setCookie('enhancer_idFieldVisiblity', isVisible, 360);
                }
                
                // get list of ids of items in trade offer
                function getIDs() {
                    let you = get.$activeInventoryTab().attr('id') === 'inventory_select_your_inventory';
                    let $slots = you ? page.$yourSlots : page.$theirSlots;
                    let $items = $slots.find('div.item');
                    
                    return $items.map((i, el) => {
                        let $item = $(el);
                        // array containing item identifiers e.g. ['440', '2', '123']
                        let split = $item.attr('id').replace('item', '').split('_'); 
                        let assetid = split[2];
                        
                        return assetid;
                    }).get().filter(a => a);
                }
                
                function keyPressed(e) {
                    Utils.execHotKey(e, {
                        // P
                        112: toggleIDFields
                    });
                }
                
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
                page.btns.$getIDs.click(() => {
                    page.controls.$ids.val(getIDs().join(','));
                });
                page.$document.keypress((e) => {
                    keyPressed(e);
                });
                
                unsafeWindow.addIDs = addIDs; // expose...
            }
            
            // observe changes to dom
            function observe() {
                function tradeSlots() {
                    function observeSlots($slots, you) {
                        function summarize() {
                            tradeOfferWindow.summarize(you);
                            lastSummarized = new Date(); // add date
                        }
                        
                        let observer = new MutationObserver(() => {
                            let canInstantSummarize = (
                                !lastSummarized ||
                                // compare with date when last summarized
                                new Date() - lastSummarized > 200  ||
                                // large summaries take longer to build and can hurt performance
                                $slots.find('> div').length <= 204
                            );
                            
                            if (canInstantSummarize) {
                                summarize();
                            } else {
                                clearTimeout(timer);
                                timer = setTimeout(summarize, 200);
                            }
                        });
                        let settings = {
                            childList: true,
                            characterData: false,
                            subtree: true
                        };
                        let lastSummarized = new Date();
                        let timer;
                        
                        observer.observe($slots[0], settings);
                    }
                    
                    observeSlots(page.$yourSlots, true);
                    observeSlots(page.$theirSlots, false);
                }
                
                function inventories() {
                    let observer = new MutationObserver((mutations) => {
                        if (!mutations[0].addedNodes) return;
                        
                        let mutation = mutations[0];
                        let inventory = mutation.addedNodes[0];
                        let split = inventory.id.replace('inventory_', '').split('_');
                        let [steamid, appid] = split;
                        
                        inventoryManager.call(steamid, appid);
                    });
                    let settings = {
                        childList: true,
                        characterData: false,
                        subtree: false
                    };
                    
                    observer.observe(page.$inventories[0], settings);
                }
                
                tradeSlots();
                inventories();
            }
            
            function bindInventoryEvents() {
                // this will force an inventory to load
                function forceInventory(appid, contextid) {
                    unsafeWindow.g_rgCurrentTradeStatus.them.assets.push({
                        appid: appid,
                        contextid: contextid,
                        assetid: '0',
                        amount: 1
                    });
                    unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                    unsafeWindow.g_rgCurrentTradeStatus.them.assets = [];
                    unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                }
                
                inventoryManager.register(STEAMID, null, () => {
                    tradeOfferWindow.ready();
                });
                
                if (URLPARAMS.listing_intent !== undefined) {
                    // we are buying, add items from our inventory
                    let selling = URLPARAMS.listing_intent == 0;
                    
                    page.btns.$listing.addClass(selling ? 'selling' : 'buying');
                    
                    // force their inventory to load if we are selling
                    if (selling) {
                        forceInventory('440', '2');
                    }
                }
                
                if (URLPARAMS.for_item !== undefined) {
                    let [ appid, contextid, assetid ] = URLPARAMS.for_item.split('_');
                    let item = {
                        appid,
                        contextid,
                        assetid,
                        amount: 1
                    };
                    
                    unsafeWindow.g_rgCurrentTradeStatus.them.assets.push(item);
                    unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                    
                    // check for a dead item when this inventory is loaded
                    inventoryManager.register(PARTNER_STEAMID, appid, () => {
                        if (get.$deadItem().length > 0) {
                            unsafeWindow.g_rgCurrentTradeStatus.them.assets = [];
                            unsafeWindow.RefreshTradeStatus(unsafeWindow.g_rgCurrentTradeStatus, true);
                            alert(
                                `Seems like the item you are looking to buy (ID: ${assetid}) is no longer available. ` +
                                'You should check other user\'s backpack and see if it\'s still there.'
                            );
                        }
                    });
                }
                
                // why would you open this
                inventoryManager.register(STEAMID, '578080', () => {
                    alert('wow why are you looking at your pubg inventory');
                });
            }
            
            function overrides() {
                // basically remove animation due to bugginess
                // also it's a bit faster
                unsafeWindow.EnsureSufficientTradeSlots = function(bYourSlots, cSlotsInUse, cCurrencySlotsInUse) {
                    let $slots = bYourSlots ? page.$yourSlots : page.$theirSlots;
                    let elSlotContainer = $slots[0];
                    let cTotalSlotsInUse = cSlotsInUse + cCurrencySlotsInUse;
                    let cDesiredSlots = (
                        unsafeWindow.Economy_UseResponsiveLayout() ?
                        cTotalSlotsInUse + 1 :
                        Math.max(Math.floor((cTotalSlotsInUse + 5) / 4) * 4, 8)
                    );
                    let cDesiredItemSlots = cDesiredSlots - cCurrencySlotsInUse;
                    let cCurrentItemSlots = elSlotContainer.childElements().length;
                    let cCurrentSlots = cCurrentItemSlots + cCurrencySlotsInUse;
                    let bElementsChanged = cDesiredSlots !== cCurrentSlots;
                    let fnOnAnimComplete = null;
                    
                    if (cDesiredSlots > cCurrentSlots) {
                        let Create = unsafeWindow.CreateTradeSlot;
                        
                        for (let i = cCurrentItemSlots; i < cDesiredItemSlots; i++) {
                            Create(bYourSlots, i);
                        }
                    } else if (cDesiredSlots < cCurrentSlots) {
                        // going to compact
                        let prefix = bYourSlots ? 'your_slot_' : 'their_slot_';
                        let rgElementsToRemove = [];
                        let $parent = $slots.parent();
                        
                        for (let i = cDesiredItemSlots; i < cCurrentItemSlots; i++) {
                            let element = $slots.find('#' + prefix + i)[0];
                            
                            element.id = '';
                            $parent.append(element.remove());
                            rgElementsToRemove.push(element);
                        }
                        
                        fnOnAnimComplete = function() {
                            rgElementsToRemove.invoke('remove');
                        };
                    }
                    
                    if (bElementsChanged && fnOnAnimComplete) {
                        fnOnAnimComplete();
                    }
                };
                // remove multiple items from a trade offer at once
                // pretty much removes all items INSTANTLY
                unsafeWindow.GTradeStateManager.RemoveItemsFromTrade = function(items) {
                    function checkItems(items, you) {
                        if (items.length === 0) return false;
                        
                        function getGroups(rgItems) {
                            let groupBy = Utils.groupBy;
                            let grouped = groupBy(rgItems, 'appid');
                            
                            for (let appid in grouped) {
                                grouped[appid] = groupBy(grouped[appid], 'contextid');
                                
                                for (let contextid in grouped[appid]) {
                                    grouped[appid][contextid] = groupBy(grouped[appid][contextid], 'id');
                                }
                            }
                            
                            return grouped;
                        }
                        
                        // iteration dom elements and collect rgItems from items
                        function iterItems(items) {
                            let rgItems = [];
                            let revertItem = unsafeWindow.RevertItem;
                            let isInTradeSlot = unsafeWindow.BIsInTradeSlot;
                            let cleanSlot = unsafeWindow.CleanupSlot;
                            let setStackItemInTrade = unsafeWindow.SetStackableItemInTrade;
                            
                            for (let i = items.length - 1; i >= 0; i--) {
                                let elItem = items[i];
                                let item = elItem.rgItem;
                                
                                if (isInTradeSlot(elItem)) {
                                    cleanSlot(elItem.parentNode.parentNode);
                                }
                                
                                if (item.is_stackable) {
                                    // stackable items are fully removed by this call
                                    setStackItemInTrade(item, 0);
                                    continue;
                                }
                                
                                revertItem(item);
                                item.homeElement.down('.slot_actionmenu_button').show();
                                rgItems.push(item);
                            }
                            
                            return rgItems;
                        }
                        
                        // iterate assets in slots
                        function iterAssets(rgItems) {
                            if (rgItems.length === 0) return false;
                            
                            function getItem(appid, contextid, assetid) {
                                return groups[appid] &&
                                    groups[appid][contextid] &&
                                    groups[appid][contextid][assetid];
                            }
                            
                            let rgStatus = unsafeWindow.g_rgCurrentTradeStatus;
                            let slots = you ? rgStatus.me : rgStatus.them;
                            let assets = slots.assets;
                            let groups = getGroups(rgItems);
                            let bChanged;
                            
                            for (let i = assets.length - 1; i >= 0; i--) {
                                let asset = assets[i];
                                let item= getItem(asset.appid, asset.contextid, asset.assetid);
                                
                                if (item) {
                                    bChanged = true;
                                    assets.splice(i, 1);
                                }
                            }
                            
                            return bChanged;
                        }
                        
                        // return true if any assets were removed from trade
                        return iterAssets(iterItems(items));
                    }
                    
                    let manager = unsafeWindow.GTradeStateManager;
                    let [yours, theirs] = Utils.partition(items, (elItem) => {
                        return !elItem.rgItem.is_their_item;
                    });
                    let hasChanged = [
                        checkItems(yours, true),
                        checkItems(theirs, false)
                    ].some(a => a);
                    
                    if (hasChanged) {
                        manager.m_bChangesMade = true;
                        manager.UpdateTradeStatus();
                    }
                };
            }
            
            function configure() {
                // hack to fix empty space under inventory
                // TODO get rid of this if they ever fix it
                function fixHeight() {
                    if (page.$inventoryDisplayControls.height() >= 50) return;
                    
                    page.$inventories.css('marginBottom', '8px');
                    /*
                    if (page.$inventories.css('marginBottom') === '8px') {
                        page.$inventories.css('marginBottom', '7px');
                    } else {
                        page.$inventories.css('marginBottom', '8px');
                    }
                    */
                }
                
                tradeOfferWindow.userChanged(get.$activeInventoryTab());
                
                if (Utils.getCookie('enhancer_idFieldVisiblity') == 1) {
                    page.fields.$ids.show();
                }
                
                if (URLPARAMS.listing_intent !== undefined) {
                    let selling = URLPARAMS.listing_intent == 0;
                    
                    page.btns.$listing.addClass(selling ? 'selling' : 'buying');
                }
                
                page.$inventories.css('marginBottom', '8px');
                setInterval(fixHeight, 500);
            }
            
            addElements();
            getPageElements();
            bindEvents();
            bindInventoryEvents();
            observe();
            configure();
            overrides();
        }
        
        // perform actions
        ready();
    }
    
    function getTradeOffers() {
        const $ = unsafeWindow.jQuery;
        const page = {
            $offers: $('.tradeoffer'),
            $reportBtn: $('.btn_report')
        };
        const get = {
            $summaryActions: () => $('.summary_action')
        };
        
        function getStyles() {
            return `
                .btn_user_link {
                    background-position: 14px 0px;
                    background-repeat: no-repeat !important;
                    width: 0;
                    margin-top: -8px;
                    margin-left: 6px;
                    padding-left: 44px;
                    line-height: 30px;
                    float: right;
                }
                .btn_user_link:hover {
                    background-position: 14px -30px !important;
                    background-color: #808285;
                }
                .rep_btn {
                    background-image: url(https://i.imgur.com/OD9rRAB.png) !important;
                }
                .backpack_btn {
                    background-image: url(https://i.imgur.com/8LvnfuX.png) !important;
                }
                .tradeoffer_items_summary {
                    position: relative;
                    background-color: #1D1D1D;
                    border: 1px solid #3D3D3E;
                    border-radius: 5px;
                    padding: 17px;
                    margin-top: 8px;
                    width: 100%;
                    font-size: 12px;
                    color: #FFFFFF;
                    display: flex;
                    box-sizing: border-box;
                }
                .items_summary {
                    width: 50%;
                    margin-right: 2.1%;
                    display: inline-block;
                }
                .items_summary:last-child {
                    margin-right: 0;
                }
                .summary_header {
                    margin-bottom: 12px;
                }
                .summary_item {
                    display: inline-block;
                    width: 44px;
                    height: 44px;
                    padding: 3px;
                    margin: 0 2px 2px 0;
                    border: 1px solid;
                    background-color: #3C352E;
                    background-position: center;
                    background-size: 44px 44px;
                    background-repeat: no-repeat;
                }
                .summary_badge {
                    padding: 1px 3px;
                    border-radius: 4px;
                    background-color: #0099CC;
                    border: 1px solid #003399;
                    font-size: 12px;
                }
            `;
        }
        
        function addStyles(styles) {
            $(`<style type="text/css">${styles}</style>`).appendTo('head');
        }
        
        function evaluateItems($items) {
            let total = $items.length;
            let items = {};
            
            $items.each((i, item) => {
                let img = item.getElementsByTagName('img')[0].getAttribute('src');
                let quality = item.style.borderColor;
                
                items[img] = items[img] || {};
                items[img][quality] = (items[img][quality] || 0) + 1;
            });
            
            return { total, items };
        }
    
        function dumpSummary(type, summary) {
            if (summary.total === 0) return '';
            
            function getHeader() {
                let itemsStr = total === 1 ? 'item' : 'items';
                
                return `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;
            }
            
            function getSummary() {
                function getItems() {
                    let html = '';
                    
                    function getItem(img, quality, count) {
                        let styles = `background-image: url(${img}); border-color: ${quality};`;
                        let badge = `<span class="summary_badge">${count}</span>`;
                        
                        return `<span class="summary_item" style="${styles}">${badge}</span>`;
                    }
                    
                    // item counts
                    for (let img in items) {
                        for (let quality in items[img]) {
                            let count = items[img][quality];
                            
                            html += getItem(img, quality, count);
                        }
                    }
                    
                    return html;
                }
                
                return getItems();
            }
            
            function wrap(html) {
                return `<div class="items_summary">${html}</div>`;
            }
            
            // unpack summary...
            let { total, items } = summary;
            
            return wrap([
                getHeader(),
                getSummary()
            ].join(''));
        }
        
        function toggleSummary($offer) {
            function createSummary() {
                function wrap(html) {
                    return `<div class="tradeoffer_items_summary">${html}</div>`;
                }
                
                let html = wrap($offer.find('.tradeoffer_items').toArray().reverse().map((el) => {
                    let $group = $(el);
                    let $items= $group.find('div.trade_item');
                    let my = !$group.hasClass('primary');
                    let type = my ? 'My' : 'Their';
                    let summary = evaluateItems($items);
                    let html = dumpSummary(type, summary);
                    
                    return html;
                }).join(''));
                
                $offer.append(html);
            }
            
            function hideSummary() {
                $summary.hide();
            }
            
            function showSummary() {
                $summary.show();
            }
            
            let $summary = $offer.find('.tradeoffer_items_summary');
            
            if ($summary.is(':visible')) {
                hideSummary();
            } else if ($summary.length > 0) {
                showSummary();
            } else {
                createSummary();
            }
        }
        
        function checkOffer(i, el) {
            function getButtons(steamid, personaname) {
                function makeReplacements(string) {
                    return string.replace('%personaname%', personaname) // replace personaname
                        .replace('%steamid%', steamid); // replace steamid
                }
                // generate html for button
                function getButton(button) {
                    let href = makeReplacements(button.url);
                    let title = makeReplacements(button.title);
                    let classes = [button.className, 'btn_grey_grey', 'btn_small', 'btn_user_link'];
                    
                    return `<a href="${href}" title="${title}" class="${classes.join(' ')}">&nbsp;</a>`;
                }
                
                // all the lovely buttons we want to add
                let buttonsToAdd = [
                    {
                        title: 'View %personaname%\'s backpack',
                        // %steamid% is replaced with user's steamid
                        url: 'https://backpack.tf/profiles/%steamid%',
                        // each button has a class name for which image to use
                        className: 'backpack_btn'
                    },
                    {
                        title: 'View %personaname%\'s Rep.tf page',
                        url: 'https://rep.tf/%steamid%',
                        className: 'rep_btn' 
                    }
                ];
                let buttons = buttonsToAdd.map(getButton);
                // reverse to preserve order
                let html = buttons.reverse().join('');
                
                return html;
            }
            
            function getActions() {
                function getAction(action) {
                    let classes = [action.className, 'whiteLink'];
                    
                    return `<a href="javascript:void(0);" class="${classes.join(' ')}">${action.title}</a> | `;
                }
                
                let actionsToAdd = [
                    {
                        title: 'Summary',
                        className: 'summary_action'
                    }
                ];
                let actions = actionsToAdd.map(getAction);
                let html = actions.reverse().join('');
                
                return html;
            }
            
            let $offer = $(el);
            let $reportButton = $offer.find('.btn_report');
            let $actions = $offer.find('.tradeoffer_footer_actions');
            
            // sent offers will not have a report button - we won't add any buttons to them
            if ($reportButton.length > 0) {
                // match steamid, personaname
                let pattern = /ReportTradeScam\( ?\'(\d{17})\', ?"(.*)"\ ?\)/;
                let match = ($reportButton.attr('onclick') || '').match(pattern);
                
                if (match) {
                    let [ , steamid, personaname] = match;
                    
                    // insert html for buttons
                    $reportButton.after(getButtons(steamid, personaname)); 
                }
            }
            
            if ($actions.length > 0) {
                $actions.prepend(getActions());
            }
        }
        
        function bindEvents() {
            get.$summaryActions().click((e) => {
                toggleSummary($(e.target).closest('.tradeoffer'));
            });
        }
        
        function ready() {
            addStyles(getStyles()); // add styles
            page.$offers.each(checkOffer);
            page.$reportBtn.remove();
            bindEvents();
        }
        
        // perform actions
        ready();
    }
    
    function getClassifieds() {
        const page = {
            $listing: $('.listing')
        };
        
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
                let currencies = Utils.stringToCurrencies(price);
                
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
        const URLPARAMS =Utils.getURLParams();
        const page = {
            $document: $(document),
            $backpack: $('#backpack'),
            $refined: $('.refined-value'),
            $inventorySortMenu: $('#inventory-sort-menu ul.dropdown-menu')
        };
        const get = {
            $selected: () => page.$backpack.find('li.item:visible:not(.unselected)'),
            $listedItems: () => page.$backpack.find('li.item:visible:not(.unselected)[data-listing_price]'),
            $firstSelectPage: () => page.$backpack.find('span.select-page:first'),
            $backpackPage: () => page.$backpack.find('div.backpack-page'),
            $itemPricedInKeys: () => page.$backpack.find('li.item[data-p_bptf*="keys"]:first'),
            $crateKey: () => page.$backpack.find('.item[data-name="Mann Co. Supply Crate Key"]:first'),
            $inventoryCmpFrom: () => $('#inventory-cmp-from'),
            $inventoryCmpTo: () => $('#inventory-cmp-to')
        };
        
        // obvserve changes to refined value
        function observeRefinedValue(keyValue) {
            function refinedValueChanged() {
                // get pretty value in keys
                function refinedToKeys(value) {
                    return Math.round((value / keyValue) * 10) / 10;
                }
                
                // get refined value from currencies
                function getRefinedValue(currencies) {
                    return (currencies.metal || 0) +
                        (currencies.keys || 0) * keyValue;
                }
                
                /**
                 * Update the refined field
                 * @param {Number} keys - Total key value of all selected items
                 * @param {Number} keysListed - Total listed value in keys of all selected items
                 * @returns {undefined}
                 */
                function update(keysValue, keysListedValue) {
                    let listedValue = `${keysListedValue} keys listed value`;
                    
                    $refined.text(keysValue);
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
                function getKeysValue() {
                    let text = $refined.text().replace(/,/g, '').trim();
                    let refined = parseFloat(text);
                    
                    return refinedToKeys(refined);
                }
                
                function getKeysListedValue() {
                    let prices = $listedItems.map((i, el) => {
                        let listingPrice = el.dataset.listing_price;
                        // get refined value of listing price
                        let currencies = Utils.stringToCurrencies(listingPrice);
                        let refined = currencies && getRefinedValue(currencies);
                        
                        return refined || 0;
                    }).get();
                    let refined = prices.reduce((a, b) => a + b, 0);
                    
                    return refinedToKeys(refined);
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
                    update(getKeysValue(), getKeysListedValue());
                    // observe changes again
                    observeRefChanges(); 
                    
                    // get values to detect changes on next check
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
        
        // get the value of keys
        function getKeyValue() {
            /**
             * Get pricing details from item
             * @param {Object} item - DOM element of data
             * @returns {Object} Object containing price details
             */
            function parseItem(item) {
                // parse price string e.g. "1-1.2 keys"
                function parseString(string) {
                    let match = string.match(/^([\d\.]*)[\-\u2013]?([\d\.]*)? (\w*)/); 
                    let currencyNames = {
                        'metal': 'metal',
                        'ref': 'metal',
                        'keys': 'keys',
                        'key': 'keys'
                    };
                    
                    if (match) {
                        details.value = parseFloat(match[1]);
                        details.average = details.value;
                        details.currency = currencyNames[match[3]]; 
                        
                        // if there are 3 match groups, there is a range
                        if (match[2]) {
                            details.value_high = parseFloat(match[2]);
                            details.average = (details.value + details.value_high) / 2;
                        }
                    }
                }
                
                let data = item.dataset;
                let details = {};
                
                if (data.price) {
                    details.raw = parseFloat(data.price);
                }
                
                if (data.p_bptf) {
                    parseString(data.p_bptf);
                }
                
                return details;
            }
            
            // find item priced in keys
            let item = get.$itemPricedInKeys()[0];
            let price = item && parseItem(item);
            
            if (price && price.currency === 'keys' && price.average && price.raw) {
                // to get the value of keys in refined metal...
                // take the price in metal divided by the price in keys
                return price.raw / price.average;
            } else {
                // set value using the value of a key, if no items in inventory are priced in keys
                let key = get.$crateKey()[0];
                let price = key && parseItem(key);
                
                return price && price.value;
            }
        }
        
        // select items in inventory by id's
        function filterItems(ids) {
            function hideEmptyPages() {
                get.$backpackPage().each((i, el) => {
                    let $page = $(el);
                    let $items = $page.find('.item-list .item');
                    
                    if ($items.length === 0) {
                        $page.hide();
                    }
                });
            }
            
            function updateTotals() {
                // hackish way of updating totals
                get.$firstSelectPage().trigger('click');
                get.$firstSelectPage().trigger('click');
            }
            
            let $backpack = page.$backpack;
            let $items = $backpack.find('li.item:not(.spacer)');
            let selectors = ids.map(id => `[data-id="${id}"]`);
            let $filtered = $items.filter(selectors.join(',')); // select items
            
            if ($filtered.length) {
                let $unfiltered = $items.not($filtered);
                let $spacers = $backpack.find('li.spacer');
                // all hidden items are moved to a temp page
                let $tempPage = $('<div class="temp-page" style="display:none;"/>');
                
                sortBy('price'); // sort
                $backpack.append($tempPage); // then add the temp page, it will be hidden
                $spacers.appendTo($tempPage); // remove spacers
                $unfiltered.appendTo($tempPage); // add the unfiltered items to the temp page
                hideEmptyPages(); // hide pages that contain no items
                updateTotals(); // then update totals
            }
        }
        
        function sortBy(key) {
            page.$inventorySortMenu.find(`li[data-value="${key}"]`).trigger('click');
        }
        
        function copyToClipboard(str) {
            let el = document.createElement('textarea');
            el.value = str;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        
        function waitForBackpack() {
            function untilBackpackLoaded(callback) {
                // wait until items are loaded
                let observer = new MutationObserver((mutations) => {
                    // if the mutations include an item list, items have been added
                    let hasItemList = mutations.some((mutation) => {
                        return mutation.addedNodes &&
                            mutation.target.className === 'item-list';
                    });
                    
                    if (hasItemList) {
                        // disconnect observer since the backpack has been loaded
                        observer.disconnect();
                        // then callback
                        return callback();
                    }
                });
                let backpack = document.getElementById('backpack');
                let settings = {
                    childList: true,
                    subtree: true,
                    attributes: false,
                    characterData: false
                };
                
                observer.observe(backpack, settings);
            }
            
            untilBackpackLoaded(backpackLoaded);
        }
        
        function backpackLoaded() {
            // ids are comma-seperated in select param
            let select = Utils.getIDsFromString(URLPARAMS.select);  
            // get value of keys in refined using rawValue
            let keyValue = getKeyValue();
            
            if (keyValue) {
                observeRefinedValue(keyValue);
            }
            
            if (select) {
                filterItems(select); // select items if select param is present
            }
            
            bindEvents();
        }
        
        /**
         * Get IDs of all selected items
         * @returns {Array} Array of IDs
         */
        function getIDs() {
            return get.$selected().map((i, el) => {
                return el.dataset.id;
            }).get();
        }
        
        /**
         * Change comparison
         * @param {Boolean} up - Go to next day if true, previous day if false
         * @returns {undefined}
         */
        function compare(up) {
            let $from = get.$inventoryCmpFrom();
            let $to = get.$inventoryCmpTo();
            let available = $from.length && !$from.hasClass('disabled');
            
            if (!available) {
                return;
            }
            
            let from = parseInt($from.val());
            let to = parseInt($to.val());
            let options = $from.find('option').map((i, el) => {
                return parseInt(el.value);
            }).get();
            let filtered = options.filter((option) => {
                if (option === to || option === from) {
                    return false;
                } else if (up) {
                    return option > to;
                } else {
                    return option < to;
                }
            });
            
            if (filtered.length === 0) {
                return;
            }
            
            let value = up ? Math.min(...filtered) : Math.max(...filtered);
            let abs = [from, to].map(a => Math.abs(a - value));
            // farthest... closest? I failed math, but it works
            let farthest = Math.min(...abs) === Math.abs(from - value) ? from : to;
            
            if (farthest === from) {
                $to.val(value).trigger('change');
            } else if (farthest === to) {
                $from.val(value).trigger('change');
            }
        }
        
        function bindEvents() {
            function copyIDs() {
                copyToClipboard(getIDs().join(','));
            }
            
            function keyPressed(e) {
                Utils.execHotKey(e, {
                    // P
                    112: copyIDs,
                    // 1
                    49: () => sortBy('bpslot'),
                    // 2
                    50: () => sortBy('price'),
                    // 3
                    51: () => sortBy('market'),
                    // W
                    119: () => compare(true),
                    // S
                    115: () => compare(false)
                });
            }
            
            page.$document.keypress((e) => {
                keyPressed(e);
            });
        }
        
        function ready() {
            waitForBackpack();
        }
        
        // perform actions
        ready();
    }
    
    const Utils = {
        /**
         * Get URL parameters
         * @returns {Object} Object containing url parameters e.g. { 'item': 'Fruit Shoot' }
         */
        getURLParams: function() {
            let params = {};
            let pattern = /[?&]+([^=&]+)=([^&]*)/gi;
            
            window.location.search.replace(pattern, (str, key, value) => {
                params[key] = decodeURIComponent(value);
            });
            
            return params;
        },
        /**
         * Check if a variable is undefined, null, or an empty string ('')
         * @param {*} value - Value to check
         * @returns {Boolean} Is empty?
         */
        isEmpty: function(value) {
            return value === undefined || value === null || value === '';
        },
        /**
         * Get unique values from array
         * @param {Array} arr - Array of basic items (strings, numbers)
         * @returns {Array} Array with unique values
         */
        uniq: function(arr) {
            return [...new Set(arr)];
        },
        /**
         * Get a list of IDs from a comma-seperated string
         * @param {String} str - Comma-seperated string
         * @returns {(Array|null)} Array if string is valid, null if not
         */
        getIDsFromString: function(str) {
            if (/(\d+)(,\s*\d+)*/.test(str)) {
                return str.split(',');
            }
            
            return null;
        },
        /**
         * Execute hot key command
         * @param {Object} e - Event
         * @param {Object} hotKeys - Hot keys mapped to functions
         * @returns {undefined}
         */
        execHotKey: function(e, hotKeys) {
            let isTextField = /textarea|select/i.test(e.target.nodeName) || 
                [ 'number', 'text' ].indexOf(e.target.type) !== -1;
            let code = e.keyCode || e.which;
            let method = hotKeys[code];
            
            if (!isTextField && method) {
                method();
            }
        },
        /**
         * Flatten arrays
         * @param {Array} arrays - Array of arrays
         * @returns {Array} Flatten array
         */
        flatten: function(arrays) {
            return [].concat(...arrays);
        },
        /**
         * Partition array based on conditions
         * @param {Array} arr - Array
         * @param {Function} fn - Function to satisfy
         * @returns {Array} Partitioned array
         */
        partition: function(arr, fn) {
           let result = [[], []];
           
           for (let i = 0; i < arr.length; i++) {
               result[fn(arr[i]) ? 0 : 1].push(arr[i]);
           }
           
           return result;
        },
        /**
         * Group an array by value from key
         * @param {Array} arr - Array
         * @param {String} key - Key to take value from
         * @returns {Object} Object of groups
         */
        groupBy: function(arr, key) {
            return arr.reduce((a, b) => {
                (a[b[key]] = a[b[key]] || []).push(b);
                
                return a;
            }, {});
        },
        /**
         * Set a cookie's value
         * @param {String} name - Name of cookie
         * @param {*} [value=''] - Value of cookie
         * @param {Number} [days] - Expiration from now in days
         * @returns {String} Value of cookie
         */
        setCookie: function(name, value = '', days = 90) {
            let expires = '';
            let oneDay = 24 * 60 * 60 * 1000;
            let date = new Date();
            
            if (days) {
                date.setTime(date.getTime() + (days * oneDay));
                expires = '; expires=' + date.toUTCString();
            }
            
            document.cookie = name + '=' + (value || '')  + expires + '; path=/';
        },
        /**
         * Get a cookie's value
         * @param {String} name - Name of cookie
         * @returns {String} Value of cookie
         */
        getCookie: function(name) {
            let nameEQ = name + '=';
            let ca = document.cookie.split(';');
            
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                
                while (c.charAt(0) == ' ') {
                    c = c.substring(1,c.length);
                }
                
                if (c.indexOf(nameEQ) == 0) {
                    return c.substring(nameEQ.length, c.length);
                }
            }
            
            return null;
        },
        /**
         * Convert a currency string to a currency object
         * @param {String} string - String to parse
         * @returns {(Object|null)} Object of currencies if string is valid
         */
        stringToCurrencies: function(string) {
            let prices = string.split(',');
            let currencies = {};
            let currencyNames = {
                'metal': 'metal',
                'ref': 'metal',
                'keys': 'keys',
                'key': 'keys'
            };
            
            for (let i = 0, n = prices.length; i < n; i++) {
                // match currencies - the first value is the amount
                // the second value is the currency name
                let match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i) || [];
                let currency = match && currencyNames[match[2]];
                let value = match && parseFloat(match[1]);
                
                if (currency) {
                    currencies[currency] = value;
                } else {
                    // something isn't right
                    return null;
                }
            }
            
            if (Object.keys(currencies).length) {
                return currencies;
            } else {
                return null;
            }
        }
    };
    
    // perform actions
    ready();
}());