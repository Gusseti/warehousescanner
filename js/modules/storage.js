// storage.js - Håndtering av lokallagring
import { appState } from '../app.js';
import { showToast } from './utils.js';

/**
 * Lagrer strekkodeoversikt til localStorage
 */
export function saveBarcodeMapping() {
    try {
        localStorage.setItem('barcodeMapping', JSON.stringify(appState.barcodeMapping));
    } catch (error) {
        console.error('Feil ved lagring av strekkodeoversikt:', error);
        showToast('Kunne ikke lagre strekkodedata.', 'error');
    }
}

/**
 * Laster inn strekkodeoversikt fra localStorage
 */
export function loadBarcodeMappingFromStorage() {
    try {
        const mapping = localStorage.getItem('barcodeMapping');
        if (mapping) {
            appState.barcodeMapping = JSON.parse(mapping);
            
            // Oppdater UI hvis elementet finnes
            const barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
            if (barcodeFileInfoEl) {
                const count = Object.keys(appState.barcodeMapping).length;
                barcodeFileInfoEl.textContent = `Lastet inn: ${count} strekkoder`;
            }
        }
    } catch (error) {
        console.error('Feil ved lasting av strekkodeoversikt:', error);
        appState.barcodeMapping = {};
    }
}

/**
 * Lagrer innstillinger til localStorage
 */
export function saveSettings() {
    try {
        localStorage.setItem('settings', JSON.stringify(appState.settings));
    } catch (error) {
        console.error('Feil ved lagring av innstillinger:', error);
        showToast('Kunne ikke lagre innstillinger.', 'error');
    }
}

/**
 * Laster inn innstillinger fra localStorage
 */
export function loadSettings() {
    try {
        const storedSettings = localStorage.getItem('settings');
        if (storedSettings) {
            appState.settings = JSON.parse(storedSettings);
            
            // Oppdater UI hvis elementene finnes
            const weightUnitEl = document.getElementById('weightUnit');
            const defaultItemWeightEl = document.getElementById('defaultItemWeight');
            
            if (weightUnitEl) {
                weightUnitEl.value = appState.settings.weightUnit;
            }
            
            if (defaultItemWeightEl) {
                defaultItemWeightEl.value = appState.settings.defaultItemWeight;
            }
        }
    } catch (error) {
        console.error('Feil ved lasting av innstillinger:', error);
    }
}

/**
 * Lagrer vektdata til localStorage
 */
export function saveItemWeights() {
    try {
        localStorage.setItem('itemWeights', JSON.stringify(appState.itemWeights));
    } catch (error) {
        console.error('Feil ved lagring av vektdata:', error);
        showToast('Kunne ikke lagre vektdata.', 'error');
    }
}

/**
 * Laster inn vektdata fra localStorage
 */
export function loadItemWeights() {
    try {
        const storedWeights = localStorage.getItem('itemWeights');
        if (storedWeights) {
            appState.itemWeights = JSON.parse(storedWeights);
        }
    } catch (error) {
        console.error('Feil ved lasting av vektdata:', error);
        appState.itemWeights = {};
    }
}

/**
 * Lagrer alle lister til localStorage
 */
export function saveListsToStorage() {
    try {
        localStorage.setItem('pickListItems', JSON.stringify(appState.pickListItems));
        localStorage.setItem('pickedItems', JSON.stringify(appState.pickedItems));
        localStorage.setItem('receiveListItems', JSON.stringify(appState.receiveListItems));
        localStorage.setItem('receivedItems', JSON.stringify(appState.receivedItems));
        localStorage.setItem('returnListItems', JSON.stringify(appState.returnListItems));
    } catch (error) {
        console.error('Feil ved lagring av lister:', error);
        showToast('Kunne ikke lagre listedata.', 'error');
    }
}

/**
 * Laster inn alle lister fra localStorage
 * @returns {boolean} Om listene ble lastet inn
 */
export function loadListsFromStorage() {
    try {
        // Plukkliste
        const storedPickListItems = localStorage.getItem('pickListItems');
        if (storedPickListItems) {
            appState.pickListItems = JSON.parse(storedPickListItems);
        }
        
        const storedPickedItems = localStorage.getItem('pickedItems');
        if (storedPickedItems) {
            appState.pickedItems = JSON.parse(storedPickedItems);
        }
        
        // Mottaksliste
        const storedReceiveListItems = localStorage.getItem('receiveListItems');
        if (storedReceiveListItems) {
            appState.receiveListItems = JSON.parse(storedReceiveListItems);
        }
        
        const storedReceivedItems = localStorage.getItem('receivedItems');
        if (storedReceivedItems) {
            appState.receivedItems = JSON.parse(storedReceivedItems);
        }
        
        // Returliste
        const storedReturnListItems = localStorage.getItem('returnListItems');
        if (storedReturnListItems) {
            appState.returnListItems = JSON.parse(storedReturnListItems);
        }
        
        return true;
    } catch (error) {
        console.error('Feil ved lasting av lister:', error);
        return false;
    }
}

/**
 * Sletter alle lagrede data
 */
export function clearAllStoredData() {
    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('Feil ved sletting av alle data:', error);
        return false;
    }
}