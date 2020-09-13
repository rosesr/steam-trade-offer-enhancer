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
                    const url = getEffectURL(attributes.effect);
                    
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
                'Magical Spirit': 3036,
                'Verdatica': 147,
                'Aromatica': 148,
                'Chromatica': 149,
                'Prismatica': 150,
                'Bee Swarm': 151,
                'Frisky Fireflies': 152,
                'Smoldering Spirits': 153,
                'Wandering Wisps': 154,
                'Kaleidoscope': 155
            },
            /**
             * Includes effect image in element.
             * @param {Object} itemEl - DOM element.
             * @param {Object} value - Value for Unusual effect.
             * @returns {undefined}
             */
            modifyElement: function(itemEl, value) {
                const url = shared.offers.unusual.getEffectURL(value);
                
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
             * @returns {String} URL string
             */
            getEffectURL: function(value) {
                return `https://scrap.tf/img/particles_440/${value}_380x380.png`;
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
    WINDOW,
    $,
    Utils,
    shared,
    addAttributesToHoverItems,
    setStored,
    getStored
};
