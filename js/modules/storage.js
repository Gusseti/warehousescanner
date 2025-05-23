// storage.js - Håndtering av lokallagring
import { appState } from '../app.js';
import { showToast } from './utils.js';

// Innebygde strekkoder vil bli lastet fra barcodes.json
let defaultBarcodes = {};

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
 * Laster inn innstillinger fra brukerens lagring
 */
export function loadSettings() {
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
 * Laster inn vektdata fra brukerens lagring
 */
export function loadItemWeights() {
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