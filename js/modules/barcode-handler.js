// barcode-handler.js - Forbedret strekkodehåndtering

import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage, saveBarcodeMapping, findSimilarBarcodes } from './storage.js';
import { updatePickingUI } from './picking.js';
import { updateReceivingUI } from './receiving.js';
import { updateReturnsUI } from './returns.js';

// Modal elementer for uregistrerte strekkoder
let unknownBarcodeModalEl;
let unknownBarcodeValueEl;
let itemIdInputEl;
let itemDescInputEl;
let itemQuantityInputEl;
let saveBarcodeCheckboxEl;
let similarBarcodesListEl;
let saveBtnEl;
let cancelBtnEl;
let modalCloseEl;

// Midlertidig lagring for skannet strekkode
let lastScannedBarcode = null;
let currentScanTarget = null; // 'pick', 'receive', eller 'return'

/**
 * Initialiserer barcode handler
 */
export function initBarcodeHandler() {
    // Finn eller opprett modal for uregistrerte strekkoder
    unknownBarcodeModalEl = document.getElementById('unknownBarcodeModal');
    
    // Hvis modal ikke finnes, lag den
    if (!unknownBarcodeModalEl) {
        createUnknownBarcodeModal();
    }
    
    // Finn elementer
    unknownBarcodeValueEl = document.getElementById('unknownBarcodeValue');
    itemIdInputEl = document.getElementById('itemIdInput');
    itemDescInputEl = document.getElementById('itemDescInput');
    itemQuantityInputEl = document.getElementById('itemQuantityInput');
    saveBarcodeCheckboxEl = document.getElementById('saveBarcodeCheckbox');
    similarBarcodesListEl = document.getElementById('similarBarcodesList');
    saveBtnEl = document.getElementById('saveUnknownBarcodeBtn');
    cancelBtnEl = document.getElementById('cancelUnknownBarcodeBtn');
    modalCloseEl = document.getElementById('closeUnknownBarcodeModal');
    
    // Legg til event listeners
    setupBarcodeModalEvents();
}

// I barcode-handler.js, erstatt createUnknownBarcodeModal og setupBarcodeModalEvents:

function createUnknownBarcodeModal() {
    // Sjekk om modal allerede eksisterer
    let existingModal = document.getElementById('unknownBarcodeModal');
    if (existingModal) {
        document.body.removeChild(existingModal); // Fjern eksisterende modal
    }
    
    const modalHTML = `
<div id="unknownBarcodeModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2 class="modal-title">Ukjent strekkode</h2>
            <span class="close" id="closeUnknownBarcodeModal">&times;</span>
        </div>
        <div class="modal-body">
            <p>Strekkoden <strong><span id="unknownBarcodeValue"></span></strong> ble ikke funnet i systemet.</p>
            
            <div id="similarBarcodesCont" style="margin-bottom: 15px; display: none;">
                <h3>Lignende strekkoder:</h3>
                <ul id="similarBarcodesList" style="max-height: 150px; overflow-y: auto;"></ul>
            </div>
            
            <div class="form-group">
                <label for="itemIdInput">Varenummer:</label>
                <input type="text" id="itemIdInput" class="form-control" placeholder="Angi varenummer">
            </div>
            
            <div class="form-group">
                <label for="itemDescInput">Beskrivelse:</label>
                <input type="text" id="itemDescInput" class="form-control" placeholder="Angi beskrivelse">
            </div>
            
            <div class="form-group">
                <label for="itemQuantityInput">Antall:</label>
                <input type="number" id="itemQuantityInput" class="form-control" value="1" min="1">
            </div>
            
            <div class="form-group">
                <input type="checkbox" id="saveBarcodeCheckbox" checked>
                <label for="saveBarcodeCheckbox">Lagre strekkode for fremtidig bruk</label>
            </div>
        </div>
        <div class="modal-footer">
            <button id="saveUnknownBarcodeBtn" class="btn btn-success">Legg til</button>
            <button id="cancelUnknownBarcodeBtn" class="btn btn-danger">Avbryt</button>
        </div>
    </div>
</div>`;

    // Legg til modal i DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);
    
    // Oppdater referanser
    unknownBarcodeModalEl = document.getElementById('unknownBarcodeModal');
    unknownBarcodeValueEl = document.getElementById('unknownBarcodeValue');
    itemIdInputEl = document.getElementById('itemIdInput');
    itemDescInputEl = document.getElementById('itemDescInput');
    itemQuantityInputEl = document.getElementById('itemQuantityInput');
    saveBarcodeCheckboxEl = document.getElementById('saveBarcodeCheckbox');
    similarBarcodesListEl = document.getElementById('similarBarcodesList');
    saveBtnEl = document.getElementById('saveUnknownBarcodeBtn');
    cancelBtnEl = document.getElementById('cancelUnknownBarcodeBtn');
    modalCloseEl = document.getElementById('closeUnknownBarcodeModal');
    
    // Sett opp event listeners umiddelbart
    setupBarcodeModalEvents();
}

