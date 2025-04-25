// core-module-handler.js - Felles funksjonalitet for alle moduler
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { handleFileImport, exportWithFormat, exportToPDF } from './import-export.js';
import { blinkBackground, playErrorSound } from './scanner.js';

/**
 * Generisk funksjon for å håndtere skanning på tvers av moduler
 * @param {string} barcode - Den skannede strekkoden
 * @param {string} moduleType - Modultype ('pick', 'receive', 'return')
 * @param {Object} options - Tilleggsalternativer for prosessering
 * @returns {Object} Resultat av skanningen
 */
export function handleModuleScan(barcode, moduleType, options = {}) {
    console.log(`${moduleType.toUpperCase()}-DEBUG: handleModuleScan starter med strekkode:`, barcode);
    
    // Håndter tilfeller der strekkode er et objekt
    if (typeof barcode === 'object' && barcode !== null) {
        if (barcode.id) {
            barcode = barcode.id;
        } else {
            // Prøv å finne en passende identifikator i objektet
            const possibleIdFields = ['productId', 'code', 'sku', 'barcode', 'ean'];
            for (const field of possibleIdFields) {
                if (barcode[field]) {
                    barcode = barcode[field];
                    break;
                }
            }
            
            // Hvis vi fortsatt har et objekt, prøv toString()
            if (typeof barcode === 'object') {
                barcode = String(barcode);
                
                if (barcode === "[object Object]") {
                    showToast("Ugyldig strekkodeformat mottatt", "error");
                    return { success: false, error: "Ugyldig strekkodeformat" };
                }
            }
        }
    }
    
    if (!barcode) {
        console.error(`${moduleType.toUpperCase()}-ERROR: Tomt strekkodeargument`);
        return { success: false, error: "Tom strekkode" };
    }
    
    // Hent de riktige listene basert på modultype
    let itemsList, processedList, lastItemRef;
    
    switch(moduleType) {
        case 'pick':
            itemsList = appState.pickListItems;
            processedList = appState.pickedItems;
            lastItemRef = 'lastPickedItem';
            break;
        case 'receive':
            itemsList = appState.receiveListItems;
            processedList = appState.receivedItems;
            lastItemRef = 'lastReceivedItem';
            break;
        case 'return':
            itemsList = appState.returnListItems;
            processedList = appState.returnedItems;
            lastItemRef = 'lastReturnedItem';
            break;
        default:
            console.error(`${moduleType.toUpperCase()}-ERROR: Ukjent modultype`);
            return { success: false, error: "Ukjent modultype" };
    }
    
    // Sjekk om strekkoden finnes i barcodeMapping
    let itemId = barcode;
    if (appState.barcodeMapping && appState.barcodeMapping[barcode]) {
        const mappedValue = appState.barcodeMapping[barcode];
        if (typeof mappedValue === 'object' && mappedValue.id) {
            itemId = mappedValue.id;
        } else if (typeof mappedValue === 'string') {
            itemId = mappedValue;
        }
        console.log(`${moduleType.toUpperCase()}-DEBUG: Strekkode ${barcode} mappet til varenummer ${itemId}`);
    } else {
        console.log(`${moduleType.toUpperCase()}-DEBUG: Strekkode ${barcode} ikke funnet i mapping, bruker som varenummer`);
    }
    
    // Finn varen i listen
    const item = itemsList.find(item => item.id === itemId);
    
    if (!item) {
        console.error(`${moduleType.toUpperCase()}-ERROR: Vare "${itemId}" ikke funnet i listen`);
        showToast(`Vare "${itemId}" finnes ikke i ${moduleType === 'pick' ? 'plukk' : moduleType === 'receive' ? 'mottak' : 'retur'}listen!`, 'error');
        blinkBackground('red');
        playErrorSound();
        return { success: false, error: "Vare ikke funnet", itemId };
    }
    
    // Prosesser skanningen basert på modultype
    let result;
    
    switch(moduleType) {
        case 'pick':
            result = processPickScan(item, itemId);
            break;
        case 'receive':
            result = processReceiveScan(item, itemId);
            break;
        case 'return':
            result = processReturnScan(item, itemId, options.quantity || 1);
            break;
        default:
            result = { success: false, error: "Ukjent modultype" };
    }
    
    // Oppdater referanse til sist prosesserte vare
    if (result.success) {
        appState[lastItemRef] = {
            id: itemId,
            timestamp: new Date()
        };
        
        // Lagre endringer
        saveListsToStorage();
    }
    
    return result;
}

