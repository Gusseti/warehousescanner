// picking.js - Funksjonalitet for plukk-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, connectToBluetoothScanner } from './scanner.js';
import { importFromCSV, importFromJSON, importFromPDF, exportList, exportWithFormat, exportToPDF } from './import-export.js';
import { openWeightModal } from './weights.js';
import { handleScannedBarcode } from './barcode-handler.js';

// DOM elementer - Plukk
let importPickFileEl;
let importPickBtnEl;
let pickFileInfoEl;
let connectScannerPickEl;
let cameraScannerPickEl;
let pickListEl;
let pickStatusPickedEl;
let pickStatusRemainingEl;
let pickStatusTextEl;
let pickManualScanEl;
let pickManualScanBtnEl;
let pickUndoBtnEl;
let pickExportBtnEl;
let pickClearBtnEl;
let totalWeightEl;
let cameraScannerPickContainerEl;
let videoPickScannerEl;
let canvasPickScannerEl;
let scannerPickOverlayEl;
let closePickScannerEl;

window.handlePickScan = handlePickScan;
window.updatePickingUI = updatePickingUI;

/**
 * Initialiserer plukk-modulen
 */
export function initPicking() {
    // Hent DOM-elementer
    importPickFileEl = document.getElementById('importPickFile');
    importPickBtnEl = document.getElementById('importPickBtn');
    pickFileInfoEl = document.getElementById('pickFileInfo');
    connectScannerPickEl = document.getElementById('connectScannerPick');
    cameraScannerPickEl = document.getElementById('cameraScannerPick');
    pickListEl = document.getElementById('pickList');
    pickStatusPickedEl = document.getElementById('pickStatusPicked');
    pickStatusRemainingEl = document.getElementById('pickStatusRemaining');
    pickStatusTextEl = document.getElementById('pickStatusText');
    pickManualScanEl = document.getElementById('pickManualScan');
    pickManualScanBtnEl = document.getElementById('pickManualScanBtn');
    pickUndoBtnEl = document.getElementById('pickUndoBtn');
    pickExportBtnEl = document.getElementById('pickExportBtn');
    pickClearBtnEl = document.getElementById('pickClearBtn');
    totalWeightEl = document.getElementById('totalWeight');
    cameraScannerPickContainerEl = document.getElementById('cameraScannerPickContainer');
    videoPickScannerEl = document.getElementById('videoPickScanner');
    canvasPickScannerEl = document.getElementById('canvasPickScanner');
    scannerPickOverlayEl = document.getElementById('scannerPickOverlay');
    closePickScannerEl = document.getElementById('closePickScanner');
    
    // Initialiser kameraskanneren for plukk
    initCameraScanner(
        document.getElementById('videoPickScanner'), 
        document.getElementById('canvasPickScanner'), 
        document.getElementById('scannerPickOverlay'), 
        handlePickScan,
        updateScannerStatus
    );
    
    // Legg til event listeners
    setupPickingEventListeners();
    
    // Oppdater UI basert på lagrede data
    updatePickingUI();
}

/**
 * Setter opp event listeners for plukk-modulen
 */
function setupPickingEventListeners() {
    importPickBtnEl.addEventListener('click', function() {
        importPickFileEl.click();
    });
    
    importPickFileEl.addEventListener('change', function(event) {
        handlePickFileImport(event);
    });
    
    connectScannerPickEl.addEventListener('click', function() {
        connectToBluetoothPickScanner();
    });
    
    cameraScannerPickEl.addEventListener('click', function() {
        startPickCameraScanning();
    });
    
    closePickScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerPickContainerEl.style.display = 'none';
    });
    
    pickManualScanBtnEl.addEventListener('click', function() {
        handlePickScan(pickManualScanEl.value);
    });
    
    pickManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handlePickScan(pickManualScanEl.value);
        }
    });
    
    pickUndoBtnEl.addEventListener('click', function() {
        undoLastPickScan();
    });
    
    // Hovedeksportknapp (PDF som standard)
    pickExportBtnEl.addEventListener('click', function() {
        exportPickList('pdf');
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#pickingModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportPickList(format);
        });
    });
    
    pickClearBtnEl.addEventListener('click', function() {
        clearPickList();
    });
}

/**
 * Oppdaterer UI for plukk-modulen
 */
