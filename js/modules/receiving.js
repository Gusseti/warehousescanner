// receiving.js - Funksjonalitet for mottak-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, connectToBluetoothScanner } from './scanner.js';
import { openWeightModal } from './weights.js';
import { importFromCSV, importFromJSON, importFromPDF, importFromReceiptPDF, importKvikFollgeseddel, exportList, exportWithFormat, exportToPDF } from './import-export.js';


// DOM elementer - Mottak
let importReceiveFileEl;
let importReceiveBtnEl;
let receiveFileInfoEl;
let connectScannerReceiveEl;
let cameraScannerReceiveEl;
let receiveListEl;
let receiveStatusReceivedEl;
let receiveStatusRemainingEl;
let receiveStatusTextEl;
let receiveManualScanEl;
let receiveManualScanBtnEl;
let receiveUndoBtnEl;
let receiveExportBtnEl;
let receiveClearBtnEl;
let totalReceiveWeightEl;
let cameraScannerReceiveContainerEl;
let videoReceiveScannerEl;
let canvasReceiveScannerEl;
let scannerReceiveOverlayEl;
let closeReceiveScannerEl;
let switchCameraReceiveEl;

/**
 * Initialiserer mottak-modulen
 */
export function initReceiving() {
    // Hent DOM-elementer
    importReceiveFileEl = document.getElementById('importReceiveFile');
    importReceiveBtnEl = document.getElementById('importReceiveBtn');
    receiveFileInfoEl = document.getElementById('receiveFileInfo');
    connectScannerReceiveEl = document.getElementById('connectScannerReceive');
    cameraScannerReceiveEl = document.getElementById('cameraScannerReceive');
    receiveListEl = document.getElementById('receiveList');
    receiveStatusReceivedEl = document.getElementById('receiveStatusReceived');
    receiveStatusRemainingEl = document.getElementById('receiveStatusRemaining');
    receiveStatusTextEl = document.getElementById('receiveStatusText');
    receiveManualScanEl = document.getElementById('receiveManualScan');
    receiveManualScanBtnEl = document.getElementById('receiveManualScanBtn');
    receiveUndoBtnEl = document.getElementById('receiveUndoBtn');
    receiveExportBtnEl = document.getElementById('receiveExportBtn');
    receiveClearBtnEl = document.getElementById('receiveClearBtn');
    totalReceiveWeightEl = document.getElementById('totalReceiveWeight');
    cameraScannerReceiveContainerEl = document.getElementById('cameraScannerReceiveContainer');
    videoReceiveScannerEl = document.getElementById('videoReceiveScanner');
    canvasReceiveScannerEl = document.getElementById('canvasReceiveScanner');
    scannerReceiveOverlayEl = document.getElementById('scannerReceiveOverlay');
    closeReceiveScannerEl = document.getElementById('closeReceiveScanner');
    switchCameraReceiveEl = document.getElementById('switchCameraReceive');
    
    // Initialiser kameraskanneren for mottak
    initCameraScanner(
        videoReceiveScannerEl, 
        canvasReceiveScannerEl, 
        scannerReceiveOverlayEl, 
        handleReceiveScan,
        updateScannerStatus
    );
    
    // Legg til event listeners
    setupReceivingEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReceivingUI();
}

/**
 * Setter opp event listeners for mottak-modulen
 */
function setupReceivingEventListeners() {
    importReceiveBtnEl.addEventListener('click', function() {
        importReceiveFileEl.click();
    });
    
    importReceiveFileEl.addEventListener('change', function(event) {
        handleReceiveFileImport(event);
    });
    
    connectScannerReceiveEl.addEventListener('click', function() {
        connectToBluetoothReceiveScanner();
    });
    
    cameraScannerReceiveEl.addEventListener('click', function() {
        startReceiveCameraScanning();
    });
    
    closeReceiveScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerReceiveContainerEl.style.display = 'none';
    });
    
    receiveManualScanBtnEl.addEventListener('click', function() {
        handleReceiveScan(receiveManualScanEl.value);
    });
    
    receiveManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleReceiveScan(receiveManualScanEl.value);
        }
    });
    
    receiveUndoBtnEl.addEventListener('click', function() {
        undoLastReceiveScan();
    });
    
    // Hovedeksportknapp (PDF som standard)
    receiveExportBtnEl.addEventListener('click', function() {
        exportReceiveList('pdf');
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#receivingModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportReceiveList(format);
        });
    });
    
    receiveClearBtnEl.addEventListener('click', function() {
        clearReceiveList();
    });
}

/**
 * Oppdaterer UI for mottak-modulen
 */
