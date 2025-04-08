// weights.js - Håndtering av vekter
import { appState } from '../app.js';
import { saveItemWeights } from './storage.js';
import { updatePickingUI } from './picking.js';
import { updateReceivingUI } from './receiving.js';
import { updateReturnsUI } from './returns.js';

// DOM-elementer for vektmodal
let weightModalEl;
let weightModalItemIdEl;
let itemWeightEl;
let saveWeightBtnEl;
let cancelWeightBtnEl;
let closeWeightModalEl;

/**
 * Initialiserer vektmodulen
 */
export function initWeights() {
    // Hent DOM-elementer
    weightModalEl = document.getElementById('weightModal');
    weightModalItemIdEl = document.getElementById('weightModalItemId');
    itemWeightEl = document.getElementById('itemWeight');
    saveWeightBtnEl = document.getElementById('saveWeightBtn');
    cancelWeightBtnEl = document.getElementById('cancelWeightBtn');
    closeWeightModalEl = document.getElementById('closeWeightModal');
    
    // Legg til event listeners
    setupWeightEventListeners();
}

/**
 * Setter opp event listeners for vektmodal
 */
function setupWeightEventListeners() {
    saveWeightBtnEl.addEventListener('click', function() {
        saveItemWeight();
    });
    
    cancelWeightBtnEl.addEventListener('click', function() {
        closeWeightModal();
    });
    
    closeWeightModalEl.addEventListener('click', function() {
        closeWeightModal();
    });
}

/**
 * Åpner vektmodal for å angi vekt for en vare
 * @param {string} itemId - Varenummer
 */
export function openWeightModal(itemId) {
    weightModalItemIdEl.textContent = itemId;
    itemWeightEl.value = appState.itemWeights[itemId] || appState.settings.defaultItemWeight;
    weightModalEl.style.display = 'block';
}

/**
 * Lukker vektmodal
 */
function closeWeightModal() {
    weightModalEl.style.display = 'none';
}

/**
 * Lagrer vekt for en vare
 */
function saveItemWeight() {
    const itemId = weightModalItemIdEl.textContent;
    const weight = parseFloat(itemWeightEl.value) || appState.settings.defaultItemWeight;
    
    // Lagre vekten
    appState.itemWeights[itemId] = weight;
    saveItemWeights();
    
    // Oppdater vekter i alle moduler
    updateAllWeights();
    
    // Lukk modalen
    closeWeightModal();
}

/**
 * Oppdaterer alle vekter i alle moduler
 */
export function updateAllWeights() {
    // Oppdater vekter for varelinjer i plukk, mottak og retur
    updateItemWeights();
    
    // Oppdater UI basert på gjeldende modul
    if (appState.currentModule === 'picking') {
        updatePickingUI();
    } else if (appState.currentModule === 'receiving') {
        updateReceivingUI();
    } else if (appState.currentModule === 'returns') {
        updateReturnsUI();
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