function setupBarcodeModalEvents() {
    console.log("Setting up barcode modal events");
    
    // Sjekk at elementene finnes
    modalCloseEl = document.getElementById('closeUnknownBarcodeModal');
    cancelBtnEl = document.getElementById('cancelUnknownBarcodeBtn');
    saveBtnEl = document.getElementById('saveUnknownBarcodeBtn');
    similarBarcodesListEl = document.getElementById('similarBarcodesList');
    
    // Lukk modal knapper
    if (modalCloseEl) {
        console.log("Setting up close button event");
        modalCloseEl.addEventListener('click', closeUnknownBarcodeModal);
    } else {
        console.error("Close button element not found");
    }
    
    if (cancelBtnEl) {
        console.log("Setting up cancel button event");
        cancelBtnEl.addEventListener('click', closeUnknownBarcodeModal);
    } else {
        console.error("Cancel button element not found");
    }
    
    // Lagre ukjent strekkode
    if (saveBtnEl) {
        console.log("Setting up save button event");
        saveBtnEl.addEventListener('click', () => {
            console.log("Save button clicked");
            
            const itemId = itemIdInputEl.value.trim();
            const itemDesc = itemDescInputEl.value.trim();
            const quantity = parseInt(itemQuantityInputEl.value) || 1;
            
            if (!itemId) {
                showToast('Varenummer må fylles ut!', 'error');
                return;
            }
            
            // Lagre strekkode-mapping hvis valgt
            if (saveBarcodeCheckboxEl.checked && lastScannedBarcode) {
                appState.barcodeMapping[lastScannedBarcode] = itemId;
                saveBarcodeMapping();
            }
            
            // Legg til varen i riktig liste basert på context
            if (currentScanTarget) {
                addItemToTargetList(itemId, itemDesc, quantity);
            }
            
            closeUnknownBarcodeModal();
        });
    } else {
        console.error("Save button element not found");
    }
    
    // Håndtere klikk på lignende strekkodeforslag
    if (similarBarcodesListEl) {
        console.log("Setting up similar barcodes list event");
        
        // Fjern eksisterende event-listeners
        const clonedList = similarBarcodesListEl.cloneNode(true);
        similarBarcodesListEl.parentNode.replaceChild(clonedList, similarBarcodesListEl);
        similarBarcodesListEl = clonedList;
        
        similarBarcodesListEl.addEventListener('click', (e) => {
            console.log("Similar barcode list clicked", e.target);
            
            if (e.target.classList.contains('similar-barcode-use')) {
                const barcode = e.target.dataset.barcode;
                const itemId = e.target.dataset.itemId;
                
                console.log("Using similar barcode:", barcode, "->", itemId);
                
                // Fyll inn data
                if (itemIdInputEl) {
                    itemIdInputEl.value = itemId;
                    
                    // Finn beskrivelse hvis tilgjengelig fra pick eller receive lister
                    let description = '';
                    
                    // Sjekk først i plukklisten
                    const pickItem = appState.pickListItems.find(item => item.id === itemId);
                    if (pickItem) {
                        description = pickItem.description;
                    } else {
                        // Sjekk så i mottakslisten
                        const receiveItem = appState.receiveListItems.find(item => item.id === itemId);
                        if (receiveItem) {
                            description = receiveItem.description;
                        }
                    }
                    
                    // Sett beskrivelse hvis funnet
                    if (description && itemDescInputEl) {
                        itemDescInputEl.value = description;
                    }
                }
            }
        });
    } else {
        console.error("Similar barcodes list element not found");
    }
}

/**
 * Legger til en vare i riktig liste basert på nåværende skannekontekst
 * @param {string} itemId - Varenummer
 * @param {string} itemDesc - Beskrivelse
 * @param {number} quantity - Antall
 */
