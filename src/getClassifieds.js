function getClassifieds({Utils}) {
    const dom = {
        listingsElList: document.getElementsByClassName('listing')
    };
    
    function getQuery(intent, currencies) {
        const params = {
            listing_intent: intent === 'buy' ? 0 : 1
        };
        
        for (let k in currencies) {
            params['listing_currencies_' + k] = currencies[k];
        }
        
        return Object.entries(params).map(([k, v]) => {
            return k + '=' + v;
        });
    }
    
    Array.from(dom.listingsElList).forEach((listingEl) => {
        const itemEl = listingEl.getElementsByClassName('item')[0];
        const offerButtonEl = listingEl.getElementsByClassName('listing-buttons')[0].lastElementChild;
        const href = offerButtonEl.getAttribute('href');
        const data = itemEl.dataset;
        const currencies = Utils.stringToCurrencies(data.listing_price);
        
        if (currencies != null) {
            const query = getQuery(data.listing_intent, currencies);
            // url with query added
            const url = [href, ...query].join('&');
            
            offerButtonEl.setAttribute('href', url);
        }
    });
}