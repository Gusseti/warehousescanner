// storage.js - Module for handling storage operations
import eventBus from './event-bus.js';
import { showToast } from './utils.js';

// Applikasjonstilstand som vil bli tilgjengelig etter initialisering
let appState = {}; 

// Innebygde strekkoder vil bli lastet fra barcodes.json
let defaultBarcodes = {};

/**
 * Singleton-instans av StorageManager
 */
let storageManagerInstance = null;

/**
 * StorageManager klasse - wrapper rundt lagringsfunksjoner
 * @class
 */
class StorageManager {
    constructor() {
        // Bruk appState fra modulen
        this.appState = appState;
    }
    
    /**
     * Henter verdi fra localStorage
     * @param {string} key - Nøkkel for verdien
     * @returns {*} Verdien eller null hvis den ikke finnes
     */
    getItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Feil ved henting av ${key}:`, error);
            return null;
        }
    }
    
    /**
     * Lagrer verdi til localStorage
     * @param {string} key - Nøkkel
     * @param {*} value - Verdien som skal lagres
     * @returns {boolean} True hvis lagring var vellykket
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Feil ved lagring av ${key}:`, error);
            return false;
        }
    }
    
    /**
     * Fjerner verdi fra localStorage
     * @param {string} key - Nøkkel
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Feil ved fjerning av ${key}:`, error);
            return false;
        }
    }
    
    /**
     * Hent appState (alias for tilgang til appState-objektet)
     * @returns {Object} appState-objektet
     */
    getState() {
        return appState;
    }
    
    /**
     * Sett appState
     * @param {Object} newState - Nytt appState-objekt
     */
    setState(newState) {
        appState = newState;
    }
    
    /**
     * Funksjon for å lagre alle data
     * @returns {boolean} True hvis lagring var vellykket
     */
    saveAll() {
        return saveListsToStorage() && saveBarcodeMapping() && saveItemWeights() && saveSettings();
    }
    
    /**
     * Funksjon for å laste alle data
     * @returns {boolean} True hvis innlasting var vellykket
     */
    loadAll() {
        loadFromStorage();
        loadBarcodeMapping();
        loadItemWeights();
        loadSettings();
        return true;
    }
}

/**
 * Hent singleton-instans av StorageManager
 * @returns {StorageManager} StorageManager-instansen
 */
export function getStorageManager() {
    if (!storageManagerInstance) {
        storageManagerInstance = new StorageManager();
    }
    return storageManagerInstance;
}

/**
 * Initialize the storage module
 * @param {Object} state - Referanse til applikasjonstilstanden
 */
export function initStorage(state) {
    if (state) {
        appState = state;
    } else {
        // Fallback hvis ingen tilstand er gitt - koble til globalt objekt
        appState = window.appState || {};
        // Sørg for at vi alltid har et objekt å jobbe med
        if (!window.appState) {
            window.appState = appState;
        }
    }
    
    loadFromStorage();
    loadBarcodeMapping();
    loadItemWeights();
    loadSettings();
    
    // Reset singleton instansen, i tilfelle appState har endret seg
    storageManagerInstance = null;
    
    return getStorageManager();
}

/**
 * Laster inn barcode.json fra rotmappen
 * @returns {Promise} Promise som løses når filen er lastet
 */
export async function loadBarcodesFromJson() {
    try {
        const response = await fetch('barcodes.json');
        if (!response.ok) {
            console.error(`Kunne ikke laste barcodes.json: ${response.status} ${response.statusText}`);
            // Bruk et fallback objekt hvis filen ikke kan lastes
            return {};
        }
        const data = await response.json();
        console.log(`Lastet ${Object.keys(data).length} strekkoder fra barcodes.json`);
        return data;
    } catch (error) {
        console.error('Feil ved lasting av barcodes.json:', error);
        return {};
    }
}

/**
 * Load all lists from local storage
 */