/**
 * Prosesserer en plukk-skanning
 * @private
 */
function processPickScan(item, itemId) {
    // Initialiser tellefelt hvis det ikke eksisterer
    if (item.pickedCount === undefined) {
        item.pickedCount = 0;
    }
    
    // Sjekk om maksimalt antall er nådd
    if (item.pickedCount >= item.quantity) {
        showToast(`MAKS OPPNÅDD: ${item.pickedCount}/${item.quantity} enheter av "${itemId}" er allerede plukket!`, 'error');
        blinkBackground('red');
        playErrorSound();
        return { success: false, error: "Maksimalt antall nådd" };
    }
    
    // Øk antallet
    item.pickedCount++;
    
    // Merk som fullstendig plukket hvis alle enheter er skannet
    if (item.pickedCount >= item.quantity) {
        item.picked = true;
        item.pickedAt = new Date();
        
        // Legg til i listen over fullstendig plukkede varer hvis den ikke allerede er der
        if (!appState.pickedItems.includes(itemId)) {
            appState.pickedItems.push(itemId);
        }
        
        blinkBackground('green');
    } else {
        blinkBackground('green');
    }
    
    // Vis tilbakemelding til brukeren
    const remainingCount = item.quantity - item.pickedCount;
    
    if (remainingCount > 0) {
        showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
    } else {
        showToast(`Vare "${itemId}" fullstendig plukket!`, 'success');
    }
    
    return { 
        success: true, 
        item,
        remainingCount, 
        isComplete: item.pickedCount >= item.quantity 
    };
}

/**
 * Prosesserer en mottaksskanning
 * @private
 */
function processReceiveScan(item, itemId) {
    // Initialiser tellefelt hvis det ikke eksisterer
    if (item.receivedCount === undefined) {
        item.receivedCount = 0;
    }
    
    // Sjekk om maksimalt antall er nådd
    if (item.receivedCount >= item.quantity) {
        showToast(`MAKS OPPNÅDD: ${item.receivedCount}/${item.quantity} enheter av "${itemId}" er allerede mottatt!`, 'error');
        blinkBackground('red');
        playErrorSound();
        return { success: false, error: "Maksimalt antall nådd" };
    }
    
    // Øk antallet
    item.receivedCount++;
    
    // Merk som fullstendig mottatt hvis alle enheter er skannet
    if (item.receivedCount >= item.quantity) {
        item.received = true;
        item.receivedAt = new Date();
        
        // Legg til i listen over fullstendig mottatte varer hvis den ikke allerede er der
        if (!appState.receivedItems.includes(itemId)) {
            appState.receivedItems.push(itemId);
        }
        
        blinkBackground('green');
    } else {
        blinkBackground('green');
    }
    
    // Vis tilbakemelding til brukeren
    const remainingCount = item.quantity - item.receivedCount;
    
    if (remainingCount > 0) {
        showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
    } else {
        showToast(`Vare "${itemId}" fullstendig mottatt!`, 'success');
    }
    
    return { 
        success: true, 
        item,
        remainingCount, 
        isComplete: item.receivedCount >= item.quantity 
    };
}

/**
 * Prosesserer en retur-skanning
 * @private
 */
function processReturnScan(item, itemId, quantity) {
    // Initialiser tellefelt hvis det ikke eksisterer
    if (item.returnedCount === undefined) {
        item.returnedCount = 0;
    }
    
    // Sjekk om maksimalt antall er nådd
    if (item.returnedCount >= item.quantity) {
        showToast(`MAKS OPPNÅDD: ${item.returnedCount}/${item.quantity} enheter av "${itemId}" er allerede returnert!`, 'error');
        blinkBackground('red');
        playErrorSound();
        return { success: false, error: "Maksimalt antall nådd" };
    }
    
    // Sørg for at antallet ikke overstiger maksimalt antall
    const newCount = Math.min(item.returnedCount + quantity, item.quantity);
    const actualIncrement = newCount - item.returnedCount;
    
    item.returnedCount = newCount;
    
    // Merk som fullstendig returnert hvis alle enheter er skannet
    if (item.returnedCount >= item.quantity) {
        item.returned = true;
        item.returnedAt = new Date();
        
        // Legg til i listen over fullstendig returnerte varer hvis den ikke allerede er der
        if (!appState.returnedItems.includes(itemId)) {
            appState.returnedItems.push(itemId);
        }
        
        blinkBackground('green');
    } else {
        blinkBackground('green');
    }
    
    // Vis tilbakemelding til brukeren
    const remainingCount = item.quantity - item.returnedCount;
    
    if (remainingCount > 0) {
        showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
    } else {
        showToast(`Vare "${itemId}" fullstendig returnert!`, 'success');
    }
    
    return { 
        success: true, 
        item,
        remainingCount, 
        isComplete: item.returnedCount >= item.quantity,
        actualQuantity: actualIncrement
    };
}