export function updateReceivingUI() {
    // Sikre at vi har en referanse til tabellen
    if (!receiveListEl) {
        console.error('Tabellreferanse for mottak mangler');
        return;
    }
    
    // Hent tbody-elementet
    const tbody = receiveListEl.querySelector('tbody');
    if (!tbody) {
        console.error('Tbody for mottak ikke funnet');
        return;
    }
    
    // Tøm tabellen
    tbody.innerHTML = '';
    
    // Variabler for totalberegninger
    let totalWeight = 0;
    let totalReceivedItems = 0;
    let totalRequiredItems = 0;
    
    // Prosesser hver vare
    appState.receiveListItems.forEach(item => {
        // Initialisere tellefelt hvis det ikke eksisterer
        if (item.receivedCount === undefined) {
            item.receivedCount = 0;
        }
        
        const tr = document.createElement('tr');
        const isFullyReceived = item.received;
        const currentCount = item.receivedCount;
        
        // Regn ut statusfarge basert på skannet antall
        if (currentCount > 0) {
            if (currentCount >= item.quantity) {
                tr.classList.add('received');
            } else {
                tr.classList.add('partially-scanned');
            }
            
            // Legg til vekt for skannede varer - basert på faktisk skannede antall
            totalWeight += currentCount * (item.weight || 0);
        }
        
        // Tell opp totaler for statuslinje
        totalReceivedItems += currentCount;
        totalRequiredItems += item.quantity;
        
        // Beregn vekt for denne spesifikke varen
        const itemTotalWeight = (item.weight || 0) * item.quantity;
        const receivedWeight = (item.weight || 0) * currentCount;
        
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
                    `<span class="badge badge-success">Mottatt</span>`
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
    const percentage = totalRequiredItems > 0 ? Math.round((totalReceivedItems / totalRequiredItems) * 100) : 0;
    
    if (receiveStatusReceivedEl) receiveStatusReceivedEl.style.width = `${percentage}%`;
    if (receiveStatusRemainingEl) receiveStatusRemainingEl.style.width = `${100 - percentage}%`;
    
    if (receiveStatusTextEl) {
        receiveStatusTextEl.textContent = `${totalReceivedItems} av ${totalRequiredItems} varer mottatt (${percentage}%)`;
    }
    
    // Oppdater totalvekt
    if (totalReceiveWeightEl) {
        totalReceiveWeightEl.textContent = `${totalWeight.toFixed(2)} ${appState.settings.weightUnit || 'kg'}`;
    }
    
    // Oppdater filinformasjon
    if (receiveFileInfoEl) {
        if (appState.receiveListItems.length > 0) {
            receiveFileInfoEl.textContent = `Aktiv mottaksliste: ${appState.receiveListItems.length} varer`;
        } else {
            receiveFileInfoEl.textContent = 'Ingen fil lastet inn';
        }
    }
    
    // Aktiver/deaktiver knapper
    if (receiveExportBtnEl) receiveExportBtnEl.disabled = appState.receiveListItems.length === 0;
    if (receiveClearBtnEl) receiveClearBtnEl.disabled = appState.receiveListItems.length === 0;
    if (receiveUndoBtnEl) receiveUndoBtnEl.disabled = !appState.lastReceivedItem;
}

/**
 * Håndterer import av fil
 * @param {Event} event - Fil-input event
 */
function handleReceiveFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vis laster-melding
    showToast('Importerer mottaksliste...', 'info');
    
    // Håndter ulike filtyper
    if (file.type === 'application/pdf') {
        // I mottak-modulen, forsøk alltid Kvik følgeseddel-import først
        importFromReceiptPDF(file)
            .then(() => {
                updateReceivingUI();
                saveListsToStorage();
            })
            .catch(error => {
                // Hvis Kvik import feiler, prøv standard PDF-import
                console.warn('Kvik følgeseddel-import feilet, prøver standard PDF-import:', error);
                importFromPDF(file, 'receive')
                    .then(() => {
                        updateReceivingUI();
                        saveListsToStorage();
                    })
                    .catch(secondError => {
                        showToast('Feil ved import av PDF: ' + secondError.message, 'error');
                    });
            });
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                
                // Sjekk filtypen basert på filendelse eller innhold
                if (file.name.endsWith('.json')) {
                    importFromJSON(content, file.name, 'receive');
                } else {
                    importFromCSV(content, file.name, 'receive');
                }
                
                updateReceivingUI();
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
 * Kobler til Bluetooth-skanner for mottak
 */
async function connectToBluetoothReceiveScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await connectToBluetoothScanner();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Starter kameraskanning for mottak
 */
async function startReceiveCameraScanning() {
    try {
        // Vis kameraskanner-container
        cameraScannerReceiveContainerEl.style.display = 'block';
        await startCameraScanning();
    } catch (error) {
        cameraScannerReceiveContainerEl.style.display = 'none';
        showToast(error.message, 'error');
    }
}

/**
 * Håndterer skanning for mottak
 * @param {string} barcode - Skannet strekkode
 */
export function handleReceiveScan(barcode) {
    if (!barcode) return;
    
    // Sjekk om vi faktisk er i mottak-modulen
    if (appState.currentModule !== 'receiving') {
        console.log('Ignorerer strekkodeskanning i mottak-modulen fordi en annen modul er aktiv:', appState.currentModule);
        return;
    }
    
    console.log('Håndterer strekkode i mottak-modulen:', barcode);
    
    // Tøm input etter skanning
    if (receiveManualScanEl) {
        receiveManualScanEl.value = '';
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Finn varen i listen
    let item = appState.receiveListItems.find(item => item.id === itemId);
    
    // Håndtere varer som ikke er i listen
    if (!item) {
        // For mottak, legg til varen hvis den ikke finnes
        item = {
            id: itemId,
            description: 'Ukjent vare',
            quantity: 1,
            weight: appState.itemWeights[itemId] || appState.settings.defaultItemWeight,
            received: false,
            receivedAt: null,
            receivedCount: 0
        };
        
        appState.receiveListItems.push(item);
        
        // Åpne vektmodal for å angi vekt
        openWeightModal(itemId);
        
        showToast(`Ny vare "${itemId}" lagt til i mottakslisten.`, 'info');
    }
    
    // Initialisere tellefelt hvis det ikke eksisterer
    if (item.receivedCount === undefined) {
        item.receivedCount = 0;
    }
    
    // Sjekk om vi har mottatt alle enhetene av denne varen
    if (item.receivedCount >= item.quantity) {
        showToast(`Alle ${item.quantity} enheter av "${itemId}" er allerede mottatt!`, 'warning');
        return;
    }
    
    // Øk antallet mottatt
    item.receivedCount++;
    
    // Merk varen som fullstendig mottatt hvis alle enheter er skannet
    if (item.receivedCount >= item.quantity) {
        item.received = true;
        item.receivedAt = new Date();
        
        // Legg til i listen over fullstendig mottatte varer
        if (!appState.receivedItems.includes(itemId)) {
            appState.receivedItems.push(itemId);
        }
    }
    
    // Lagre sist mottatt vare for angrefunksjonalitet
    appState.lastReceivedItem = {
        id: itemId,
        timestamp: new Date()
    };
    
    // Oppdater UI
    updateReceivingUI();
    
    // Vis tilbakemelding til brukeren
    const remainingCount = item.quantity - item.receivedCount;
    
    if (remainingCount > 0) {
        showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
    } else {
        showToast(`Vare "${itemId}" fullstendig mottatt!`, 'success');
    }
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Angrer siste skanning
 */
function undoLastReceiveScan() {
    if (!appState.lastReceivedItem) return;
    
    // Finn varen som skal angres
    const item = appState.receiveListItems.find(item => item.id === appState.lastReceivedItem.id);
    
    if (item) {
        // Reduser antall mottatte
        if (item.receivedCount > 0) {
            item.receivedCount--;
        }
        
        // Fjern fra fullstendig mottatte hvis antallet nå er mindre enn totalen
        if (item.receivedCount < item.quantity) {
            item.received = false;
            item.receivedAt = null;
            
            // Fjern fra listen over fullstendig mottatte varer hvis den er der
            const index = appState.receivedItems.indexOf(item.id);
            if (index !== -1) {
                appState.receivedItems.splice(index, 1);
            }
        }
    }
    
    // Nullstill sist mottatt vare
    appState.lastReceivedItem = null;
    
    // Oppdater UI
    updateReceivingUI();
    showToast('Siste skanning er angret!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}

/**
 * Eksporterer mottakslisten
 * @param {string} format - Format for eksport (pdf, csv, json, txt, html)
 */
function exportReceiveList(format = 'pdf') {
    // Sjekk om vi har varer å eksportere
    if (appState.receiveListItems.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }
    
    try {
        if (format.toLowerCase() === 'pdf') {
            // Bruk den nye PDF-eksportfunksjonen
            exportToPDF(appState.receiveListItems, 'mottak', {
                title: 'Mottaksliste',
                subtitle: 'Eksportert fra Lagerstyring PWA',
                exportDate: new Date(),
                showStatus: true
            });
        } else {
            // Bruk den eksisterende eksportfunksjonen for andre formater
            exportWithFormat(appState.receiveListItems, 'mottak', format);
        }
    } catch (error) {
        console.error('Feil ved eksport:', error);
        showToast('Kunne ikke eksportere liste. Prøv igjen senere.', 'error');
    }
}

/**
 * Tømmer mottakslisten
 */
function clearReceiveList() {
    if (!confirm('Er du sikker på at du vil tømme mottakslisten?')) {
        return;
    }
    
    appState.receiveListItems = [];
    appState.receivedItems = [];
    appState.lastReceivedItem = null;
    
    updateReceivingUI();
    showToast('Mottaksliste tømt!', 'warning');
    
    // Lagre endringer
    saveListsToStorage();
}