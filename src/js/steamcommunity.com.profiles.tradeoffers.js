// @include /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/tradeoffers/
function({ $, VERSION, WINDOW, addAttributesToHoverItems }) {
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