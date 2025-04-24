// returns.js - Funksjonalitet for retur-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, connectToBluetoothScanner } from './scanner.js';
import { exportList, exportWithFormat, exportToPDF } from './import-export.js';
import { openWeightModal } from './weights.js';
import { handleScannedBarcode } from './barcode-handler.js';

// DOM elementer - Retur
let connectScannerReturnEl;
let cameraScannerReturnEl;
let returnListEl;
let returnManualScanEl;
let returnQuantityEl;
let returnManualScanBtnEl;
let returnExportBtnEl;
let clearReturnListEl;
let totalReturnWeightEl;
let cameraScannerReturnContainerEl;
let videoReturnScannerEl;
let canvasReturnScannerEl;
let scannerReturnOverlayEl;
let closeReturnScannerEl;
let switchCameraReturnEl;
let returnItemConditionEl; // Ny referanse til tilstandsvelgeren

/**
 * Globale variabler for tilstandsmodalen
 */
let conditionModalEl;
let closeConditionModalEl;
let itemConditionEl;
let saveConditionBtnEl;
let cancelConditionBtnEl;
let conditionModalItemIdEl;
let currentEditItemIndex = -1; // Holder styr på hvilket element som redigeres

/**
 * Initialiserer retur-modulen
 */
export function initReturns() {
    console.log("Initialiserer retur-modul");
    
    // Hent DOM-elementer
    connectScannerReturnEl = document.getElementById('connectScannerReturn');
    cameraScannerReturnEl = document.getElementById('cameraScannerReturn');
    returnListEl = document.getElementById('returnList');
    returnManualScanEl = document.getElementById('returnManualScan');
    returnQuantityEl = document.getElementById('returnQuantity');
    returnManualScanBtnEl = document.getElementById('returnManualScanBtn');
    returnExportBtnEl = document.getElementById('returnExportBtn');
    clearReturnListEl = document.getElementById('clearReturnList');
    totalReturnWeightEl = document.getElementById('totalReturnWeight');
    cameraScannerReturnContainerEl = document.getElementById('cameraScannerReturnContainer');
    videoReturnScannerEl = document.getElementById('videoReturnScanner');
    canvasReturnScannerEl = document.getElementById('canvasReturnScanner');
    scannerReturnOverlayEl = document.getElementById('scannerReturnOverlay');
    closeReturnScannerEl = document.getElementById('closeReturnScanner');
    switchCameraReturnEl = document.getElementById('switchCameraReturn');
    returnItemConditionEl = document.getElementById('returnItemCondition'); // Ny: Hent tilstandsvelgeren
    
    // Hent referanser til tilstandsmodalen
    conditionModalEl = document.getElementById('conditionModal');
    closeConditionModalEl = document.getElementById('closeConditionModal');
    itemConditionEl = document.getElementById('itemCondition');
    saveConditionBtnEl = document.getElementById('saveConditionBtn');
    cancelConditionBtnEl = document.getElementById('cancelConditionBtn');
    conditionModalItemIdEl = document.getElementById('conditionModalItemId');
    
    // VIKTIG FIX: Gjøre handleReturnScan tilgjengelig globalt
    // Dette sikrer at funksjonen alltid er tilgjengelig for skanneren
    if (typeof window.handleReturnScan !== 'function') {
        window.handleReturnScan = handleReturnScan;
        console.log("Registrerte window.handleReturnScan");
    }
    
    // Initialiser kameraskanneren for retur med modulspesifikk callback
    initCameraScanner(
        videoReturnScannerEl, 
        canvasReturnScannerEl, 
        scannerReturnOverlayEl, 
        handleReturnScan,
        updateScannerStatus,
        'return'  // Nytt parameter: modulnavn
    );
    
    // Legg til event listeners
    setupReturnsEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReturnsUI();
    
    console.log("Retur-modul initialisert");
}

/**
 * Setter opp event listeners for retur-modulen
 */
function setupReturnsEventListeners() {
    connectScannerReturnEl.addEventListener('click', function() {
        connectToBluetoothReturnScanner();
    });
    
    cameraScannerReturnEl.addEventListener('click', function() {
        startReturnCameraScanning();
    });
    
    closeReturnScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerReturnContainerEl.style.display = 'none';
    });
    
    returnManualScanBtnEl.addEventListener('click', function() {
        handleReturnScan(returnManualScanEl.value, parseInt(returnQuantityEl.value) || 1);
    });
    
    returnManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleReturnScan(returnManualScanEl.value, parseInt(returnQuantityEl.value) || 1);
        }
    });
    
    // Hovedeksportknapp (PDF som standard)
    returnExportBtnEl.addEventListener('click', function() {
        exportReturnList('pdf');
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#returnsModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportReturnList(format);
        });
    });
    
    clearReturnListEl.addEventListener('click', function() {
        clearReturnList();
    });
    
    // Tilstandsmodal event listeners
    if (closeConditionModalEl) {
        closeConditionModalEl.addEventListener('click', closeConditionModal);
    }
    
    if (saveConditionBtnEl) {
        saveConditionBtnEl.addEventListener('click', saveCondition);
    }
    
    if (cancelConditionBtnEl) {
        cancelConditionBtnEl.addEventListener('click', closeConditionModal);
    }
}

