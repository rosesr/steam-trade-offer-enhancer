// @include /^https?:\/\/(.*\.)?backpack\.tf(:\\d+)?\/(stats|classifieds).*/
function({ Utils }) {
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