// quantity.js - Håndtering av antall
import { appState } from '../app.js';
import { saveListsToStorage } from './storage.js';
import { updateReceivingUI } from './receiving.js';
import { showToast } from './utils.js';

// DOM-elementer for antallsmodal
let quantityModalEl;
let quantityModalItemIdEl;
let itemQuantityEl;
let saveQuantityBtnEl;
let cancelQuantityBtnEl;
let closeQuantityModalEl;

/**
 * Initialiserer antallsmodulen
 */
export function initQuantity() {
    // Hent DOM-elementer
    quantityModalEl = document.getElementById('quantityModal');
    quantityModalItemIdEl = document.getElementById('quantityModalItemId');
    itemQuantityEl = document.getElementById('itemQuantity');
    saveQuantityBtnEl = document.getElementById('saveQuantityBtn');
    cancelQuantityBtnEl = document.getElementById('cancelQuantityBtn');
    closeQuantityModalEl = document.getElementById('closeQuantityModal');
    
    // Legg til event listeners
    setupQuantityEventListeners();
}

/**
 * Setter opp event listeners for antallsmodal
 */
function setupQuantityEventListeners() {
    saveQuantityBtnEl.addEventListener('click', function() {
        saveItemQuantity();
    });
    
    cancelQuantityBtnEl.addEventListener('click', function() {
        closeQuantityModal();
    });
    
    closeQuantityModalEl.addEventListener('click', function() {
        closeQuantityModal();
    });
}

/**
 * Åpner antallsmodal for å angi mottatt antall for en vare
 * @param {string} itemId - Varenummer
 */
export function openQuantityModal(itemId) {
    // Sikre at DOM-elementene er hentet
    if (!quantityModalEl) {
        quantityModalEl = document.getElementById('quantityModal');
        quantityModalItemIdEl = document.getElementById('quantityModalItemId');
        itemQuantityEl = document.getElementById('itemQuantity');
        saveQuantityBtnEl = document.getElementById('saveQuantityBtn');
        cancelQuantityBtnEl = document.getElementById('cancelQuantityBtn');
        closeQuantityModalEl = document.getElementById('closeQuantityModal');
        
        // Sett opp event listeners hvis elementene finnes
        if (saveQuantityBtnEl && cancelQuantityBtnEl && closeQuantityModalEl) {
            setupQuantityEventListeners();
        }
    }
    
    // Sjekk om vi fortsatt mangler elementer
    if (!quantityModalEl || !quantityModalItemIdEl || !itemQuantityEl) {
        console.error('Kunne ikke åpne antallsmodal: Manglende DOM-elementer', {
            quantityModalEl,
            quantityModalItemIdEl,
            itemQuantityEl
        });
        return; // Avbryt hvis elementene ikke er funnet
    }
    
    // Finn varen i mottakslisten
    const item = appState.receiveListItems.find(item => item.id === itemId);
    if (!item) {
        console.error(`Kunne ikke finne vare med ID: ${itemId}`);
        return;
    }
    
    // Sett varenummer og nåværende mottatt antall i modalen
    quantityModalItemIdEl.textContent = itemId;
    itemQuantityEl.value = item.receivedCount || 0;
    
    // Oppdater tittel og ledetekst i modalen for tydelig å vise at vi endrer mottatt antall
    const modalHeader = quantityModalEl.querySelector('.modal-header h2');
    if (modalHeader) {
        modalHeader.textContent = 'Angi mottatt antall';
    }
    
    const quantityLabel = quantityModalEl.querySelector('label[for="itemQuantity"]');
    if (quantityLabel) {
        quantityLabel.textContent = `Mottatt antall (av ${item.quantity} totalt):`;
    }
    
    // Sett maks verdi for input-feltet (kan ikke motta flere enn total antall)
    itemQuantityEl.max = item.quantity;
    
    quantityModalEl.style.display = 'block';
}

/**
 * Lukker antallsmodal
 */
function closeQuantityModal() {
    quantityModalEl.style.display = 'none';
}

/**
 * Lagrer mottatt antall for en vare
 */
function saveItemQuantity() {
    const itemId = quantityModalItemIdEl.textContent;
    const newReceivedCount = parseInt(itemQuantityEl.value) || 0;
    
    // Finn varen i mottakslisten
    const item = appState.receiveListItems.find(item => item.id === itemId);
    if (item) {
        // Sjekk om det nye antallet er gyldig
        if (newReceivedCount < 0) {
            showToast('Mottatt antall kan ikke være negativt', 'error');
            return;
        }
        
        // Sjekk om det nye antallet overstiger totalt antall
        if (newReceivedCount > item.quantity) {
            if (confirm(`Du har angitt ${newReceivedCount} mottatte enheter, men totalt antall er ${item.quantity}. Vil du justere totalt antall til ${newReceivedCount}?`)) {
                item.quantity = newReceivedCount;
            } else {
                // Hvis brukeren avbryter, setter vi mottatt antall til totalt antall
                itemQuantityEl.value = item.quantity;
                return;
            }
        }
        
        // Oppdater antall mottatt
        const oldReceivedCount = item.receivedCount || 0;
        item.receivedCount = newReceivedCount;
        
        // Oppdater om varen er fullstendig mottatt
        if (item.receivedCount >= item.quantity) {
            item.received = true;
            item.receivedAt = new Date();
            
            // Legg til i listen over fullstendig mottatte varer hvis den ikke allerede er der
            if (!appState.receivedItems.includes(itemId)) {
                appState.receivedItems.push(itemId);
            }
        } else {
            item.received = false;
            item.receivedAt = null;
            
            // Fjern fra listen over fullstendig mottatte varer hvis den er der
            const index = appState.receivedItems.indexOf(itemId);
            if (index !== -1) {
                appState.receivedItems.splice(index, 1);
            }
        }
        
        // Vis melding til brukeren
        showToast(`Mottatt antall for "${itemId}" endret fra ${oldReceivedCount} til ${newReceivedCount}.`, 'success');
        
        // Lagre endringer
        saveListsToStorage();
        
        // Oppdater UI
        updateReceivingUI();
    }
    
    // Lukk modalen
    closeQuantityModal();
}