export function loadFromStorage() {
    try {
        // Load pick list
        const pickListItems = localStorage.getItem('pickListItems');
        if (pickListItems) {
            appState.pickListItems = JSON.parse(pickListItems);
        }
        
        // Load picked items
        const pickedItems = localStorage.getItem('pickedItems');
        if (pickedItems) {
            appState.pickedItems = JSON.parse(pickedItems);
        }
        
        // Load last picked item
        const lastPickedItem = localStorage.getItem('lastPickedItem');
        if (lastPickedItem) {
            appState.lastPickedItem = JSON.parse(lastPickedItem);
        }
        
        // Load receive list
        const receiveListItems = localStorage.getItem('receiveListItems');
        if (receiveListItems) {
            appState.receiveListItems = JSON.parse(receiveListItems);
        }
        
        // Load received items
        const receivedItems = localStorage.getItem('receivedItems');
        if (receivedItems) {
            appState.receivedItems = JSON.parse(receivedItems);
        }
        
        // Load last received item
        const lastReceivedItem = localStorage.getItem('lastReceivedItem');
        if (lastReceivedItem) {
            appState.lastReceivedItem = JSON.parse(lastReceivedItem);
        }
        
        // Load return list
        const returnListItems = localStorage.getItem('returnListItems');
        if (returnListItems) {
            appState.returnListItems = JSON.parse(returnListItems);
        }
        
        // Load last returned item
        const lastReturnedItem = localStorage.getItem('lastReturnedItem');
        if (lastReturnedItem) {
            appState.lastReturnedItem = JSON.parse(lastReturnedItem);
        }
        
        console.log('Storage loaded successfully');
    } catch (error) {
        console.error('Error loading from storage:', error);
    }
}

// The duplicate saveListsToStorage function has been removed
// The more comprehensive implementation is used instead (around line 529)


/**
 * Clear all lists from storage
 */
export function clearStorage() {
    try {
        // Clear pick list
        localStorage.removeItem('pickListItems');
        appState.pickListItems = [];
        
        // Clear picked items
        localStorage.removeItem('pickedItems');
        appState.pickedItems = [];
        
        // Clear last picked item
        localStorage.removeItem('lastPickedItem');
        appState.lastPickedItem = null;
        
        // Clear receive list
        localStorage.removeItem('receiveListItems');
        appState.receiveListItems = [];
        
        // Clear received items
        localStorage.removeItem('receivedItems');
        appState.receivedItems = [];
        
        // Clear last received item
        localStorage.removeItem('lastReceivedItem');
        appState.lastReceivedItem = null;
        
        // Clear return list
        localStorage.removeItem('returnListItems');
        appState.returnListItems = [];
        
        // Clear last returned item
        localStorage.removeItem('lastReturnedItem');
        appState.lastReturnedItem = null;
        
        console.log('Storage cleared successfully');
    } catch (error) {
        console.error('Error clearing storage:', error);
    }
}

/**
 * Lagrer strekkodeoversikt til brukerens lagring
 */
