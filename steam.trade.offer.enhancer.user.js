// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @description Browser script to enhance Steam trade offers.
// @version     1.9.0
// @author      Julia
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
// @updateURL   https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.meta.js
// @downloadURL https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.user.js
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       unsafeWindow
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
        const $ = UW.jQuery;
        const urlParams = Utils.getURLParams();
        const STEAMID = UW.UserYou.strSteamId;
        const PARTNER_STEAMID = UW.UserThem.strSteamId;
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
            $appSelectOption: $('.appselect_options .option'),
            // get jquery elements which are constantly changing based on page state
            get: {
                $inventory: () => $('.inventory_ctn:visible'),
                $activeInventoryTab: () => $('.inventory_user_tab.active'),
                $modifyTradeOffer: () => $('div.modify_trade_offer:visible'),
                $imgThrobber: () => $('img[src$="throbber.gif"]:visible'),
                $appSelectImg: () => $('#appselect_activeapp img'),
                $deadItem: () => $('a[href$="_undefined"]'),
                $tradeItemBox: () => page.$tradeBoxContents.find('div.trade_item_box')
            }
        };
        // keys for stored values
        const stored = {
            id_visible: 'getTradeOfferWindow.id_visible'
        };
        /**
         * Interact with trade offer
         * 
         * @namespace tradeOfferWindow
         */
        const tradeOfferWindow = (function() {
            /**
             * Get summary of items
             * @param {Object} $items - jQuery object of collection of items
             * @param {Boolean} you - Are these your items?
             * @returns {(Object|null)} Summary of items, null if inventory is not properly loaded
             */
            function evaluateItems($items, you) {
                let warningIdentifiers = [
                    {
                        name: 'rare TF2 key',
                        appid: '440',
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
                                rare440Keys.indexOf(defindex) !== -1;
                        }
                    },
                    {
                        name: 'uncraftable item',
                        appid: '440',
                        check: function(item) {
                            let descriptions = item.descriptions;
                            let isUncraftable = (description) => {
                                return !description.color &&
                                    description.value === '( Not Usable in Crafting )';
                            };
                            
                            return typeof descriptions === 'object' &&
                                descriptions.some(isUncraftable);
                        }
                    },
                    {
                        name: 'spelled item',
                        appid: '440',
                        check: function(item) {
                            let descriptions = item.descriptions;
                            let isSpelled = (description) => {
                                return description.color === '7ea9d1' &&
                                    description.value.indexOf('(spell only active during event)') !== -1;
                            };
                            
                            return typeof descriptions === 'object' &&
                                descriptions.some(isSpelled);
                        }
                    },
                    {
                        name: 'restricted gift',
                        appid: '753',
                        check: function(item) {
                            let fraudwarnings = item.fraudwarnings;
                            let isRestricted = (text) => {
                                return text.indexOf('restricted gift') !== -1;
                            };
                            
                            return typeof fraudwarnings === 'object' &&
                                fraudwarnings.some(isRestricted);
                        }
                    }
                ];
                let inventory = getUserInventory(you);
                let total = $items.length;
                let apps = {};
                let items = {};
                let warnings = [];
                let valid = true;
                
                $items.toArray().forEach((itemEl) => {
                    // array containing item identifiers e.g. ['440', '2', '123']
                    let split = itemEl.id.replace('item', '').split('_'); 
                    let [appid, contextid, assetid] = split;
                    let img = itemEl.getElementsByTagName('img')[0].getAttribute('src');
                    let quality = itemEl.style.borderColor;
                    let effect = itemEl.getAttribute('data-effect') || 'none';
                    let item = inventory[appid] &&
                        inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid];
                    
                    if (!item) {
                        // not properly loaded
                        return (valid = false); 
                    }
                    
                    if (!apps[appid]) {
                        apps[appid] = [];
                    }
                    
                    items[img] = items[img] || {};
                    items[img][quality] = (items[img][quality] || {});
                    items[img][quality][effect] = (items[img][quality][effect] || 0) + 1;
                    apps[appid].push(assetid);
                    
                    for (let i = warningIdentifiers.length - 1; i >= 0; i--) {
                        let identifier = warningIdentifiers[i];
                        let addWarning = identifier.appid === appid &&
                            identifier.check(item);
                        
                        if (addWarning) {
                            // add the warning
                            warnings.push(`Offer contains ${identifier.name}(s).`);
                            // remove the identifier so we do not check for it
                            // or add it again after this point
                            warningIdentifiers.splice(i, 1);
                        }
                    }
                });
                
                if (valid) {
                    return {total, apps, items, warnings};
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
            function dumpSummary(type, summary, User) {
                if (summary === null || summary.total === 0) return ''; // no summary or no items
                
                function getSummary() {
                    /**
                     * Wrap HTML in backpack.tf link for items
                     * @param {String} html - HTML contents to wrap around
                     * @param {Array} ids - Array of IDs to include in URL
                     * @returns {String} HTML with link wrapped around
                     */
                    function wrapBackpackLink(html, ids) {
                        let url = `https://backpack.tf/profiles/${steamid}?select=${ids.join(',')}`;
                        
                        return `<a title="Open on backpack.tf" href="${url}" target="_blank">${html}</a>`;
                    }
                    
                    let ids = apps['440'];
                    
                    if (ids) {
                        // if tf2 items are in offer
                        // return summary items with backpack.tf link wrapped around 
                        return wrapBackpackLink(getItems(items), ids);
                    } else {
                        return getItems(items);
                    }
                }
                
                function getWarnings() {
                    if (warnings.length === 0) return ''; // no warnings to display
                    
                    // so that descriptions are always in the same order
                    let descriptions = warnings.sort().join('<br/>');
                    
                    return `<div class="warning">${descriptions}</span>`;
                }
                
                /**
                 * Get header for summary
                 * @param {String} type - The name of trader e.g. "My" or "Them"
                 * @param {Number} total - Total number of items in offer
                 * @returns {String} HTML string
                 */
                function getHeader(type, total) {
                    let itemsStr = total === 1 ? 'item' : 'items';
                    
                    return `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;
                }
                
                /**
                 * Get summary of items in offer
                 * @param {Object} items - Summary of items from 'evaluateItems' function
                 * @returns {String} HTML string
                 */
                function getItems(items) {
                    let html = '';
                    let getEffectURL = shared.offers.unusual.getEffectURL;
                    
                    function getItem(img, quality, effect, count) {
                        let imgs = `url(${img})`;
                        
                        if (effect !== 'none') {
                            imgs += `, url('${getEffectURL(effect)}')`;
                        }
                        
                        let styles = `background-image: ${imgs}; border-color: ${quality};`;
                        let badge = count > 1 ? `<span class="summary_badge">${count}</span>` : '&nbsp;';
                        
                        return `<span class="summary_item" style="${styles}">${badge}</span>`;
                    }
                    
                    // super duper looper
                    for (let img in items) {
                        for (let quality in items[img]) {
                            for (let effect in items[img][quality]) {
                                let count = items[img][quality][effect];
                                
                                html += getItem(img, quality, effect, count);
                            }
                        }
                    }
                    
                    return html;
                }
                
                // unpack summary...
                let {total, apps, items, warnings} = summary;
                let steamid = User.strSteamId;
                
                // build html piece-by-piece
                return [
                    getHeader(type, total),
                    getSummary(),
                    getWarnings()
                ].join('');
            }
            
            /**
             * Summarize a user's items in trade offer
             * @param {Boolen} you - Is this your summary?
             * @returns {undefined}
             * @memberOf tradeOfferWindow
             */
            function summarize(you) {
                function getSummary(config) {
                    let $items = config.$slots.find('div.item');
                    let summary = evaluateItems($items, config.you);
                    let html = dumpSummary(config.name, summary, config.user);
                    
                    return html;
                }
                
                let name = you ? 'you' : 'them';
                let config = {
                    you: {
                        you: true,
                        name: 'My',
                        user: UW.UserYou,
                        $slots: page.$yourSlots,
                        $container: page.$yourSummary
                    },
                    them: {
                        you: false,
                        name: 'Their',
                        user: UW.UserThem,
                        $slots: page.$theirSlots,
                        $container: page.$theirSummary
                    }
                }[name];
                let html = getSummary(config);
                
                config.$container.html(html);
            }
            
            /**
             * Callback when chain has finished
             * @callback chain-callback
             */
            
            /**
             * Call function for each item one after another
             * @param {Array} items - Array
             * @param {Number} timeout - Time between each call
             * @param {Function} fn - Function to call on item
             * @param {chain-callback} callback - Callback when chain has finished
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
            
            // clear items that were added to the offer
            function clearItemsInOffer($addedItems) {
                let items = $addedItems.find('div.item').get();
                
                // remove all at once
                UW.GTradeStateManager.RemoveItemsFromTrade(items.reverse());
                
                // remove by each item
                // let Clear = UW.MoveItemToInventory;
                // chain(items.reverse(), 100, Clear, summarize);
            }
            
            // add items to the trade offer
            function addItemsToOffer(items, callback) {
                let MoveItem = UW.MoveItemToTrade;
                
                chain(items, 20, MoveItem, callback);
            }
            
            /**
             * Callback when items have finished adding
             * @callback addItems-callback
             */
            
            /**
             * Add items to trade
             * @param {Object} items - jQuery object of items
             * @param {addItems-callback} callback - Callback when items have finished adding
             * @returns {undefined}
             * @memberOf tradeOfferWindow
             */
            function addItems(items, callback = function() {}) {
                addItemsToOffer(items, callback);
            }
            
            /**
             * Clear items in offer
             * @param {Object} $addedItems - jQuery object of items to remove
             * @returns {undefined}
             * @memberOf tradeOfferWindow
             */
            function clear($addedItems) {
                clearItemsInOffer($addedItems);
            }
            
            /**
             * Update display of buttons
             * @param {Boolean} you - Is your inventory selected?
             * @param {Number} appid - AppID of inventory selected
             * @returns {undefined}
             * @memberOf tradeOfferWindow
             */
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
                let listingIntent = urlParams.listing_intent;
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
            
            /**
             * Call when a different user's inventory is selected
             * @param {Object} $inventoryTab - jQuery element of inventory tab selected
             * @returns {undefined}
             * @memberOf tradeOfferWindow
             */
            function userChanged($inventoryTab) {
                // fallback option for getting appid
                function appIdFallback() {
                    let src = page.get.$appSelectImg().attr('src') || ''; // fallback to appid from image
                    let match = src.match(/public\/images\/apps\/(\d+)/);
                    
                    return match && match[1];
                }
                
                let $inventory = page.get.$inventory();
                let you = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
                let match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
                let appid = (match && match[1]) || appIdFallback();
                
                // now update the dispaly
                updateDisplay(you, appid);
            }
            
            return {
                summarize, addItems, clear, updateDisplay, userChanged
            };
        }());
        /**
         * Manage inventory load events
         * 
         * @namespace inventoryManager
         */
        const inventoryManager = (function() {
            let inventories = {};
            let users = {};
            
            users[STEAMID] = [];
            users[PARTNER_STEAMID] = [];
            inventories[STEAMID] = {};
            inventories[PARTNER_STEAMID] = {};
            
            /**
             * An inventory has loaded, call all events according to parameters
             * @param {String} steamid - steamid of user
             * @param {String} appid - appid of inventory loaded
             * @param {String} contextid - contextid of inventory loaded
             * @returns {undefined}
             * @memberOf inventoryManager
             */
            function call(steamid, appid, contextid) {
                let actions = [
                    ...users[steamid],
                    ...((inventories[steamid][appid] && inventories[steamid][appid][contextid]) || [])
                ];
                
                // clear
                users[steamid] = [];
                inventories[steamid][appid] = [];
                // call all functions
                actions.forEach(fn => fn(steamid, appid, contextid));
            }
            
            /**
             * Register an event
             * @param {String} steamid - steamid for user
             * @param {(String|Function)} appid - appid of event, or app-agnostic function to be called
             * @param {(String|undefined)} [contextid] - contextid of app
             * @param {(Function|undefined)} [fn] - Function to call when inventory is loaded
             * @returns {undefined}
             * @memberOf inventoryManager
             */
            function register(steamid, appid, contextid, fn) {
                if (!fn) {
                    fn = appid;
                    users[steamid].push(fn);
                } else {
                    if (!inventories[steamid][appid]) {
                        inventories[steamid][appid] = {};
                    }
                    
                    if (!inventories[steamid][appid][contextid]) {
                        inventories[steamid][appid][contextid] = [];
                    }
                    
                    inventories[steamid][appid][contextid].push(fn);
                }
            }
            
            return {
                register, call
            };
        }());
        /**
         * Collect items based on conditions
         * @param {String} mode - Mode
         * @param {Number} amount - Number of items to pick
         * @param {Number} index - Index to start picking items at
         * @param {Boolean} [you] - Your items?
         * @returns {Array} First value is an array of items, second is whether the amount was satisfied
         */
        const collectItems = (function() {
            // used for identifying items
            const identifiers = {
                // item is key
                isKey: function(item) {
                    switch (parseInt(item.appid)) {
                        case 440:
                            return item.market_hash_name === 'Mann Co. Supply Crate Key';
                        case 730:
                            return identifiers.hasTag(item, 'Type', 'Key');
                    }
                    
                    return null;
                },
                // item has tag
                hasTag: function(item, tagName, tagValue) {
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
            const finders = {
                metal: (function() {
                    function hasMetal(item, name) {
                        return item.appid == 440 && item.market_hash_name === name;
                    }
                    
                    // find each type of metal
                    return function(you, amount, index, name) {
                        return pickItems(you, amount, index, (item) => {
                            return hasMetal(item, name);
                        });
                    };
                }()),
                // return items by array of id's
                id: function(ids) {
                    let filter = (item) => {
                        return ids.indexOf(item.id) !== -1;
                    };
                    let items = pickItems(null, ids.length, 0, filter).sort((a, b) => {
                        return ids.indexOf(a.id) - ids.indexOf(b.id);
                    });
                    
                    return items;
                }
            };
            
            /**
             * Pick items from inventory
             * @param {(Boolean|null)} you - Pick items from your inventory? Use null for both
             * @param {Number} amount - Amount of items to pick
             * @param {Number} index - Index to start picking items at
             * @param {Function} finder - Finder method
             * @returns {Array} Array of picked items
             */
            function pickItems(you, amount, index, finder) {
                // get inventory for selected app and context
                function getInventory(user) {
                    return (user.rgAppInfo[appid] &&
                        user.rgAppInfo[appid].rgContexts[contextid].inventory &&
                        user.rgAppInfo[appid].rgContexts[contextid].inventory.rgInventory
                    ) || {};
                }
                
                function getItems(you) {
                    let user = you ? UW.UserYou : UW.UserThem;
                    let $items = (you ? page.$yourSlots : page.$theirSlots).find('.item');
                    let inventory = getInventory(user);
                    // get ids of items in trade offer matching app
                    let addedIDs = $items.toArray().reduce((arr, el) => {
                        let split = el.id.replace('item', '').split('_');
                        let [iAppid, , assetid] = split;
                        
                        if (iAppid === appid) {
                            arr.push(assetid);
                        }
                        
                        return arr;
                    }, []);
                    let items = [];
                    let total = [];
                    let ids = Object.keys(inventory);
                    let currentIndex = 0;
                    
                    if (index < 0) {
                        // select in reverse
                        // since -1 is the starting position we add 1 to it before inverting it
                        index = (index + 1) * -1;
                        ids.reverse();
                    }
                    
                    // items will always be sorted from front-to-back by default
                    for (let i = 0; i < ids.length; i++) {
                        let id = ids[i];
                        let item = inventory[id];
                        
                        if (addedIDs.indexOf(id) !== -1) {
                            // id of item is already in trade offer
                            if (index !== 0 && finder(item)) {
                                currentIndex++; // increment if item matches
                            }
                            
                            continue;
                        } else if (items.length >= amount) {
                            // break when amount has been reached
                            break;
                        } else if (finder(item)) {
                            if (currentIndex >= index) {
                                items.push(item);
                            }
                            
                            // add items to total in case amount is not met
                            total.push(item);
                            currentIndex++;
                        }
                    }
                    
                    if (items < amount) {
                        items = total.splice(offsetIndex(index, amount, total.length), amount);
                    }
                    
                    return items;
                }
                
                let $inventory = page.get.$inventory();
                let match = ($inventory.attr('id') || '').match(/(\d+)_(\d+)$/);
                let [ , appid, contextid] = (match || []);
                
                // inventory must be present
                if (!appid) {
                    return;
                } else if (you === null) {
                    // get items for both users
                    return Utils.flatten([true, false].map(getItems));
                } else {
                    // get items for user based on whether 'you' is truthy or falsy
                    return getItems(you);
                }
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
                    // no offset needed
                    return index; 
                }
            }
            
            // map items to array of dom elements
            function getElementsForItems(items) {
                if (items.length === 0) return [];
                
                // get element id for each item
                let ids = items.map(item => `item${item.appid}_${item.contextid}_${item.id}`);
                let elements = ids.map(id => document.getElementById(id)).map(a => a);
                
                return elements;
            }
            
            /**
             * Pick metal from items based on value in refined metal
             * @param {Boolean} you - Add to your side?
             * @param {Number} amount - Value to make in metal (e.g. 13.33)
             * @param {Number} index - Index to add at
             * @returns {Array} First value is an array of items, second is whether the amount was satisfied
             */
            function getItemsForMetal(you, amount, index) {
                // converts a metal value to the equivalent number of scrap emtals
                // values are rounded
                function toScrap(num) {
                    return Math.round(num / (1 / 9));
                }
                
                // value was met
                function valueMet() {
                    return total === amount;
                }
                
                function getMetal(arr, type) {
                    if (valueMet()) {
                        // empty array
                        return arr; 
                    }
                    
                    // get number of metal to add based on how much more we need to add
                    // as well as the value of the metal we are adding
                    let curValue = values[type];
                    let valueNeeded = amount - total;
                    let amountToAdd = Math.floor(valueNeeded / curValue);
                    // get array of metal
                    let items = finder(you, amountToAdd, index, type); 
                    let amountAdded = Math.min(
                        amountToAdd,
                        // there isn't quite enough there...
                        items.length
                    ); 
                    
                     // add it to the total
                    total = total + (amountAdded * curValue);
                    
                    // add the new items to the array
                    return arr.concat(items);
                }
                
                // convert the amount to the number of scrap metal
                amount = toScrap(amount);
                
                let finder = finders.metal;
                let total = 0; // total to be added to
                // the value in scrap metal of each type of metal
                let values = {
                    'Refined Metal': 9,
                    'Reclaimed Metal': 3,
                    'Scrap Metal': 1
                };
                let metal = Object.keys(values).reduce(getMetal, []);
                let items = getElementsForItems(metal);
                let satisfied = valueMet();
                
                return [items, satisfied];
            }
            
            /**
             * Collect items based on conditions
             * @param {String} mode - Mode
             * @param {Number} amount - Number of items to pick
             * @param {Number} index - Index to start picking items at
             * @param {Boolean} [you] - Your items?
             * @returns {Array} First value is an array of items, second is whether the amount was satisfied
             */
            function getItems(mode, amount, index, you) {
                return {
                    // get keys
                    'KEYS': function() {
                        let found = pickItems(you, amount, index, identifiers.isKey);
                        let items = getElementsForItems(found);
                        let satisfied = amount === items.length;
                        
                        return [items, satisfied];
                    },
                    // get amount of metal (keys, ref, scrap);
                    'METAL': function() {
                        let [items, satisfied] = getItemsForMetal(you, amount, index);
                        
                        return [items, satisfied];
                    },
                    // get items by id
                    'ID': function() {
                        // list of id's is passed through index
                        let ids = index; 
                        let found = finders.id(ids);
                        let items = getElementsForItems(found);
                        let satisfied = ids.length === items.length;
                        
                        return [items, satisfied];
                    },
                    // get items displayed in the inventory
                    'ITEMS': function() {
                        // check if an items is visible on page
                        // the item iteself will not contain the display property, but its parent does
                        function isVisible(i, el) {
                            return el.parentNode.style.display !== 'none';
                        }
                        
                        // select all visible items from active inventory
                        let found = page.get.$inventory().find('div.item').filter(isVisible).toArray();
                        
                        if (index < 0) {
                            index = (index + 1) * -1;
                            found = found.reverse();
                        }
                        
                        let offset = offsetIndex(index, amount, found.length);
                        let items = found.splice(offset, amount);
                        let satisfied = amount === items.length;
                        
                        return [items, satisfied];
                    }
                }[mode]();
            }
            
            return getItems;
        }());
        const unusual = (function() {
            const {
                effectsMap,
                modifyElement,
                getEffectName
            } = shared.offers.unusual;
            
            function addEffectImage(item, effectName) {
                let value = effectsMap[effectName];
                
                if (value) {
                    let {appid, contextid, id} = item;
                    let elId = `item${appid}_${contextid}_${id}`;
                    let itemEl = document.getElementById(elId);
                    
                    modifyElement(itemEl, value);
                }
            }
            
            function addImagesToInventory(inventory) {
                for (let assetid in inventory) {
                    let item = inventory[assetid];
                    let effectName = getEffectName(item);
                    
                    if (effectName) {
                        addEffectImage(item, effectName);
                    }
                }
            }
            
            /**
             * Get URL of image for effect
             * @param {Number} value - Value of effect
             * @returns {String} URL string
             */
            function getEffectURL(value) {
                return `https://backpack.tf/images/440/particles/${value}_188x188.png`;
            }
            
            return {
                addImagesToInventory, getEffectURL
            };
        }());
        
        /**
         * Get inventory for user
         * @param {Boolean} you - Is this your inventory?
         * @returns {Object} Your inventory if 'yours' is true, otherwise their inventory
         */
        function getUserInventory(you) {
            let myInventory = UW.g_rgAppContextData;
            let themInventory = UW.g_rgPartnerAppContextData;
            
            return you ? myInventory : themInventory;
        }
        
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
                    .btn_green {
                        background-color: #709D3C;
                    }
                    .btn_silver {
                        background-color: #676767;
                    }
                    .btn_blue {
                        background-color: #2E4766;
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
                        background-size: 48px 48px, 100% 100%;
                        background-repeat: no-repeat;
                    }
                    .summary_badge {
                        padding: 1px 3px;
                        border-radius: 4px;
                        background-color: #209DE6;
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
                    .control_fields {
                        margin-top: 8px
                    }
                    .warning {
                        color: #FF4422;
                    }
                    .trade_area .item.unusual.hover {
                        background-position: center;
                        background-color: #474747 !important;
                    }
                    .unusual {
                        background-position: center;
                        background-size: 100% 100%;
                    }
                `);
            }
            
            function getControls() {
                return trim(`
                    <div id="controls">
                        <div class="trade_rule selectableNone"/>
                        <div class="selectableNone">Add multiple items:</div>
                        <div class="filter_ctn">
                            <input id="amount_control" class="filter_search_box" type="number" min="0" step="any" placeholder="amount"/>
                            <input id="index_control" class="filter_search_box" type="number" min="0" placeholder="index"/>
                        </div>
                        <div id="add_btns" class="control_fields">
                            <div id="btn_additems" class="btn_black btn_small">
                                <span>Add</span>
                            </div>
                            <div id="btn_addkeys" class="btn_green btn_black btn_small">
                                <span>Add Keys</span>
                            </div>
                            <div id="btn_addmetal" class="btn_silver btn_black btn_small">
                                <span>Add Metal</span>
                            </div>
                            <div id="btn_addlisting" class="btn_blue btn_black btn_small">
                                <span>Add Listing</span>
                            </div>
                        </div>
                        <div id="clear_btns" class="control_fields">
                            <div id="btn_clearmyitems" type="button" class="btn_black btn_small">
                                <span>Clear my items</span>
                            </div>
                            <div id="btn_cleartheiritems" type="button" class="btn_black btn_small">
                                <span>Clear their items</span>
                            </div>
                        </div>
                        <div id="id_fields" class="control_fields" style="display: none;">
                            <div class="filter_ctn">
                                <div class="filter_control_ctn">
                                    <input id="ids_control" class="filter_search_box filter_full" type="text" placeholder="ids" autocomplete="off"/>
                                </div>
                                <div class="filter_tag_button_ctn filter_right_controls">
                                    <div id="btn_addids" type="button" class="btn_black btn_small">
                                        <span>Add</span>
                                    </div>
                                    <div id="btn_getids" type="button" class="btn_black btn_small">
                                        <span>Get</span>
                                    </div>
                                </div>
                                <div style="clear:both;"></div>
                            </div>
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
                GM_addStyle(styles);
            }
            
            function addControls() {
                let $tradeBox = page.$tradeBoxContents;
                let html = [
                    getControls(),
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
            page.$controls = $('#controls');
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
        
        // observe changes to dom
        function observe() {
            function tradeSlots() {
                function observeSlots(slotsEl, you) {
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
                            slotsEl.children.length <= 204
                        );
                        
                        if (canInstantSummarize) {
                            summarize();
                        } else {
                            clearTimeout(timer);
                            timer = setTimeout(summarize, 400);
                        }
                    });
                    let settings = {
                        childList: true,
                        characterData: false,
                        subtree: true
                    };
                    let lastSummarized = new Date();
                    let timer;
                    
                    observer.observe(slotsEl, settings);
                }
                
                observeSlots(page.$yourSlots[0], true);
                observeSlots(page.$theirSlots[0], false);
            }
            
            function inventories() {
                let observer = new MutationObserver((mutations) => {
                    if (!mutations[0].addedNodes) return;
                    
                    let mutation = mutations[0];
                    let inventory = mutation.addedNodes[0];
                    let split = inventory.id.replace('inventory_', '').split('_');
                    let [steamid, appid, contextid] = split;
                    
                    inventoryManager.call(steamid, appid, contextid);
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
        
        function bindEvents() {
            // the user changed from one app to another
            function appChanged(app) {
                let $app = $(app);
                let id = $app.attr('id');
                let match = id.match(/appselect_option_(you|them)_(\d+)_(\d+)/);
                
                if (match) {
                    let you = match[1] === 'you';
                    let appid = match[2];
                    let contextid = match[3];
                    
                    tradeOfferWindow.updateDisplay(you, appid, contextid);
                }
            }
            
            // add the listing price
            function addListingPrice() {
                /**
                 * Callback when items have finished adding
                 * @callback addCurrencies-callback
                 * @param {Array} reasons - Array of reasons if value was not met for each currency
                 */
                
                /**
                 * Add currencies to the trade
                 * @param {Boolean} you - Are we adding from your inventory?
                 * @param {Object} currencies - Object containing currencies
                 * @param {addCurrencies-callback} callback - Callback when all items have been added
                 * @returns {undefined}
                 */
                function addCurrencies(you, currencies, callback) {
                    let names = Object.keys(currencies).filter((currency) => {
                        return currencies[currency] > 0;
                    });
                    let reasons = [];
                    let index = parseInt(page.controls.$index.val()) || 0;
                    
                    function addCurrency(callback) {
                        let currency = names.shift(); // get first name and remove it from array
                        let amount = currencies[currency];
                        
                        if (currency) {
                            addItems(currency, amount, index, you, (satisfied) => {
                                if (satisfied === false) {
                                    reasons.push(`not enough ${currency.toLowerCase()}`);
                                }
                                
                                addCurrency(callback); // recurse
                            });
                        } else {
                            return callback(reasons);
                        }
                    }
                    
                    addCurrency(callback);
                }
                
                // 0 = buy order
                // 1 = sell order
                let listingIntent = urlParams.listing_intent;
                // we are buying, add items from our inventory
                let you = listingIntent == 1;
                
                addCurrencies(you, {
                    KEYS: parseInt(urlParams.listing_currencies_keys) || 0,
                    METAL: parseFloat(urlParams.listing_currencies_metal) || 0
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
                    addItems('ID', 0, ids, null);
                }
            }
            
            // get default amount and index value based on fields
            function getDefaults() {
                return [
                    // amount
                    parseFloat(page.controls.$amount.val()) || 1,
                    // index
                    parseInt(page.controls.$index.val()) || 0,
                    // your inventory is selected
                    page.$inventorySelectYour.hasClass('active')
                ];
            }
            
            function toggleIDFields() {
                let $controls = page.fields.$ids.toggle();
                let isVisible  = $controls.is(':visible') ? 1 : 0;
                
                setStored(stored.id_visible, isVisible);
            }
            
            // get list of ids of items in trade offer
            function getIDs() {
                let $inventoryTab = page.get.$activeInventoryTab();
                let you = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
                let $slots = you ? page.$yourSlots : page.$theirSlots;
                let $items = $slots.find('div.item');
                
                return $items.toArray().map((el) => {
                    // array containing item identifiers e.g. ['440', '2', '123']
                    let split = (el.id || '').replace('item', '').split('_'); 
                    let assetid = split[2];
                    
                    return assetid;
                });
            }
            
            function keyPressed(e) {
                Utils.execHotKey(e, {
                    // P
                    112: toggleIDFields
                });
            }
            
            function addItems(mode = 'ITEMS', amount = 1, index = 0, you = true, callback = function() {}) {
                let canModify = (
                    // an inventory is not selected
                    (/(\d+)_(\d+)$/.test(page.get.$inventory().attr('id'))) ||
                    // the offer cannot be modified
                    page.get.$modifyTradeOffer().length === 0
                );
                
                if (canModify) {
                    let [items, satisfied] = collectItems(...arguments);
                    
                    tradeOfferWindow.addItems(items, () => {
                        return callback(satisfied);
                    });
                } else {
                    return callback();
                }
            }
            
            page.$appSelectOption.on('click', (e) => {
                appChanged(e.target);
            });
            page.$inventorySelectYour.on('click', () => {
                tradeOfferWindow.userChanged(page.$inventorySelectYour);
            });
            page.$inventorySelectTheir.on('click', () => {
                tradeOfferWindow.userChanged(page.$inventorySelectTheir);
            });
            page.btns.$clearMy.on('click', () => {
                tradeOfferWindow.clear(page.$yourSlots);
            });
            page.btns.$clearTheir.on('click', () => {
                tradeOfferWindow.clear(page.$theirSlots);
            });
            page.btns.$items.on('click', () => {
                addItems('ITEMS', ...getDefaults());
            });
            page.btns.$keys.on('click', () => {
                addItems('KEYS', ...getDefaults());
            });
            page.btns.$metal.on('click', () => {
                addItems('METAL', ...getDefaults());
            });
            page.btns.$listing.on('click', () => {
                addListingPrice();
            });
            page.btns.$addIDs.on('click', () => {
                addIDs(page.controls.$ids.val());
            });
            page.btns.$getIDs.on('click', () => {
                page.controls.$ids.val(getIDs().join(','));
            });
            page.$document.on('keypress', (e) => {
                keyPressed(e);
            });
        }
        
        function bindInventoryEvents() {
            // this will force an inventory to load
            function forceInventory(appid, contextid) {
                UW.g_rgCurrentTradeStatus.them.assets.push({
                    appid: appid,
                    contextid: contextid,
                    assetid: '0',
                    amount: 1
                });
                UW.RefreshTradeStatus(UW.g_rgCurrentTradeStatus, true);
                UW.g_rgCurrentTradeStatus.them.assets = [];
                UW.RefreshTradeStatus(UW.g_rgCurrentTradeStatus, true);
            }
            
            function addEffectImages(steamid, appid, contextid) {
                let you = steamid === STEAMID;
                let inventory = getUserInventory(you)[appid].rgContexts[contextid].inventory.rgInventory;
                
                if (!you) {
                    // force the items in their inventory to be displayed so we can add images
                    // if their inventory has not been displayed
                    forceVisibility();
                }
                
                unusual.addImagesToInventory(inventory);
                // re-summarize
                tradeOfferWindow.summarize(you);
            }
            
            /**
             * Force visibility of other user's inventory
             * @returns {undefined}
             */
            function forceVisibility() {
                let $activeTab = page.get.$activeInventoryTab();
                let $theirs = page.$inventorySelectTheir;
                
                $theirs.trigger('click');
                $activeTab.trigger('click');
            }
            
            inventoryManager.register(STEAMID, () => {
                // something to do when your inventory is loaded...
            });
            
            if (urlParams.listing_intent !== undefined) {
                // we are buying, add items from our inventory
                let selling = urlParams.listing_intent == 0;
                
                page.btns.$listing.addClass(selling ? 'selling' : 'buying');
                
                // force their inventory to load if we are selling
                if (selling) {
                    forceInventory('440', '2');
                }
            }
            
            if (urlParams.for_item !== undefined) {
                let [appid, contextid, assetid] = urlParams.for_item.split('_');
                let item = {
                    appid,
                    contextid,
                    assetid,
                    amount: 1
                };
                
                UW.g_rgCurrentTradeStatus.them.assets.push(item);
                UW.RefreshTradeStatus(UW.g_rgCurrentTradeStatus, true);
                
                // check for a dead item when this inventory is loaded
                inventoryManager.register(PARTNER_STEAMID, appid, contextid, () => {
                    if (page.get.$deadItem().length > 0) {
                        UW.g_rgCurrentTradeStatus.them.assets = [];
                        UW.RefreshTradeStatus(UW.g_rgCurrentTradeStatus, true);
                        alert(
                            `Seems like the item you are looking to buy (ID: ${assetid}) is no longer available. ` +
                            'You should check other user\'s backpack and see if it\'s still there.'
                        );
                    }
                });
            }
            
            // why would you open this
            inventoryManager.register(STEAMID, '578080', '2', () => {
                alert('wow why are you looking at your pubg inventory');
            });
            
            [STEAMID, PARTNER_STEAMID].forEach((steamid) => {
                inventoryManager.register(steamid, '440', '2', addEffectImages);
            });
        }
        
        function overrides() {
            // basically remove animation due to bugginess
            // also it's a bit faster
            UW.EnsureSufficientTradeSlots = function(bYourSlots, cSlotsInUse, cCurrencySlotsInUse) {
                let $slots = bYourSlots ? page.$yourSlots : page.$theirSlots;
                let elSlotContainer = $slots[0];
                let cTotalSlotsInUse = cSlotsInUse + cCurrencySlotsInUse;
                let cDesiredSlots = (
                    UW.Economy_UseResponsiveLayout() ?
                    cTotalSlotsInUse + 1 :
                    Math.max(Math.floor((cTotalSlotsInUse + 5) / 4) * 4, 8)
                );
                let cDesiredItemSlots = cDesiredSlots - cCurrencySlotsInUse;
                let cCurrentItemSlots = elSlotContainer.childElements().length;
                let cCurrentSlots = cCurrentItemSlots + cCurrencySlotsInUse;
                let bElementsChanged = cDesiredSlots !== cCurrentSlots;
                let rgElementsToRemove = [];
                
                if (cDesiredSlots > cCurrentSlots) {
                    let Create = UW.CreateTradeSlot;
                    
                    for (let i = cCurrentItemSlots; i < cDesiredItemSlots; i++) {
                        Create(bYourSlots, i);
                    }
                } else if (cDesiredSlots < cCurrentSlots) {
                    // going to compact
                    let prefix = bYourSlots ? 'your_slot_' : 'their_slot_';
                    let $parent = $slots.parent();
                    
                    for (let i = cDesiredItemSlots; i < cCurrentItemSlots; i++) {
                        let element = $slots.find('#' + prefix + i)[0];
                        
                        element.id = '';
                        $parent.append(element.remove());
                        rgElementsToRemove.push(element);
                    }
                }
                
                if (bElementsChanged && rgElementsToRemove.length > 0) {
                    rgElementsToRemove.invoke('remove');
                }
            };
            // remove multiple items from a trade offer at once
            // pretty much removes all items INSTANTLY
            UW.GTradeStateManager.RemoveItemsFromTrade = function(items) {
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
                    
                    // iterate over dom elements and collect rgItems from items
                    function iterItems(items) {
                        let rgItems = [];
                        let revertItem = UW.RevertItem;
                        let isInTradeSlot = UW.BIsInTradeSlot;
                        let cleanSlot = UW.CleanupSlot;
                        let setStackItemInTrade = UW.SetStackableItemInTrade;
                        
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
                        
                        let rgStatus = UW.g_rgCurrentTradeStatus;
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
                
                let manager = UW.GTradeStateManager;
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
            }
            
            tradeOfferWindow.userChanged(page.get.$activeInventoryTab());
            
            if (getStored(stored.id_visible) == 1) {
                page.fields.$ids.show();
            }
            
            if (urlParams.listing_intent !== undefined) {
                let selling = urlParams.listing_intent == 0;
                
                page.btns.$listing.addClass(selling ? 'selling' : 'buying');
            }
            
            page.$inventories.css('marginBottom', '8px');
            setInterval(fixHeight, 500);
        }
        
        function ready() {
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
        const $ = UW.jQuery;
        const page = {
        };
        const dom = {
            offers: document.getElementsByClassName('tradeoffer')
        };
        const stored = {
            effect_cache: 'getTradeOffers.effect_cache'
        };
        const unusual = (function() {
            const {
                effectsMap,
                modifyElement,
                getEffectName,
                getEffectURL
            } = shared.offers.unusual;
            const addImage = {
                fromValue: function(itemEl, value) {
                    return modifyElement(itemEl, value);
                },
                /**
                 * Add an image using an item's object
                 * @param {Object} itemEl - DOM element of item
                 * @param {Object} item - Item object
                 * @returns {undefined}
                 */
                fromItem: function(itemEl, item) {
                    let name = getEffectName(item);
                    let value = name && effectsMap[name];
                    let cacheKey = cache.key(itemEl);
                    
                    // cache blank value if there is no value
                    // so that we do not obsessively request data
                    // for this item when no value is available
                    cache.store(cacheKey, value || 'none');
                    cache.save();
                    
                    if (value) {
                        modifyElement(itemEl, value);
                    }
                }
            };
            const cache = (function() {
                let values = {};
                let cacheIndex = stored.effect_cache;
                
                function save() {
                    let value = JSON.stringify(values);
                    
                    if (value.length >= 10000) {
                        // clear cache when it becomes too big
                        values = {};
                        value = '{}'; 
                    }
                    
                    setStored(cacheIndex, value);
                }
                
                function store(key, value) {
                    values[key] = value;
                }
                
                function get() {
                    values = JSON.parse(getStored(cacheIndex) || '{}');
                }
                
                function key(itemEl) {
                    let classinfo = itemEl.getAttribute('data-economy-item');
                    let [ , , classid, instanceid] = classinfo.split('/');
                    let cacheKey = [classid, instanceid].join('-');
                    
                    return cacheKey;
                }
                
                function getValue(key) {
                    return values[key];
                }
                
                return {
                    save, get, store, key, getValue
                };
            }());
            
            return {
                addImage, cache, getEffectURL
            };
        }());
        
        // get all unusual elements
        function getUnusualItems() {
            let itemElList = document.getElementsByClassName('trade_item');
            
            return Array.from(itemElList).filter((itemEl) => {
                let borderColor = itemEl.style.borderColor;
                let classinfo = itemEl.getAttribute('data-economy-item');
                let isTf2 = /^classinfo\/440\//.test(classinfo);
                let isUnusual = borderColor === 'rgb(134, 80, 172)';
                
                return isTf2 && isUnusual;
            });
        }
        
        function checkItem(itemEl) {
            function getHover(itemEl) {
                // classinfo format - "classinfo/440/192234515/3041550843"
                let classinfo = itemEl.getAttribute('data-economy-item');
                let [ , appid, classid, instanceid] = classinfo.split('/');
                let itemStr = [appid, classid, instanceid].join('/');
                let uri = `economy/itemclasshover/${itemStr}?content_only=1&l=english`;
                let req = new UW.CDelayedAJAXData(uri, 0);
                
                req.QueueAjaxRequestIfNecessary();
                req.RunWhenAJAXReady(() => {
                    // 3rd element is a script tag containing item data
                    let html = req.m_$Data[2].innerHTML;
                    // extract the json for item with pattern...
                    let match = html.match(/BuildHover\(\s*?\'economy_item_[A-z0-9]+\',\s*?(.*)\s\);/);
                    // then parse it
                    let json = JSON.parse(match[1]);
                    
                    if (json) {
                        unusual.addImage.fromItem(itemEl, json);
                    }
                });
            }
            
            let cache = unusual.cache;
            let cacheKey = cache.key(itemEl);
            let cachedValue = cache.getValue(cacheKey);
            
            if (cachedValue === 'none') {
                // i am a do-nothing
            } else if (cachedValue) {
                // use cached value to display image
                unusual.addImage.fromValue(itemEl, cachedValue);
            } else {
                // get hover for item to get item information
                // this requires an ajax request
                getHover(itemEl);
            }
        }
        
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
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    padding: 1px 3px;
                    color: #FFFFFF;
                    border-radius: 4px;
                    background-color: #209DE6;
                    font-size: 14px;
                    cursor: default;
                    font-weight: bold;
                }
                .unusual {
                    background-position: center;
                    background-size: 100% 100%;
                }
            `;
        }
        
        function addStyles(styles) {
            GM_addStyle(styles);
        }
        
        function addButtons(offerEl) {
            function getButtons(steamid, personaname) {
                function makeReplacements(string) {
                    // replace personaname and steamid
                    return string.replace('%personaname%', personaname).replace('%steamid%', steamid); 
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
            
            let reportButtonEl = offerEl.getElementsByClassName('btn_report')[0];
            
            // sent offers will not have a report button - we won't add any buttons to them
            if (reportButtonEl) {
                // match steamid, personaname
                let pattern = /ReportTradeScam\( ?\'(\d{17})\', ?"(.*)"\ ?\)/;
                let match = (reportButtonEl.getAttribute('onclick') || '').match(pattern);
                
                if (match) {
                    let [ , steamid, personaname] = match;
                    let html = getButtons(steamid, personaname);
                    
                    // insert html for buttons
                    reportButtonEl.insertAdjacentHTML('beforebegin', html);
                }
                
                // we don't really want it
                reportButtonEl.remove();
            }
        }
        
        function summarize(offerEl) {
            function summarizeList(itemsEl) {
                function multipleSameItems() {
                    let infos = [];
                    
                    return itemsArr.some((itemEl) => {
                        let classinfo = getClassInfo(itemEl);
                        
                        if (infos.indexOf(classinfo) !== -1) {
                            return true;
                        } else {
                            infos.push(classinfo);
                            return false;
                        }
                    });
                }
                
                function getClassInfo(itemEl) {
                    let classinfo = itemEl.getAttribute('data-economy-item');
                    // I believe item classes always remain static
                    let translateClass = {
                        'classinfo/440/339892/11040578': 'classinfo/440/101785959/11040578',
                        'classinfo/440/339892/11040559': 'classinfo/440/101785959/11040578',
                        'classinfo/440/107348667/11040578': 'classinfo/440/101785959/11040578'
                    };
                    
                    return translateClass[classinfo] || classinfo;
                }
                
                // get summarized items and sort elements by properties
                // most of this stuff should be fairly optimized
                function getItems() {
                    function getItem(classinfo, itemEl) {
                        return {
                            classinfo: classinfo,
                            app: classinfo.replace('classinfo/', '').split('/')[0],
                            color: itemEl.style.borderColor
                        };
                    }
                    
                    function getSort(key, item) {
                        let index, value;
                        
                        if (key === 'count') {
                            index = -item.count;
                        } else {
                            value = item.props[key];
                            index = sorts[key].indexOf(value);
                            
                            if (index === -1) {
                                sorts[key].push(value);
                                index = sorts[key].indexOf(value);
                            }
                        }
                        
                        return index;
                    }
                    
                    function buildIndex() {
                        let items = {};
                        
                        itemsArr.forEach((itemEl) => {
                            let classinfo = getClassInfo(itemEl);
                            
                            if (items[classinfo]) {
                                items[classinfo].count += 1;
                            } else {
                                items[classinfo] = {
                                    el: itemEl,
                                    count: 1,
                                    props: getItem(classinfo, itemEl)
                                };
                            }
                        });
                        
                        return items;
                    }
                    
                    let sorts = {
                        app: [
                            // team fortress 2
                            '440',
                            // csgo
                            '730'
                        ],
                        color: [
                            // unusual
                            'rgb(134, 80, 172)',
                            // collectors
                            'rgb(170, 0, 0)',
                            // strange
                            'rgb(207, 106, 50)',
                            // haunted
                            'rgb(56, 243, 171)',
                            // genuine
                            'rgb(77, 116, 85)',
                            // vintage
                            'rgb(71, 98, 145)',
                            // decorated
                            'rgb(250, 250, 250)',
                            // unique
                            'rgb(125, 109, 0)'
                        ]
                    };
                    let items = Object.values(buildIndex());
                    
                    return items.sort((a, b) => {
                        let index = 0;
                        
                        // sort by these keys
                        // break when difference is found
                        ['app', 'color', 'count'].find((key) => {
                            let x = getSort(key, a);
                            let y = getSort(key, b);
                            
                            // these are already sorted in the proper direction
                            if (x > y) {
                                index = 1;
                                return true;
                            } else if (x < y) {
                                index = -1;
                                return true;
                            }
                        });
                        
                        return index;
                    });
                }
                
                function getFragment() {
                    let fragment = document.createDocumentFragment();
                    let clearEl = document.createElement('div');
                    
                    getItems().forEach((item) => {
                        if (item.count > 1) {
                            // add badge
                            let badgeEl = document.createElement('span');
                            
                            badgeEl.classList.add('summary_badge');
                            badgeEl.textContent = item.count;
                            
                            item.el.appendChild(badgeEl);
                        }
                        
                        fragment.appendChild(item.el);
                    });
                    
                    clearEl.style.clear = 'both';
                    // add clearfix to end of fragment
                    fragment.appendChild(clearEl);
                    
                    return fragment;
                }
                
                let itemsArr = Array.from(itemsEl.getElementsByClassName('trade_item'));
                
                // only modify dom if necessary
                if (itemsArr.length > 0 && multipleSameItems()) {
                    // clear html before-hand to reduce dom manipulation
                    itemsEl.innerHTML = '';
                    itemsEl.appendChild(getFragment());
                }
            }
            
            let itemsList = offerEl.getElementsByClassName('tradeoffer_item_list');
            
            Array.from(itemsList).forEach(summarizeList);
        }
        
        function checkOffer(offerEl) {
            addButtons(offerEl);
            summarize(offerEl);
        }
        
        function bindEvents() {
            // nothing
        }
        
        function modifyElements() {
            // modify each trade offer
            Array.from(dom.offers).forEach(checkOffer);
        }
        
        function ready() {
            unusual.cache.get();
            getUnusualItems().forEach(checkItem);
            addStyles(getStyles());
            modifyElements();
            bindEvents();
        }
        
        // perform actions
        ready();
    }
    
    function getClassifieds() {
        const dom = {
            listingsElList: document.getElementsByClassName('listing')
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
            
            Array.from(dom.listingsElList).forEach((listingEl) => {
                let itemEl = listingEl.getElementsByClassName('item')[0];
                let offerButtonEl = listingEl.getElementsByClassName('listing-buttons')[0].lastElementChild;
                let href = offerButtonEl.getAttribute('href');
                let data = itemEl.dataset;
                let price = data.listing_price;
                let intent = data.listing_intent;
                let currencies = Utils.stringToCurrencies(price);
                
                if (currencies) {
                    let query = getQuery(intent, currencies);
                    // url with query added
                    let url = [href, ...query].join('&');
                    
                    offerButtonEl.setAttribute('href', url);
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
        const urlParams = Utils.getURLParams();
        const stored = {
            key_price: 'getInventory.key_price'
        };
        const page = {
            $document: $(document),
            $backpack: $('#backpack'),
            $refined: $('.refined-value'),
            $inventorySortMenu: $('#inventory-sort-menu ul.dropdown-menu'),
            get: {
                $selected: () => page.$backpack.find('li.item:visible:not(.unselected)'),
                $listedItems: () => page.$backpack.find('li.item:visible:not(.unselected)[data-listing_price]'),
                $firstSelectPage: () => page.$backpack.find('span.select-page:first'),
                $backpackPage: () => page.$backpack.find('div.backpack-page'),
                $itemPricedInKeys: () => page.$backpack.find('li.item[data-p_bptf*="keys"]:first'),
                $crateKey: () => page.$backpack.find('.item[data-name="Mann Co. Supply Crate Key"]:first'),
                $inventoryCmpFrom: () => $('#inventory-cmp-from'),
                $inventoryCmpTo: () => $('#inventory-cmp-to')
            }
        };
        // use key value from cache
        let keyValue = getStored(stored.key_price);
        
        // obvserve changes to refined value
        function observeRefinedValue() {
            // get pretty value in keys
            function refinedToKeys(value) {
                return Math.round((value / keyValue) * 10) / 10;
            }
            
            function refinedValueChanged() {
                // this will generally always be available other than the first load
                // if it isn't there's nothing we can
                if (!keyValue) return;
                
                /**
                 * Update the refined field
                 * @param {Number} keysValue - Total key value of all selected items
                 * @param {Number} keysListedValue - Total listed value in keys of all selected items
                 * @returns {undefined}
                 */
                function update(keysValue) {
                    $refined.text(keysValue);
                }
                
                // get total value of all items in keys by converting ref value
                function getKeysValue() {
                    let text = $refined.text().replace(/,/g, '').trim();
                    let refined = parseFloat(text);
                    
                    return refinedToKeys(refined);
                }
                
                let keysValue = getKeysValue();
                
                // disconnect so we can modify the object
                // without calling this function again
                observer.disconnect();
                // update the ref value
                update(keysValue);
                // observe changes again
                observeRefChanges(); 
            }
                
            function observeRefChanges() {
                let settings = {
                    childList: true,
                    subtree: true,
                    attributes: false,
                    characterData: false
                };
                // observe changes to ref value
                observer.observe(refinedEl, settings);
            }
            
            function setup() {
                // keeping this in a mouseover will speed things up a bit
                // especially if there are many items that are listed in the inventory
                function updatedListedPrice() {
                    // this will generally always be available other than the first load
                    // if it isn't there's nothing we can
                    if (!keyValue) return;
                    
                    // get refined value from currencies
                    function getRefinedValue(currencies) {
                        return (currencies.metal || 0) +
                            (currencies.keys || 0) * keyValue;
                    }
                    
                    function getKeysListedValue() {
                        let $listedItems = page.get.$listedItems();
                        let prices = $listedItems.map((i, el) => {
                            let listingPrice = el.dataset.listing_price;
                            // get refined value of listing price
                            let currencies = Utils.stringToCurrencies(listingPrice);
                            let refined = currencies && getRefinedValue(currencies);
                            
                            return refined || 0;
                        }).get();
                        let sum = (a, b) => a + b;
                        let refined = prices.reduce(sum, 0);
                        
                        return refinedToKeys(refined);
                    }
                    
                    let listedKeysValue = getKeysListedValue();
                    let listedValue = `${listedKeysValue} keys listed value`;
                    
                    $refined.attr({
                        'title': listedValue,
                        'data-original-title': listedValue
                    });
                    // clear title
                    $refined.attr('title', ''); 
                }
                
                // change the text from "refined" to "keys"
                page.$refined.closest('li').find('small').text('keys'); 
                refinedValueChanged();
                $refined.on('mouseover', () => {
                    updatedListedPrice();
                });
            }
            
            let observer = new MutationObserver(refinedValueChanged);
            let $refined = page.$refined;
            let refinedEl = $refined[0];
            
            setup();
        }
        
        // get the value of keys in metal
        // this should be very approximate. but close enough
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
                
                function getRefinedValue(allStr) {
                    let match = allStr.replace(/\,/g, '').match(/(\d+\.?\d*) ref/);
                    let value = match && parseFloat(match[1]);
                    let rawValue = details.raw;
                    
                    // the raw value has extra precision but includes the value of paint and strange parts
                    // if it is close to the value of the price items,
                    // we can use the raw value instead which is more precise
                    if (value && rawValue && value.toFixed(2) === rawValue.toFixed(2)) {
                        return rawValue;
                    } else {
                        return value || rawValue;
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
                
                details.refined = getRefinedValue(data.p_bptf_all || '');
                
                return details;
            }
            
            // find item priced in keys
            let item = page.get.$itemPricedInKeys()[0];
            let price = item && parseItem(item);
            
            if (price && price.currency === 'keys' && price.average && price.refined) {
                // to get the value of keys in refined metal...
                // take the price in metal divided by the price in keys
                return price.refined / price.average;
            } else {
                // set value using the value of a key, if no items in inventory are priced in keys
                let key = page.get.$crateKey()[0];
                let price = key && parseItem(key);
                
                return price && price.refined;
            }
        }
        
        function filterItems($filtered) {
            if ($filtered.length === 0) return;
            
            function hideEmptyPages() {
                page.get.$backpackPage().each((i, el) => {
                    let $page = $(el);
                    let $items = $page.find('.item-list .item');
                    
                    if ($items.length === 0) {
                        $page.hide();
                    }
                });
            }
            
            function updateTotals() {
                // hackish way of updating totals
                page.get.$firstSelectPage().trigger('click');
                page.get.$firstSelectPage().trigger('click');
            }
            
            let $backpack = page.$backpack;
            let $items = $backpack.find('li.item:not(.spacer)');
            let $unfiltered = $items.not($filtered);
            let $spacers = $backpack.find('li.spacer');
            // all hidden items are moved to a temp page
            let $tempPage = $('<div class="temp-page" style="display:none;"/>');
            
            // sort
            sortBy('price');
            // then add the temp page, it will be hidden
            $backpack.append($tempPage);
            // remove spacers
            $spacers.appendTo($tempPage);
            // add the unfiltered items to the temp page
            $unfiltered.appendTo($tempPage);
            // hide pages that contain no items
            hideEmptyPages();
            // then update totals
            updateTotals();
        }
        
        /**
         * Select items on page matching IDs
         * @param {Array} ids - Array of IDs to select
         * @returns {undefined}
         */
        function selectItemsById(ids) {
            let $backpack = page.$backpack;
            let $items = $backpack.find('li.item:not(.spacer)');
            let selectors = ids.map(id => `[data-id="${id}"]`);
            // select items
            let $filtered = $items.filter(selectors.join(','));
            
            filterItems($filtered);
        }
        
        function sortBy(key) {
            page.$inventorySortMenu.find(`li[data-value="${key}"]`).trigger('click');
        }
        
        function waitForBackpack() {
            function onLoad() {
                // disconnect observer since the backpack has been loaded
                observer.disconnect();
                // then callback
                backpackLoaded();
            }
            
            function handler(mutations) {
                // if the mutations include an item list, items have been added
                let hasItemList = mutations.some((mutation) => {
                    return mutation.addedNodes &&
                        mutation.target.className === 'item-list';
                });
                
                if (hasItemList) {
                    // backpack has loaded
                    onLoad();
                }
            }
            
            let observer = new MutationObserver(handler);
            let backpackEl = document.getElementById('backpack');
            let settings = {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            };
            
            observer.observe(backpackEl, settings);
        }
        
        function backpackLoaded() {
            // ids are comma-seperated in select param
            let select = Utils.getIDsFromString(urlParams.select);
            // get key value using items in inventory
            let bpKeyValue = getKeyValue();
            
            if (bpKeyValue) {
                // set keyValue to price obtained from inventory
                // this should be very approximate. but close enough
                keyValue = bpKeyValue;
                // then cache it
                setStored(stored.key_price, keyValue);
            }
            
            if (select) {
                selectItemsById(select); // select items if select param is present
            }
            
            bindEvents();
        }
        
        /**
         * Get IDs of all selected items
         * @returns {Array} Array of IDs
         */
        function getIDs() {
            return page.get.$selected().map((i, el) => {
                return el.dataset.id;
            }).get();
        }
        
        /**
         * Change comparison
         * @param {Boolean} up - Go to next day if true, previous day if false
         * @returns {undefined}
         */
        function compare(up) {
            let $from = page.get.$inventoryCmpFrom();
            let $to = page.get.$inventoryCmpTo();
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
                Utils.copyToClipboard(getIDs().join(','));
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
            
            page.$document.on('keypress', (e) => {
                keyPressed(e);
            });
        }
        
        function ready() {
            observeRefinedValue();
            waitForBackpack();
        }
        
        // perform actions
        ready();
    }
    
    // short-hand
    const UW = unsafeWindow;
    /**
     * Utility functions
     * @namespace Utils
     */
    const Utils = {
        /**
         * Get URL parameters
         * @returns {Object} Object containing url parameters e.g. {'item': 'Fruit Shoot'}
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
         * Get difference between two arrays
         * @param {Array} arr1 - First array
         * @param {Array} arr2 - Second array
         * @returns {Array} Array with values removed
         */
        difference: function(arr1, arr2) {
            return arr1.filter((a) => {
                return arr2.indexOf(a) === -1;
            });
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
                ['number', 'text'].indexOf(e.target.type) !== -1;
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
         * Copy a value to clipboard
         * @param {String} str - String to copy
         * @returns {undefined}
         */
        copyToClipboard: function(str) {
            let el = document.createElement('textarea');
            
            el.value = str;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
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
                let match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
                let currency = currencyNames[match[2]];
                let value = parseFloat(match[1]);
                
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
    // these are shared between page scripts
    const shared = {
        // offers shared between offers pages
        offers: {
            // unusual helper functions
            unusual: {
                // all unusual effects as of apr. 20, 19
                effectsMap: {
                    'Community Sparkle': 4,
                    'Green Confetti': 6,
                    'Purple Confetti': 7,
                    'Haunted Ghosts': 8,
                    'Green Energy': 9,
                    'Purple Energy': 10,
                    'Circling TF Logo': 11,
                    'Massed Flies': 12,
                    'Burning Flames': 13,
                    'Scorching Flames': 14,
                    'Searing Plasma': 15,
                    'Vivid Plasma': 16,
                    'Sunbeams': 17,
                    'Circling Peace Sign': 18,
                    'Circling Heart': 19,
                    'Stormy Storm': 29,
                    'Blizzardy Storm': 30,
                    'Nuts n\' Bolts': 31,
                    'Orbiting Planets': 32,
                    'Orbiting Fire': 33,
                    'Bubbling': 34,
                    'Smoking': 35,
                    'Steaming': 36,
                    'Flaming Lantern': 37,
                    'Cloudy Moon': 38,
                    'Cauldron Bubbles': 39,
                    'Eerie Orbiting Fire': 40,
                    'Knifestorm': 43,
                    'Misty Skull': 44,
                    'Harvest Moon': 45,
                    'It\'s A Secret To Everybody': 46,
                    'Stormy 13th Hour': 47,
                    'Kill-a-Watt': 56,
                    'Terror-Watt': 57,
                    'Cloud 9': 58,
                    'Aces High': 59,
                    'Dead Presidents': 60,
                    'Miami Nights': 61,
                    'Disco Beat Down': 62,
                    'Phosphorous': 63,
                    'Sulphurous': 64,
                    'Memory Leak': 65,
                    'Overclocked': 66,
                    'Electrostatic': 67,
                    'Power Surge': 68,
                    'Anti-Freeze': 69,
                    'Time Warp': 70,
                    'Green Black Hole': 71,
                    'Roboactive': 72,
                    'Arcana': 73,
                    'Spellbound': 74,
                    'Chiroptera Venenata': 75,
                    'Poisoned Shadows': 76,
                    'Something Burning This Way Comes': 77,
                    'Hellfire': 78,
                    'Darkblaze': 79,
                    'Demonflame': 80,
                    'Showstopper': 3001,
                    'Holy Grail': 3003,
                    '\'72': 3004,
                    'Fountain of Delight': 3005,
                    'Screaming Tiger': 3006,
                    'Skill Gotten Gains': 3007,
                    'Midnight Whirlwind': 3008,
                    'Silver Cyclone': 3009,
                    'Mega Strike': 3010,
                    'Bonzo The All-Gnawing': 81,
                    'Amaranthine': 82,
                    'Stare From Beyond': 83,
                    'The Ooze': 84,
                    'Ghastly Ghosts Jr': 85,
                    'Haunted Phantasm Jr': 86,
                    'Haunted Phantasm': 3011,
                    'Ghastly Ghosts': 3012,
                    'Frostbite': 87,
                    'Molten Mallard': 88,
                    'Morning Glory': 89,
                    'Death at Dusk': 90,
                    'Hot': 701,
                    'Isotope': 702,
                    'Cool': 703,
                    'Energy Orb': 704,
                    'Abduction': 91,
                    'Atomic': 92,
                    'Subatomic': 93,
                    'Electric Hat Protector': 94,
                    'Magnetic Hat Protector': 95,
                    'Voltaic Hat Protector': 96,
                    'Galactic Codex': 97,
                    'Ancient Codex': 98,
                    'Nebula': 99,
                    'Death by Disco': 100,
                    'It\'s a mystery to everyone': 101,
                    'It\'s a puzzle to me': 102,
                    'Ether Trail': 103,
                    'Nether Trail': 104,
                    'Ancient Eldritch': 105,
                    'Eldritch Flame': 106,
                    'Neutron Star': 107,
                    'Tesla Coil': 108,
                    'Starstorm Insomnia': 109,
                    'Starstorm Slumber': 110,
                    'Hellish Inferno': 3013,
                    'Spectral Swirl': 3014,
                    'Infernal Flames': 3015,
                    'Infernal Smoke': 3016,
                    'Brain Drain': 111,
                    'Open Mind': 112,
                    'Head of Steam': 113,
                    'Galactic Gateway': 114,
                    'The Eldritch Opening': 115,
                    'The Dark Doorway': 116,
                    'Ring of Fire': 117,
                    'Vicious Circle': 118,
                    'White Lightning': 119,
                    'Omniscient Orb': 120,
                    'Clairvoyance': 121,
                    'Acidic Bubbles of Envy': 3017,
                    'Flammable Bubbles of Attraction': 3018,
                    'Poisonous Bubbles of Regret': 3019,
                    'Roaring Rockets': 3020,
                    'Spooky Night': 3021,
                    'Ominous Night': 3022
                },
                /**
                 * Include effect image in element
                 * @param {Object} itemEl - DOM element
                 * @param {Object} value - Value for Unusual effect
                 * @returns {undefined}
                 */
                modifyElement: function(itemEl, value) {
                    let versions = {
                        // the 188x188 version does not work for purple confetti
                        7: '380x380'
                    };
                    let version = versions[value];
                    let url = shared.offers.unusual.getEffectURL(value, version);
                    
                    itemEl.style.backgroundImage = `url('${url}')`;
                    itemEl.setAttribute('data-effect', value);
                    itemEl.classList.add('unusual');
                },
                /**
                 * Get URL of image for effect
                 * @param {Number} value - Value of effect
                 * @param {Number} [version] - Size of image from backpack.tf
                 * @returns {String} URL string
                 */
                getEffectURL: function(value, version) {
                    return `https://backpack.tf/images/440/particles/${value}_${version || '188x188'}.png`;
                },
                /**
                 * Get effect name from an item
                 * @param {Object} item - Item from steam
                 * @returns {(String|null|undefined)} Effect name, if available
                 */
                getEffectName: function(item) {
                    let hasDescriptions = typeof item.descriptions === 'object';
                    let isUnique = (item.name_color || '').toUpperCase() === '7D6D00';
                    
                    // unique items should probably never have effects
                    // though, cases have "Unusual Effect" descriptions and we want to exclude them
                    if (!hasDescriptions || isUnique) {
                        return null;
                    }
                    
                    for (let i = 0; i < item.descriptions.length; i++) {
                        let description = item.descriptions[i];
                        let match = description.color === 'ffd700' &&
                            description.value.match(/^\u2605 Unusual Effect: (.+)$/);
                        
                        if (match) {
                            return match[1];
                        }
                    }
                }
            }
        }
    };
    
    // set a stored value
    function setStored(name, value) {
        GM_setValue(name, value);
    }
    
    // get a stored value
    function getStored(name) {
        return GM_getValue(name);
    }
    
    // perform actions
    ready();
}());