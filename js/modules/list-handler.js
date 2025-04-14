// list-handler.js - Konsolidert listebehandling for plukk, mottak og retur
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { blinkBackground, playSuccessSound, playErrorSound } from './scanner.js';

/**
 * Generisk funksjon for å legge til eller oppdatere en vare i en liste
 * @param {Array} list - Referanse til listen som skal oppdateres
 * @param {string} itemId - Varenummer
 * @param {string} description - Beskrivelse
 * @param {number} quantity - Antall
 * @param {number} weight - Vekt per enhet
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @param {Array} trackedItems - Referanse til listen med fullførte varer
 * @returns {Object} Oppdatert vare
 */
export function addOrUpdateItem(list, itemId, description, quantity, weight, context, trackedItems) {
    // Normaliser input
    description = description || 'Ukjent vare';
    quantity = parseInt(quantity) || 1;
    weight = parseFloat(weight) || appState.settings.defaultItemWeight;
    
    // Finn eksisterende vare
    const existingItem = list.find(item => item.id === itemId);
    
    if (existingItem) {
        // Oppdater eksisterende vare
        return updateExistingItem(existingItem, quantity, context, trackedItems);
    } else {
        // Lag ny vare
        return addNewItem(list, itemId, description, quantity, weight, context, trackedItems);
    }
}

/**
 * Oppdaterer en eksisterende vare
 * @param {Object} item - Varen som skal oppdateres
 * @param {number} quantity - Antall å legge til/oppdatere med
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @param {Array} trackedItems - Referanse til listen med fullførte varer
 * @returns {Object} Oppdatert vare
 */
function updateExistingItem(item, quantity, context, trackedItems) {
    switch (context) {
        case 'pick':
            // For plukk, initialiserer vi tellere hvis de ikke eksisterer
            if (item.pickedCount === undefined) item.pickedCount = 0;
            
            // Legg til antall
            item.pickedCount += quantity;
            
            // Oppdater status
            if (item.pickedCount >= item.quantity) {
                item.picked = true;
                item.pickedAt = new Date();
                
                // Legg til i listen over fullførte varer hvis den ikke er der
                if (trackedItems && !trackedItems.includes(item.id)) {
                    trackedItems.push(item.id);
                }
                
                playSuccessSound();
                blinkBackground('green');
                showToast(`Vare "${item.id}" fullstendig plukket!`, 'success');
            } else {
                playSuccessSound();
                blinkBackground('green');
                const remaining = item.quantity - item.pickedCount;
                showToast(`Vare "${item.id}" registrert! ${remaining} av ${item.quantity} gjenstår.`, 'info');
            }
            
            // Oppdater sist behandlet element
            appState.lastPickedItem = {
                id: item.id,
                timestamp: new Date()
            };
            break;
            
        case 'receive':
            // For mottak, initialiserer vi tellere hvis de ikke eksisterer
            if (item.receivedCount === undefined) item.receivedCount = 0;
            
            // Legg til antall
            item.receivedCount += quantity;
            
            // Oppdater status
            if (item.receivedCount >= item.quantity) {
                item.received = true;
                item.receivedAt = new Date();
                
                // Legg til i listen over fullførte varer hvis den ikke er der
                if (trackedItems && !trackedItems.includes(item.id)) {
                    trackedItems.push(item.id);
                }
                
                playSuccessSound();
                blinkBackground('green');
                showToast(`Vare "${item.id}" fullstendig mottatt!`, 'success');
            } else {
                playSuccessSound();
                blinkBackground('green');
                const remaining = item.quantity - item.receivedCount;
                showToast(`Vare "${item.id}" registrert! ${remaining} av ${item.quantity} gjenstår.`, 'info');
            }
            
            // Oppdater sist behandlet element
            appState.lastReceivedItem = {
                id: item.id,
                timestamp: new Date()
            };
            break;
            
        case 'return':
            // For retur øker vi bare antallet
            item.quantity += quantity;
            playSuccessSound();
            blinkBackground('green');
            showToast(`Vare "${item.id}" antall økt til ${item.quantity}!`, 'success');
            break;
    }
    
    // Lagre endringene
    saveListsToStorage();
    
    return item;
}

