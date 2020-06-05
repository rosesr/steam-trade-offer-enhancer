// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @description Browser script to enhance Steam trade offers.
// @version     2.0.2
// @author      Julia
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @updateURL   https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.meta.js
// @downloadURL https://github.com/juliarose/steam-trade-offer-enhancer/raw/master/steam.trade.offer.enhancer.user.js
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       unsafeWindow
// @run-at      document-end
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
// @include     /^https?:\/\/steamcommunity\.com\/market\/listings\/440\/.*/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/inventory(\/$|\?|$)/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[A-z0-9]+(\/$|\?|$)/
// @include     /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// ==/UserScript==

(function() {
    'use strict';
    
    const scripts = [
        {
            includes: [
                /^https?:\/\/(.*\.)?backpack\.tf(:\\d+)?\/(stats|classifieds).*/
            ],
            fn: function({ Utils }) {
                const dom = {
                    listingsElList: document.getElementsByClassName('listing')
                };
                
                Array.from(dom.listingsElList).forEach((listingEl) => {
                    const itemEl = listingEl.getElementsByClassName('item')[0];
                    const offerButtonEl = listingEl.getElementsByClassName('listing-buttons')[0].lastElementChild;
                    const href = offerButtonEl.getAttribute('href');
                    const {
                        listing_intent,
                        listing_price
                    } = itemEl.dataset;
                    const currencies = Utils.stringToCurrencies(listing_price);
                    
                    // no currencies
                    if (currencies == null) {
                        // continue
                        return;
                    }
                    
                    // array of query string parameters
                    // e.g. ['listing_intent=1', 'listing_currencies_keys=2']
                    const query = (function getQuery() {
                        const params = {
                            listing_intent: listing_intent === 'buy' ? 0 : 1
                        };
                        
                        for (let k in currencies) {
                            params['listing_currencies_' + k] = currencies[k];
                        }
                        
                        return Object.entries(params).map(([k, v]) => {
                            return k + '=' + v;
                        });
                    }());
                    // url with query added
                    const url = [
                        href,
                        ...query
                    ].join('&');
                    
                    offerButtonEl.setAttribute('href', url);
                });
            }
        },
        {
            includes: [
                /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
            ],
            fn: function({ $, Utils, getStored, setStored }) {
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
                // the key value is used for displaying totals in keys
                // get key value from cache, if available
                let keyValue = getStored(stored.key_price);
                
                // wait for the backpack to load
                (function waitForBackpack() {
                    // the backpack was loaded
                    function onBackpackLoad() {
                        // get the value of keys in metal
                        // this should be very approximate, but close enough
                        function getKeyValue() {
                            // gets pricing details from item element
                            function parseItem(itemEl) {
                                // parse price string e.g. "1-1.2 keys"
                                function parseString(string) {
                                    const match = string.match(/^([\d\.]*)[\-\u2013]?([\d\.]*)? (\w*)/); 
                                    const currencyNames = {
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
                                    const match = allStr.replace(/\,/g, '').match(/(\d+\.?\d*) ref/);
                                    const value = match && parseFloat(match[1]);
                                    const rawValue = details.raw;
                                    const canUseRawValue = Boolean(
                                        value &&
                                        rawValue &&
                                        value.toFixed(2) === rawValue.toFixed(2)
                                    );
                                    
                                    // the raw value has extra precision but includes the value of paint/strange parts.
                                    // if it is close to the value of the price items,
                                    // we can use the raw value instead which is more precise
                                    if (canUseRawValue) {
                                        return rawValue;
                                    } else {
                                        return value || rawValue;
                                    }
                                }
                                
                                const data = itemEl.dataset;
                                const details = {};
                                
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
                            const item = page.get.$itemPricedInKeys()[0];
                            const price = item && parseItem(item);
                            const useItemPricedInKeys = Boolean(
                                price &&
                                price.currency === 'keys' &&
                                price.average &&
                                price.refined
                            );
                            
                            // use an item priced in keys to extract the key value
                            if (useItemPricedInKeys) {
                                // to get the value of keys in refined metal...
                                // take the price in metal divided by the price in keys
                                return price.refined / price.average;
                            } else {
                                // set value using the value of a key, if no items in inventory are priced in keys
                                const key = page.get.$crateKey()[0];
                                const price = (
                                    key &&
                                    parseItem(key)
                                );
                                
                                return (
                                    price &&
                                    price.refined
                                );
                            }
                        }
                        
                        function filterItems($filtered) {
                            // no items to filter
                            if ($filtered.length === 0) {
                                return;
                            }
                            
                            const $backpack = page.$backpack;
                            const $items = $backpack.find('li.item:not(.spacer)');
                            const $unfiltered = $items.not($filtered);
                            const $spacers = $backpack.find('li.spacer');
                            // all hidden items are moved to a temp page
                            const $tempPage = $('<div class="temp-page" style="display:none;"/>');
                            
                            // sort
                            sortBy('price');
                            // then add the temp page, it will be hidden
                            $backpack.append($tempPage);
                            // remove spacers
                            $spacers.appendTo($tempPage);
                            // add the unfiltered items to the temp page
                            $unfiltered.appendTo($tempPage);
                            // hide pages that contain no items
                            page.get.$backpackPage().each((i, el) => {
                                const $page = $(el);
                                const $items = $page.find('.item-list .item');
                                
                                if ($items.length === 0) {
                                    $page.hide();
                                }
                            });
                            // then update totals
                            // hackish way of updating totals
                            page.get.$firstSelectPage().trigger('click');
                            page.get.$firstSelectPage().trigger('click');
                        }
                        
                        // selects items in inventory matching the given ids
                        function selectItemsById(ids) {
                            const $backpack = page.$backpack;
                            const $items = $backpack.find('li.item:not(.spacer)');
                            const selectors = ids.map(id => `[data-id="${id}"]`);
                            // select items
                            const $filtered = $items.filter(selectors.join(','));
                            
                            filterItems($filtered);
                        }
                        
                        function sortBy(key) {
                            page.$inventorySortMenu.find(`li[data-value="${key}"]`).trigger('click');
                        }
                        
                        // changes the comparison
                        // set up to true to go up a day, otherwise go down
                        function compare(up) {
                            const $from = page.get.$inventoryCmpFrom();
                            const $to = page.get.$inventoryCmpTo();
                            const isAvailable = (
                                $from.length > 0 &&
                                !$from.hasClass('disabled')
                            );
                            
                            // no selections available
                            if (!isAvailable) {
                                return;
                            }
                            
                            const from = parseInt($from.val());
                            const to = parseInt($to.val());
                            const options = $from.find('option').map((i, el) => {
                                return parseInt(el.value);
                            }).get();
                            const filtered = options.filter((option) => {
                                if (option === to || option === from) {
                                    return false;
                                } else if (up) {
                                    return option > to;
                                }
                                
                                return option < to;
                            });
                            
                            // no items
                            if (filtered.length === 0) {
                                return;
                            }
                            
                            const value = up ? Math.min(...filtered) : Math.max(...filtered);
                            const abs = [from, to].map(a => Math.abs(a - value));
                            // farthest... closest? I failed math, but it works
                            const farthest = Math.min(...abs) === Math.abs(from - value) ? from : to;
                            
                            if (farthest === from) {
                                $to.val(value).trigger('change');
                            } else if (farthest === to) {
                                $from.val(value).trigger('change');
                            }
                        }
                        
                        // get the id's of all selected items
                        function getIDs() {
                            return page.get.$selected().map((i, el) => {
                                return el.dataset.id;
                            }).get();
                        }
                        
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
                        
                        // disconnect observer since the backpack has been loaded
                        observer.disconnect();
                        // then callback
                        
                        // ids are comma-seperated in select param
                        const select = Utils.getIDsFromString(urlParams.select);
                        // get key value using items in inventory
                        const bpKeyValue = getKeyValue();
                        
                        if (bpKeyValue) {
                            // set keyValue to price obtained from inventory
                            // this should be very approximate. but close enough
                            keyValue = bpKeyValue;
                            // then cache it
                            setStored(stored.key_price, keyValue);
                        }
                        
                        if (select) {
                            // select items if select param is present
                            selectItemsById(select);
                        }
                        
                        page.$document.on('keypress', (e) => {
                            keyPressed(e);
                        });
                    }
                    
                    // perform actions
                    // observe changes to refined value
                    (function observeRefinedValue() {
                        // get pretty value in keys
                        function refinedToKeys(value) {
                            return Math.round((value / keyValue) * 10) / 10;
                        }
                        
                        function refinedValueChanged() {
                            // this will generally always be available other than the first load
                            // if it isn't there's nothing we can do
                            if (!keyValue) return;
                            
                            // get total value of all items in keys by converting from ref value
                            const text = $refined.text().replace(/,/g, '').trim();
                            const refined = parseFloat(text);
                            const keysValue = refinedToKeys(refined);
                            
                            // disconnect so we can modify the object
                            // without calling this function again
                            observer.disconnect();
                            // update the ref value
                            $refined.text(keysValue);
                            // observe changes again
                            observeRefChanges(); 
                        }
                            
                        function observeRefChanges() {
                            // observe changes to ref value
                            observer.observe(refinedEl, {
                                childList: true,
                                subtree: true,
                                attributes: false,
                                characterData: false
                            });
                        }
                        
                        // keeping this in a mouseover will speed things up a bit
                        // especially if there are many items that are listed in the inventory
                        function updatedListedPrice() {
                            // this will generally always be available other than the first load
                            // if it isn't there's nothing we can
                            if (!keyValue) return;
                            
                            function getKeysListedValue() {
                                // get refined value from currencies
                                const getRefinedValue = (currencies) => {
                                    const keys = currencies.keys || 0;
                                    const metal = currencies.metal || 0;
                                    
                                    return (keys * keyValue) + metal;
                                };
                                const $listedItems = page.get.$listedItems();
                                const prices = $listedItems.map((i, el) => {
                                    const listingPrice = el.dataset.listing_price;
                                    // get refined value of listing price
                                    const currencies = Utils.stringToCurrencies(listingPrice);
                                    const refined = (
                                        currencies &&
                                        getRefinedValue(currencies)
                                    ) || 0;
                                    
                                    return refined;
                                }).get();
                                const sum = (a, b) => a + b;
                                const refined = prices.reduce(sum, 0);
                                
                                return refinedToKeys(refined);
                            }
                            
                            const listedKeysValue = getKeysListedValue();
                            const listedValueStr = `${listedKeysValue} keys listed value`;
                            
                            $refined.attr({
                                'title': listedValueStr,
                                'data-original-title': listedValueStr
                            });
                            // clear title
                            $refined.attr('title', ''); 
                        }
                        
                        const observer = new MutationObserver(refinedValueChanged);
                        const $refined = page.$refined;
                        const refinedEl = $refined[0];
                        
                        // change the text from "refined" to "keys"
                        page.$refined.closest('li').find('small').text('keys'); 
                        refinedValueChanged();
                        $refined.on('mouseover', updatedListedPrice);
                    }());
                    
                    function handler(mutations) {
                        // if the mutations include an item list, items have been added
                        const hasItemList = mutations.some((mutation) => {
                            return Boolean(
                                mutation.addedNodes &&
                                mutation.target.className === 'item-list'
                            );
                        });
                        
                        if (hasItemList) {
                            // backpack has loaded
                            onBackpackLoad();
                        }
                    }
                    
                    const observer = new MutationObserver(handler);
                    const backpackEl = document.getElementById('backpack');
                    const settings = {
                        childList: true,
                        subtree: true,
                        attributes: false,
                        characterData: false
                    };
                    
                    observer.observe(backpackEl, settings);
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/steamcommunity\.com\/market\/listings\/440\/.*/
            ],
            styles: `
                .unusual {
                    background-position: center !important;
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                }
                
                .uncraft {
                    border-style: dashed !important;
                }
                
                .strange:before {
                    content: " ";
                    position: absolute;
                    z-index: 1;
                    top: 2px;
                    left: 2px;
                    right: 2px;
                    bottom: 2px;
                    border: 2px solid rgba(207, 106, 50, 0.5);
                    /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
                }
                
                .icons img.spell {
                    width: 14px;
                    height: 20px;
                }
                
                .icons {
                    position: absolute;
                    bottom: 3px;
                    left: 3px;
                    width: 100%;
                    height: 20px;
                }
            `,
            fn: function({ WINDOW, shared }) {
                const dom = {
                    resultsRows: document.getElementById('searchResultsRows')
                };
                
                // gets the appid, contextid and assetid from an element
                function getItem(rowEl) {
                    const buyButtonLinkEl = rowEl.querySelector('div.market_listing_buy_button a');
                    
                    if (!buyButtonLinkEl) {
                        return null;
                    }
                    
                    const href = buyButtonLinkEl.getAttribute('href');
                    const params = href.replace('javascript:BuyMarketListing', '').replace(/[\,\(/) ]/g, '');
                    const split = params.split(/'(.+?)'/g).filter(a => a);
                    const [ , , appid, contextid, assetid] = split;
                    
                    return {
                        appid,
                        contextid,
                        assetid
                    };
                }
                
                // gets an item's asset
                function getAsset({ appid, contextid, assetid }) {
                    const assets = WINDOW.g_rgAssets;
                    
                    return (
                        assets[appid] &&
                        assets[appid][contextid] &&
                        assets[appid][contextid][assetid]
                    );
                }
                
                function addAttributesToResults() {
                    const rowsList = dom.resultsRows.getElementsByClassName('market_listing_row');
                    const {
                        addAttributes
                    } = shared.offers.identifiers;
                    
                    Array.from(rowsList).forEach((rowEl) => {
                        // extract item data from this row
                        const item = getItem(rowEl);
                        // get asset data from that data
                        const asset = (
                            item &&
                            getAsset(item)
                        );
                        
                        // no asset for whatever reason
                        if (asset == null) {
                            // continue
                            return;
                        }
                        
                        // get the container for the item image
                        const itemImgContainerEl = rowEl.querySelector('div.market_listing_item_img_container');
                        // get the image element
                        const itemImgEl = itemImgContainerEl.querySelector('img.market_listing_item_img');
                        // we create another element to wrap the image element in for styling purposes
                        const itemEl = (function() {
                            const el = document.createElement('div');
                            const imgSrc = itemImgEl.getAttribute('src');
                            
                            el.classList.add('market_listing_item_img', 'economy_item_hoverable');
                            el.setAttribute('style', itemImgEl.getAttribute('style'));
                            el.style.position = 'relative';
                            el.style.backgroundImage = `url('${imgSrc}')`;
                            
                            return el;
                        }());
                        
                        // remove attributes from the image element
                        itemImgEl.classList.remove('market_listing_item_img');
                        itemImgEl.style.backgroundColor = 'transparent';
                        
                        // add it to our newly created item elment
                        itemEl.appendChild(itemImgEl);
                        
                        // then add it to the container - this effectively wraps the image in another element
                        itemImgContainerEl.appendChild(itemEl);
                        
                        // now add the attributes to this item
                        addAttributes(asset, itemEl);
                    });
                }
                
                // add the initial elements
                addAttributesToResults();
                
                // observe changes to rows
                (function() {
                    const observer = new MutationObserver(addAttributesToResults);
                    
                    observer.observe(dom.resultsRows, {
                        childList: true
                    });
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/inventory(\/$|\?|$)/
            ],
            styles: `
                .unusual {
                    background-position: center !important;
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                }
                
                .uncraft {
                    border-style: dashed !important;
                }
                
                .strange:before {
                    content: " ";
                    position: absolute;
                    z-index: 1;
                    top: 2px;
                    left: 2px;
                    right: 2px;
                    bottom: 2px;
                    border: 2px solid rgba(207, 106, 50, 0.5);
                    /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
                }
                
                .icons img.spell {
                    width: 14px;
                    height: 20px;
                }
                
                .icons {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    width: 100%;
                    height: 20px;
                }
            `,
            fn: function({ $, WINDOW, shared }) {
                const dom = {
                    inventory: document.getElementById('inventories'),
                    get: {
                        tf2Inventory: () => {
                            const userSteamId = WINDOW.UserYou.strSteamId;
                            const app440InventoryId = `inventory_${userSteamId}_440_2`;
                            
                            return document.getElementById(app440InventoryId);
                        },
                        items: () => {
                            const inventory = dom.get.tf2Inventory();
                            
                            if (!inventory) {
                                return [];
                            }
                            
                            return Array.from(inventory.querySelectorAll('.item:not(.pendingItem)'));
                        }
                    }
                };
                
                // tf2 inventory has changed
                function onTF2InventoryChange() {
                    function getAsset(assets, itemEl) {
                        const [ , , assetid] = itemEl.id.split('_');
                        
                        return assets[assetid];
                    }
                    
                    // tf2 assets
                    const inventory = (
                        WINDOW.g_rgAppContextData &&
                        WINDOW.g_rgAppContextData[440] &&
                        WINDOW.g_rgAppContextData[440].rgContexts &&
                        WINDOW.g_rgAppContextData[440].rgContexts[2] &&
                        WINDOW.g_rgAppContextData[440].rgContexts[2].inventory
                    );
                    
                    // no tf2 inventory in contexts
                    if (!inventory) {
                        // stop
                        return;
                    }
                    
                    const {
                        addAttributes
                    } = shared.offers.identifiers;
                    const assets = inventory.m_rgAssets;
                    const itemsList = dom.get.items();
                    
                    itemsList.forEach((itemEl) => {
                        const asset = getAsset(assets, itemEl);
                        // item is stored in description of asset
                        const item = asset.description;
                        
                        // add the attributes to this item
                        addAttributes(item, itemEl);
                    });
                }
                
                // a tf2 inventory was loaded on the page
                function onTF2Inventory(tf2Inventory) {
                    const observer = new MutationObserver(onTF2InventoryChange);
                    
                    // observe changes to the tf2 inventory
                    observer.observe(tf2Inventory, {
                        childList: true
                    });
                    
                    onTF2InventoryChange();
                }
                
                // observe changes to dom
                (function() {
                    const inventoryEl = dom.inventory;
                    // wait for the tf2 inventory to be loaded
                    const observer = new MutationObserver(() => {
                        const tf2Inventory = dom.get.tf2Inventory();
                        const tf2InventoryVisible = Boolean(
                            tf2Inventory &&
                            tf2Inventory.style.display !== 'none'
                        );
                        const itemsList = dom.get.items();
                        
                        // make sure the inventory is visible and it contains visible items
                        if (tf2InventoryVisible && itemsList.length > 0) {
                            // disconnect the observer
                            observer.disconnect();
                            onTF2Inventory(tf2Inventory);
                        }
                    });
                    
                    observer.observe(inventoryEl, {
                        childList: true,
                        subtree: true
                    });
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[A-z0-9]+(\/$|\?|$)/
            ],
            styles: `
                .unusual {
                    background-position: center !important;
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                }
                
                .uncraft {
                    border-style: dashed !important;
                }
                
                .strange:before {
                    content: " ";
                    position: absolute;
                    z-index: 1;
                    top: 2px;
                    left: 2px;
                    right: 2px;
                    bottom: 2px;
                    border: 2px solid rgba(207, 106, 50, 0.5);
                    /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
                }
                
                .icons img.spell {
                    width: 14px;
                    height: 20px;
                }
                
                .icons {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    width: 100%;
                    height: 20px;
                }
                
                .item_showcase_item {
                    line-height: inherit !important;
                }
            `,
            fn: function({ addAttributesToHoverItems }) {
                const itemsList = document.getElementsByClassName('item_showcase_item');
                
                // add attributes to images - so easy!
                addAttributesToHoverItems(itemsList);
            }
        },
        {
            includes: [
                /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
            ],
            styles: `
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
                    background-position: center !important;
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                }
                
                .uncraft {
                    border-style: dashed !important;
                }
                
                .strange:before {
                    content: " ";
                    position: absolute;
                    z-index: -1;
                    top: 2px;
                    left: 2px;
                    right: 2px;
                    bottom: 2px;
                    border: 2px solid rgba(207, 106, 50, 0.5);
                    /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
                }
                
                .icons img.spell {
                    width: 14px;
                    height: 20px;
                }
                
                .icons {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    width: 100%;
                    height: 20px;
                }
                
                .decline_active_button {
                    display: block;
                    margin-top: 0.6em;
                    text-align: center;
                }
            `,
            fn: function({ $, VERSION, WINDOW, addAttributesToHoverItems }) {
                const dom = {
                    offers: document.getElementsByClassName('tradeoffer')
                };
                
                // modify each trade offer
                Array.from(dom.offers).forEach((offerEl) => {
                    // add buttons to the offer
                    (function addButtons() {
                        const reportButtonEl = offerEl.getElementsByClassName('btn_report')[0];
                        
                        // sent offers will not have a report button - we won't add any buttons to them
                        if (reportButtonEl == null) {
                            // stop
                            return;
                        }
                        
                        // match steamid, personaname
                        const pattern = /ReportTradeScam\( ?\'(\d{17})\', ?"(.*)"\ ?\)/;
                        const match = (reportButtonEl.getAttribute('onclick') || '').match(pattern);
                        
                        if (match) {
                            const [ , steamid, personaname] = match;
                            
                            // generate the html for the buttons
                            const html = (function getButtons() {
                                // generate html for button
                                const getButton = (button) => {
                                    const makeReplacements = (string) => {
                                        // replace personaname and steamid
                                        return string.replace('%personaname%', personaname).replace('%steamid%', steamid); 
                                    };
                                    const href = makeReplacements(button.url);
                                    const title = makeReplacements(button.title);
                                    const classes = [
                                        button.className,
                                        'btn_grey_grey',
                                        'btn_small',
                                        'btn_user_link'
                                    ];
                                    
                                    return `<a href="${href}" title="${title}" class="${classes.join(' ')}">&nbsp;</a>`;
                                };
                                // all the lovely buttons we want to add
                                const buttons = [
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
                                ].map(getButton);
                                // reverse to preserve order
                                const html = buttons.reverse().join('');
                                
                                return html;
                            }());
                            
                            // insert html for buttons
                            reportButtonEl.insertAdjacentHTML('beforebegin', html);
                        }
                        
                        // we don't really want it
                        reportButtonEl.remove();
                    }());
                    
                    // summarize the offer
                    (function() {
                        const itemsList = offerEl.getElementsByClassName('tradeoffer_item_list');
                        
                        // summarize each list
                        Array.from(itemsList).forEach((itemsEl) => {
                            const itemsArr = Array.from(itemsEl.getElementsByClassName('trade_item'));
                            const getClassInfo = (itemEl) => {
                                const classinfo = itemEl.getAttribute('data-economy-item');
                                // I believe item classes always remain static
                                const translateClass = {
                                    'classinfo/440/339892/11040578': 'classinfo/440/101785959/11040578',
                                    'classinfo/440/339892/11040559': 'classinfo/440/101785959/11040578',
                                    'classinfo/440/107348667/11040578': 'classinfo/440/101785959/11040578'
                                };
                                
                                return (
                                    translateClass[classinfo] ||
                                    classinfo
                                );
                            };
                            // has multiples of the same item
                            const hasMultipleSameItems = Boolean(function() {
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
                            }());
                            const shouldModifyDOM = Boolean(
                                itemsArr.length > 0 &&
                                hasMultipleSameItems
                            );
                            
                            // only modify dom if necessary
                            if (shouldModifyDOM) {
                                const fragment = document.createDocumentFragment();
                                const clearEl = document.createElement('div');
                                // get summarized items and sort elements by properties
                                // most of this stuff should be fairly optimized
                                const items = (function() {
                                    const getSort = (key, item) => {
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
                                    };
                                    // some parameters to sort by
                                    const sorts = {
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
                                    // this reduces the items on the page and puts them into
                                    // a group which contains the count for that item
                                    const items = (function() {
                                        const getItem = (classinfo, itemEl) => {
                                            return {
                                                classinfo,
                                                app: classinfo.replace('classinfo/', '').split('/')[0],
                                                color: itemEl.style.borderColor
                                            };
                                        };
                                        const items = itemsArr.reduce((result, itemEl) => {
                                            const classinfo = getClassInfo(itemEl);
                                            
                                            if (result[classinfo]) {
                                                result[classinfo].count += 1;
                                            } else {
                                                result[classinfo] = {
                                                    el: itemEl,
                                                    count: 1,
                                                    props: getItem(classinfo, itemEl)
                                                };
                                            }
                                            
                                            return result;
                                        }, {});
                                        
                                        return Object.values(items);
                                    }());
                                    const sorted = items.sort((a, b) => {
                                        let index = 0;
                                        
                                        // sort by these keys
                                        // break when difference is found
                                        [
                                            'app',
                                            'color',
                                            'count'
                                        ].find((key) => {
                                            // get the sort value for a and b
                                            const [sortA, sortB] = [a, b].map((value) => {
                                                return getSort(key, value);
                                            });
                                            
                                            // these are already sorted in the proper direction
                                            if (sortA > sortB) {
                                                index = 1;
                                                return true;
                                            } else if (sortA < sortB) {
                                                index = -1;
                                                return true;
                                            }
                                        });
                                        
                                        return index;
                                    });
                                    
                                    return sorted;
                                }());
                                
                                items.forEach(({ el, count }) => {
                                    if (count > 1) {
                                        // add badge
                                        const badgeEl = document.createElement('span');
                                        
                                        badgeEl.classList.add('summary_badge');
                                        badgeEl.textContent = count;
                                        
                                        el.appendChild(badgeEl);
                                    }
                                    
                                    fragment.appendChild(el);
                                });
                                
                                clearEl.style.clear = 'both';
                                // add clearfix to end of fragment
                                fragment.appendChild(clearEl);
                                // clear html before-hand to reduce dom manipulation
                                itemsEl.innerHTML = '';
                                itemsEl.appendChild(fragment);
                            }
                        });
                    }());
                });
                
                // add attributes to images
                (function() {
                    const itemsList = document.getElementsByClassName('trade_item');
                    
                    addAttributesToHoverItems(itemsList);
                }());
                
                // add the button to decline all trade offers
                (function() {
                    const { ShowConfirmDialog, ActOnTradeOffer } = WINDOW;
                    // gets an array of id's of all active trade offers on page
                    const getActiveTradeOfferIDs = () => {
                        const getTradeOfferIDs = (tradeOffersList) => {
                            const getTradeOfferID = (el) => el.id.replace('tradeofferid_', '');
                            
                            return tradeOffersList.map(getTradeOfferID);
                        };
                        const isActive = (el) => !el.querySelector('.inactive');
                        const tradeOffersList = Array.from(document.getElementsByClassName('tradeoffer'));
                        const activeTradeOffersList = tradeOffersList.filter(isActive);
                        
                        return getTradeOfferIDs(activeTradeOffersList);
                    };
                    // declines any number of trades by their id
                    const declineOffers = (tradeOfferIDs) => {
                        const declineOffer = (tradeOfferID) => {
                            ActOnTradeOffer(tradeOfferID, 'decline', 'Trade Declined', 'Decline Trade');
                        };
                        
                        tradeOfferIDs.forEach(declineOffer);
                    };
                    
                    // jquery elements
                    const $newTradeOfferBtn = $('.new_trade_offer_btn');
                    const canAct = Boolean(
                        // this should probably always be there...
                        // but maybe not always
                        $newTradeOfferBtn.length > 0 &&
                        // page must have active trade offers
                        getActiveTradeOfferIDs().length > 0
                    );
                    
                    if (!canAct) {
                        // stop right there
                        return;
                    }
                    
                    const $declineAllButton = $(`
                        <div class="btn_darkred_white_innerfade btn_medium decline_active_button">
                            <span>
                                Decline All Active...
                            </span>
                        </div>
                    `);
                    
                    // add the button... after the "New Trade Offer" button
                    $declineAllButton.insertAfter($newTradeOfferBtn);
                    
                    // add the handler to show the dialog on click
                    $declineAllButton.click(() => {
                        // yes
                        const yes = (str) => {
                            return str === 'OK';
                        };
                        
                        ShowConfirmDialog(
                            'Decline Active',
                            'Are you sure you want to decline all active trade offers?',
                            'Decline Trade Offers',
                            null
                        ).done((strButton) => {
                            if (yes(strButton)) {
                                const tradeOfferIDs = getActiveTradeOfferIDs();
                                
                                declineOffers(tradeOfferIDs);
                                $declineAllButton.remove();
                            }
                        });
                    });
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
            ],
            styles: `
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
                    position: relative;
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
                    background-position: center !important;
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                }
                
                .uncraft {
                    border-style: dashed !important;
                }
                
                .strange:before {
                    content: " ";
                    position: absolute;
                    z-index: 1;
                    top: 2px;
                    left: 2px;
                    right: 2px;
                    bottom: 2px;
                    border: 2px solid rgba(207, 106, 50, 0.5);
                    /* box-shadow: inset 0px 0px 12px 0px #CF6A32; */
                }
                
                .icons img.spell {
                    width: 14px;
                    height: 20px;
                }
                
                .icons {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    width: 100%;
                    height: 20px;
                }
            `,
            fn: function({ WINDOW, $, Utils, shared, getStored, setStored }) {
                const urlParams = Utils.getURLParams();
                // these are never re-assigned in steam's source code
                // only updated
                const { UserYou, UserThem, RefreshTradeStatus } = WINDOW;
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
                        const inventory = you ? INVENTORY : PARTNER_INVENTORY;
                        const total = $items.length;
                        let apps = {};
                        let items = {};
                        let valid = true;
                        
                        $items.toArray().forEach((itemEl) => {
                            // array containing item identifiers e.g. ['440', '2', '123']
                            const split = itemEl.id.replace('item', '').split('_'); 
                            const [appid, contextid, assetid] = split;
                            const img = itemEl.getElementsByTagName('img')[0].getAttribute('src');
                            const quality = itemEl.style.borderColor;
                            const effect = itemEl.getAttribute('data-effect');
                            const uncraft = itemEl.classList.contains('uncraft');
                            const strange = itemEl.classList.contains('strange');
                            const item = (
                                inventory[appid] &&
                                inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid]
                            );
                            
                            if (!item) {
                                // not properly loaded
                                valid = false;
                                
                                // stop loop
                                return false; 
                            }
                            
                            if (!apps[appid]) {
                                apps[appid] = [];
                            }
                            
                            // create json for item
                            const json = Utils.omitEmpty({
                                img,
                                quality,
                                effect,
                                uncraft,
                                strange
                            });
                            // use the json to create the key
                            const key = JSON.stringify(json);
                            
                            items[key] = (items[key] || 0) + 1;
                            apps[appid].push(assetid);
                        });
                        
                        if (!valid) {
                            return null;
                        }
                        
                        return {
                            total,
                            apps,
                            items
                        };
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
                            const { getEffectURL } = shared.offers.unusual;
                            const ids = apps['440'];
                            let html = '';
                            
                            // super duper looper
                            for (let key in items) {
                                // generate the html for this item
                                const {
                                    img,
                                    quality,
                                    effect,
                                    uncraft,
                                    strange
                                } = JSON.parse(key);
                                const count = items[key];
                                const imgs = [`url(${img})`];
                                const classes = ['summary_item'];
                                
                                if (effect !== 'none') {
                                    imgs.push(`url('${getEffectURL(effect)}')`);
                                }
                                
                                if (uncraft) {
                                    classes.push('uncraft');
                                }
                                
                                if (strange) {
                                    classes.push('strange');
                                }
                                
                                const styles = `background-image: ${imgs.join(', ')}; border-color: ${quality};`;
                                const badge = count > 1 ? `<span class="summary_badge">${count}</span>` : '&nbsp;';
                                const itemHTML = `<span class="${classes.join(' ')}" style="${styles}">${badge}</span>`;
                                
                                // add the html for this item
                                html += itemHTML;
                            }
                            
                            if (ids) {
                                // if tf2 items are in offer
                                // return summary items with backpack.tf link wrapped around 
                                const url = `https://backpack.tf/profiles/${steamid}?select=${ids.join(',')}`;
                                
                                // wrap the html
                                html = `<a title="Open on backpack.tf" href="${url}" target="_blank">${html}</a>`;
                            }
                            
                            return html;
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
                        const { total, apps, items } = summary;
                        const steamid = User.strSteamId;
                        
                        // build html piece-by-piece
                        return [
                            getHeader(type, total),
                            getSummary(items, apps, steamid),
                            ''
                        ].join('');
                    }
                    
                    /**
                     * Summarize a user's items in trade offer.
                     * @param {Boolen} you - Is this your summary?
                     * @returns {undefined}
                     * @memberOf tradeOfferWindow
                     */
                    function summarize(you) {
                        let config;
                        
                        // define config based on user
                        if (you) {
                            config = {
                                name: 'My',
                                user: UserYou,
                                $slots: page.$yourSlots,
                                $container: page.$yourSummary
                            };
                        } else {
                            config = {
                                name: 'Their',
                                user: UserThem,
                                $slots: page.$theirSlots,
                                $container: page.$theirSummary
                            };
                        }
                        
                        const $items = config.$slots.find('div.item');
                        const summary = evaluateItems($items, you);
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
                        summarize,
                        addItems,
                        clear,
                        updateDisplay,
                        userChanged
                    };
                }());
                /**
                 * Manage inventory load events.
                 * 
                 * @namespace inventoryManager
                 */
                const inventoryManager = (function() {
                    const inventories = {};
                    const users = {};
                    
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
                        const actions = [
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
                        register,
                        call
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
                            const ids = Object.keys(inventory);
                            let items = [];
                            let total = [];
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
                            return Utils.flatten([
                                true,
                                false
                            ].map(getItems));
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
                        const ids = items.map(item => `item${item.appid}_${item.contextid}_${item.id}`);
                        const elements = ids.map(id => document.getElementById(id)).map(a => a);
                        
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
                            const curValue = values[type];
                            const valueNeeded = amount - total;
                            const amountToAdd = Math.floor(valueNeeded / curValue);
                            // get array of metal
                            const items = finder(you, amountToAdd, index, type); 
                            const amountAdded = Math.min(
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
                        
                        // total to be added to
                        let total = 0;
                        const finder = finders.metal;
                        // the value in scrap metal of each type of metal
                        const values = {
                            'Refined Metal': 9,
                            'Reclaimed Metal': 3,
                            'Scrap Metal': 1
                        };
                        const metal = Object.keys(values).reduce(getMetal, []);
                        const items = getElementsForItems(metal);
                        const satisfied = valueMet();
                        
                        return {
                            items,
                            satisfied
                        };
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
                                const found = pickItems(you, amount, index, identifiers.isKey);
                                const items = getElementsForItems(found);
                                const satisfied = amount === items.length;
                                
                                return {
                                    items,
                                    satisfied
                                };
                            },
                            // get amount of metal (keys, ref, scrap);
                            'METAL': function() {
                                const {
                                    items,
                                    satisfied
                                } = getItemsForMetal(you, amount, index);
                                
                                return {
                                    items,
                                    satisfied
                                };
                            },
                            // get items by id
                            'ID': function() {
                                // list of id's is passed through index
                                const ids = index; 
                                const found = finders.id(ids);
                                const items = getElementsForItems(found);
                                const satisfied = ids.length === items.length;
                                
                                return {
                                    items,
                                    satisfied
                                };
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
                                
                                const offset = offsetIndex(index, amount, found.length);
                                const items = found.splice(offset, amount);
                                const satisfied = amount === items.length;
                                
                                return {
                                    items,
                                    satisfied
                                };
                            }
                        }[mode]();
                    }
                    
                    return getItems;
                }());
                
                // customizes the elements within this inventory
                function customizeItems(inventory) {
                    const {
                        addAttributes
                    } = shared.offers.identifiers;
                    
                    for (let assetid in inventory) {
                        const item = inventory[assetid];
                        
                        if (item.element) {
                            // add the attributes to this element
                            addAttributes(item, item.element);
                        }
                    }
                }
                
                // perform actions
                // add elements to page
                (function() {
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
                    // clearfix to add after inventories to fix height bug in firefox
                    const $clear = $('<div style="clear: both"/>');
                    const html = [
                        controlsHTML,
                        itemSummaryHTML
                    ].join('').replace(/\s{2,}/g, ' ');
                    
                    // add it
                    $tradeBox.append(html);
                    
                    // add the clear after inventories
                    $clear.insertAfter(page.$inventories);
                    
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
                }());
                
                // binds events to elements
                (function() {
                    // the user changed from one app to another
                    function appChanged(app) {
                        const $app = $(app);
                        const id = $app.attr('id');
                        const match = id.match(/appselect_option_(you|them)_(\d+)_(\d+)/);
                        
                        if (match) {
                            const you = match[1] === 'you';
                            const [ , , appid, contextid] = match;
                            
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
                            const names = Object.keys(currencies).filter((currency) => {
                                return currencies[currency] > 0;
                            });
                            const reasons = [];
                            const index = parseInt(page.controls.$index.val()) || 0;
                            
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
                        const listingIntent = urlParams.listing_intent;
                        // we are buying, add items from our inventory
                        const you = listingIntent == 1;
                        
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
                        const ids = Utils.getIDsFromString(idsStr);
                        
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
                        const $controls = page.fields.$ids.toggle();
                        const isVisible  = $controls.is(':visible') ? 1 : 0;
                        
                        setStored(stored.id_visible, isVisible);
                    }
                    
                    // get list of ids of items in trade offer
                    function getIDs() {
                        const $inventoryTab = page.get.$activeInventoryTab();
                        const you = $inventoryTab.attr('id') === 'inventory_select_your_inventory';
                        const $slots = you ? page.$yourSlots : page.$theirSlots;
                        const $items = $slots.find('div.item');
                        
                        return $items.toArray().map((el) => {
                            // array containing item identifiers e.g. ['440', '2', '123']
                            const split = (el.id || '').replace('item', '').split('_'); 
                            const assetid = split[2];
                            
                            return assetid;
                        });
                    }
                    
                    function keyPressed(e) {
                        Utils.execHotKey(e, {
                            // P
                            112: toggleIDFields
                        });
                    }
                    
                    function addItems(
                        mode = 'ITEMS',
                        amount = 1,
                        index = 0,
                        you = true,
                        callback = function() {}
                    ) {
                        const canModify = Boolean(
                            // an inventory is not selected
                            (/(\d+)_(\d+)$/.test(page.get.$inventory().attr('id'))) ||
                            // the offer cannot be modified
                            page.get.$modifyTradeOffer().length === 0
                        );
                        
                        // we can modify the items in the offer based on the current window state
                        if (canModify) {
                            const {
                                items,
                                satisfied
                            } = collectItems(...arguments);
                            
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
                }());
                
                // register inventory events
                (function() {
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
                    
                    // customizes the elements in the inventory
                    function customizeElements(steamid, appid, contextid) {
                        const you = steamid === STEAMID;
                        const inventory = you ? INVENTORY : PARTNER_INVENTORY;
                        const contextInventory = inventory[appid].rgContexts[contextid].inventory.rgInventory;
                        
                        if (!you) {
                            // force the items in their inventory to be displayed so we can add images
                            // if their inventory has not been displayed
                            forceVisibility();
                        }
                        
                        customizeItems(contextInventory);
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
                        inventoryManager.register(steamid, '440', '2', customizeElements);
                    });
                }());
                
                // observe changes to dom
                (function() {
                    // observe changes to trade slots
                    (function() {
                        function observeSlots(slotsEl, you) {
                            function summarize() {
                                tradeOfferWindow.summarize(you);
                                lastSummarized = new Date(); // add date
                            }
                            
                            const observer = new MutationObserver(() => {
                                const canInstantSummarize = Boolean(
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
                            let lastSummarized = new Date();
                            let timer;
                            
                            observer.observe(slotsEl, {
                                childList: true,
                                characterData: false,
                                subtree: true
                            });
                        }
                        
                        observeSlots(page.$yourSlots[0], true);
                        observeSlots(page.$theirSlots[0], false);
                    }());
                    
                    // observe inventory changes
                    (function() {
                        const observer = new MutationObserver((mutations) => {
                            if (!mutations[0].addedNodes) return;
                            
                            const mutation = mutations[0];
                            const inventory = mutation.addedNodes[0];
                            const split = inventory.id.replace('inventory_', '').split('_');
                            const [steamid, appid, contextid] = split;
                            
                            inventoryManager.call(steamid, appid, contextid);
                        });
                        
                        observer.observe(page.$inventories[0], {
                            childList: true,
                            characterData: false,
                            subtree: false
                        });
                    }());
                }());
                // configure state
                (function configure() {
                    tradeOfferWindow.userChanged(page.get.$activeInventoryTab());
                    
                    if (getStored(stored.id_visible) == 1) {
                        page.fields.$ids.show();
                    }
                    
                    if (urlParams.listing_intent !== undefined) {
                        const isSelling = urlParams.listing_intent == 0;
                        
                        page.btns.$listing.addClass(isSelling ? 'selling' : 'buying');
                    }
                }());
                
                // override page functions
                (function() {
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
                                
                                const getItem = ({ appid, contextid, assetid }) => {
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
                }());
            }
        }
    ];
    
    (function() {
        const DEPS = (function() {
            // current version number of script
            const VERSION = '2.0.2';
            // our window object for accessing globals
            const WINDOW = unsafeWindow;
            // dependencies to provide to each page script    
            const $ = WINDOW.jQuery;
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
                    const params = {};
                    const pattern = /[?&]+([^=&]+)=([^&]*)/gi;
                    
                    window.location.search.replace(pattern, (str, key, value) => {
                        params[key] = decodeURIComponent(value);
                    });
                    
                    return params;
                },
                /**
                 * Omits keys with values that are empty from object.
                 * @param {Object} obj - Object to omit values from.
                 * @returns {Object} Object with null, undefined, or empty string values omitted.
                 */
                omitEmpty: function(obj) {
                    const result = {};
                    
                    for (let k in obj) {
                        if (obj[k] != null && obj[k] !== '') {
                            result[k] = obj[k];
                        }
                    }
                    
                    return result;
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
                    const isTextField = (
                        /textarea|select/i.test(e.target.nodeName) || 
                        ['number', 'text'].indexOf(e.target.type) !== -1
                    );
                    const code = e.keyCode || e.which;
                    const method = hotKeys[code];
                    
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
                    const el = document.createElement('textarea');
                    
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
                    const prices = string.split(',');
                    const currencies = {};
                    const currencyNames = {
                        'metal': 'metal',
                        'ref': 'metal',
                        'keys': 'keys',
                        'key': 'keys'
                    };
                    
                    for (let i = 0; i < prices.length; i++) {
                        // match currencies - the first value is the amount
                        // the second value is the currency name
                        const match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
                        const currency = currencyNames[match[2]];
                        const value = parseFloat(match[1]);
                        
                        if (currency) {
                            currencies[currency] = value;
                        } else {
                            // something isn't right
                            return null;
                        }
                    }
                    
                    if (Object.keys(currencies).length === 0) {
                        return null;
                    }
                    
                    return currencies;
                }
            };
            // these are shared between page scripts
            const shared = {
                // offers shared between offers pages
                offers: {
                    // helpers for identifying items
                    identifiers: {
                        // checks whether the item is strange or not (strange unusuals, strange genuine, etc.)
                        // item is an asset from steam
                        isStrange: function(item) {
                            const pattern = /^Strange ([0-9\w\s\\(\)'\-]+) \- ([0-9\w\s\(\)'-]+): (\d+)\n?$/;
                            // is a strange quality item
                            const isStrange = (item.name_color || '').toUpperCase() === 'CF6A32';
                            
                            return Boolean(
                                // we don't mean strange quality items
                                !isStrange &&
                                // the name must begin with strange
                                /^Strange /.test(item.market_hash_name) &&
                                // the item has a type
                                item.type &&
                                // the type matches a pattern similar to (Strange Hat - Points Scored: 0)
                                pattern.test(item.type)
                            );
                        },
                        // checks if the item is a rare tf2 key
                        isRareTF2Key: function(item) {
                            const { appdata } = item;
                            // array of rare TF2 keys (defindexes)
                            const rare440Keys = [
                                '5049',
                                '5067',
                                '5072',
                                '5073',
                                '5079',
                                '5081',
                                '5628',
                                '5631',
                                '5632',
                                '5713',
                                '5716',
                                '5717',
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
                        },
                        // detects certain attributes from an item
                        // this is used heavily and should be as optimized as possible
                        getItemAttributes: function(item) {
                            const hasDescriptions = typeof item.descriptions === 'object';
                            const isUnique = (item.name_color || '').toUpperCase() === '7D6D00';
                            const { isStrange } = shared.offers.identifiers;
                            const { getEffectValue } = shared.offers.unusual;
                            const attributes = {};
                            
                            if (isStrange(item)) {
                                attributes.strange = true;
                            }
                            
                            // no descriptions, so don't go any further
                            if (!hasDescriptions) {
                                return attributes;
                            }
                            
                            for (let i = 0; i < item.descriptions.length; i++) {
                                const description = item.descriptions[i];
                                const matchesEffect = (
                                    attributes.effectName === undefined &&
                                    // this will exclude cases with "Unusual Effect" descriptions
                                    !isUnique &&
                                    description.color === 'ffd700' &&
                                    description.value.match(/^\u2605 Unusual Effect: (.+)$/)
                                );
                                const isSpelled = Boolean(
                                    attributes.spelled === undefined &&
                                    description.color === '7ea9d1' &&
                                    description.value.indexOf('(spell only active during event)') !== -1
                                );
                                const isUncraftable = Boolean(
                                    !description.color &&
                                    /^\( Not.* Usable in Crafting/.test(description.value)
                                );
                                
                                if (matchesEffect) {
                                    const effectName = matchesEffect[1];
                                    
                                    attributes.effect = getEffectValue(effectName);
                                }
                                
                                if (isSpelled) {
                                    attributes.spelled = true;
                                }
                                
                                if (isUncraftable) {
                                    attributes.uncraft = true;
                                }
                            }
                            
                            return attributes;
                        },
                        // adds attributes to item element
                        addAttributes: function(item, itemEl) {
                            const {
                                getItemAttributes,
                                addAttributesToElement
                            } = shared.offers.identifiers;
                            const attributes = getItemAttributes(item);
                            
                            addAttributesToElement(itemEl, attributes);
                        },
                        // adds attributes to item element
                        addAttributesToElement: function(itemEl, attributes) {
                            // already checked
                            if (itemEl.hasAttribute('data-checked')) {
                                return;
                            }
                            
                            const {
                                getEffectURL
                            } = shared.offers.unusual;
                            const iconsEl = document.createElement('div');
                            const classes = [];
                            
                            if (attributes.effect) {
                                const versions = {
                                    // the 188x188 version does not work for purple confetti
                                    7: '380x380'
                                };
                                const version = versions[attributes.effect];
                                const url = getEffectURL(attributes.effect, version);
                                
                                itemEl.setAttribute('data-effect', attributes.effect);
                                itemEl.style.backgroundImage = `url('${url}')`;
                                classes.push('unusual');
                            }
                            
                            if (attributes.strange) {
                                classes.push('strange');
                            }
                            
                            if (attributes.uncraft) {
                                classes.push('uncraft');
                            }
                            
                            if (attributes.spelled) {
                                // construct icon for spells
                                const spellEl = document.createElement('img');
                                
                                spellEl.setAttribute('src', 'https://scrap.tf/img/spell.png');
                                spellEl.classList.add('spell');
                                
                                // add it to the icons element
                                iconsEl.appendChild(spellEl);
                            }
                            
                            // check if we added any icons to the element holding icons
                            if (iconsEl.children.length > 0) {
                                iconsEl.classList.add('icons');
                                
                                // then insert the element containing icons
                                itemEl.appendChild(iconsEl);
                            }
                            
                            if (classes.length > 0) {
                                itemEl.classList.add(...classes);
                            }
                            
                            itemEl.setAttribute('data-checked', 1);
                        }
                    },
                    // unusual helper functions
                    unusual: {
                        // all unusual effects as of the winter 2019 update
                        effectsMap: {
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
                            'Ominous Night': 3022,
                            'Fifth Dimension': 122,
                            'Vicious Vortex': 123,
                            'Menacing Miasma': 124,
                            'Abyssal Aura': 125,
                            'Wicked Wood': 126,
                            'Ghastly Grove': 127,
                            'Mystical Medley': 128,
                            'Ethereal Essence': 129,
                            'Twisted Radiance': 130,
                            'Violet Vortex': 131,
                            'Verdant Vortex': 132,
                            'Valiant Vortex': 133,
                            'Bewitched': 3023,
                            'Accursed': 3024,
                            'Enchanted': 3025,
                            'Static Mist': 3026,
                            'Eerie Lightning': 3027,
                            'Terrifying Thunder': 3028,
                            'Jarate Shock': 3029,
                            'Nether Void': 3030,
                            'Sparkling Lights': 134,
                            'Frozen Icefall': 135,
                            'Fragmented Gluons': 136,
                            'Fragmented Quarks': 137,
                            'Fragmented Photons': 138,
                            'Defragmenting Reality': 139,
                            'Fragmenting Reality': 141,
                            'Refragmenting Reality': 142,
                            'Snowfallen': 143,
                            'Snowblinded': 144,
                            'Pyroland Daydream': 145,
                            'Good-Hearted Goodies': 3031,
                            'Wintery Wisp': 3032,
                            'Arctic Aurora': 3033,
                            'Winter Spirit': 3034,
                            'Festive Spirit': 3035,
                            'Magical Spirit': 3036
                        },
                        /**
                         * Includes effect image in element.
                         * @param {Object} itemEl - DOM element.
                         * @param {Object} value - Value for Unusual effect.
                         * @returns {undefined}
                         */
                        modifyElement: function(itemEl, value) {
                            const versions = {
                                // the 188x188 version does not work for purple confetti
                                7: '380x380'
                            };
                            const version = versions[value];
                            const url = shared.offers.unusual.getEffectURL(value, version);
                            
                            itemEl.style.backgroundImage = `url('${url}')`;
                            itemEl.classList.add('unusual');
                        },
                        /**
                         * Gets the effect value from an effect name.
                         * @param {String} effectName - Effect name.
                         * @returns {(String|undefined)} Effect value, if available.
                         */
                        getEffectValue: function(effectName) {
                            return shared.offers.unusual.effectsMap[effectName];
                        },
                        /**
                         * Gets URL of image for effect.
                         * @param {Number} value - Value of effect.
                         * @param {Number} [version] - Size of image from backpack.tf.
                         * @returns {String} URL string
                         */
                        getEffectURL: function(value, version) {
                            return `https://backpack.tf/images/440/particles/${value}_${version || '188x188'}.png`;
                        }
                    }
                }
            };
            
            // adds attribute display properties to a list of hoverable items (e.g. in trade offers or steam profiles)
            // itemsList is of type NodeList or Array
            function addAttributesToHoverItems(itemsList) {
                if (itemsList.length === 0) {
                    // nothing to do
                    return;
                }
                
                const {
                    getItemAttributes,
                    addAttributesToElement
                } = shared.offers.identifiers;
                // cache for classinfo data
                const attributeCache = (function() {
                    // the key to set/get values from
                    const CACHE_INDEX = VERSION + '.getTradeOffers.cache';
                    // this will hold our cached values
                    let values = {};
                    
                    function save() {
                        let value = JSON.stringify(values);
                        
                        if (value.length >= 10000) {
                            // clear cache when it becomes too big
                            values = {};
                            value = '{}'; 
                        }
                        
                        setStored(CACHE_INDEX, value);
                    }
                    
                    function store(key, value) {
                        values[key] = value;
                    }
                    
                    function get() {
                        values = JSON.parse(getStored(CACHE_INDEX) || '{}');
                    }
                    
                    function key(itemEl) {
                        const classinfo = itemEl.getAttribute('data-economy-item');
                        const [ , , classid] = classinfo.split('/');
                        
                        return classid;
                    }
                    
                    function getValue(key) {
                        return values[key];
                    }
                    
                    return {
                        save,
                        get,
                        store,
                        key,
                        getValue
                    };
                }());
                let itemsChecked = 0;
                let cacheSaveTimer;
                
                // first load from cache
                attributeCache.get();
                
                Array.from(itemsList)
                    // process unusual items first
                    .sort((a, b) => {
                        const getValue = (itemEl) => {
                            const unusualBorderColor = 'rgb(134, 80, 172)';
                            const { borderColor } = itemEl.style;
                            
                            if (borderColor === unusualBorderColor) {
                                return 1;
                            }
                            
                            return -1;
                        };
                        
                        return getValue(b) - getValue(a);
                    })
                    .forEach((itemEl) => {
                        // get hover for item to get item information
                        // this requires an ajax request
                        // classinfo format - "classinfo/440/192234515/3041550843"
                        const classinfo = itemEl.getAttribute('data-economy-item');
                        const [ , appid, classid, instanceid] = classinfo.split('/');
                        
                        // only check tf2 items
                        if (appid !== '440') {
                            // continue
                            return;
                        }
                        
                        const cacheKey = attributeCache.key(itemEl);
                        const cachedValue = attributeCache.getValue(cacheKey);
                        
                        if (cachedValue) {
                            // use cached attributes
                            addAttributesToElement(itemEl, cachedValue);
                        } else {
                            const itemStr = [appid, classid, instanceid].join('/');
                            const uri = `economy/itemclasshover/${itemStr}?content_only=1&l=english`;
                            const req = new WINDOW.CDelayedAJAXData(uri, 0);
                            // this will space requests
                            const delay = 5000 * Math.floor(itemsChecked / 50);
                            
                            itemsChecked++;
                            
                            setTimeout(() => {
                                // we use this to get class info (names, descriptions) for each item
                                // it would be much more efficient to use GetAssetClassInfo/v0001 but it requires an API key
                                // this may be considered later
                                req.RunWhenAJAXReady(() => {
                                    // 3rd element is a script tag containing item data
                                    const html = req.m_$Data[2].innerHTML;
                                    // extract the json for item with pattern...
                                    const match = html.match(/BuildHover\(\s*?\'economy_item_[A-z0-9]+\',\s*?(.*)\s\);/);
                                    
                                    try {
                                        // then parse it
                                        const item = JSON.parse(match[1]);
                                        const attributes = getItemAttributes(item);
                                        
                                        // then add the attributes to the element
                                        addAttributesToElement(itemEl, attributes);
                                        
                                        // store the attributes in cache
                                        attributeCache.store(cacheKey, attributes);
                                        
                                        // then save it n ms after the last completed request
                                        clearTimeout(cacheSaveTimer);
                                        cacheSaveTimer = setTimeout(attributeCache.save, 1000);
                                    } catch (e) {
                                        
                                    }
                                });
                            }, delay);
                        }
                    });
            }
            
            // set a stored value
            function setStored(name, value) {
                GM_setValue(name, value);
            }
            
            // get a stored value
            function getStored(name) {
                return GM_getValue(name);
            }
            
            return {
                VERSION,
                WINDOW,
                $,
                Utils,
                shared,
                addAttributesToHoverItems,
                setStored,
                getStored
            };
        }());
        const script = scripts.find(({includes}) => {
            return includes.some((pattern) => {
                return Boolean(location.href.match(pattern));
            });
        });
        
        if (script) {
            if (script.styles) {
                // add the styles
                GM_addStyle(script.styles);
            }
            
            if (script.fn) {
                // run the script
                script.fn(DEPS);
            }
        }
    }());
}());