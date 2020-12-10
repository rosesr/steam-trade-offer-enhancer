// @include /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
function({ $, Utils, getStored, setStored }) {
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
    (function () {
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