function addItemToTargetList(itemId, itemDesc, quantity) {
    const description = itemDesc || 'Ukjent vare';
    const weight = appState.itemWeights[itemId] || appState.settings.defaultItemWeight;
    
    switch (currentScanTarget) {
        case 'pick':
            // For plukkliste sjekker vi om varen allerede finnes
            const pickItem = appState.pickListItems.find(item => item.id === itemId);
            
            if (pickItem) {
                // Oppdater telleren for varen
                if (pickItem.pickedCount === undefined) {
                    pickItem.pickedCount = 0;
                }
                
                pickItem.pickedCount++;
                
                // Sjekk om alle er plukket
                if (pickItem.pickedCount >= pickItem.quantity) {
                    pickItem.picked = true;
                    pickItem.pickedAt = new Date();
                    
                    if (!appState.pickedItems.includes(itemId)) {
                        appState.pickedItems.push(itemId);
                    }
                }
                
                // Lagre sist plukket vare
                appState.lastPickedItem = {
                    id: itemId,
                    timestamp: new Date()
                };
                
                showToast(`Vare "${itemId}" registrert! ${pickItem.quantity - pickItem.pickedCount} av ${pickItem.quantity} gjenstår.`, 'info');
            } else {
                // Legg til ny vare i listen
                const newItem = {
                    id: itemId,
                    description: description,
                    quantity: quantity,
                    weight: weight,
                    picked: false,
                    pickedAt: null,
                    pickedCount: 1
                };
                
                // Hvis antallet matcher, merk som ferdig plukket
                if (newItem.pickedCount >= newItem.quantity) {
                    newItem.picked = true;
                    newItem.pickedAt = new Date();
                    
                    if (!appState.pickedItems.includes(itemId)) {
                        appState.pickedItems.push(itemId);
                    }
                }
                
                appState.pickListItems.push(newItem);
                
                // Lagre sist plukket vare
                appState.lastPickedItem = {
                    id: itemId,
                    timestamp: new Date()
                };
                
                showToast(`Ny vare "${itemId}" lagt til i plukklisten!`, 'success');
            }
            
            // Oppdater UI
            updatePickingUI();
            break;
            
        case 'receive':
            // For mottak sjekker vi om varen allerede finnes
            const receiveItem = appState.receiveListItems.find(item => item.id === itemId);
            
            if (receiveItem) {
                // Oppdater telleren for varen
                if (receiveItem.receivedCount === undefined) {
                    receiveItem.receivedCount = 0;
                }
                
                receiveItem.receivedCount++;
                
                // Sjekk om alle er mottatt
                if (receiveItem.receivedCount >= receiveItem.quantity) {
                    receiveItem.received = true;
                    receiveItem.receivedAt = new Date();
                    
                    if (!appState.receivedItems.includes(itemId)) {
                        appState.receivedItems.push(itemId);
                    }
                }
                
                // Lagre sist mottatt vare
                appState.lastReceivedItem = {
                    id: itemId,
                    timestamp: new Date()
                };
                
                showToast(`Vare "${itemId}" registrert! ${receiveItem.quantity - receiveItem.receivedCount} av ${receiveItem.quantity} gjenstår.`, 'info');
            } else {
                // Legg til ny vare i listen
                const newItem = {
                    id: itemId,
                    description: description,
                    quantity: quantity,
                    weight: weight,
                    received: false,
                    receivedAt: null,
                    receivedCount: 1
                };
                
                // Hvis antallet matcher, merk som ferdig mottatt
                if (newItem.receivedCount >= newItem.quantity) {
                    newItem.received = true;
                    newItem.receivedAt = new Date();
                    
                    if (!appState.receivedItems.includes(itemId)) {
                        appState.receivedItems.push(itemId);
                    }
                }
                
                appState.receiveListItems.push(newItem);
                
                // Lagre sist mottatt vare
                appState.lastReceivedItem = {
                    id: itemId,
                    timestamp: new Date()
                };
                
                showToast(`Ny vare "${itemId}" lagt til i mottakslisten!`, 'success');
            }
            
            // Oppdater UI
            updateReceivingUI();
            break;
            
        case 'return':
            // For retur sjekker vi om varen allerede finnes
            const existingReturnItemIndex = appState.returnListItems.findIndex(item => item.id === itemId);
            
            if (existingReturnItemIndex !== -1) {
                // Øk antallet hvis varen allerede er i listen
                appState.returnListItems[existingReturnItemIndex].quantity += quantity;
                showToast(`Vare "${itemId}" antall økt til ${appState.returnListItems[existingReturnItemIndex].quantity}!`, 'success');
            } else {
                // Legg til ny vare i returlisten
                const newItem = {
                    id: itemId,
                    description: description,
                    quantity: quantity,
                    weight: weight,
                    returnedAt: new Date()
                };
                
                appState.returnListItems.push(newItem);
                showToast(`Vare "${itemId}" lagt til som retur!`, 'success');
            }
            
            // Oppdater UI
            updateReturnsUI();
            break;
    }
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Hovedfunksjon for håndtering av skannede strekkoder
 * @param {string} barcode - Skannet strekkode
 * @param {string} target - Målmodul ('pick', 'receive', eller 'return')
 * @param {number} quantity - Antall (valgfritt, brukes for retur)
 * @returns {boolean} Om strekkoden ble håndtert
 */
export function handleScannedBarcode(barcode, target, quantity = 1) {
    if (!barcode) return false;
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
        
        // Håndter basert på target
        switch (target) {
            case 'pick':
                // Finn varen i listen
                const pickItem = appState.pickListItems.find(item => item.id === itemId);
                
                if (!pickItem) {
                    // Ukjent vare - blink rødt og vis feilmelding
                    blinkBackground('red');
                    showToast(`Vare "${itemId}" finnes ikke i plukklisten!`, 'error');
                    playErrorSound();
                    return true;
                }
                
                // Sjekk om varen allerede er ferdig plukket
                if (pickItem.pickedCount >= pickItem.quantity) {
                    blinkBackground('orange');
                    showToast(`Alle ${pickItem.quantity} enheter av "${itemId}" er allerede plukket!`, 'warning');
                    return true;
                }
                
                return false; // La vanlig håndtering ta over
                
            case 'receive':
                // For mottak er det ok å legge til nye varer automatisk
                return false;
                
            case 'return':
                // VIKTIG: For retur er det ALLTID ok å legge til nye varer
                // Vi skal ikke validere om varenummeret finnes i plukklisten her
                return false;
        }
    } else {
        // For retur og mottak er det ok å bruke strekkoden direkte som varenummer
        if (target === 'return' || target === 'receive') {
            return false;
        }
        
        // For plukk må strekkoden finnes i mappingen eller i plukklisten
        if (target === 'pick') {
            // Finn varen direkte i plukklisten (i tilfelle strekkoden er identisk med varenummer)
            const pickItem = appState.pickListItems.find(item => item.id === barcode);
            if (!pickItem) {
                // Strekkode ikke funnet i mapping eller plukkliste - blink rødt og vis feilmelding
                blinkBackground('red');
                showToast(`Ukjent strekkode: ${barcode}`, 'error');
                playErrorSound();
                return true;
            }
            // Strekkoden er identisk med et varenummer i plukklisten, la vanlig håndtering ta over
            return false;
        }
        
        // Strekkode ikke funnet i mapping - blink rødt og vis feilmelding
        blinkBackground('red');
        showToast(`Ukjent strekkode: ${barcode}`, 'error');
        playErrorSound();
        return true;
    }
    
    return false;
}

