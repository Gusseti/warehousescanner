// returns.js - Funksjonalitet for retur-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, connectToBluetoothScanner } from './scanner.js';
import { exportList } from './import-export.js';
import { openWeightModal } from './weights.js';

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

/**
 * Initialiserer retur-modulen
 */
export function initReturns() {
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
    
    // Initialiser kameraskanneren for retur
    initCameraScanner(
        videoReturnScannerEl, 
        canvasReturnScannerEl, 
        scannerReturnOverlayEl, 
        handleReturnScan,
        updateScannerStatus
    );
    
    // Legg til event listeners
    setupReturnsEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReturnsUI();
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
    
    returnExportBtnEl.addEventListener('click', function() {
        exportReturnList();
    });
    
    clearReturnListEl.addEventListener('click', function() {
        clearReturnList();
    });
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
        
        // Legg til vekt
        totalWeight += item.quantity * (item.weight || 0);
        
        // Beregn totalvekt for denne spesifikke varen
        const itemTotalWeight = (item.weight || 0) * item.quantity;
        
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
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
 * Håndterer skanning for retur
 * @param {string} barcode - Skannet strekkode
 * @param {number} quantity - Antall varer å returnere
 */
export function handleReturnScan(barcode, quantity = 1) {
    if (!barcode) return;
    
    // Sjekk om vi faktisk er i retur-modulen
    if (appState.currentModule !== 'returns') {
        console.log('Ignorerer strekkodeskanning i retur-modulen fordi en annen modul er aktiv:', appState.currentModule);
        return;
    }
    
    console.log('Håndterer strekkode i retur-modulen:', barcode);
    
    // Tøm input etter skanning
    if (returnManualScanEl) {
        returnManualScanEl.value = '';
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Sjekk om varen allerede er i returlisten
    const existingItemIndex = appState.returnListItems.findIndex(item => item.id === itemId);
    
    if (existingItemIndex !== -1) {
        // Øk antallet hvis varen allerede er i listen
        appState.returnListItems[existingItemIndex].quantity += quantity;
        showToast(`Vare "${itemId}" antall økt til ${appState.returnListItems[existingItemIndex].quantity}!`, 'success');
    } else {
        // Finn varen i plukk- eller mottaksliste for å få beskrivelse
        let description = 'Returvare';
        let foundItem = appState.pickListItems.find(item => item.id === itemId);
        if (!foundItem) {
            foundItem = appState.receiveListItems.find(item => item.id === itemId);
        }
        
        if (foundItem) {
            description = foundItem.description;
        }
        
        // Legg til ny vare i returlisten
        const newItem = {
            id: itemId,
            description: description,
            quantity: quantity,
            weight: appState.itemWeights[itemId] || appState.settings.defaultItemWeight,
            returnedAt: new Date()
        };
        
        appState.returnListItems.push(newItem);
        
        // Åpne vektmodal for å angi vekt hvis vekten ikke er satt
        if (!appState.itemWeights[itemId]) {
            openWeightModal(itemId);
        }
        
        showToast(`Vare "${itemId}" lagt til som retur!`, 'success');
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
 */
function exportReturnList() {
    exportList(appState.returnListItems, 'retur');
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