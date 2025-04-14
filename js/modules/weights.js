// weights.js - Refaktorert modul for vekthåndtering
import { appState } from '../app.js';
import { saveItemWeights } from './storage.js';
import { showToast } from './utils.js';

// DOM-elementer for vektmodal
const elements = {
    modal: null,
    itemIdSpan: null,
    weightInput: null,
    saveButton: null,
    cancelButton: null,
    closeButton: null
};

// Callback som kalles etter vektoppdatering
let onWeightUpdateCallback = null;

/**
 * Initialiserer vektmodulen
 * @param {Function} callback - Callback som kalles når vekter oppdateres
 */
export function initWeights(callback) {
    // Hent DOM-elementer
    elements.modal = document.getElementById('weightModal');
    elements.itemIdSpan = document.getElementById('weightModalItemId');
    elements.weightInput = document.getElementById('itemWeight');
    elements.saveButton = document.getElementById('saveWeightBtn');
    elements.cancelButton = document.getElementById('cancelWeightBtn');
    elements.closeButton = document.getElementById('closeWeightModal');
    
    // Lagre callback
    onWeightUpdateCallback = callback;
    
    // Legg til event listeners
    setupWeightEventListeners();
}

/**
 * Setter opp event listeners for vektmodal
 */
function setupWeightEventListeners() {
    if (!elements.modal) {
        console.error('Vektmodal ikke funnet i DOM');
        return;
    }
    
    elements.saveButton.addEventListener('click', saveItemWeight);
    elements.cancelButton.addEventListener('click', closeWeightModal);
    elements.closeButton.addEventListener('click', closeWeightModal);
    
    // Legg til event for å lagre ved Enter
    elements.weightInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveItemWeight();
        }
    });
}

/**
 * Åpner vektmodal for å angi vekt for en vare
 * @param {string} itemId - Varenummer
 */
export function openWeightModal(itemId) {
    if (!elements.modal) {
        console.error('Vektmodal ikke funnet i DOM');
        return;
    }
    
    elements.itemIdSpan.textContent = itemId;
    elements.weightInput.value = appState.itemWeights[itemId] || appState.settings.defaultItemWeight;
    elements.modal.style.display = 'block';
    
    // Sett fokus på input
    setTimeout(() => {
        elements.weightInput.focus();
        elements.weightInput.select();
    }, 100);
}

/**
 * Lukker vektmodal
 */
export function closeWeightModal() {
    if (!elements.modal) return;
    elements.modal.style.display = 'none';
}

/**
 * Lagrer vekt for en vare
 */
function saveItemWeight() {
    const itemId = elements.itemIdSpan.textContent;
    const weight = parseFloat(elements.weightInput.value) || appState.settings.defaultItemWeight;
    
    // Valider verdien - sørg for at den er et positivt tall
    if (weight <= 0) {
        showToast('Vekt må være et positivt tall.', 'error');
        return;
    }
    
    // Lagre vekten
    appState.itemWeights[itemId] = weight;
    saveItemWeights();
    
    // Oppdater vekter i alle moduler
    updateAllWeights();
    
    // Lukk modalen
    closeWeightModal();
    
    // Vis bekreftelse
    showToast(`Vekt for "${itemId}" satt til ${weight} ${appState.settings.weightUnit}`, 'success');
}

/**
 * Oppdaterer alle vekter i alle moduler
 */
export function updateAllWeights() {
    // Oppdater vekter for varelinjer i plukk, mottak og retur
    updateItemWeights();
    
    // Kall callback hvis den er registrert
    if (typeof onWeightUpdateCallback === 'function') {
        onWeightUpdateCallback();
    }
}

/**
 * Oppdaterer vekter for alle varer i alle lister
 */
function updateItemWeights() {
    // Oppdater plukklisten
    appState.pickListItems.forEach(item => {
        item.weight = appState.itemWeights[item.id] || appState.settings.defaultItemWeight;
    });
    
    // Oppdater mottakslisten
    appState.receiveListItems.forEach(item => {
        item.weight = appState.itemWeights[item.id] || appState.settings.defaultItemWeight;
    });
    
    // Oppdater returlisten
    appState.returnListItems.forEach(item => {
        item.weight = appState.itemWeights[item.id] || appState.settings.defaultItemWeight;
    });
}

/**
 * Beregner totalvekt for en liste
 * @param {Array} items - Liste med varer
 * @param {string} countProperty - Navn på property som inneholder antall (f.eks. 'pickedCount')
 * @returns {number} Total vekt i kg
 */
export function calculateTotalWeight(items, countProperty = null) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return 0;
    }
    
    return items.reduce((total, item) => {
        const weight = parseFloat(item.weight) || appState.settings.defaultItemWeight;
        
        if (countProperty && item[countProperty] !== undefined) {
            // Bruk spesifisert property (f.eks. pickedCount eller receivedCount)
            return total + (weight * item[countProperty]);
        } else if (item.quantity !== undefined) {
            // Ellers bruk quantity
            return total + (weight * item.quantity);
        } else {
            // Fallback til 1 hvis ingen av dem finnes
            return total + weight;
        }
    }, 0).toFixed(2);
}

/**
 * Eksporterer vektdata til JSON
 * @returns {Blob} JSON blob med vektdata
 */
export function exportWeightData() {
    const data = JSON.stringify(appState.itemWeights, null, 2);
    return new Blob([data], { type: 'application/json' });
}

/**
 * Importerer vektdata fra JSON
 * @param {string} jsonData - JSON-strengen med vektdata
 * @returns {boolean} Om importen var vellykket
 */
export function importWeightData(jsonData) {
    try {
        const data = JSON.parse(jsonData);
        
        if (typeof data !== 'object' || data === null) {
            throw new Error('Ugyldig dataformat. Forventet objekt.');
        }
        
        // Merg med eksisterende vekter
        appState.itemWeights = { ...appState.itemWeights, ...data };
        
        // Lagre til localStorage
        saveItemWeights();
        
        // Oppdater vekter i alle moduler
        updateAllWeights();
        
        return true;
    } catch (error) {
        console.error('Feil ved import av vektdata:', error);
        showToast('Kunne ikke importere vektdata. Ugyldig format.', 'error');
        return false;
    }
}

/**
 * Oppdaterer vektformat basert på valgt enhet
 * @param {string} unit - Enheten (kg, g)
 */
export function updateWeightUnit(unit) {
    if (unit === appState.settings.weightUnit) {
        return; // Ingen endring
    }
    
    const conversionFactor = unit === 'g' ? 1000 : 0.001;
    
    // Konverter alle vekter
    for (const itemId in appState.itemWeights) {
        const currentWeight = appState.itemWeights[itemId];
        appState.itemWeights[itemId] = currentWeight * conversionFactor;
    }
    
    // Oppdater standardvekt
    appState.settings.defaultItemWeight = appState.settings.defaultItemWeight * conversionFactor;
    
    // Oppdater vektenhet
    appState.settings.weightUnit = unit;
    
    // Oppdater vekter i alle moduler
    updateAllWeights();
    
    showToast(`Vektenhet endret til ${unit}`, 'success');
}