/**
 * Legger til en ny vare i listen
 * @param {Array} list - Referanse til listen som skal oppdateres
 * @param {string} itemId - Varenummer
 * @param {string} description - Beskrivelse
 * @param {number} quantity - Antall
 * @param {number} weight - Vekt per enhet
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @param {Array} trackedItems - Referanse til listen med fullførte varer
 * @returns {Object} Ny vare
 */
function addNewItem(list, itemId, description, quantity, weight, context, trackedItems) {
    // Opprett basisitem
    const newItem = {
        id: itemId,
        description: description,
        quantity: quantity,
        weight: weight
    };
    
    // Legg til kontekstspesifikke felt
    switch (context) {
        case 'pick':
            newItem.picked = false;
            newItem.pickedAt = null;
            newItem.pickedCount = 1; // Vi antar at vi legger til én vare når vi oppretter et nytt element
            
            // Sjekk om varen er ferdig plukket
            if (newItem.pickedCount >= newItem.quantity) {
                newItem.picked = true;
                newItem.pickedAt = new Date();
                
                // Legg til i listen over fullførte varer
                if (trackedItems && !trackedItems.includes(itemId)) {
                    trackedItems.push(itemId);
                }
            }
            
            // Oppdater sist plukket vare
            appState.lastPickedItem = {
                id: itemId,
                timestamp: new Date()
            };
            
            playSuccessSound();
            showToast(`Ny vare "${itemId}" lagt til i plukklisten!`, 'success');
            break;
            
        case 'receive':
            newItem.received = false;
            newItem.receivedAt = null;
            newItem.receivedCount = 1; // Vi antar at vi legger til én vare når vi oppretter et nytt element
            
            // Sjekk om varen er ferdig mottatt
            if (newItem.receivedCount >= newItem.quantity) {
                newItem.received = true;
                newItem.receivedAt = new Date();
                
                // Legg til i listen over fullførte varer
                if (trackedItems && !trackedItems.includes(itemId)) {
                    trackedItems.push(itemId);
                }
            }
            
            // Oppdater sist mottatt vare
            appState.lastReceivedItem = {
                id: itemId,
                timestamp: new Date()
            };
            
            playSuccessSound();
            showToast(`Ny vare "${itemId}" lagt til i mottakslisten!`, 'success');
            break;
            
        case 'return':
            newItem.returnedAt = new Date();
            
            playSuccessSound();
            showToast(`Vare "${itemId}" lagt til som retur!`, 'success');
            break;
    }
    
    // Legg til varen i listen
    list.push(newItem);
    
    // Lagre endringene
    saveListsToStorage();
    
    return newItem;
}

/**
 * Angrer siste skanning
 * @param {string} context - Kontekst ('pick', 'receive')
 * @returns {boolean} Om angringen var vellykket
 */
export function undoLastScan(context) {
    let lastItem = null;
    let list = null;
    
    // Finn sist behandlet element basert på kontekst
    switch (context) {
        case 'pick':
            lastItem = appState.lastPickedItem;
            list = appState.pickListItems;
            break;
            
        case 'receive':
            lastItem = appState.lastReceivedItem;
            list = appState.receiveListItems;
            break;
            
        default:
            return false;
    }
    
    if (!lastItem || !list) return false;
    
    // Finn varen i listen
    const item = list.find(item => item.id === lastItem.id);
    
    if (!item) return false;
    
    // Angre basert på kontekst
    switch (context) {
        case 'pick':
            // Redusere antall plukkede
            if (item.pickedCount > 0) {
                item.pickedCount--;
            }
            
            // Oppdatere status
            if (item.pickedCount < item.quantity) {
                item.picked = false;
                item.pickedAt = null;
                
                // Fjerne fra listen over fullførte varer
                const index = appState.pickedItems.indexOf(item.id);
                if (index !== -1) {
                    appState.pickedItems.splice(index, 1);
                }
            }
            
            // Tilbakestill sist plukket vare
            appState.lastPickedItem = null;
            break;
            
        case 'receive':
            // Redusere antall mottatte
            if (item.receivedCount > 0) {
                item.receivedCount--;
            }
            
            // Oppdatere status
            if (item.receivedCount < item.quantity) {
                item.received = false;
                item.receivedAt = null;
                
                // Fjerne fra listen over fullførte varer
                const index = appState.receivedItems.indexOf(item.id);
                if (index !== -1) {
                    appState.receivedItems.splice(index, 1);
                }
            }
            
            // Tilbakestill sist mottatt vare
            appState.lastReceivedItem = null;
            break;
    }
    
    // Lagre endringene
    saveListsToStorage();
    
    showToast('Siste skanning er angret!', 'warning');
    return true;
}