/**
 * Håndterer filimport for forskjellige moduler
 * @param {Event} event - Filimport-event
 * @param {string} moduleType - Modultype ('pick', 'receive', 'return')
 * @param {Function} updateUICallback - Funksjon for å oppdatere UI etter import
 */
export function handleModuleFileImport(event, moduleType, updateUICallback) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vis laster-melding
    showToast(`Importerer ${moduleType === 'pick' ? 'plukk' : moduleType === 'receive' ? 'mottaks' : 'retur'}liste...`, 'info');
    
    // Bruk den generiske filimportfunksjonen
    handleFileImport(file, moduleType, {
        onSuccess: () => {
            updateUICallback();
            saveListsToStorage();
        },
        onError: (error) => {
            showToast('Feil ved import av fil: ' + error.message, 'error');
        }
    });
    
    // Reset file input
    event.target.value = '';
}

/**
 * Eksporterer en moduls liste i spesifisert format med utvidet funksjonalitet
 * @param {Array} items - Varene som skal eksporteres
 * @param {string} moduleType - Modultype ('pick', 'receive', 'return')
 * @param {string} format - Eksportformat ('pdf', 'csv', 'json', 'txt', 'html', 'excel')
 * @param {Object} options - Tilleggsalternativer for eksport
 */
export function exportModuleList(items, moduleType, format = 'pdf', options = {}) {
    // Sjekk om vi har varer å eksportere
    if (!items || items.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }
    
    // Beregn detaljert eksportstatus for å vise til brukeren
    const totalItems = items.length;
    let processedItems = 0;
    let partiallyProcessedItems = 0;
    let unprocessedItems = 0;
    let totalProcessedUnits = 0;
    let totalUnits = 0;
    
    // Beregn statistikk basert på modultype
    items.forEach(item => {
        const quantity = item.quantity || 1;
        totalUnits += quantity;
        
        let processedCount = 0;
        let isFullyProcessed = false;
        
        switch(moduleType) {
            case 'pick':
                processedCount = item.pickedCount || 0;
                isFullyProcessed = item.picked || processedCount >= quantity;
                break;
            case 'receive':
                processedCount = item.receivedCount || 0;
                isFullyProcessed = item.received || processedCount >= quantity;
                break;
            case 'return':
                processedCount = item.returnedCount || 0;
                isFullyProcessed = item.returned || processedCount >= quantity;
                break;
        }
        
        totalProcessedUnits += processedCount;
        
        if (isFullyProcessed) {
            processedItems++;
        } else if (processedCount > 0) {
            partiallyProcessedItems++;
        } else {
            unprocessedItems++;
        }
    });
    
    // Beregn prosentvis ferdigstillelse
    const percentComplete = totalUnits > 0 ? Math.round((totalProcessedUnits / totalUnits) * 100) : 0;
    
    // Vis detaljert statistikk til brukeren
    const statusMessage = `
        Eksporterer ${moduleType === 'pick' ? 'plukkliste' : moduleType === 'receive' ? 'mottaksliste' : 'returliste'}:
        - ${totalItems} varelinjer totalt
        - ${processedItems} fullstendig ${moduleType === 'pick' ? 'plukket' : moduleType === 'receive' ? 'mottatt' : 'returnert'}
        - ${partiallyProcessedItems} delvis prosessert
        - ${unprocessedItems} uprosessert
        - ${totalProcessedUnits} av ${totalUnits} enheter (${percentComplete}%) prosessert
    `;
    console.log(statusMessage);
    
    // Sjekk om det er uprosesserte varer og bekreft med brukeren hvis nødvendig
    if (unprocessedItems > 0 && options.confirmUnfinished !== false) {
        if (!confirm(`Advarsel: ${unprocessedItems} varelinjer (${totalUnits - totalProcessedUnits} enheter) er ikke fullstendig prosessert.\n\nEksportere likevel?`)) {
            return; // Brukeren valgte å avbryte
        }
    }
    
    // Utvidet metadata for eksport
    const exportMetadata = {
        ...options,
        exportDate: new Date(),
        exportStatus: {
            totalItems,
            processedItems,
            partiallyProcessedItems,
            unprocessedItems,
            totalProcessedUnits,
            totalUnits,
            percentComplete
        },
        moduleName: moduleType === 'pick' ? 'Plukkliste' : moduleType === 'receive' ? 'Mottaksliste' : 'Returliste'
    };
    
    try {
        // Vis eksportstatus
        showToast(`Eksporterer ${exportMetadata.moduleName.toLowerCase()} (${percentComplete}% ferdig)...`, 'info');
        
        // Håndter ulike eksportformater
        switch(format.toLowerCase()) {
            case 'pdf':
                // Bruk PDF-eksportfunksjonen med metadata
                exportToPDF(items, moduleType, exportMetadata);
                break;
            case 'excel':
                // Excel-eksport (implementeres senere)
                showToast('Excel-eksport er under utvikling og vil være tilgjengelig snart!', 'info');
                break;
            case 'csv':
            case 'json':
            case 'txt':
            case 'html':
                // Bruk den eksisterende eksportfunksjonen for andre formater
                exportWithFormat(items, moduleType, format);
                break;
            default:
                throw new Error(`Ukjent eksportformat: ${format}`);
        }
    } catch (error) {
        console.error('Feil ved eksport:', error);
        showToast('Kunne ikke eksportere listen: ' + error.message, 'error');
    }
}