/**
 * Får bakgrunnen til å blinke i en bestemt farge
 * @param {string} color - Farge å blinke (f.eks. 'red', 'green')
 */
function blinkBackground(color) {
    // Legg til et overlay-element hvis det ikke allerede finnes
    let overlay = document.getElementById('blinkOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'blinkOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.zIndex = '9999';
        overlay.style.pointerEvents = 'none'; // Ikke blokker klikk
        overlay.style.transition = 'background-color 0.3s';
        document.body.appendChild(overlay);
    }
    
    // Sett farge med litt gjennomsiktighet
    overlay.style.backgroundColor = color === 'red' ? 'rgba(255, 0, 0, 0.3)' : 
                                   color === 'green' ? 'rgba(0, 255, 0, 0.3)' : 
                                   color === 'orange' ? 'rgba(255, 165, 0, 0.3)' : 
                                   'rgba(0, 0, 0, 0.2)';
    
    // Fjern etter kort tid
    setTimeout(() => {
        overlay.style.backgroundColor = 'transparent';
    }, 500);
}

/**
 * Spiller en lyd for å gi tilbakemelding ved feil
 */
function playErrorSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 220; // Lavere frekvens for feilmeldinger
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        // Spill en "ned" lyd for å indikere feil
        oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.2);
        
        setTimeout(() => {
            oscillator.stop();
        }, 300);
    } catch (error) {
        // Fallback til å vibrere enheten hvis tilgjengelig
        try {
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Mønster for feil
            }
        } catch (e) {
            // Ignorer feil her
        }
    }
}