export function saveBarcodeMapping() {
    try {
        // Hvis vi har en bruker-spesifikk lagring, bruk den
        if (window.currentUserData) {
            window.currentUserData.data.barcodes = {...appState.barcodeMapping};
            localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
            console.log(`Lagret ${Object.keys(appState.barcodeMapping).length} strekkoder for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring hvis bruker ikke er logget inn
            localStorage.setItem('barcodeMapping', JSON.stringify(appState.barcodeMapping));
        }
    } catch (error) {
        console.error('Feil ved lagring av strekkodeoversikt:', error);
        showToast('Kunne ikke lagre strekkodedata.', 'error');
    }
}

/**
 * Laster inn strekkodeoversikt fra brukerens lagring og legger til innebygde strekkoder
 */
export async function loadBarcodeMappingFromStorage() {
    try {
        // Last først innebygde strekkoder fra JSON-fil
        defaultBarcodes = await loadBarcodesFromJson();
        
        let userBarcodes = {};
        
        // Sjekk om vi har bruker-spesifikk lagring
        if (window.currentUserData && window.currentUserData.data.barcodes) {
            userBarcodes = window.currentUserData.data.barcodes;
            console.log(`Lastet ${Object.keys(userBarcodes).length} strekkoder for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            const mapping = localStorage.getItem('barcodeMapping');
            if (mapping) {
                userBarcodes = JSON.parse(mapping);
            }
        }
        
        // Kombiner innebygde strekkoder med brukerdefinerte
        appState.barcodeMapping = { ...defaultBarcodes, ...userBarcodes };
        
        // Sikre at alle innebygde strekkoder er inkludert (i tilfelle noen er slettet)
        let updated = false;
        for (const [barcode, itemId] of Object.entries(defaultBarcodes)) {
            if (!appState.barcodeMapping[barcode]) {
                appState.barcodeMapping[barcode] = itemId;
                updated = true;
                console.log(`La til innebygd strekkode: ${barcode} -> ${itemId}`);
            }
        }
        
        // Lagre oppdateringene hvis noen innebygde strekkoder måtte legges til
        if (updated) {
            saveBarcodeMapping();
        }
        
        // Oppdater UI hvis elementet finnes
        const barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
        if (barcodeFileInfoEl) {
            const count = Object.keys(appState.barcodeMapping).length;
            const defaultCount = Object.keys(defaultBarcodes).length;
            const userCount = count - defaultCount;
            
            if (userCount > 0) {
                barcodeFileInfoEl.textContent = `Lastet inn: ${count} strekkoder (${defaultCount} innebygde + ${userCount} brukerdefinerte)`;
            } else {
                barcodeFileInfoEl.textContent = `Lastet inn: ${count} innebygde strekkoder`;
            }
        }
        
        console.log(`Totalt ${Object.keys(appState.barcodeMapping).length} strekkoder lastet`);
    } catch (error) {
        console.error('Feil ved lasting av strekkodeoversikt:', error);
        // Tilbakestill til innebygde strekkoder ved feil
        appState.barcodeMapping = { ...defaultBarcodes };
    }
}

/**
 * Load barcode mapping from local storage
 */
export function loadBarcodeMapping() {
    try {
        const barcodeMapping = localStorage.getItem('barcodeMapping');
        if (barcodeMapping) {
            appState.barcodeMapping = JSON.parse(barcodeMapping);
        } else {
            appState.barcodeMapping = {};
        }
        
        console.log('Barcode mapping loaded successfully');
    } catch (error) {
        console.error('Error loading barcode mapping:', error);
        appState.barcodeMapping = {};
    }
}

// The first implementation of findSimilarBarcodes has been removed
// Using the more comprehensive implementation at line ~797 instead

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(a, b) {
    // Create matrix
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Lagrer innstillinger til brukerens lagring
 */
export function saveSettings() {
    try {
        // Hvis vi har en bruker-spesifikk lagring, bruk den
        if (window.currentUserData) {
            window.currentUserData.data.settings = {...appState.settings};
            localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
            console.log(`Lagret innstillinger for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            localStorage.setItem('settings', JSON.stringify(appState.settings));
        }
    } catch (error) {
        console.error('Feil ved lagring av innstillinger:', error);
        showToast('Kunne ikke lagre innstillinger.', 'error');
    }
}

/**
 * Load user settings from local storage
 */
export function loadSettings() {
    try {
        const settings = localStorage.getItem('settings');
        if (settings) {
            appState.settings = { ...appState.settings, ...JSON.parse(settings) };
        }
        
        console.log('Settings loaded successfully');
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Laster inn innstillinger fra brukerens lagring
 */
export function loadSettingsFromStorage() {
    try {
        let userSettings = null;
        
        // Sjekk om vi har bruker-spesifikk lagring
        if (window.currentUserData && window.currentUserData.data.settings) {
            userSettings = window.currentUserData.data.settings;
            console.log(`Lastet innstillinger for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            const storedSettings = localStorage.getItem('settings');
            if (storedSettings) {
                userSettings = JSON.parse(storedSettings);
            }
        }
        
        // Oppdater appState med brukerens innstillinger
        if (userSettings) {
            appState.settings = userSettings;
            
            // Oppdater UI hvis elementene finnes
            const weightUnitEl = document.getElementById('weightUnit');
            const defaultItemWeightEl = document.getElementById('defaultItemWeight');
            
            if (weightUnitEl) {
                weightUnitEl.value = appState.settings.weightUnit;
            }
            
            if (defaultItemWeightEl) {
                defaultItemWeightEl.value = appState.settings.defaultItemWeight;
            }
            
            // Sjekk om mørk modus er aktivert
            if (userSettings.theme === 'dark') {
                document.body.classList.add('dark-mode');
                const themeToggle = document.getElementById('themeToggle');
                if (themeToggle) themeToggle.checked = true;
                
                const themeToggleSettings = document.getElementById('themeToggleSettings');
                if (themeToggleSettings) themeToggleSettings.checked = true;
            }
        }
    } catch (error) {
        console.error('Feil ved lasting av innstillinger:', error);
    }
}

/**
 * Lagrer vektdata til brukerens lagring
 */
export function saveItemWeights() {
    try {
        // Hvis vi har en bruker-spesifikk lagring, bruk den
        if (window.currentUserData) {
            window.currentUserData.data.itemWeights = {...appState.itemWeights};
            localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
            console.log(`Lagret vektdata for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            localStorage.setItem('itemWeights', JSON.stringify(appState.itemWeights));
        }
    } catch (error) {
        console.error('Feil ved lagring av vektdata:', error);
        showToast('Kunne ikke lagre vektdata.', 'error');
    }
}

/**
 * Load item weights from local storage
 */
export function loadItemWeights() {
    try {
        const itemWeights = localStorage.getItem('itemWeights');
        if (itemWeights) {
            appState.itemWeights = JSON.parse(itemWeights);
        } else {
            appState.itemWeights = {};
        }
        
        console.log('Item weights loaded successfully');
    } catch (error) {
        console.error('Error loading item weights:', error);
        appState.itemWeights = {};
    }
}

/**
 * Laster inn vektdata fra brukerens lagring
 */
export function loadItemWeightsFromStorage() {
    try {
        let userWeights = null;
        
        // Sjekk om vi har bruker-spesifikk lagring
        if (window.currentUserData && window.currentUserData.data.itemWeights) {
            userWeights = window.currentUserData.data.itemWeights;
            console.log(`Lastet vektdata for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            const storedWeights = localStorage.getItem('itemWeights');
            if (storedWeights) {
                userWeights = JSON.parse(storedWeights);
            }
        }
        
        if (userWeights) {
            appState.itemWeights = userWeights;
        } else {
            appState.itemWeights = {};
        }
    } catch (error) {
        console.error('Feil ved lasting av vektdata:', error);
        appState.itemWeights = {};
    }
}

/**
 * Lagrer alle lister til brukerens lagring
 */
export function saveListsToStorage() {
    try {
        // Rens dataene før lagring
        
        // Rett opp feil i plukklisten
        if (appState.pickListItems) {
            appState.pickListItems.forEach(item => {
                // Kontroller at pickedCount ikke er høyere enn quantity
                if (item.pickedCount > item.quantity) {
                    console.warn(`Korrigerer pickedCount for ${item.id}: ${item.pickedCount} > ${item.quantity}`);
                    item.pickedCount = item.quantity;
                }
                
                // Pass på at picked-status er i samsvar med pickedCount
                if (item.pickedCount >= item.quantity) {
                    item.picked = true;
                } else {
                    item.picked = false;
                }
            });
        }
        
        // Tilsvarende for mottakslisten
        if (appState.receiveListItems) {
            appState.receiveListItems.forEach(item => {
                if (item.receivedCount > item.quantity) {
                    console.warn(`Korrigerer receivedCount for ${item.id}: ${item.receivedCount} > ${item.quantity}`);
                    item.receivedCount = item.quantity;
                }
                
                if (item.receivedCount >= item.quantity) {
                    item.received = true;
                } else {
                    item.received = false;
                }
            });
        }
        
        // Bruker-spesifikk lagring
        if (window.currentUserData) {
            window.currentUserData.data.pickings = appState.pickListItems || [];
            window.currentUserData.data.receivings = appState.receiveListItems || [];
            window.currentUserData.data.returns = appState.returnListItems || [];
            
            localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
            console.log(`Lagret listedata for bruker ${window.currentUserData.id}`);
        } else {
            // Fallback til vanlig lagring
            localStorage.setItem('pickListItems', JSON.stringify(appState.pickListItems || []));
            localStorage.setItem('pickedItems', JSON.stringify(appState.pickedItems || []));
            localStorage.setItem('lastPickedItem', appState.lastPickedItem ? JSON.stringify(appState.lastPickedItem) : null);
            
            localStorage.setItem('receiveListItems', JSON.stringify(appState.receiveListItems || []));
            localStorage.setItem('receivedItems', JSON.stringify(appState.receivedItems || []));
            localStorage.setItem('lastReceivedItem', appState.lastReceivedItem ? JSON.stringify(appState.lastReceivedItem) : null);
            
            localStorage.setItem('returnListItems', JSON.stringify(appState.returnListItems || []));
        }
        
        return true;
    } catch (error) {
        console.error('Feil ved lagring av lister:', error);
        showToast('Kunne ikke lagre listedata.', 'error');
        return false;
    }
}

/**
 * Laster inn alle lister fra brukerens lagring
 * @returns {boolean} Om listene ble lastet inn
 */
export function loadListsFromStorage() {
    try {
        console.log("Laster data fra lagring");
        
        // Bruker-spesifikk lagring
        if (window.currentUserData) {
            const userData = window.currentUserData.data;
            
            // Laster plukklister
            if (userData.pickings) {
                appState.pickListItems = userData.pickings;
                console.log("Lastet pickListItems fra brukerdata:", appState.pickListItems.length, "varer");
            } else {
                appState.pickListItems = [];
            }
            
            // Laster mottakslister
            if (userData.receivings) {
                appState.receiveListItems = userData.receivings;
                console.log("Lastet receiveListItems fra brukerdata:", appState.receiveListItems.length, "varer");
            } else {
                appState.receiveListItems = [];
            }
            
            // Laster returlister
            if (userData.returns) {
                appState.returnListItems = userData.returns;
                console.log("Lastet returnListItems fra brukerdata:", appState.returnListItems.length, "varer");
            } else {
                appState.returnListItems = [];
            }
            
            console.log("Laster fullført fra brukerdata");
        } else {
            // Fallback til vanlig lagring
            // Plukkliste
            const storedPickListItems = localStorage.getItem('pickListItems');
            if (storedPickListItems) {
                try {
                    appState.pickListItems = JSON.parse(storedPickListItems);
                    console.log("Lastet pickListItems:", appState.pickListItems);
                } catch (e) {
                    console.error("Feil ved parsing av pickListItems:", e);
                    appState.pickListItems = [];
                }
            } else {
                appState.pickListItems = [];
            }
            
            const storedPickedItems = localStorage.getItem('pickedItems');
            if (storedPickedItems) {
                try {
                    appState.pickedItems = JSON.parse(storedPickedItems);
                    console.log("Lastet pickedItems:", appState.pickedItems);
                } catch (e) {
                    console.error("Feil ved parsing av pickedItems:", e);
                    appState.pickedItems = [];
                }
            } else {
                appState.pickedItems = [];
            }
            
            const storedLastPickedItem = localStorage.getItem('lastPickedItem');
            if (storedLastPickedItem && storedLastPickedItem !== "null") {
                try {
                    appState.lastPickedItem = JSON.parse(storedLastPickedItem);
                } catch (e) {
                    console.error("Feil ved parsing av lastPickedItem:", e);
                    appState.lastPickedItem = null;
                }
            } else {
                appState.lastPickedItem = null;
            }
            
            // Mottaksliste
            const storedReceiveListItems = localStorage.getItem('receiveListItems');
            if (storedReceiveListItems) {
                try {
                    appState.receiveListItems = JSON.parse(storedReceiveListItems);
                    console.log("Lastet receiveListItems:", appState.receiveListItems.length, "varer");
                } catch (e) {
                    console.error("Feil ved parsing av receiveListItems:", e);
                    appState.receiveListItems = [];
                }
            } else {
                appState.receiveListItems = [];
            }
            
            const storedReceivedItems = localStorage.getItem('receivedItems');
            if (storedReceivedItems) {
                try {
                    appState.receivedItems = JSON.parse(storedReceivedItems);
                } catch (e) {
                    console.error("Feil ved parsing av receivedItems:", e);
                    appState.receivedItems = [];
                }
            } else {
                appState.receivedItems = [];
            }
            
            // Returliste
            const storedReturnListItems = localStorage.getItem('returnListItems');
            if (storedReturnListItems) {
                try {
                    appState.returnListItems = JSON.parse(storedReturnListItems);
                    console.log("Lastet returnListItems:", appState.returnListItems.length, "varer");
                } catch (e) {
                    console.error("Feil ved parsing av returnListItems:", e);
                    appState.returnListItems = [];
                }
            } else {
                appState.returnListItems = [];
            }
        }
        
        // Oppdater UI basert på gjeldende modul hvis den er satt
        if (appState.currentModule) {
            switch (appState.currentModule) {
                case 'picking':
                    if (typeof updatePickingUI === 'function') {
                        updatePickingUI();
                    } else if (window.updatePickingUI) {
                        window.updatePickingUI();
                    }
                    break;
                case 'receiving':
                    if (typeof updateReceivingUI === 'function') {
                        updateReceivingUI();
                    } else if (window.updateReceivingUI) {
                        window.updateReceivingUI();
                    }
                    break;
                case 'returns':
                    if (typeof updateReturnsUI === 'function') {
                        updateReturnsUI();
                    } else if (window.updateReturnsUI) {
                        window.updateReturnsUI();
                    }
                    break;
            }
        }
        
        console.log("Alle lister lastet fra lagring");
        return true;
    } catch (error) {
        console.error('Feil ved lasting av lister:', error);
        return false;
    }
}

/**
 * Sletter alle lagrede data for gjeldende bruker bortsett fra innebygde strekkoder
 */
export function clearAllStoredData() {
    try {
        // Lagre innebygde strekkoder midlertidig
        const savedBarcodes = { ...defaultBarcodes };
        
        if (window.currentUserData) {
            // Tøm all brukerdata, men behold brukerens konto
            window.currentUserData.data = {
                barcodes: {...savedBarcodes},
                pickings: [],
                receivings: [],
                returns: [],
                settings: {
                    weightUnit: 'kg',
                    defaultItemWeight: 1,
                    theme: 'light'
                }
            };
            
            localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
            console.log(`Tilbakestilte data for bruker ${window.currentUserData.id}`);
            
            // Oppdater appState
            appState.barcodeMapping = {...savedBarcodes};
            appState.pickListItems = [];
            appState.receiveListItems = [];
            appState.returnListItems = [];
            appState.settings = {
                weightUnit: 'kg',
                defaultItemWeight: 1.0,
                theme: 'light'
            };
            appState.itemWeights = {};
            
            // Fjern mørk modus hvis den er aktivert
            document.body.classList.remove('dark-mode');
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) themeToggle.checked = false;
            
            const themeToggleSettings = document.getElementById('themeToggleSettings');
            if (themeToggleSettings) themeToggleSettings.checked = false;
        } else {
            // Tøm all localStorage
            localStorage.clear();
            
            // Gjenopprett innebygde strekkoder
            appState.barcodeMapping = savedBarcodes;
            saveBarcodeMapping();
        }
        
        return true;
    } catch (error) {
        console.error('Feil ved sletting av alle data:', error);
        return false;
    }
}

/**
 * Tilbakestiller strekkodedata til kun innebygde strekkoder
 */
export function resetToDefaultBarcodes() {
    try {
        appState.barcodeMapping = { ...defaultBarcodes };
        saveBarcodeMapping();
        
        // Oppdater UI
        const barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
        if (barcodeFileInfoEl) {
            barcodeFileInfoEl.textContent = `Lastet inn: ${Object.keys(defaultBarcodes).length} innebygde strekkoder`;
        }
        
        return true;
    } catch (error) {
        console.error('Feil ved tilbakestilling av strekkoder:', error);
        return false;
    }
}

/**
 * Søker etter lignende strekkoder i barcode mapping
 * @param {string} barcode - Strekkoden å søke etter lignende for
 * @param {number} threshold - Terskel for likhet (0-1), f.eks. 0.7 for 70% likhet
 * @returns {Array} Liste med lignende strekkoder og deres varenumre
 */
export function findSimilarBarcodes(barcode, threshold = 0.7) {
    if (!barcode || barcode.length < 3) return [];
    
    const results = [];
    
    for (const [code, itemId] of Object.entries(appState.barcodeMapping)) {
        const similarity = calculateStringSimilarity(barcode, code);
        if (similarity >= threshold) {
            results.push({
                barcode: code,
                itemId: itemId,
                similarity: similarity
            });
        }
    }
    
    // Sorter etter likhet (høyest først)
    return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Beregner likhet mellom to strenger (0-1)
 * @param {string} str1 - Første streng
 * @param {string} str2 - Andre streng
 * @returns {number} Likhet mellom 0 og 1
 */
function calculateStringSimilarity(str1, str2) {
    // Hvis strengene er like, returner 1
    if (str1 === str2) return 1;
    
    // Hvis en av strengene er tom, returner 0
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Beregn lengden av den lengste felles delsekvensen
    const matrix = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
    
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            if (str1[i-1] === str2[j-1]) {
                matrix[i][j] = matrix[i-1][j-1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i-1][j], matrix[i][j-1]);
            }
        }
    }
    
    // Lengden av den lengste felles delsekvensen
    const lcs = matrix[str1.length][str2.length];
    
    // Normaliser til en verdi mellom 0 og 1
    return lcs / Math.max(str1.length, str2.length);
}

/**
 * Export data to JSON file
 * @param {string} type - Type of data to export (all, picks, receives, returns)
 * @returns {Object} - JSON data object
 */
export function exportDataToJson(type = 'all') {
    let data = {};
    
    switch (type) {
        case 'picks':
            data = {
                pickListItems: appState.pickListItems,
                pickedItems: appState.pickedItems,
                lastPickedItem: appState.lastPickedItem
            };
            break;
            
        case 'receives':
            data = {
                receiveListItems: appState.receiveListItems,
                receivedItems: appState.receivedItems,
                lastReceivedItem: appState.lastReceivedItem
            };
            break;
            
        case 'returns':
            data = {
                returnListItems: appState.returnListItems,
                lastReturnedItem: appState.lastReturnedItem
            };
            break;
            
        case 'barcodes':
            data = {
                barcodeMapping: appState.barcodeMapping
            };
            break;
            
        case 'weights':
            data = {
                itemWeights: appState.itemWeights
            };
            break;
            
        case 'settings':
            data = {
                settings: appState.settings
            };
            break;
            
        case 'all':
        default:
            data = {
                pickListItems: appState.pickListItems,
                pickedItems: appState.pickedItems,
                lastPickedItem: appState.lastPickedItem,
                receiveListItems: appState.receiveListItems,
                receivedItems: appState.receivedItems,
                lastReceivedItem: appState.lastReceivedItem,
                returnListItems: appState.returnListItems,
                lastReturnedItem: appState.lastReturnedItem,
                barcodeMapping: appState.barcodeMapping,
                itemWeights: appState.itemWeights,
                settings: appState.settings
            };
            break;
    }
    
    return data;
}

/**
 * Import data from JSON object
 * @param {Object} data - JSON data object
 * @param {string} type - Type of data to import (all, picks, receives, returns)
 * @returns {boolean} - Success status
 */
export function importDataFromJson(data, type = 'all') {
    try {
        if (!data) return false;
        
        switch (type) {
            case 'picks':
                if (data.pickListItems) appState.pickListItems = data.pickListItems;
                if (data.pickedItems) appState.pickedItems = data.pickedItems;
                if (data.lastPickedItem) appState.lastPickedItem = data.lastPickedItem;
                break;
                
            case 'receives':
                if (data.receiveListItems) appState.receiveListItems = data.receiveListItems;
                if (data.receivedItems) appState.receivedItems = data.receivedItems;
                if (data.lastReceivedItem) appState.lastReceivedItem = data.lastReceivedItem;
                break;
                
            case 'returns':
                if (data.returnListItems) appState.returnListItems = data.returnListItems;
                if (data.lastReturnedItem) appState.lastReturnedItem = data.lastReturnedItem;
                break;
                
            case 'barcodes':
                if (data.barcodeMapping) appState.barcodeMapping = data.barcodeMapping;
                break;
                
            case 'weights':
                if (data.itemWeights) appState.itemWeights = data.itemWeights;
                break;
                
            case 'settings':
                if (data.settings) {
                    appState.settings = { ...appState.settings, ...data.settings };
                }
                break;
                
            case 'all':
            default:
                if (data.pickListItems) appState.pickListItems = data.pickListItems;
                if (data.pickedItems) appState.pickedItems = data.pickedItems;
                if (data.lastPickedItem) appState.lastPickedItem = data.lastPickedItem;
                if (data.receiveListItems) appState.receiveListItems = data.receiveListItems;
                if (data.receivedItems) appState.receivedItems = data.receivedItems;
                if (data.lastReceivedItem) appState.lastReceivedItem = data.lastReceivedItem;
                if (data.returnListItems) appState.returnListItems = data.returnListItems;
                if (data.lastReturnedItem) appState.lastReturnedItem = data.lastReturnedItem;
                if (data.barcodeMapping) appState.barcodeMapping = data.barcodeMapping;
                if (data.itemWeights) appState.itemWeights = data.itemWeights;
                if (data.settings) {
                    appState.settings = { ...appState.settings, ...data.settings };
                }
                break;
        }
        
        // Save imported data to storage
        saveListsToStorage();
        saveBarcodeMapping();
        saveItemWeights();
        saveSettings();
        
        return true;
    } catch (error) {
        console.error('Error importing data:', error);
        return false;
    }
}