/**
 * Angrer siste skanning for en modul
 * @param {string} moduleType - Modultype ('pick', 'receive', 'return')
 * @param {Function} updateUICallback - Funksjon for å oppdatere UI etter angring
 */
export function undoLastModuleScan(moduleType, updateUICallback) {
    let lastItemRef, itemsList, processedList;
    
    switch(moduleType) {
        case 'pick':
            lastItemRef = 'lastPickedItem';
            itemsList = 'pickListItems';
            processedList = 'pickedItems';
            break;
        case 'receive':
            lastItemRef = 'lastReceivedItem';
            itemsList = 'receiveListItems';
            processedList = 'receivedItems';
            break;
        case 'return':
            lastItemRef = 'lastReturnedItem';
            itemsList = 'returnListItems';
            processedList = 'returnedItems';
            break;
        default:
            console.error(`Ukjent modultype: ${moduleType}`);
            return;
    }
    
    if (!appState[lastItemRef]) return;
    
    // Finn varen som skal angres
    const item = appState[itemsList].find(item => item.id === appState[lastItemRef].id);
    
    if (item) {
        // Reduser antall basert på modultype
        switch(moduleType) {
            case 'pick':
                if (item.pickedCount > 0) {
                    item.pickedCount--;
                }
                if (item.pickedCount < item.quantity) {
                    item.picked = false;
                    item.pickedAt = null;
                }
                break;
            case 'receive':
                if (item.receivedCount > 0) {
                    item.receivedCount--;
                }
                if (item.receivedCount < item.quantity) {
                    item.received = false;
                    item.receivedAt = null;
                }
                break;
            case 'return':
                if (item.returnedCount > 0) {
                    item.returnedCount--;
                }
                if (item.returnedCount < item.quantity) {
                    item.returned = false;
                    item.returnedAt = null;
                }
                break;
        }
        
        // Fjern fra prosessert liste hvis antall nå er mindre enn totalen
        const countField = moduleType === 'pick' ? 'pickedCount' : 
                           moduleType === 'receive' ? 'receivedCount' : 'returnedCount';
        
        if (item[countField] < item.quantity) {
            const index = appState[processedList].indexOf(item.id);
            if (index !== -1) {
                appState[processedList].splice(index, 1);
            }
        }
    }
    
    // Nullstill sist prosesserte vare
    appState[lastItemRef] = null;
    
    // Oppdater UI
    updateUICallback();
    showToast('Siste skanning angret!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Tømmer en liste for en modul
 * @param {string} moduleType - Modultype ('pick', 'receive', 'return')
 * @param {Function} updateUICallback - Funksjon for å oppdatere UI etter tømming
 */
export function clearModuleList(moduleType, updateUICallback) {
    if (!confirm(`Er du sikker på at du vil tømme ${moduleType === 'pick' ? 'plukk' : moduleType === 'receive' ? 'mottaks' : 'retur'}listen?`)) {
        return;
    }
    
    switch(moduleType) {
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
            appState.returnedItems = [];
            appState.lastReturnedItem = null;
            break;
        default:
            console.error(`Ukjent modultype: ${moduleType}`);
            return;
    }
    
    updateUICallback();
    showToast(`${moduleType === 'pick' ? 'Plukk' : moduleType === 'receive' ? 'Mottaks' : 'Retur'}liste tømt!`, 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}