// @include /^https?:\/\/steamcommunity\.com\/market\/listings\/440\/.*/
function({ WINDOW, shared }) {
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