/**
 * Viser modal for ukjent strekkode
 * @param {string} barcode - Skannet strekkode
 * @param {string} itemId - Foreslått varenummer (som oftest samme som strekkode)
 * @param {string} target - Målmodul ('pick', 'receive', eller 'return')
 * @param {string} message - Melding å vise
 * @param {number} quantity - Antall (valgfritt)
 */
// I barcode-handler.js, modifiser showUnknownItemModal-funksjonen for å sjekke om elementene finnes før du forsøker å bruke dem
function showUnknownItemModal(barcode, itemId, target, message, quantity = 1) {
    // Sjekk om modalen finnes
    let unknownBarcodeModalEl = document.getElementById('unknownBarcodeModal');
    
    if (!unknownBarcodeModalEl) {
        createUnknownBarcodeModal();
        setupBarcodeModalEvents();
        unknownBarcodeModalEl = document.getElementById('unknownBarcodeModal');
    }
    
    // Få referanser til andre elementer
    const unknownBarcodeValueEl = document.getElementById('unknownBarcodeValue');
    const itemIdInputEl = document.getElementById('itemIdInput');
    const itemDescInputEl = document.getElementById('itemDescInput');
    const itemQuantityInputEl = document.getElementById('itemQuantityInput');
    const similarBarcodesListEl = document.getElementById('similarBarcodesList');
    const similarBarcodesCont = document.getElementById('similarBarcodesCont');
    
    // Sjekk at alle elementer finnes før vi forsøker å bruke dem
    if (unknownBarcodeValueEl) {
        unknownBarcodeValueEl.textContent = barcode;
    }
    
    if (itemIdInputEl) {
        // Sett foreslått varenummer (men ikke samme som strekkoden)
        if (itemId === barcode) {
            itemIdInputEl.value = ''; // La brukeren sette dette
        } else {
            itemIdInputEl.value = itemId;
        }
    }
    
    // Reset beskrivelse
    if (itemDescInputEl) {
        itemDescInputEl.value = '';
    }
    
    // Sett antall
    if (itemQuantityInputEl) {
        itemQuantityInputEl.value = quantity;
    }
    
    // Finn og vis lignende strekkoder
    const similarBarcodes = findSimilarBarcodes ? findSimilarBarcodes(barcode, 0.7) : [];
    
    if (similarBarcodesListEl && similarBarcodesCont) {
        if (similarBarcodes.length > 0) {
            similarBarcodesCont.style.display = 'block';
            similarBarcodesListEl.innerHTML = '';
            
            similarBarcodes.forEach(item => {
                const li = document.createElement('li');
                li.className = 'similar-barcode-item';
                li.style.margin = '5px 0';
                li.style.padding = '5px';
                li.style.border = '1px solid #ddd';
                li.style.borderRadius = '4px';
                
                const useBtn = document.createElement('button');
                useBtn.className = 'btn btn-sm btn-primary similar-barcode-use';
                useBtn.textContent = 'Bruk';
                useBtn.dataset.barcode = item.barcode;
                useBtn.dataset.itemId = item.itemId;
                useBtn.style.marginLeft = '10px';
                
                li.innerHTML = `<span>${item.barcode} -> ${item.itemId} (${Math.round(item.similarity * 100)}% match)</span>`;
                li.appendChild(useBtn);
                
                similarBarcodesListEl.appendChild(li);
            });
        } else {
            similarBarcodesCont.style.display = 'none';
        }
    }
    
    // Vis modalen
    if (unknownBarcodeModalEl) {
        unknownBarcodeModalEl.style.display = 'block';
    } else {
        console.error('Kunne ikke vise modal for ukjent strekkode - element ikke funnet');
    }
}

/**
 * Lukker modal for ukjent strekkode
 */
function closeUnknownBarcodeModal() {
    unknownBarcodeModalEl.style.display = 'none';
    
    // Reset data
    lastScannedBarcode = null;
    currentScanTarget = null;
}