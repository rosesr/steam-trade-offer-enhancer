function getTradeOfferWindow({WINDOW, $, Utils, shared, getStored, setStored}) {
    const urlParams = Utils.getURLParams();
    // these are never re-assigned in steam's source code
    // only updated
    const {UserYou, UserThem, RefreshTradeStatus} = WINDOW;
    const STEAMID = UserYou.strSteamId;
    const PARTNER_STEAMID = UserThem.strSteamId;
    const INVENTORY = WINDOW.g_rgAppContextData;
    const PARTNER_INVENTORY = WINDOW.g_rgPartnerAppContextData;
    const TRADE_STATUS = WINDOW.g_rgCurrentTradeStatus;
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
     * Interact with trade offer.
     * 
     * @namespace tradeOfferWindow
     */
    const tradeOfferWindow = (function() {
        /**
         * Get summary of items.
         * @param {Object} $items - JQuery object of collection of items.
         * @param {Boolean} you - Are these your items?
         * @returns {(Object|null)} Summary of items, null if inventory is not properly loaded.
         */
        function evaluateItems($items, you) {
            let warningIdentifiers = [
                {
                    name: 'rare TF2 key',
                    appid: '440',
                    check: function({appdata}) {
                        // array of rare TF2 keys (defindexes)
                        const rare440Keys = [
                            '5049', '5067', '5072', '5073',
                            '5079', '5081', '5628', '5631',
                            '5632', '5713', '5716', '5717',
                            '5762'
                        ];
                        const defindex = (
                            appdata &&
                            appdata.def_index
                        );
                        
                        return Boolean(
                            typeof defindex === 'string' &&
                            rare440Keys.indexOf(defindex) !== -1
                        );
                    }
                },
                {
                    name: 'uncraftable item',
                    appid: '440',
                    check: function({descriptions}) {
                        const isUncraftable = (description) => {
                            return Boolean(
                                !description.color &&
                                description.value === '( Not Usable in Crafting )'
                            );
                        };
                        
                        return Boolean(
                            typeof descriptions === 'object' &&
                            descriptions.some(isUncraftable)
                        );
                    }
                },
                {
                    name: 'spelled item',
                    appid: '440',
                    check: function({descriptions}) {
                        const isSpelled = (description) => {
                            return Boolean(
                                description.color === '7ea9d1' &&
                                description.value.indexOf('(spell only active during event)') !== -1
                            );
                        };
                        
                        return Boolean(
                            typeof descriptions === 'object' &&
                            descriptions.some(isSpelled)
                        );
                    }
                },
                {
                    name: 'restricted gift',
                    appid: '753',
                    check: function({fraudwarnings}) {
                        const isRestricted = (text) => {
                            return text.indexOf('restricted gift') !== -1;
                        };
                        
                        return Boolean(
                            typeof fraudwarnings === 'object' &&
                            fraudwarnings.some(isRestricted)
                        );
                    }
                }
            ];
            const inventory = you ? INVENTORY : PARTNER_INVENTORY;
            const total = $items.length;
            let apps = {};
            let items = {};
            let warnings = [];
            let valid = true;
            
            $items.toArray().forEach((itemEl) => {
                // array containing item identifiers e.g. ['440', '2', '123']
                const split = itemEl.id.replace('item', '').split('_'); 
                const [appid, contextid, assetid] = split;
                const img = itemEl.getElementsByTagName('img')[0].getAttribute('src');
                const quality = itemEl.style.borderColor;
                const effect = itemEl.getAttribute('data-effect') || 'none';
                const item = (
                    inventory[appid] &&
                    inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid]
                );
                
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
                    const identifier = warningIdentifiers[i];
                    const addWarning = Boolean(
                        identifier.appid === appid &&
                        identifier.check(item)
                    );
                    
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
                return {
                    total,
                    apps,
                    items,
                    warnings
                };
            } else {
                return null;
            }
        }
        
        /**
         * Get summary HTML.
         * @param {String} type - Name of user e.g. "Your" or "Their".
         * @param {(Object|null)} summary - Result from evaluateItems.
         * @param {Object} User - User object from steam that the items belong to.
         * @returns {String} Summary HTML.
         */
        function dumpSummary(type, summary, User) {
            // no summary or no items
            if (summary === null || summary.total === 0) {
                return '';
            }
            
            function getSummary(items, apps, steamid) {
                // helper for getting effecting url
                const {getEffectURL} = shared.offers.unusual;
                const ids = apps['440'];
                const getItem = (img, quality, effect, count) => {
                    let imgs = [`url(${img})`];
                    
                    if (effect !== 'none') {
                        imgs.push(`url('${getEffectURL(effect)}')`);
                    }
                    
                    const styles = `background-image: ${imgs.join(', ')}; border-color: ${quality};`;
                    const badge = count > 1 ? `<span class="summary_badge">${count}</span>` : '&nbsp;';
                    
                    return `<span class="summary_item" style="${styles}">${badge}</span>`;
                };
                let html = '';
                
                // super duper looper
                for (let img in items) {
                    for (let quality in items[img]) {
                        for (let effect in items[img][quality]) {
                            let count = items[img][quality][effect];
                            
                            html += getItem(img, quality, effect, count);
                        }
                    }
                }
                
                if (ids) {
                    // if tf2 items are in offer
                    // return summary items with backpack.tf link wrapped around 
                    const url = `https://backpack.tf/profiles/${steamid}?select=${ids.join(',')}`;
                    
                    return `<a title="Open on backpack.tf" href="${url}" target="_blank">${html}</a>`;
                } else {
                    return html;
                }
            }
            
            function getWarnings() {
                // no warnings to display
                if (warnings.length === 0) {
                    return '';
                }
                
                // so that descriptions are always in the same order
                const descriptions = warnings.sort().join('<br/>');
                
                return `<div class="warning">${descriptions}</span>`;
            }
            
            /**
             * Get header for summary.
             * @param {String} type - The name of trader e.g. "My" or "Them".
             * @param {Number} total - Total number of items in offer.
             * @returns {String} HTML string.
             */
            function getHeader(type, total) {
                const itemsStr = total === 1 ? 'item' : 'items';
                
                return `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;
            }
            
            // unpack summary...
            const {total, apps, items, warnings} = summary;
            const steamid = User.strSteamId;
            
            // build html piece-by-piece
            return [
                getHeader(type, total),
                getSummary(items, apps, steamid),
                getWarnings(warnings)
            ].join('');
        }
        
        /**
         * Summarize a user's items in trade offer.
         * @param {Boolen} you - Is this your summary?
         * @returns {undefined}
         * @memberOf tradeOfferWindow
         */
        function summarize(you) {
            const name = you ? 'you' : 'them';
            const config = {
                you: {
                    you: true,
                    name: 'My',
                    user: UserYou,
                    $slots: page.$yourSlots,
                    $container: page.$yourSummary
                },
                them: {
                    you: false,
                    name: 'Their',
                    user: UserThem,
                    $slots: page.$theirSlots,
                    $container: page.$theirSummary
                }
            }[name];
            const $items = config.$slots.find('div.item');
            const summary = evaluateItems($items, config.you);
            const html = dumpSummary(config.name, summary, config.user);
            
            config.$container.html(html);
        }
        
        /**
         * Callback when chain has finished.
         * @callback chain-callback
         */
        
        /**
         * Call function for each item one after another.
         * @param {Array} items - Array.
         * @param {Number} timeout - Time between each call.
         * @param {Function} fn - Function to call on item.
         * @param {chain-callback} callback - Callback when chain has finished.
         * @returns {undefined}
         */
        function chain(items, timeout, fn, callback) {
            function getNext(callback) {
                const item = items.shift();
                
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
            const items = $addedItems.find('div.item').get();
            
            // remove all at once
            WINDOW.GTradeStateManager.RemoveItemsFromTrade(items.reverse());
            
            // remove by each item
            // let Clear = WINDOW.MoveItemToInventory;
            // chain(items.reverse(), 100, Clear, summarize);
        }
        
        // add items to the trade offer
        function addItemsToOffer(items, callback) {
            const MoveItem = WINDOW.MoveItemToTrade;
            
            chain(items, 20, MoveItem, callback);
        }
        
        /**
         * Callback when items have finished adding.
         * @callback addItems-callback
         */
        
        /**
         * Add items to trade.
         * @param {Object} items - JQuery object of items.
         * @param {addItems-callback} callback - Callback when items have finished adding.
         * @returns {undefined}
         * @memberOf tradeOfferWindow
         */
        function addItems(items, callback = function() {}) {
            addItemsToOffer(items, callback);
        }
        
        /**
         * Clear items in offer.
         * @param {Object} $addedItems - JQuery object of items to remove.
         * @returns {undefined}
         * @memberOf tradeOfferWindow
         */
        function clear($addedItems) {
            clearItemsInOffer($addedItems);
        }
        
        /**
         * Update display of buttons.
         * @param {Boolean} you - Is your inventory selected?
         * @param {Number} appid - AppID of inventory selected.
         * @returns {undefined}
         * @memberOf tradeOfferWindow
         */
        function updateDisplay(you, appid) {
            // update the state of the button
            const updateState = ($btn, show) => {
                if (show) {
                    $btn.show();
                } else {
                    $btn.hide();
                }
            };
            const isTF2 = appid == 440;
            const isCSGO = appid == 730;
            const listingIntent = urlParams.listing_intent;
            // show keys button for tf2 and csgo
            const showKeys = isTF2 || isCSGO;
            const showMetal = isTF2;
            // 0 = buy order
            // 1 = sell order
            // we are buying, add items from our inventory
            const isBuying = Boolean(
                you &&
                listingIntent == 1
            );
            const isSelling = (
                !you &&
                listingIntent == 0
            );
            const showListingButton = Boolean(
                isTF2 &&
                (
                    isBuying ||
                    isSelling
                )
            );
            
            updateState(page.btns.$items, true); 
            updateState(page.btns.$keys, showKeys);
            updateState(page.btns.$metal, showMetal);
            updateState(page.btns.$listing, showListingButton);
        }
        
        /**
         * Call when a different user's inventory is selected.
         * @param {Object} $inventoryTab - JQuery element of inventory tab selected.
         * @returns {undefined}
         * @memberOf tradeOfferWindow
         */
        function userChanged($inventoryTab) {
            // fallback option for getting appid
            function appIdFallback() {
                // fallback to appid from image
                const src = page.get.$appSelectImg().attr('src') || '';
                const match = src.match(/public\/images\/apps\/(\d+)/);
                
                return match && match[1];
            }
            
            const $inventory = page.get.$inventory();
            const you = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
            const match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
            const appid = (match && match[1]) || appIdFallback();
            
            // now update the dispaly
            updateDisplay(you, appid);
        }
        
        return {
            summarize, addItems, clear, updateDisplay, userChanged
        };
    }());
    /**
     * Manage inventory load events.
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
         * An inventory has loaded, call all events according to parameters.
         * @param {String} steamid - Steamid of user.
         * @param {String} appid - Appid of inventory loaded.
         * @param {String} contextid - Contextid of inventory loaded.
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
         * Register an event.
         * @param {String} steamid - Steamid for user.
         * @param {(String|Function)} appid - Appid of event, or app-agnostic function to be called.
         * @param {(String|undefined)} [contextid] - Contextid of app.
         * @param {(Function|undefined)} [fn] - Function to call when inventory is loaded.
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
     * Collect items based on conditions.
     * @param {String} mode - Mode.
     * @param {Number} amount - Number of items to pick.
     * @param {Number} index - Index to start picking items at.
     * @param {Boolean} [you] - Your items?
     * @returns {Array} First value is an array of items, second is whether the amount was satisfied.
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
                
                const tags = item.tags;
                
                for (let i = 0, n = tags.length; i < n; i++) {
                    const tag = tags[i];
                    const hasTag = Boolean(
                        tag.category === tagName &&
                        tagValue === tag.name
                    );
                    
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
                const hasMetal = (item, name) => {
                    return Boolean(
                        item.appid == 440 &&
                        item.market_hash_name === name
                    );
                };
                
                // find each type of metal
                return function(you, amount, index, name) {
                    return pickItems(you, amount, index, (item) => {
                        return hasMetal(item, name);
                    });
                };
            }()),
            // return items by array of id's
            id: function(ids) {
                const filter = (item) => {
                    return ids.indexOf(item.id) !== -1;
                };
                const items = pickItems(null, ids.length, 0, filter).sort((a, b) => {
                    return ids.indexOf(a.id) - ids.indexOf(b.id);
                });
                
                return items;
            }
        };
        
        /**
         * Pick items from inventory.
         * @param {(Boolean|null)} you - Pick items from your inventory? Use null for both.
         * @param {Number} amount - Amount of items to pick.
         * @param {Number} index - Index to start picking items at.
         * @param {Function} finder - Finder method.
         * @returns {Array} Array of picked items.
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
                const user = you ? UserYou : UserThem;
                const $items = (you ? page.$yourSlots : page.$theirSlots).find('.item');
                const inventory = getInventory(user);
                // get ids of items in trade offer matching app
                const addedIDs = $items.toArray().reduce((arr, el) => {
                    const split = el.id.replace('item', '').split('_');
                    const [iAppid, , assetid] = split;
                    
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
                    const id = ids[i];
                    const item = inventory[id];
                    
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
            
            const $inventory = page.get.$inventory();
            const match = ($inventory.attr('id') || '').match(/(\d+)_(\d+)$/);
            const [ , appid, contextid] = (match || []);
            
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
         * Offset index to pick items at based on amount and number of items available.
         * @param {Number} index - Index.
         * @param {Number} amount - Amount of items to pick.
         * @param {Number} length - Number of items to pick from.
         * @returns {Number} Modified index.
         */
        function offsetIndex(index, amount, length) {
            if (index < 0) {
                // pick from back if index is negative
                return Math.max(0, length - (amount + index + 1));
            } else if (index + amount >= length) {
                // offset if index + the amount is greater than the number of items we can pick
                return Math.max(0, length - amount);
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
         * Pick metal from items based on value in refined metal.
         * @param {Boolean} you - Add to your side?
         * @param {Number} amount - Value to make in metal (e.g. 13.33).
         * @param {Number} index - Index to add at.
         * @returns {Array} First value is an array of items, second is whether the amount was satisfied.
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
         * Collect items based on conditions.
         * @param {String} mode - Mode.
         * @param {Number} amount - Number of items to pick.
         * @param {Number} index - Index to start picking items at.
         * @param {Boolean} [you] - Your items?
         * @returns {Array} First value is an array of items, second is whether the amount was satisfied.
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
                    
                    // select in reverse
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
         * Get URL of image for effect.
         * @param {Number} value - Value of effect.
         * @returns {String} URL string.
         */
        function getEffectURL(value) {
            return `https://backpack.tf/images/440/particles/${value}_188x188.png`;
        }
        
        return {
            addImagesToInventory,
            getEffectURL
        };
    }());
    
    // add elements to page
    function addElements() {
        const controlsHTML = `
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
        `;
        const itemSummaryHTML = `
            <div id="tradeoffer_items_summary">
                <div class="items_summary" id="your_summary"></div>
                <div class="items_summary" id="their_summary"></div>
            </div>
        `;
        const $tradeBox = page.$tradeBoxContents;
        const html = [
            controlsHTML,
            itemSummaryHTML
        ].join('').replace(/\s{2,}/g, ' ');
        
        // add it
        $tradeBox.append(html);
        
        // add newly created elements to page object
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
             * Callback when items have finished adding.
             * @callback addCurrencies-callback
             * @param {Array} reasons - Array of reasons if value was not met for each currency.
             */
            
            /**
             * Add currencies to the trade.
             * @param {Boolean} you - Are we adding from your inventory?
             * @param {Object} currencies - Object containing currencies.
             * @param {addCurrencies-callback} callback - Callback when all items have been added.
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
         * Add items by list of IDs.
         * @param {String} idsStr - Comma-seperated list of IDs.
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
    
    // register inventory events
    function bindInventoryEvents() {
        // this will force an inventory to load
        function forceInventory(appid, contextid) {
            TRADE_STATUS.them.assets.push({
                appid: appid,
                contextid: contextid,
                assetid: '0',
                amount: 1
            });
            RefreshTradeStatus(TRADE_STATUS, true);
            TRADE_STATUS.them.assets = [];
            RefreshTradeStatus(TRADE_STATUS, true);
        }
        
        function addEffectImages(steamid, appid, contextid) {
            const you = steamid === STEAMID;
            const inventory = you ? INVENTORY : PARTNER_INVENTORY;
            const contextInventory = inventory[appid].rgContexts[contextid].inventory.rgInventory;
            
            if (!you) {
                // force the items in their inventory to be displayed so we can add images
                // if their inventory has not been displayed
                forceVisibility();
            }
            
            unusual.addImagesToInventory(contextInventory);
            // re-summarize
            tradeOfferWindow.summarize(you);
        }
        
        /**
         * Force visibility of other user's inventory.
         * @returns {undefined}
         */
        function forceVisibility() {
            const $activeTab = page.get.$activeInventoryTab();
            const $theirs = page.$inventorySelectTheir;
            
            $theirs.trigger('click');
            $activeTab.trigger('click');
        }
        
        inventoryManager.register(STEAMID, () => {
            // something to do when your inventory is loaded...
        });
        
        if (urlParams.listing_intent !== undefined) {
            // we are buying, add items from our inventory
            const isSelling = urlParams.listing_intent == 0;
            
            page.btns.$listing.addClass(isSelling ? 'selling' : 'buying');
            
            // force their inventory to load if we are selling
            if (isSelling) {
                forceInventory('440', '2');
            }
        }
        
        if (urlParams.for_item !== undefined) {
            const [appid, contextid, assetid] = urlParams.for_item.split('_');
            const item = {
                appid,
                contextid,
                assetid,
                amount: 1
            };
            
            TRADE_STATUS.them.assets.push(item);
            RefreshTradeStatus(TRADE_STATUS, true);
            
            // check for a dead item when this inventory is loaded
            inventoryManager.register(PARTNER_STEAMID, appid, contextid, () => {
                if (page.get.$deadItem().length === 0) {
                    return;
                }
                
                TRADE_STATUS.them.assets = [];
                RefreshTradeStatus(TRADE_STATUS, true);
                alert(
                    `Seems like the item you are looking to buy (ID: ${assetid}) is no longer available. ` +
                    'You should check other user\'s backpack and see if it\'s still there.'
                );
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
        // basically removes animation due to bugginess
        // also it's a bit faster
        WINDOW.EnsureSufficientTradeSlots = function(bYourSlots, cSlotsInUse, cCurrencySlotsInUse) {
            const getDesiredSlots = () => {
                const useResponsiveLayout = WINDOW.Economy_UseResponsiveLayout();
                
                if (useResponsiveLayout) {
                    return cTotalSlotsInUse + 1;
                } else {
                    const cTotalSlotsInUse = cSlotsInUse + cCurrencySlotsInUse;
                    
                    return Math.max(Math.floor((cTotalSlotsInUse + 5) / 4) * 4, 8);
                }
            };
            const $slots = bYourSlots ? page.$yourSlots : page.$theirSlots;
            const elSlotContainer = $slots[0];
            const cDesiredSlots = getDesiredSlots();
            const cDesiredItemSlots = cDesiredSlots - cCurrencySlotsInUse;
            const cCurrentItemSlots = elSlotContainer.childElements().length;
            const cCurrentSlots = cCurrentItemSlots + cCurrencySlotsInUse;
            const bElementsChanged = cDesiredSlots !== cCurrentSlots;
            const rgElementsToRemove = [];
            
            if (cDesiredSlots > cCurrentSlots) {
                const Create = WINDOW.CreateTradeSlot;
                
                for (let i = cCurrentItemSlots; i < cDesiredItemSlots; i++) {
                    Create(bYourSlots, i);
                }
            } else if (cDesiredSlots < cCurrentSlots) {
                // going to compact
                const prefix = bYourSlots ? 'your_slot_' : 'their_slot_';
                const $parent = $slots.parent();
                
                for (let i = cDesiredItemSlots; i < cCurrentItemSlots; i++) {
                    const element = $slots.find('#' + prefix + i)[0];
                    
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
        WINDOW.GTradeStateManager.RemoveItemsFromTrade = function(items) {
            function checkItems(items, you) {
                if (items.length === 0) {
                    return false;
                }
                
                function getGroups(rgItems) {
                    const groupBy = Utils.groupBy;
                    const grouped = groupBy(rgItems, 'appid');
                    
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
                    const revertItem = WINDOW.RevertItem;
                    const isInTradeSlot = WINDOW.BIsInTradeSlot;
                    const cleanSlot = WINDOW.CleanupSlot;
                    const setStackItemInTrade = WINDOW.SetStackableItemInTrade;
                    
                    // this is done in reverse
                    for (let i = items.length - 1; i >= 0; i--) {
                        const elItem = items[i];
                        const item = elItem.rgItem;
                        
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
                    if (rgItems.length === 0) {
                        return false;
                    }
                    
                    const getItem = ({appid, contextid, assetid}) => {
                        return (
                            groups[appid] &&
                            groups[appid][contextid] &&
                            groups[appid][contextid][assetid]
                        );
                    };
                    const slots = you ? TRADE_STATUS.me : TRADE_STATUS.them;
                    const groups = getGroups(rgItems);
                    let assets = slots.assets;
                    let bChanged;
                    
                    for (let i = assets.length - 1; i >= 0; i--) {
                        const asset = assets[i];
                        const item = getItem(asset);
                        
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
            
            const manager = WINDOW.GTradeStateManager;
            const [yours, theirs] = Utils.partition(items, (elItem) => {
                return !elItem.rgItem.is_their_item;
            });
            const hasChanged = [
                checkItems(yours, true),
                checkItems(theirs, false)
            ].some(Boolean);
            
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
            if (page.$inventoryDisplayControls.height() >= 50) {
                return;
            }
            
            page.$inventories.css('marginBottom', '8px');
        }
        
        tradeOfferWindow.userChanged(page.get.$activeInventoryTab());
        
        if (getStored(stored.id_visible) == 1) {
            page.fields.$ids.show();
        }
        
        if (urlParams.listing_intent !== undefined) {
            const isSelling = urlParams.listing_intent == 0;
            
            page.btns.$listing.addClass(isSelling ? 'selling' : 'buying');
        }
        
        page.$inventories.css('marginBottom', '8px');
        setInterval(fixHeight, 500);
    }
    
    // perform actions
    addElements();
    bindEvents();
    bindInventoryEvents();
    observe();
    configure();
    overrides();
}