/**
 * Fjerner en vare fra listen
 * @param {Array} list - Referanse til listen som skal oppdateres
 * @param {number} index - Indeks til varen som skal fjernes
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @returns {boolean} Om fjerningen var vellykket
 */
export function removeItem(list, index, context) {
    if (index < 0 || index >= list.length) return false;
    
    const item = list[index];
    list.splice(index, 1);
    
    // Lagre endringene
    saveListsToStorage();
    
    showToast(`Vare "${item.id}" fjernet fra ${getContextName(context)}liste!`, 'warning');
    return true;
}

/**
 * Tømmer en liste
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @returns {boolean} Om tømmingen var vellykket
 */
export function clearList(context) {
    if (!confirm(`Er du sikker på at du vil tømme ${getContextName(context)}listen?`)) {
        return false;
    }
    
    switch (context) {
        case 'pick':
            appState.pickListItems = [];
            appState.pickedItems = [];
            appState.lastPickedItem = null;
            break;
            
        case 'receive':
            appState.receiveListItems = [];
            appState.receivedItems = [];
            appState.lastReceivedItem = null;
            break;
            
        case 'return':
            appState.returnListItems = [];
            break;
            
        default:
            return false;
    }
    
    // Lagre endringene
    saveListsToStorage();
    
    showToast(`${getContextName(context)}liste tømt!`, 'warning');
    return true;
}

/**
 * Beregner status for en liste
 * @param {Array} list - Listen som skal sjekkes
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @returns {Object} Statusobjekt med totaler
 */
export function calculateListStatus(list, context) {
    if (!list || list.length === 0) {
        return {
            totalItems: 0,
            processedItems: 0,
            totalQuantity: 0,
            processedQuantity: 0,
            percentage: 0,
            totalWeight: 0,
            processedWeight: 0
        };
    }
    
    let totalItems = list.length;
    let processedItems = 0;
    let totalQuantity = 0;
    let processedQuantity = 0;
    let totalWeight = 0;
    let processedWeight = 0;
    
    // Gå gjennom alle varene i listen
    list.forEach(item => {
        const quantity = item.quantity || 1;
        const weight = item.weight || appState.settings.defaultItemWeight;
        
        // Legg til i totaler
        totalQuantity += quantity;
        totalWeight += quantity * weight;
        
        // Beregn prosesserte basert på kontekst
        switch (context) {
            case 'pick':
                const pickedCount = item.pickedCount || 0;
                processedQuantity += pickedCount;
                processedWeight += pickedCount * weight;
                if (item.picked) processedItems++;
                break;
                
            case 'receive':
                const receivedCount = item.receivedCount || 0;
                processedQuantity += receivedCount;
                processedWeight += receivedCount * weight;
                if (item.received) processedItems++;
                break;
                
            case 'return':
                // For retur er alt prosessert
                processedQuantity += quantity;
                processedWeight += quantity * weight;
                processedItems++;
                break;
        }
    });
    
    // Beregn prosentandel
    const percentage = totalQuantity > 0 ? Math.round((processedQuantity / totalQuantity) * 100) : 0;
    
    return {
        totalItems,
        processedItems,
        totalQuantity,
        processedQuantity,
        percentage,
        totalWeight,
        processedWeight
    };
}