/**
 * Oppdaterer UI for retur-modulen
 */
export function updateReturnsUI() {
    // Sikre at vi har en referanse til tabellen
    if (!returnListEl) {
        console.error('Tabellreferanse for retur mangler');
        return;
    }
    
    // Hent tbody-elementet
    const tbody = returnListEl.querySelector('tbody');
    if (!tbody) {
        console.error('Tbody for retur ikke funnet');
        return;
    }
    
    // Tøm tabellen
    tbody.innerHTML = '';
    
    // Beregn total vekt
    let totalWeight = 0;
    
    // Prosesser hver vare
    appState.returnListItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.classList.add('returned');
        
        // Fargekoding basert på tilstand
        if (item.condition) {
            if (item.condition === 'uåpnet') {
                tr.classList.add('item-unopened');
            } else if (item.condition === 'åpnet') {
                tr.classList.add('item-opened');
            } else if (item.condition === 'skadet') {
                tr.classList.add('item-damaged');
            }
        }
        
        // Legg til vekt
        totalWeight += item.quantity * (item.weight || 0);
        
        // Beregn totalvekt for denne spesifikke varen
        const itemTotalWeight = (item.weight || 0) * item.quantity;
        
        // Vis tilstand i tabellen med en klikkbar lenke
        const conditionText = item.condition || 'uåpnet';
        
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td class="condition-cell" data-index="${index}">${conditionText} <i class="fas fa-edit" style="font-size: 0.8em; margin-left: 5px; color: #777;"></i></td>
            <td>${itemTotalWeight.toFixed(2)} ${appState.settings.weightUnit}</td>
            <td>
                <button class="btn btn-danger remove-return-item" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        // Legg til hendelse for å angi vekt
        tr.addEventListener('dblclick', function() {
            openWeightModal(item.id);
        });
        
        tbody.appendChild(tr);
    });
    
    // Legg til event listeners for slette-knapper
    const removeButtons = document.querySelectorAll('.remove-return-item');
    removeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeReturnItem(index);
        });
    });
    
    // Legg til event listeners for tilstandsceller
    const conditionCells = document.querySelectorAll('.condition-cell');
    conditionCells.forEach(cell => {
        cell.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            openConditionModal(index);
        });
        
        // Legg til visuell indikasjon at cellen er klikkbar
        cell.style.cursor = 'pointer';
    });
    
    // Oppdater totalvekt
    if (totalReturnWeightEl) {
        totalReturnWeightEl.textContent = `${totalWeight.toFixed(2)} ${appState.settings.weightUnit || 'kg'}`;
    }
    
    // Aktiver/deaktiver knapper
    if (returnExportBtnEl) returnExportBtnEl.disabled = appState.returnListItems.length === 0;
    if (clearReturnListEl) clearReturnListEl.disabled = appState.returnListItems.length === 0;
}

/**
 * Kobler til Bluetooth-skanner for retur
 */
async function connectToBluetoothReturnScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await connectToBluetoothScanner();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Starter kameraskanning for retur
 */
async function startReturnCameraScanning() {
    try {
        // Vis kameraskanner-container
        cameraScannerReturnContainerEl.style.display = 'block';
        await startCameraScanning();
    } catch (error) {
        cameraScannerReturnContainerEl.style.display = 'none';
        showToast(error.message, 'error');
    }
}

/**
 * Oppdatert handleReturnScan funksjon for returns.js
 */