export function updatePickingUI() {
    // Sikre at vi har en referanse til tabellen
    if (!pickListEl) {
        console.error('Tabellreferanse for plukk mangler');
        return;
    }
    
    // Hent tbody-elementet
    const tbody = pickListEl.querySelector('tbody');
    if (!tbody) {
        console.error('Tbody for plukk ikke funnet');
        return;
    }
    
    // Tøm tabellen
    tbody.innerHTML = '';
    
    // Variabler for totalberegninger
    let totalWeight = 0;
    let totalScannedItems = 0;
    let totalRequiredItems = 0;
    
    // Prosesser hver vare
    appState.pickListItems.forEach(item => {
        // Initialisere tellefelt hvis det ikke eksisterer
        if (item.pickedCount === undefined) {
            item.pickedCount = 0;
        }
        
        const tr = document.createElement('tr');
        const isFullyPicked = item.picked;
        const currentCount = item.pickedCount;
        
        // Regn ut statusfarge basert på skannet antall
        if (currentCount > 0) {
            if (currentCount >= item.quantity) {
                tr.classList.add('picked');
            } else {
                tr.classList.add('partially-scanned');
            }
            
            // Legg til vekt for skannede varer - basert på faktisk skannede antall
            totalWeight += currentCount * (item.weight || 0);
        }
        
        // Tell opp totaler for statuslinje
        totalScannedItems += currentCount;
        totalRequiredItems += item.quantity;
        
        // Beregn vekt for denne spesifikke varen
        const itemTotalWeight = (item.weight || 0) * item.quantity;
        const scannedWeight = (item.weight || 0) * currentCount;
        
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.description}</td>
            <td>${currentCount} / ${item.quantity}</td>
            <td>${itemTotalWeight.toFixed(2)} ${appState.settings.weightUnit}</td>
            <td>${
                currentCount === 0 ? 
                    `<span class="badge" style="background-color: var(--gray)">Venter</span>` :
                currentCount < item.quantity ? 
                    `<span class="badge" style="background-color: var(--warning)">Delvis (${currentCount}/${item.quantity})</span>` :
                    `<span class="badge badge-success">Plukket</span>`
            }
            </td>
        `;
        
        // Legg til hendelse for å angi vekt
        tr.addEventListener('dblclick', function() {
            openWeightModal(item.id);
        });
        
        tbody.appendChild(tr);
    });
    
    // Oppdater statuslinjen
    const percentage = totalRequiredItems > 0 ? Math.round((totalScannedItems / totalRequiredItems) * 100) : 0;
    
    if (pickStatusPickedEl) pickStatusPickedEl.style.width = `${percentage}%`;
    if (pickStatusRemainingEl) pickStatusRemainingEl.style.width = `${100 - percentage}%`;
    
    if (pickStatusTextEl) {
        pickStatusTextEl.textContent = `${totalScannedItems} av ${totalRequiredItems} varer plukket (${percentage}%)`;
    }
    
    // Oppdater totalvekt
    if (totalWeightEl) {
        totalWeightEl.textContent = `${totalWeight.toFixed(2)} ${appState.settings.weightUnit || 'kg'}`;
    }
    
    // Oppdater filinformasjon
    if (pickFileInfoEl) {
        if (appState.pickListItems.length > 0) {
            pickFileInfoEl.textContent = `Aktiv plukkliste: ${appState.pickListItems.length} varer`;
        } else {
            pickFileInfoEl.textContent = 'Ingen fil lastet inn';
        }
    }
    
    // Aktiver/deaktiver knapper
    if (pickExportBtnEl) pickExportBtnEl.disabled = appState.pickListItems.length === 0;
    if (pickClearBtnEl) pickClearBtnEl.disabled = appState.pickListItems.length === 0;
    if (pickUndoBtnEl) pickUndoBtnEl.disabled = !appState.lastPickedItem;
}

/**
 * Håndterer import av fil
 * @param {Event} event - Fil-input event
 */
function handlePickFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vis laster-melding
    showToast('Importerer plukkliste...', 'info');
    
    // Håndter ulike filtyper
    if (file.type === 'application/pdf') {
        importFromPDF(file, 'pick')
            .then(() => {
                updatePickingUI();
                saveListsToStorage();
            })
            .catch(error => {
                showToast('Feil ved import av PDF: ' + error.message, 'error');
            });
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                
                // Sjekk filtypen basert på filendelse eller innhold
                if (file.name.endsWith('.json')) {
                    importFromJSON(content, file.name, 'pick');
                } else {
                    importFromCSV(content, file.name, 'pick');
                }
                
                updatePickingUI();
                saveListsToStorage();
                
            } catch (error) {
                console.error('Feil ved import av fil:', error);
                showToast('Feil ved import av fil. Sjekk filformatet.', 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    // Reset file input
    event.target.value = '';
}

/**
 * Kobler til Bluetooth-skanner for plukk
 */
async function connectToBluetoothPickScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await connectToBluetoothScanner();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Starter kameraskanning for plukk
 */
async function startPickCameraScanning() {
    try {
        // Vis kameraskanner-container
        cameraScannerPickContainerEl.style.display = 'block';
        await startCameraScanning();
    } catch (error) {
        cameraScannerPickContainerEl.style.display = 'none';
        showToast(error.message, 'error');
    }
}

// picking.js - Forbedret håndtering av skanning for plukklisten

/**
 * Håndterer skanning for plukk
 * @param {string} barcode - Skannet strekkode
 */
function handlePickScan(barcode) {
    if (!barcode) return;
    
    console.log('Håndterer strekkode i plukk-modulen:', barcode);
    
    // Tøm input etter skanning
    if (pickManualScanEl) pickManualScanEl.value = '';
    
    // Bruk den forbedrede strekkodehåndtereren for ukjente strekkoder/varer
    // Hvis den returnerer true, har den allerede håndtert strekkoden
    if (handleScannedBarcode(barcode, 'pick')) {
        console.log('Strekkoden ble håndtert av barcode-handler');
        return;
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Finn varen i listen
    const item = appState.pickListItems.find(item => item.id === itemId);
    
    if (!item) {
        // Varen finnes ikke i listen - skal ha blitt håndtert av handleScannedBarcode over
        console.log(`Vare ${itemId} finnes ikke i plukklisten og ble ikke håndtert av barcode-handler`);
        showToast(`Vare "${itemId}" finnes ikke i plukklisten!`, 'error');
        return;
    }
    
    // Initialisere tellefelt hvis det ikke eksisterer
    if (item.pickedCount === undefined) {
        item.pickedCount = 0;
    }
    
    // Sjekk om vi har plukket alle enhetene av denne varen
    if (item.pickedCount >= item.quantity) {
        showToast(`Alle ${item.quantity} enheter av "${itemId}" er allerede plukket!`, 'warning');
        return;
    }
    
    // Øk antallet plukket
    item.pickedCount++;
    console.log(`Økte pickedCount til ${item.pickedCount} for vare ${itemId}`);
    
    // Merk varen som fullstendig plukket hvis alle enheter er skannet
    if (item.pickedCount >= item.quantity) {
        item.picked = true;
        item.pickedAt = new Date();
        
        // Legg til i listen over fullstendig plukkede varer
        if (!appState.pickedItems.includes(itemId)) {
            appState.pickedItems.push(itemId);
        }
    }
    
    // Lagre sist plukket vare for angrefunksjonalitet
    appState.lastPickedItem = {
        id: itemId,
        timestamp: new Date()
    };
    
    // Vis tilbakemelding til brukeren
    const remainingCount = item.quantity - item.pickedCount;
    
    if (remainingCount > 0) {
        showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
    } else {
        showToast(`Vare "${itemId}" fullstendig plukket!`, 'success');
    }

    updatePickingUI();
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Angrer siste skanning
 */
function undoLastPickScan() {
    if (!appState.lastPickedItem) return;
    
    // Finn varen som skal angres
    const item = appState.pickListItems.find(item => item.id === appState.lastPickedItem.id);
    
    if (item) {
        // Reduser antall plukkede
        if (item.pickedCount > 0) {
            item.pickedCount--;
        }
        
        // Fjern fra fullstendig plukkede hvis antallet nå er mindre enn totalen
        if (item.pickedCount < item.quantity) {
            item.picked = false;
            item.pickedAt = null;
            
            // Fjern fra listen over fullstendig plukkede varer hvis den er der
            const index = appState.pickedItems.indexOf(item.id);
            if (index !== -1) {
                appState.pickedItems.splice(index, 1);
            }
        }
    }
    
    // Nullstill sist plukket vare
    appState.lastPickedItem = null;
    
    // Oppdater UI
    updatePickingUI();
    showToast('Siste skanning er angret!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Eksporterer plukklisten
 * @param {string} format - Format for eksport (pdf, csv, json, txt, html)
 */
function exportPickList(format = 'pdf') {
    // Sjekk om vi har varer å eksportere
    if (appState.pickListItems.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }
    
    try {
        if (format.toLowerCase() === 'pdf') {
            // Bruk den nye PDF-eksportfunksjonen
            exportToPDF(appState.pickListItems, 'plukk', {
                title: 'Plukkliste',
                subtitle: 'Eksportert fra Lagerstyring PWA',
                exportDate: new Date(),
                showStatus: true
            });
        } else {
            // Bruk den eksisterende eksportfunksjonen for andre formater
            exportWithFormat(appState.pickListItems, 'plukk', format);
        }
    } catch (error) {
        console.error('Feil ved eksport:', error);
        showToast('Kunne ikke eksportere liste. Prøv igjen senere.', 'error');
    }
}

/**
 * Tømmer plukklisten
 */
function clearPickList() {
    if (!confirm('Er du sikker på at du vil tømme plukklisten?')) {
        return;
    }
    
    appState.pickListItems = [];
    appState.pickedItems = [];
    appState.lastPickedItem = null;
    
    updatePickingUI();
    showToast('Plukkliste tømt!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}