/**
 * Få lokalisert navn for kontekst
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @returns {string} Lokalisert navn
 */
function getContextName(context) {
    switch (context) {
        case 'pick': return 'plukk';
        case 'receive': return 'mottak';
        case 'return': return 'retur';
        default: return context;
    }
}

/**
 * Håndterer scanning for en spesifikk modul
 * @param {string} barcode - Strekkode
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 * @param {number} quantity - Antall (brukes for retur)
 * @returns {boolean} Om skanningen var vellykket
 */
export function handleScan(barcode, context, quantity = 1) {
    if (!barcode) return false;
    
    // Finn riktig liste og trakingliste basert på kontekst
    let list = null;
    let trackedItems = null;
    
    switch (context) {
        case 'pick':
            list = appState.pickListItems;
            trackedItems = appState.pickedItems;
            break;
            
        case 'receive':
            list = appState.receiveListItems;
            trackedItems = appState.receivedItems;
            break;
            
        case 'return':
            list = appState.returnListItems;
            trackedItems = null; // retur bruker ikke tracking
            break;
            
        default:
            console.error(`Ukjent kontekst: ${context}`);
            return false;
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    let itemDesc = null;
    
    if (appState.barcodeMapping && appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Finn beskrivelse fra eksisterende lister
    if (context === 'pick') {
        // Sjekk om varen allerede finnes
        const existingItem = list.find(item => item.id === itemId);
        if (existingItem) {
            // For plukk, krever vi at varen er på plukklisten
            if (existingItem.pickedCount >= existingItem.quantity) {
                blinkBackground('orange');
                playErrorSound();
                showToast(`Alle ${existingItem.quantity} enheter av "${itemId}" er allerede plukket!`, 'warning');
                return false;
            }
            
            // Varen er på plukklisten og ikke fullstendig plukket
            addOrUpdateItem(list, itemId, existingItem.description, 1, existingItem.weight, context, trackedItems);
            return true;
        } else {
            // Varen er ikke på plukklisten - viser feil
            blinkBackground('red');
            playErrorSound();
            showToast(`Vare "${itemId}" finnes ikke i plukklisten!`, 'error');
            return false;
        }
    } else if (context === 'receive') {
        // Prøv å finne beskrivelse hvis varen finnes
        const existingItem = list.find(item => item.id === itemId);
        
        if (existingItem) {
            // Varen er på mottakslisten
            addOrUpdateItem(list, itemId, existingItem.description, 1, existingItem.weight, context, trackedItems);
            return true;
        } else {
            // Søk i plukklisten for beskrivelse
            const pickItem = appState.pickListItems.find(item => item.id === itemId);
            if (pickItem) {
                itemDesc = pickItem.description;
            }
            
            // Legg til ny vare
            addOrUpdateItem(list, itemId, itemDesc || 'Mottatt vare', 1, appState.itemWeights[itemId] || appState.settings.defaultItemWeight, context, trackedItems);
            return true;
        }
    } else if (context === 'return') {
        // For retur, prøv å finne beskrivelse fra begge lister
        let findDescription = () => {
            // Sjekk først i plukklisten
            const pickItem = appState.pickListItems.find(item => item.id === itemId);
            if (pickItem) return pickItem.description;
            
            // Sjekk så i mottakslisten
            const receiveItem = appState.receiveListItems.find(item => item.id === itemId);
            if (receiveItem) return receiveItem.description;
            
            // Sjekk til slutt i returlisten selv
            const returnItem = list.find(item => item.id === itemId);
            if (returnItem) return returnItem.description;
            
            return 'Returvare';
        };
        
        itemDesc = findDescription();
        
        // For retur legger vi alltid til varen
        addOrUpdateItem(list, itemId, itemDesc, quantity, appState.itemWeights[itemId] || appState.settings.defaultItemWeight, context, trackedItems);
        return true;
    }
    
    return false;
}