export function handleReturnScan(barcode, quantity = 1) {
    if (appState.currentModule !== 'returns') {
        console.log('Merk: handleReturnScan kalles mens en annen modul er aktiv:', appState.currentModule);
    }
    
    console.log('Håndterer strekkode i retur-modulen:', barcode);
    
    if (!barcode) return;
    
    // KRITISK FIX: Håndterer tilfeller der barcode er et objekt
    if (typeof barcode === 'object' && barcode !== null) {
        console.log('Barcode er et objekt, konverterer til riktig format', barcode);
        
        // Hvis objektet har ID-felt, bruk det
        if (barcode.id) {
            console.log(`Konverterer objekt til ID: ${barcode.id}`);
            barcode = barcode.id;
        } else {
            // Forsøk å finne en egnet identifikator i objektet, eller omgjør til string
            console.warn('Barcode-objekt mangler id-felt, bruker string-konvertering');
            try {
                barcode = String(barcode);
                if (barcode === '[object Object]') {
                    console.error('Kunne ikke konvertere objekt til gyldig strekkode');
                    showToast('Feil strekkodeformat mottatt. Kontakt systemadministrator.', 'error');
                    return;
                }
            } catch (e) {
                console.error('Feil ved konvertering av objekt til strekkode:', e);
                return;
            }
        }
    }
    
    // Tøm input etter skanning
    if (returnManualScanEl) {
        returnManualScanEl.value = '';
    }
    
    // Normaliser strekkoden: Fjern eventuelle mellomrom og tegn som ikke er alfanumeriske
    barcode = barcode.toString().trim().replace(/[^a-zA-Z0-9]/g, '');
    console.log('Normalisert strekkode:', barcode);
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    let description = 'Ukjent vare';
    
    // Prøv å finne varenummeret og beskrivelsen fra barcodeMapping
    let barcodeData = appState.barcodeMapping[barcode];
    console.log('Søker først etter strekkode:', barcode, 'Resultat:', barcodeData);
    
    // STEG 1: Sjekk om det er en strekkode (EAN)
    if (barcodeData) {
        // Hvis strekkoden finnes direkte i barcodeMapping
        if (typeof barcodeData === 'object' && barcodeData !== null) {
            // Objektet inneholder både id og beskrivelse
            itemId = barcodeData.id || barcode;
            description = barcodeData.description || 'Ukjent vare';
            console.log('Fant strekkode. ID:', itemId, 'Beskrivelse:', description);
        } else if (typeof barcodeData === 'string') {
            // Barcoden er bare en streng (varenummer)
            itemId = barcodeData;
            console.log('Fant strekkode som peker til varenummer:', itemId);
            
            // Se om vi kan finne mer data om denne varen
            for (const [ean, data] of Object.entries(appState.barcodeMapping)) {
                if (typeof data === 'object' && data !== null && data.id === itemId && data.description) {
                    description = data.description;
                    console.log('Fant beskrivelse fra annen oppføring:', description);
                    break;
                }
            }
        }
    } 
    // STEG 2: Hvis ikke funnet, sjekk om det er et varenummer
    else {
        console.log('Fant ikke strekkode. Prøver å søke etter varenummer...');
        
        // Sjekk om det som ble skannet er et varenummer (ikke strekkode)
        let foundProduct = false;
        
        // Søk gjennom alle produkter for å finne et med matchende ID
        for (const [ean, data] of Object.entries(appState.barcodeMapping)) {
            if (typeof data === 'object' && data !== null && data.id === barcode) {
                // Vi fant et produkt med dette varenummeret
                itemId = barcode;  // Behold varenummeret
                description = data.description || 'Ukjent vare';
                foundProduct = true;
                console.log('Fant varenummer direkte:', itemId, 'Beskrivelse:', description);
                break;
            }
        }
        
        if (!foundProduct) {
            console.log('Fant ikke varenummer. Bruker skannet verdi som varenummer.');
        }
    }
    
    // Hent den valgte tilstanden fra dropdown
    const condition = returnItemConditionEl ? returnItemConditionEl.value : 'uåpnet';
    
    // Sjekk om denne spesifikke varenummeren allerede finnes, uavhengig av tilstand
    const existingItemsWithSameId = appState.returnListItems.filter(item => item.id === itemId);
    
    if (existingItemsWithSameId.length > 0) {
        // Vi har allerede en eller flere varer med dette varenummeret
        // Finn den som har samme tilstand
        const existingItemWithSameCondition = existingItemsWithSameId.find(item => item.condition === condition);
        
        if (existingItemWithSameCondition) {
            // Øk antallet hvis varen allerede er i listen (med samme tilstand)
            existingItemWithSameCondition.quantity += quantity;
            showToast(`Vare "${itemId}" (${condition}) antall økt til ${existingItemWithSameCondition.quantity}!`, 'success');
        } else {
            // Legg til ny vare med ny tilstand
            const newItem = {
                id: itemId,
                description: description,
                condition: condition,
                quantity: quantity,
                weight: appState.itemWeights[itemId] || appState.settings.defaultItemWeight,
                returnedAt: new Date()
            };
            
            appState.returnListItems.push(newItem);
            showToast(`Vare "${itemId}" (${condition}) lagt til som retur!`, 'success');
        }
    } else {
        // Legg til ny vare i returlisten med tilstand
        const newItem = {
            id: itemId,
            description: description,
            condition: condition,
            quantity: quantity,
            weight: appState.itemWeights[itemId] || appState.settings.defaultItemWeight,
            returnedAt: new Date()
        };
        
        appState.returnListItems.push(newItem);
        showToast(`Vare "${itemId}" (${condition}) lagt til som retur!`, 'success');
    }
    
    // Oppdater UI
    updateReturnsUI();
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Fjerner en vare fra returlisten
 * @param {number} index - Indeks til varen som skal fjernes
 */
function removeReturnItem(index) {
    if (index >= 0 && index < appState.returnListItems.length) {
        const item = appState.returnListItems[index];
        appState.returnListItems.splice(index, 1);
        
        updateReturnsUI();
        showToast(`Vare "${item.id}" fjernet fra returliste!`, 'warning');
        
        // Lagre endringer
        saveListsToStorage();
    }
}

/**
 * Eksporterer returlisten
 * @param {string} format - Format for eksport (pdf, csv, json, txt, html)
 */
function exportReturnList(format = 'pdf') {
    // Sjekk om vi har varer å eksportere
    if (appState.returnListItems.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }
    
    try {
        if (format.toLowerCase() === 'pdf') {
            // Bruk den nye PDF-eksportfunksjonen
            exportToPDF(appState.returnListItems, 'retur', {
                title: 'Returliste',
                subtitle: 'Eksportert fra SnapScan',
                exportDate: new Date(),
                showStatus: true
            });
        } else {
            // Bruk den eksisterende eksportfunksjonen for andre formater
            exportWithFormat(appState.returnListItems, 'retur', format);
        }
    } catch (error) {
        console.error('Feil ved eksport:', error);
        showToast('Kunne ikke eksportere liste. Prøv igjen senere.', 'error');
    }
}

/**
 * Tømmer returlisten
 */
function clearReturnList() {
    if (!confirm('Er du sikker på at du vil tømme returlisten?')) {
        return;
    }
    
    appState.returnListItems = [];
    
    updateReturnsUI();
    showToast('Returliste tømt!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Åpner tilstandsmodalen for en vare
 * @param {number} index - Indeks til varen i returnListItems
 */
function openConditionModal(index) {
    if (index < 0 || index >= appState.returnListItems.length) {
        console.error('Ugyldig indeks for vare:', index);
        return;
    }
    
    const item = appState.returnListItems[index];
    currentEditItemIndex = index;
    
    // Vis item-ID i modalen
    if (conditionModalItemIdEl) {
        conditionModalItemIdEl.textContent = `${item.id} (${item.description})`;
    }
    
    // Sett nåværende tilstand i select-boksen
    if (itemConditionEl) {
        itemConditionEl.value = item.condition || 'uåpnet';
    }
    
    // Vis modalen
    if (conditionModalEl) {
        conditionModalEl.style.display = 'block';
    }
}

/**
 * Lukker tilstandsmodalen uten å lagre
 */
function closeConditionModal() {
    if (conditionModalEl) {
        conditionModalEl.style.display = 'none';
    }
    currentEditItemIndex = -1;
}

/**
 * Lagrer den nye tilstanden og oppdaterer varen
 */
function saveCondition() {
    if (currentEditItemIndex < 0 || currentEditItemIndex >= appState.returnListItems.length) {
        closeConditionModal();
        return;
    }
    
    const item = appState.returnListItems[currentEditItemIndex];
    const newCondition = itemConditionEl ? itemConditionEl.value : 'uåpnet';
    
    // Hvis tilstanden ikke har endret seg, bare lukk modalen
    if (item.condition === newCondition) {
        closeConditionModal();
        return;
    }
    
    // Sjekk om det finnes en annen vare med samme id og ny tilstand
    const existingItemIndex = appState.returnListItems.findIndex(
        (existingItem, idx) => idx !== currentEditItemIndex && 
                              existingItem.id === item.id && 
                              existingItem.condition === newCondition
    );
    
    if (existingItemIndex !== -1) {
        // Det finnes allerede en annen vare med samme id og samme tilstand som vi vil endre til
        // Flytt antallet til den eksisterende varen og fjern den nåværende
        appState.returnListItems[existingItemIndex].quantity += item.quantity;
        appState.returnListItems.splice(currentEditItemIndex, 1);
        
        showToast(`Vare "${item.id}" flyttet til eksisterende oppføring med tilstand "${newCondition}"!`, 'success');
    } else {
        // Bare oppdater tilstanden på den nåværende varen
        item.condition = newCondition;
        showToast(`Tilstand for vare "${item.id}" endret til "${newCondition}"!`, 'success');
    }
    
    // Lukk modalen
    closeConditionModal();
    
    // Oppdater UI
    updateReturnsUI();
    
    // Lagre endringer
    saveListsToStorage();
}