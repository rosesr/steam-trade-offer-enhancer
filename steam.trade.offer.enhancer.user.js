// ==UserScript==
// @name        Steam Trade Offer Enhancer
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @description Browser script to enhance Steam trade offers.
// @include     /^https?:\/\/steamcommunity\.com\/tradeoffer.*/
// @include     /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(stats|classifieds).*/
// @include     /^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(?:id|profiles)\/.*/
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require     https://cdn.rawgit.com/juliarose/c285ec7f12f3f91375abb9b7a02902fe/raw/8124f481e6139609e7e5b96669037dca9dd8eebb/backpacktf_price_tools.js
// @version     1.5.1
// @author      HusKy (modified by Julia)
// ==/UserScript==

(function() {
    'use strict';

    // get url params
    var urlParams = {};
    window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str, key, value) {
        urlParams[key] = decodeURIComponent(value);
    }); // Get URL params

    var methods = {
        tradeOfferWindow: function() {
            var page = {}; // cache jquery variables
            // array of dangerous descriptions
            var dangerousDescriptions = [{
                tag: 'uncraftable',
                description: 'Not Usable in Crafting'
            }];
            // array of rare TF2 keys (defindexes)
            var rare440Keys = [
                '5049', '5067', '5072', '5073',
                '5079', '5081', '5628', '5631',
                '5632', '5713', '5716', '5717',
                '5762'
            ];
            var tradeOfferWindow = {
                evaluateItems: function($items) {
                    var $slotInner = $items.find('.slot_inner');
                    var result = {
                        _total: 0,
                        _apps: {},
                        _warnings: []
                    };

                    $slotInner.each(function(index, el) {
                        var $this = jQuery(el);

                        if ($this.html() !== '' && $this.html() !== null) {
                            result._total++;

                            var $item = $this.find('.item');
                            var img = $item.find('img').attr('src');
                            var quality = $item.css('border-top-color');

                            // let's check item's info
                            var split = $item[0].id.replace('item', '').split('_');
                            var appid = split[0];
                            var contextid = split[1];
                            var assetid = split[2];
                            var inventory = $items[0].id === 'your_slots' ? unsafeWindow.g_rgAppContextData : unsafeWindow.g_rgPartnerAppContextData;
                            var inventory_item = inventory[appid] && inventory[appid].rgContexts[contextid].inventory.rgInventory[assetid];

                            // not properly loaded
                            if (!inventory_item) {
                                result = {
                                    _apps: {},
                                    _total: 0,
                                    _warnings: []
                                };
                                return true;
                            }

                            if (result[img] === undefined) {
                                result[img] = {};
                            }

                            if (result[img][quality] === undefined) {
                                result[img][quality] = 1;
                            } else {
                                result[img][quality]++;
                            }

                            // add asset id's
                            if (result._apps[appid] === undefined) {
                                result._apps[appid] = {};
                            }

                            if (result._apps[appid][contextid] === undefined) {
                                result._apps[appid][contextid] = [];
                            }

                            result._apps[appid][contextid].push(assetid);

                            var descriptions = inventory_item.descriptions;
                            var appdata = inventory_item.app_data;
                            var fraudwarnings = inventory_item.fraudwarnings;
                            var warning_text;

                            if (typeof descriptions === 'object') {
                                descriptions.forEach(function(d1) {
                                    dangerousDescriptions.forEach(function(d2) {
                                        if (d1.value.indexOf(d2.description) > -1) {
                                            var warning_text = 'Offer contains ' + d2.tag + ' item(s).';

                                            if (result._warnings.indexOf(warning_text) === -1) {
                                                result._warnings.push(warning_text);
                                            }
                                        }
                                    });
                                });
                            }

                            if (typeof appdata === 'object' && typeof appdata.def_index === 'string') {
                                if (rare440Keys.indexOf(appdata.def_index) > -1) {
                                    warning_text = 'Offer contains rare TF2 key(s).';
                                    if (result._warnings.indexOf(warning_text) === -1) {
                                        result._warnings.push(warning_text);
                                    }
                                }
                            }

                            if (typeof fraudwarnings === 'object') {
                                fraudwarnings.forEach(function(text) {
                                    if (text.indexOf('restricted gift') > -1) {
                                        warning_text = 'Offer contains restricted gift(s).';
                                        if (result._warnings.indexOf(warning_text) === -1) {
                                            result._warnings.push(warning_text);
                                        }
                                    }
                                });
                            }
                        }
                    });

                    return result;
                },

                dumpSummary: function(type, items, User) {
                    if (items._total <= 0) return '';

                    var html = (type + ' summary (' + items._total + ' ' + (items._total === 1 ? 'item' : 'items') + '):<br/>');
                    var ids_440 = items._apps['440'] && items._apps['440']['2'];
                    var has_440 = ids_440 && ids_440.length;


                    if (has_440) {
                        var steamid = User.strSteamId;
                        var backpackURL = 'https://backpack.tf/profiles/' + steamid + '?select=' + ids_440.join(',');

                        html += '<a title="Open on backpack.tf" href="' + backpackURL + '" target="_blank">';
                    }

                    // item counts
                    for (var prop in items) {
                        if (prop.indexOf('_') === 0) continue;

                        var item_type = items[prop];

                        for (var quality in item_type) {
                            html += '<span class="summary_item" style="background-image: url(\'' + prop + '\'); border-color: ' + quality + ';"><span class="summary_badge">' + item_type[quality] + '</span></span>';
                        }
                    }

                    if (has_440) {
                        html += '</a>';
                    }

                    // warnings
                    if (items._warnings.length > 0) {
                        html += '<span class="warning"><br/>Warning:<br/>';
                        items._warnings.forEach(function(warning, index) {
                            html += warning;

                            if (index < items._warnings.length - 1) {
                                html += '<br/>';
                            }
                        });
                        html += '</span>';
                    }

                    return html;
                },

                summarize: function() {
                    var $target = page.$offerSummary;
                    var $mine = page.$yourSlots;
                    var $other = page.$theirSlots;
                    var $my_items = this.evaluateItems($mine);
                    var $other_items = this.evaluateItems($other);

                    // generate the summary HTML
                    var html = this.dumpSummary('My', $my_items, UserYou) +
                        ($other_items._total > 0 ? '<br/><br/>' : '') +
                        this.dumpSummary('Their', $other_items, UserThem);

                    $target.html(html);
                },

                ready: function() {
                    var self = this;

                    this.userChanged(jQuery('.inventory_user_tab.active'));

                    // just a short delay to ensure everything is loaded
                    setTimeout(function() {
                        self.summarize();
                        self.pollRefresh();
                    }, 100);
                },

                pollRefresh: function() {
                    var self = this;

                    // refresh every x seconds
                    setInterval(function() {
                        self.summarize();
                    }, 5 * 1000);
                },

                isReady: function() {
                    return jQuery('img[src$=\'throbber.gif\']:visible').length <= 0;
                },

                init: function() {
                    var self = this;

                    // something is loading
                    var isReady = this.isReady();

                    // our partner's inventory is also loading at this point
                    var itemParamExists = urlParams.for_item !== undefined;
                    var hasBeenLoaded = true;
                    var item;

                    if (itemParamExists) {
                        // format: for_item=<appId>_<contextId>_<itemId>
                        item = urlParams.for_item.split('_');
                        hasBeenLoaded = jQuery('div#inventory_' + UserThem.strSteamId + '_' + item[0] + '_' + item[1]).length > 0;
                    }

                    if (isReady && (!itemParamExists || hasBeenLoaded)) {
                        this.ready();

                        return;
                    }

                    if (itemParamExists && hasBeenLoaded) {
                        setTimeout(self.deadItem.bind(self), 5000);
                        return;
                    }

                    setTimeout(function() {
                        self.init();
                    }, 250);
                },

                deadItem: function() {
                    var deadItemExists = jQuery('a[href$=\'_undefined\']').length > 0;
                    var item = urlParams.for_item.split('_');

                    if (deadItemExists) {
                        unsafeWindow.g_rgCurrentTradeStatus.them.assets = [];
                        RefreshTradeStatus(g_rgCurrentTradeStatus, true);
                        alert('Seems like the item you are looking to buy (ID: ' + item[2] + ') is no longer available. You should check other user\'s backpack and see if it\'s still there.');
                    } else {
                        // Something was loading very slowly, restart init...
                        this.init();
                    }
                },

                clear: function($added_items) {
                    var timeout = 150;
                    var $items = $added_items.find('div.itemHolder').find('div.item');

                    for (var i = 0; i < $items.length; i++) {
                        setTimeout(MoveItemToInventory, i * timeout, $items[i]);
                    }

                    setTimeout(function() {
                        tradeOfferWindow.summarize();
                    }, ($items.length * timeout) + 500);
                },

                // update button display
                updateDisplay: function(my, appid) {
                    var listingIntent = urlParams.listing_intent;

                    var showListingButton = appid == 440 && ((my && listingIntent == 1) || (!my && listingIntent == 0));
                    var showKeys = appid == 440 || appid == 730;
                    var showMetal = appid == 440;

                    function updateState($btn, show) {
                        if (show) {
                            $btn.show();
                        } else {
                            $btn.hide();
                        }
                    }

                    updateState(page.btns.$items, true);
                    updateState(page.btns.$listing, showListingButton);
                    updateState(page.btns.$keys, showKeys);
                    updateState(page.btns.$metal, showMetal);
                },

                // user inventory changed
                userChanged: function(el) {
                    var $el = jQuery(el);
                    var $inventory = jQuery('.inventory_ctn:visible');
                    var match = $inventory.attr('id').match(/(\d+)_(\d+)$/);
                    var my = $el.attr('id') === 'inventory_select_your_inventory';
                    var appid = match && match[1];
                    var contextid = match && match[2];

                    if (!appid) {
                        var src = jQuery('#appselect_activeapp img').attr('src') || '';
                        match = src.match(/public\/images\/apps\/(\d+)/);

                        if (match) {
                            appid = match[1];
                        }
                    }

                    this.updateDisplay(my, appid, contextid);
                }
            };
            // used for identifying items
            var identifiers = {
                // item is key
                isKey: function(item) {
                    switch (item.appid) {
                        case 440:
                            return item.market_hash_name === 'Mann Co. Supply Crate Key';
                        case 730:
                            return identifiers.hasTag(item, 'Tool', 'Key');
                    }

                    return null;
                },

                // item has tag
                hasTag: function(item, tagName, tagValue) {
                    var tags = item.tags;

                    if (!tags) return;

                    for (var i = 0, n = tags.length; i < n; i++) {
                        var tag = tags[i];

                        if (tag.category === tagName && tagValue === tag.name);

                        return true;
                    }

                    return null;
                }
            };

            // used for finding items
            // these are somewhat expensive
            var finders = {
                // return items using finder method
                items: function(finder, user, nosort) {
                    var $items;
                    var $inventory = jQuery('.inventory_ctn:visible');

                    // inventory must be shown
                    if ($inventory.length === 0) return;

                    if (!user) {
                        // get currently active user
                        user = jQuery('#inventory_select_your_inventory').hasClass('active') ? UserYou : UserThem;
                    }

                    var match = $inventory.attr('id').match(/(\d+)_(\d+)$/);

                    // inventory must be present
                    if (!match) return;

                    $items = user === UserYou ? page.$yourSlots.find('.item') : page.$theirSlots.find('.item');

                    var appid = match[1];
                    var contextid = match[2];
                    var inventory = user.rgAppInfo[appid].rgContexts[contextid].inventory.rgInventory;
                    var matches = [];
                    var pos = [];
                    // get list of id's in trade offer so we don't repeat any items
                    var elIds = $items.map(function(index, el) {
                        return el.id;
                    }).get();

                    for (var k in inventory) {
                        var item = inventory[k];

                        // don't select item we've already added
                        if (finder(item) && elIds.indexOf(itemToElId(item)) === -1) {
                            matches.push(item);
                            pos.push(item.pos);
                        }
                    }

                    // sort items by position (first to last)
                    matches = matches.sort(function(a, b) {
                        return a.pos - b.pos;
                    });

                    return matches;
                },

                metal: function() {
                    function hasName(item, name) {
                        return item.appid == 440 && item.market_hash_name === name;
                    }

                    var finder = finders.items;

                    // return groups of each kind of metal
                    return {
                        'Refined Metal': finder(function(item) {
                            return hasName(item, 'Refined Metal');
                        }),
                        'Reclaimed Metal': finder(function(item) {
                            return hasName(item, 'Reclaimed Metal');
                        }),
                        'Scrap Metal': finder(function(item) {
                            return hasName(item, 'Scrap Metal');
                        })
                    };
                },

                // return items by array of id's
                id: function(ids) {
                    var finder = finders.items;
                    var items = finder(function(item) {
                        return ids.indexOf(item.id) !== -1;
                    });

                    items = items.sort(function(a,b) {
                        return ids.indexOf(a.id) - ids.indexOf(b.id);
                    });

                    console.log(ids);
                    console.log(items[0]);

                    return items;
                }
            };

            function ready() {
                // add elements to page
                function addElements() {
                    // Append CSS style.
                    var styles = `
                        <style type='text/css'>
                            .tradeoffer_items_summary { color: #fff; font-size: 10px; }
                            .warning { color: #ff4422; }
                            .info { padding: 1px 3px; border-radius: 4px; background-color: #1155FF; border: 1px solid #003399; font-size: 14px; }
                            .summary_item { padding: 3px; margin: 0 2px 2px 0; background-color: #3C352E;background-position: center; background-size: 48px 48px; background-repeat: no-repeat; border: 1px solid; font-size: 16px; width: 48px; height: 48px; display: inline-block; }
                            .summary_badge { padding: 1px 3px; border-radius: 4px; background-color: #0099CC; border: 1px solid #003399; font-size: 12px; }
                            .filter_full { width: 200px }
                            .btn_custom { margin-right: 6px; }
                            .btn_keys { background-color: #709D3C; }
                            .btn_metal { background-color: #676767; }
                            .btn_listing { background-color: #2E4766; }
                            .summary_link {  }
                        </style>
                    `;
                    var $tradeBox = jQuery('#inventory_box div.trade_box_contents');
                    var $tradeBoxParent = $tradeBox.parent();
                    var $offerSummary = jQuery('<div class="tradeoffer_items_summary"/>');
                    var itemAdderHtml = '';
                    var idFieldHtml = '';
                    var hours;

                    itemAdderHtml += ('<div class="selectableNone">Add multiple items:</div>');
                    itemAdderHtml += ('<div class="filter_ctn">');
                    itemAdderHtml += ('<input id="amount_control" class="filter_search_box" type="number" step="any" min="0" placeholder="amount"> ');
                    itemAdderHtml += ('<input id="index_control" class="filter_search_box" type="number" min="0" placeholder="index">');
                    itemAdderHtml += ('</div>');
                    itemAdderHtml += ('<button id="btn_additems" type="button" class="btn_items btn_custom btn_add btn_black btn_small"><span>Add</span></button>');
                    itemAdderHtml += ('<button id="btn_addkeys" type="button" class="btn_keys btn_add btn_custom btn_black btn_small"><span>Add Keys</span></button>');
                    itemAdderHtml += ('<button id="btn_addmetal" type="button" class="btn_metal btn_add btn_custom btn_black btn_small"><span>Add Metal</span></button>');

                    if (urlParams.listing_intent !== undefined) {
                        itemAdderHtml += ('<button id="btn_addlisting" type="button" class="btn_listing btn_add btn_custom btn_black btn_small"><span>Add Listing</span></button>');
                    }

                    itemAdderHtml += ('<br><br>');
                    itemAdderHtml += ('<div id="btn_clearmyitems" type="button" class="btn_custom btn_black btn_small"><span>Clear my items</span></div>');
                    itemAdderHtml += ('<div id="btn_cleartheiritems" type="button" class="btn_custom btn_black btn_small"><span>Clear their items</span></div><br/><br/>');

                    idFieldHtml += ('<div id="id_fields">');
                    idFieldHtml += ('<div class="filter_ctn">');
                    idFieldHtml += ('<div class="filter_control_ctn">');
                    idFieldHtml += ('<input id="ids_control" class="filter_search_box filter_full" type="text" placeholder="ids"/>');
                    idFieldHtml += ('</div>');
                    idFieldHtml += ('<div class="filter_tag_button_ctn filter_right_controls">');
                    idFieldHtml += ('<div id="btn_addids" type="button" class="btn_ids_add btn_custom btn_black btn_small"><span>Add</span></div>');
                    idFieldHtml += ('<div id="btn_getids" type="button" class="btn_ids_get btn_custom btn_black btn_small"><span>Get</span></div>');
                    idFieldHtml += ('</div>');
                    idFieldHtml += ('<div style="clear: both;"></div>');
                    idFieldHtml += ('</div>');
                    idFieldHtml += ('</div>');

                    $tradeBox.detach(); // detach for performance
                    $tradeBox.append('<div class="trade_rule selectableNone"/>');
                    $tradeBox.append(itemAdderHtml);
                    // disabled
                    // $tradeBox.append(idFieldHtml);
                    // $tradeBox.append('<div class="trade_rule selectableNone"/>');
                    $tradeBox.append($offerSummary);
                    $tradeBox.appendTo($tradeBoxParent); // re-add to parent

                    // add styles
                    jQuery(styles).appendTo('head');

                    if (unsafeWindow.g_daysMyEscrow > 0) {
                        hours = unsafeWindow.g_daysMyEscrow * 24;
                        jQuery('div.trade_partner_headline').append('<div class=\'warning\'>(You do not have mobile confirmations enabled. Items will be held for <b>' + hours + '</b> hours.)</div>');
                    }

                    if (unsafeWindow.g_daysTheirEscrow > 0) {
                        hours = unsafeWindow.g_daysTheirEscrow * 24;
                        jQuery('div.trade_partner_headline').append('<div class=\'warning\'>(Other user does not have mobile confirmations enabled. Items will be held for <b>' + hours + '</b> hours.)</div>');
                    }

                    // assign elements
                    page = {
                        btns: {
                            $items: jQuery('#btn_additems'),
                            $keys: jQuery('#btn_addkeys'),
                            $metal: jQuery('#btn_addmetal'),
                            $listing: jQuery('#btn_addlisting'),
                            $addIDs: jQuery('#btn_addids'),
                            $getIDs: jQuery('#btn_getids')
                        },
                        // non-JQ elements
                        DOM: {
                            $yourSlots: $('your_slots'),
                            $theirSlots: $('their_slots')
                        },
                        $btns: jQuery('button.btn_add'),
                        $offerSummary: $offerSummary,
                        $yourSlots: jQuery('#your_slots'),
                        $theirSlots: jQuery('#their_slots'),
                        $inventories: jQuery('#inventories'),
                        $amountControl: jQuery('#amount_control'),
                        $indexControl: jQuery('#index_control'),
                        $idsControl: jQuery('#ids_control')
                    };
                }

                function bindEvents() {
                    // add certain amount of currency
                    function addCurrency(k, amount, callback) {
                        if (!amount) {
                            return callback(true);
                        } else {
                            addItems(k, amount, null, callback);
                        }
                    }

                    // the user change from one app to another
                    function appChanged(el) {
                        var $el = jQuery(el);
                        var id = $el.attr('id');
                        var match = id.match(/appselect_option_(you|them)_(\d+)_(\d+)/);

                        if (match) {
                            var my = match[1] === 'you';
                            var appid = match[2];
                            var contextid = match[3];

                            tradeOfferWindow.updateDisplay(my, appid, contextid);
                        }
                    }

                    // add the listing price
                    function addListingPrice() {
                        // make sure inventory has loaded first
                        if (jQuery('#inventory_box').find('img[src$=\'throbber.gif\']:visible').length > 0) {
                            return;
                        }

                        var currencies = {
                            keys: urlParams.listing_currencies_keys || 0,
                            metal: urlParams.listing_currencies_metal || 0
                        };

                        addCurrency('keys', currencies.keys, function(met1) {
                            addCurrency('metal', currencies.metal, function(met2) {
                                var reasons = [];

                                if (!met1) {
                                    reasons.push('not enough keys');
                                }

                                if (!met2) {
                                    reasons.push('not enough metal');
                                }

                                if (reasons.length > 0) {
                                    // if any were not met exactly, display message
                                    alert('Listing value could not be met: ' + reasons.join(' and '));
                                }
                            });
                        });
                    }

                    // Refresh summaries whenever ...
                    /*
                    jQuery('body').click(function() {
                        setTimeout(function() {
                            tradeOfferWindow.summarize();
                        }, 500);
                    });
                    */

                    // probably better than above
                    jQuery('body').on('dblclick', '#mainContent .trade_area .item', function() {
                        setTimeout(function() {
                            tradeOfferWindow.summarize();
                        }, 50);
                    });

                    jQuery('button#btn_clearmyitems').click(function() {
                        tradeOfferWindow.clear(page.$yourSlots);
                    });

                    jQuery('button#btn_cleartheiritems').click(function() {
                        tradeOfferWindow.clear(page.$theirSlots);
                    });

                    jQuery('.appselect_options .option').click(function(e) {
                        appChanged(e.target);
                    });

                    jQuery('#inventory_select_your_inventory, #inventory_select_their_inventory').click(function(e) {
                        tradeOfferWindow.userChanged(e.delegateTarget);
                    });

                    // click event handlers for adding items
                    page.btns.$items.click(function() {
                        addItems();
                    });
                    page.btns.$keys.click(function() {
                        addItems('keys');
                    });
                    page.btns.$metal.click(function() {
                        addItems('metal');
                    });
                    page.btns.$listing.click(function() {
                        addListingPrice();
                    });
                    page.btns.$addIDs.click(function() {
                        addIDs(page.$idsControl.val());
                    });
                }

                function configure() {
                    // hide all initially
                    page.$btns.hide();

                    // hack to fix empty space under inventory
                    // TODO get rid of this if they ever fix it
                    setInterval(function() {
                        if (jQuery('#inventory_displaycontrols').height() > 50) {
                            if (page.$inventories.css('marginBottom') === '8px') {
                                page.$inventories.css('marginBottom', '7px');
                            } else {
                                page.$inventories.css('marginBottom', '8px');
                            }
                        }
                    }, 500);

                    tradeOfferWindow.init();
                    tradeOfferWindow.userChanged(jQuery('.inventory_user_tab.active'));

                    var itemParam = urlParams.for_item;

                    if (itemParam !== undefined) {
                        var item = itemParam.split('_');

                        unsafeWindow.g_rgCurrentTradeStatus.them.assets.push({
                            'appid': item[0],
                            'contextid': item[1],
                            'assetid': item[2],
                            'amount': 1
                        });

                        RefreshTradeStatus(g_rgCurrentTradeStatus, true);
                    }
                }

                addElements();
                bindEvents();
                configure();
            }

            // get an item's element id
            function itemToElId(item) {
                return 'item' + item.appid + '_' + item.contextid + '_' + item.id;
            }

            function addItems(mode, amount, index, callback, special) {
                if (callback === undefined) callback = function() {};

                function moveItem(item) {
                    MoveItemToTrade(item);
                }

                // modified from steam's source, should be a little more optimized for adding multiple items
                function addMultiItems(items, callback) {
                    if (items.length === 0) return callback();

                    var timeout = 10;

                    // Add all items
                    for (var i = 0, amount = items.length; i < amount; i++) {
                        setTimeout(moveItem, i * timeout, items[i]);
                    }

                    // Refresh summaries
                    setTimeout(function() {
                        tradeOfferWindow.summarize();
                        return callback();
                    }, (amount * timeout) + 100);
                }

                function mapItemsToJQ(items) {
                    if (items.length) {
                        var elIds = items.map(function(item) {
                            return itemToElId(item);
                        });
                        var elIdFinder = elIds.map(function(id) {
                            return '#' + id;
                        }).join(',');
                        var $elements = jQuery('#inventories').find(elIdFinder).toArray().sort(function(a, b) {
                            return elIds.indexOf(a.id) - elIds.indexOf(b.id);
                        });

                        return $elements;
                    } else {
                        return [];
                    }
                }

                // modify index to pick from items
                function modifyIndex(index, amount, length) {
                    // pick from back
                    if (index < 0) {
                        index += 1;
                        index = Math.max(0, length - (amount + index));
                    }

                    if (index + amount >= length) {
                        index = length - amount;
                    }

                    return index;
                }

                function makeMetalValue(items, value) {
                    // rounds to nearest scrap value
                    function scrapMetal(num) {
                        return Math.floor(Math.round(num * 9) / 9 * 100) / 100;
                    }

                    function getDetailsFor(key) {
                        var collection = items[key];
                        var curValue = values[key];
                        var amountToAdd = Math.floor(scrapMetal(value - total) / scrapMetal(curValue)); // round each value for clean division

                        // there isn't quite enough there...
                        if (collection.length < amountToAdd) {
                            amountToAdd = collection.length;
                        }

                        return {
                            add: amountToAdd,
                            total: scrapMetal(total + (amountToAdd * curValue))
                        };
                    }

                    // round to nearest scrap value
                    value = scrapMetal(value);

                    var values = {
                        'Refined Metal': 1,
                        'Reclaimed Metal': 1 / 3,
                        'Scrap Metal': 1 / 9
                    };
                    var counts = {};
                    var total = 0; // total to be added to

                    for (var k in values) {
                        var details = getDetailsFor(k);

                        if (details.add > 0) {
                            counts[k] = details.add;
                            total = details.total;
                        }
                    }

                    return {
                        counts: counts,
                        met: total === value
                    };
                }

                amount = amount || parseFloat(page.$amountControl.val());
                index = index || parseInt(page.$indexControl.val());

                var $inventory = jQuery('.inventory_ctn:visible');
                var match = $inventory.attr('id').match(/(\d+)_(\d+)$/);

                if (!match) return callback();


                // Do not add items if the offer cannot be modified
                if (jQuery('div.modify_trade_offer:visible').length > 0) return callback();
                if (isNaN(amount) || amount <= 0) return callback(); // don't do anything
                if (isNaN(index)) index = 0;

                amount = parseFloat(amount);

                var items = [];
                var originalamount = amount;
                var satisfied;

                switch (mode) {
                    case 'keys':
                        {
                            amount = Math.floor(amount);
                            items = finders.items(identifiers.isKey) || [];
                            if (items.length < amount) amount = items.length;
                            index = modifyIndex(index, amount, items.length);
                            items = items.splice(index, amount); // get first "count" starting at "start"
                            items = mapItemsToJQ(items);
                            satisfied = amount === originalamount;
                        }
                        break;
                    case 'metal':
                        {
                            items = finders.metal();

                            let details = makeMetalValue(items, amount);
                            let metalItems = [];
                            let k;

                            for (k in details.counts) {
                                var count = details.counts[k];
                                var metalIndex = modifyIndex(index, count, items[k].length);

                                metalItems = metalItems.concat(items[k].splice(metalIndex, count)); // splice each individual type of metal
                            }

                            items = metalItems;
                            items = mapItemsToJQ(items);
                            satisfied = details.met;
                        }
                        break;
                    case 'id':
                        {
                            let ids = special.split(','); // list of id's is store as string in amount param

                            items = finders.id(ids);
                            if (items.length < amount) amount = items.length;
                            items = mapItemsToJQ(items);
                            satisfied = ids.length === items.length;
                        }
                        break;
                    case 'items':
                    default:
                        {
                            amount = Math.floor(amount);
                            items = jQuery('div.inventory_ctn:visible').find('div.itemHolder').filter(function(index, el) {
                                return jQuery(el).css('display') !== 'none';
                            }).find('div.item').filter(function(index, el) {
                                return jQuery(el).css('display') !== 'none';
                            });
                            if (items.length < amount) amount = items.length;
                            index = modifyIndex(index, amount, items.length);
                            items = items.splice(index, amount); // get first "count" starting at "start"
                            satisfied = amount === originalamount;
                        }
                        break;
                }

                addMultiItems(items, function() {
                    return callback(satisfied);
                });
            }

            // add items by id's (ids is comma-seperated)
            // exposed!!!!11
            unsafeWindow.addIDs = function(ids) {
                if (/(\d+)(,\s*\d+)*/.test(ids)) {
                    addItems('id', 1, 0, function() {

                    }, ids);
                } else {
                    alert('Not a valid input');
                }
            };

            ready();
        },
        // add url params to each trade offer link
        classifieds: function() {
            function stringToCurrencies(string) {
                if (string) {
                    var prices = string.split(',');
                    var currencies = {};
                    var currencyNames = {
                        'metal': 'metal',
                        'ref': 'metal',
                        'keys': 'keys',
                        'key': 'keys'
                    };

                    for (var i = 0, length = prices.length; i < length; i++) {
                        // match currencies - the first value is the amount, the second value is the currency name
                        var match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
                        var currency = match && currencyNames[match[2]];

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

            jQuery('.listing').each(function(index, el) {
                var $this = $(el);
                var $item = $this.find('.item');
                var $link = $this.find('.listing-buttons a.btn:last');
                var href = $link.attr('href');
                var price = $item.attr('data-listing_price');
                var currencies = stringToCurrencies(price);
                var k;

                if (currencies) {
                    var params = {
                        listing_intent: $item.attr('data-listing_intent') === 'buy' ? 0 : 1
                    };

                    for (k in currencies) {
                        params['listing_currencies_' + k] = currencies[k];
                    }

                    for (k in params) {
                        href += '&' + k + '=' + params[k];
                    }

                    $link.attr('href', href); // modify href
                }
            });
        },
        inventory: function() {
            var ids = urlParams.select && urlParams.select.split(','); // ids are comma seperated
            var $refined = $('.refined-value');
            var refinedEl = document.getElementsByClassName('refined-value')[0];
            var observer = new MutationObserver(refinedValueChanged);
            var lastRefValue;
            var $listedItems, lastListedCount;

            function sortByPrice() {
                $('li[data-value=price]').trigger('click');
            }

            function updateTotals() {
                // hackish way of updating totals
                $('.select-page').first().trigger('click');
                $('.select-page').first().trigger('click');
            }

            // get pretty value in keys
            function getKeyValue(val) {
                return Math.round(Price.valueInKeys(val) * 10) / 10;
            }

            function refinedValueChanged() {
                $listedItems = $('.item:visible').not('.unselected').filter('[data-listing_price]');

                // this will prevent changes occuring when the values are the same
                // can also prevent re-calculation when hovering over ref value...
                if (!Price.keyPrice || ($refined.text() == lastRefValue && $listedItems.length === lastListedCount)) return;

                var text = $refined.text().replace(/,/g, '').trim();
                var refined = parseFloat(text);

                var keys = getKeyValue(refined);

                lastListedCount = $listedItems.length;

                var prices = $listedItems.map(function(i, el) {
                    // get refined value of listing price
                    return new Price(el.dataset.listing_price).getRefinedValue();
                }).get();
                var totalListedValue = prices.reduce(function(a, b) {
                    return a + b;
                }, 0);

                observer.disconnect(); // disconnect so we can modify the object without calling this function again
                $refined.text(keys);
                $refined.attr('title', getKeyValue(totalListedValue) + ' keys listed value');
                $refined.attr('data-original-title', getKeyValue(totalListedValue) + ' keys listed value');
                $refined.attr('title', '');
                $refined.closest('li').find('small').text('keys');
                observeRefChanges(); // observe changes again

                lastRefValue = $refined.text();
            }

            function observeRefChanges() {
                // observe changes to ref value
                observer.observe(refinedEl, {
                    childList: true,
                    attributes: true,
                    subtree: true
                });
            }

            function backpackLoaded() {
                selectItems();

                var rawValue = Session && Session.rawCurrency && Session.rawCurrency.value;
                $listedItems = $('.item:visible').not('.unselected').filter('[data-listing_price]');

                if (rawValue) {
                    Price.setup(rawValue);
                    refinedValueChanged();
                }
            }

            // select items in inventory by id url param
            function selectItems() {
                if (!ids || ids.length === 0) return; // ids must be available for this to do anything

                var $backpack = $('#backpack');
                var $items = $backpack.find('.item:not(.spacer)');
                var selectors = [];
                var $filtered;

                for (var i = 0, n = ids.length; i < n; i++) {
                    // build list of selectors by each data-id attribute
                    selectors.push('[data-id="' + ids[i] + '"]');
                }

                // select items
                $filtered = $items.filter(selectors.join(','));

                if ($filtered.length) {
                    var $unfiltered = $items.not($filtered);
                    var $spacers = $backpack.find('.spacer');
                    var $tempPage = $('<div class="temp-page" style="display:none;"/>'); // all hidden items are moved to a temp page

                    sortByPrice(); // sort
                    $backpack.append($tempPage); // then add the temp page, it will be hidden
                    $spacers.appendTo($tempPage); // remove spacers
                    $unfiltered.appendTo($tempPage); // add the unfiltered items to the temp page
                    updateTotals(); // i mean it works i guess
                }
            }

            function ready() {
                // wait until items are loaded, call "backpackLoaded" only once
                waitForKeyElements('#backpack > .backpack-page:first', backpackLoaded, true);
            }

            ready();
        }
    };

    // run script related to page
    function init() {
        var path = window.location.href;

        if (path.match(/^https?:\/\/steamcommunity\.com\/tradeoffer.*/)) {
            methods.tradeOfferWindow();
        } else if (path.match(/^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(stats|classifieds).*/)) {
            methods.classifieds();
        } else if (path.match(/^https?:\/\/(.*\.)?backpack.tf(:\d+)?\/(?:id|profiles)\/.*/)) {
            methods.inventory();
        }
    }

    init();
}());