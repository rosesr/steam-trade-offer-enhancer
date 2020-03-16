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
        let params = {};
        let pattern = /[?&]+([^=&]+)=([^&]*)/gi;
        
        window.location.search.replace(pattern, (str, key, value) => {
            params[key] = decodeURIComponent(value);
        });
        
        return params;
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
        let isTextField = /textarea|select/i.test(e.target.nodeName) || 
            ['number', 'text'].indexOf(e.target.type) !== -1;
        let code = e.keyCode || e.which;
        let method = hotKeys[code];
        
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
        let el = document.createElement('textarea');
        
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
        let prices = string.split(',');
        let currencies = {};
        let currencyNames = {
            'metal': 'metal',
            'ref': 'metal',
            'keys': 'keys',
            'key': 'keys'
        };
        
        for (let i = 0, n = prices.length; i < n; i++) {
            // match currencies - the first value is the amount
            // the second value is the currency name
            let match = prices[i].trim().match(/^([\d\.]*) (\w*)$/i);
            let currency = currencyNames[match[2]];
            let value = parseFloat(match[1]);
            
            if (currency) {
                currencies[currency] = value;
            } else {
                // something isn't right
                return null;
            }
        }
        
        if (Object.keys(currencies).length) {
            return currencies;
        } else {
            return null;
        }
    }
};
// these are shared between page scripts
const shared = {
    // offers shared between offers pages
    offers: {
        // unusual helper functions
        unusual: {
            // all unusual effects as of nov 23, 19
            // missing 2019 taunt effects since they are not availabe on backpack.tf yet
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
                itemEl.setAttribute('data-effect', value);
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
            },
            /**
             * Gets the effect name from an item.
             * @param {Object} item - Item from steam.
             * @returns {(String|null|undefined)} Effect name, if available.
             */
            getEffectName: function(item) {
                const hasDescriptions = typeof item.descriptions === 'object';
                const isUnique = (item.name_color || '').toUpperCase() === '7D6D00';
                
                // unique items should probably never have effects
                // though, cases have "Unusual Effect" descriptions and we want to exclude them
                if (!hasDescriptions || isUnique) {
                    return null;
                }
                
                for (let i = 0; i < item.descriptions.length; i++) {
                    const description = item.descriptions[i];
                    const match = (
                        description.color === 'ffd700' &&
                        description.value.match(/^\u2605 Unusual Effect: (.+)$/)
                    );
                    
                    if (match) {
                        return match[1];
                    }
                }
            }
        }
    }
};

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
    setStored,
    getStored
};