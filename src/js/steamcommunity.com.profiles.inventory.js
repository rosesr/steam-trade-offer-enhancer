// @include /^https?:\/\/steamcommunity\.com\/(?:id|profiles)\/.*\/inventory/
function({$, WINDOW, shared}) {
    const dom = {
        tabContentInventory: document.getElementById('tabcontent_inventory'),
        get: {
            tf2Inventory: () => {
                const inventoriesList = document.querySelectorAll('#inventories > .inventory_ctn');
                                                                  
                return Array.from(inventoriesList).find((el) => {
                    return /_440_2$/.test(el.id);
                });
            },
            unusuals: () => {
                const inventory = dom.get.tf2Inventory();
                const isUnusualItem = (itemEl) => {
                    const borderColor = itemEl.style.borderColor;
                    const hasPurpleBorder = borderColor === 'rgb(134, 80, 172)';
                    
                    return Boolean(
                        hasPurpleBorder
                    );
                };
                
                if (!inventory) {
                    return [];
                }
                
                const itemsList = Array.from(inventory.querySelectorAll('.item:not(.unusual)'));
                
                return itemsList.select(isUnusualItem);
            }
        }
    };
    
    function onInventory() {
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
        const hasInventory = Boolean(
            inventory
        );
        
        if (!hasInventory) {
            // no tf2 assets
            return;
        }
        
        const {
            getEffectName,
            getEffectValue,
            modifyElement
        } = shared.offers.unusual;
        const assets = inventory.m_rgAssets;
        const itemsList = dom.get.unusuals();
        const addUnusualEffect = (itemEl) => {
            const asset = getAsset(assets, itemEl);
            const effectName = getEffectName(asset.description);
            const effectValue = getEffectValue(effectName);
            // the value for the effect was found
            const hasValue = Boolean(
                effectValue
            );
            
            if (!hasValue) {
                return;
            }
            
            // we can modify it
            modifyElement(itemEl, effectValue);
        };
        
        itemsList.forEach(addUnusualEffect);
    }
    
    // observe changes to dom
    (function observe() {
        const inventoryEl = dom.tabContentInventory;
        const hasInventory = Boolean(
            inventoryEl
        );
        
        // no tf2 inventory on page
        if (!hasInventory) {
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            const tf2Inventory = dom.get.tf2Inventory();
            const tf2InventoryVisible = Boolean(
                tf2Inventory &&
                tf2Inventory.style.display !== 'none'
            );
            
            if (tf2InventoryVisible) {
                console.log('yes');
                onInventory();
            }
        });
        
        observer.observe(inventoryEl, {
            childList: true,
            characterData: false,
            subtree: true
        });
    }());
}