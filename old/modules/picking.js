// picking.js - Funksjonalitet for plukk-modulen
import { appState } from '../app.js';
import { showToast, formatDate } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, bluetoothScanner, blinkBackground, playErrorSound } from './scanner.js';
import { importFromCSV, importFromJSON, importFromPDF, exportList, exportWithFormat, exportToPDF } from './import-export.js';
import { openWeightModal } from './weights.js';
import { handleScannedBarcode } from './barcode-handler.js';
import { handleModuleScan, handleModuleFileImport, exportModuleList, undoLastModuleScan, clearModuleList } from './core-module-handler.js';
// Import EventBus
import eventBus, { EventTypes } from './event-bus.js';

// Importer UI-komponenter
import { ButtonComponent } from '../components/ButtonComponent.js';
import { TableComponent } from '../components/TableComponent.js';
import { SearchComponent } from '../components/SearchComponent.js';

// Komponenter
let pickingTable;
let pickingSearch;
let importButton;
let exportButton;
let clearButton;
let undoButton;
let connectScannerButton;
let cameraScannerButton;
let scanButton;

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
let pickSearchContainerEl;
let pickButtonContainerEl;
let pickTableContainerEl;

// Registrer globale funksjoner
window.handlePickScan = handlePickScan;
window.updatePickingUI = updatePickingUI;

// EventBus abonnementer
let subscriptions = [];

/**
 * Initialiserer plukk-modulen
 */
export function initPicking() {
    console.log("Initialiserer plukk-modul");
    
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
    
    // Nye container-elementer for komponenter
    pickSearchContainerEl = document.getElementById('pickSearchContainer');
    pickButtonContainerEl = document.getElementById('pickButtonContainer');
    pickTableContainerEl = document.getElementById('pickTableContainer');
    
    // Hvis container-elementene ikke eksisterer, oppretter vi dem
    if (!pickSearchContainerEl) {
        pickSearchContainerEl = document.createElement('div');
        pickSearchContainerEl.id = 'pickSearchContainer';
        pickListEl.parentNode.insertBefore(pickSearchContainerEl, pickListEl);
    }
    
    if (!pickButtonContainerEl) {
        pickButtonContainerEl = document.createElement('div');
        pickButtonContainerEl.id = 'pickButtonContainer';
        pickButtonContainerEl.className = 'button-container';
        pickListEl.parentNode.insertBefore(pickButtonContainerEl, pickListEl);
    }
    
    if (!pickTableContainerEl) {
        pickTableContainerEl = document.createElement('div');
        pickTableContainerEl.id = 'pickTableContainer';
        pickListEl.parentNode.replaceChild(pickTableContainerEl, pickListEl);
    }
    
    // VIKTIG FIX: Gjøre handlePickScan tilgjengelig globalt
    if (typeof window.handlePickScan !== 'function') {
        window.handlePickScan = handlePickScan;
        console.log("Registrerte window.handlePickScan");
    }
    
    // Initialiser kameraskanneren for plukk
    initCameraScanner(
        document.getElementById('videoPickScanner'), 
        document.getElementById('canvasPickScanner'), 
        document.getElementById('scannerPickOverlay'), 
        handlePickScan,  
        updateScannerStatus,
        'pick'  
    );
    
    // Initialiser komponentene
    initComponents();
    
    // Legg til event listeners
    setupPickingEventListeners();
    
    // Registrer EventBus abonnementer
    registerEventBusSubscriptions();
    
    // Oppdater UI basert på lagrede data
    updatePickingUI();
    
    console.log("Plukk-modul initialisert");
}

/**
 * Registrerer EventBus abonnementer for plukk-modulen
 */
function registerEventBusSubscriptions() {
    // Rydder opp eventuelle eksisterende abonnementer
    subscriptions.forEach(subscription => subscription.unsubscribe());
    subscriptions = [];
    
    // Abonnér på skannede strekkoder som er relevante for plukk-modulen
    subscriptions.push(eventBus.subscribe(EventTypes.BARCODE_SCANNED, (data) => {
        if (data && data.module === 'pick' && appState.currentModule === 'picking') {
            console.log(`Plukk-modul mottok skannet strekkode: ${data.barcode}`);
            // Ikke gjør noe spesielt her siden skanner-modulen allerede håndterer dette
        }
    }));
    
    // Abonnér på prosesserte strekkoder
    subscriptions.push(eventBus.subscribe(EventTypes.BARCODE_PROCESSED, (data) => {
        if (data && data.module === 'pick' && appState.currentModule === 'picking') {
            console.log(`Plukk-modul mottok prosessert strekkode: ${data.barcode}, varenr: ${data.itemId}`);
            // Prosessering håndteres i handlePickScan, som kalles fra scanner-modulen
        }
    }));
    
    // Abonnér på ugyldig strekkode-hendelser
    subscriptions.push(eventBus.subscribe(EventTypes.BARCODE_INVALID, (data) => {
        if (data && data.module === 'pick' && appState.currentModule === 'picking') {
            showToast(`Ugyldig strekkode: ${data.barcode} - ${data.reason === 'not_in_system' ? 'ikke i system' : 'ugyldig format'}`, 'error');
            playErrorSound();
        }
    }));
    
    // Abonnér på modul-skifte for å nullstille eventuelle tilstander
    subscriptions.push(eventBus.subscribe(EventTypes.UI_MODULE_CHANGED, (data) => {
        // Hvis vi forlater plukk-modulen, stopp skanneren
        if (data && data.module !== 'picking' && appState.currentModule === 'picking') {
            stopCameraScanning();
            cameraScannerPickContainerEl.style.display = 'none';
        }
        
        // Hvis vi går inn i plukk-modulen, oppdater UI
        if (data && data.module === 'picking') {
            updatePickingUI();
        }
    }));
    
    // Abonnér på data-oppdateringer
    subscriptions.push(eventBus.subscribe(EventTypes.DATA_UPDATED, (data) => {
        if (data && data.type === 'pick' && appState.currentModule === 'picking') {
            updatePickingUI();
        }
    }));
    
    // Abonnér på skanner-statusendringer
    subscriptions.push(eventBus.subscribe(EventTypes.SCANNER_STATUS_CHANGED, (data) => {
        if (appState.currentModule === 'picking') {
            updateScannerStatus(data.status === 'success' || data.status === 'detected' || data.status === 'scanning');
        }
    }));
}

/**
 * Initialiserer UI-komponenter
 */
function initComponents() {
    // Søkekomponent
    pickingSearch = new SearchComponent('pickSearchContainer', {
        placeholder: 'Søk i plukklisten...',
        onSearch: (searchTerm) => filterPickList(searchTerm)
    });
    
    // Knapper
    importButton = new ButtonComponent('pickButtonContainer', {
        text: 'Importer liste',
        type: 'primary',
        icon: 'upload-icon',
        id: 'importPickBtn',
        onClick: () => importPickFileEl.click()
    });
    
    connectScannerButton = new ButtonComponent('pickButtonContainer', {
        text: 'Koble til skanner',
        type: 'secondary',
        icon: 'bluetooth-icon',
        id: 'connectScannerPick',
        onClick: () => connectToBluetoothPickScanner()
    });
    
    cameraScannerButton = new ButtonComponent('pickButtonContainer', {
        text: 'Kameraskanner',
        type: 'secondary',
        icon: 'camera-icon',
        id: 'cameraScannerPick',
        onClick: () => startPickCameraScanning()
    });
    
    scanButton = new ButtonComponent('pickManualScanContainer', {
        text: 'Skann',
        type: 'success',
        id: 'pickManualScanBtn',
        onClick: () => handlePickScan(pickManualScanEl.value)
    });
    
    undoButton = new ButtonComponent('pickButtonContainer', {
        text: 'Angre siste',
        type: 'warning',
        icon: 'undo-icon',
        id: 'pickUndoBtn',
        onClick: () => undoLastPickScan(),
        disabled: !appState.lastPickedItem
    });
    
    exportButton = new ButtonComponent('pickButtonContainer', {
        text: 'Eksporter liste',
        type: 'info',
        icon: 'export-icon',
        id: 'pickExportBtn',
        onClick: () => exportPickList('pdf'),
        disabled: appState.pickListItems.length === 0
    });
    
    clearButton = new ButtonComponent('pickButtonContainer', {
        text: 'Tøm liste',
        type: 'danger',
        icon: 'trash-icon',
        id: 'pickClearBtn',
        onClick: () => clearPickList(),
        disabled: appState.pickListItems.length === 0
    });
    
    // Tabellkomponent
    pickingTable = new TableComponent('pickTableContainer', {
        columns: [
            { field: 'id', title: 'Varenr', sortable: true },
            { field: 'description', title: 'Beskrivelse', sortable: true },
            { 
                field: 'quantity', 
                title: 'Antall', 
                sortable: true,
                renderer: (value, row) => `${row.pickedCount || 0} / ${row.quantity}`
            },
            { 
                field: 'weight', 
                title: 'Vekt', 
                sortable: true,
                renderer: (value, row) => `${((row.weight || 0) * row.quantity).toFixed(2)} ${appState.settings.weightUnit || 'kg'}`
            },
            { 
                field: 'picked', 
                title: 'Status', 
                sortable: true,
                renderer: (value, row) => {
                    const currentCount = row.pickedCount || 0;
                    if (currentCount === 0) {
                        return '<span class="badge" style="background-color: var(--gray)">Venter</span>';
                    } else if (currentCount < row.quantity) {
                        return `<span class="badge" style="background-color: var(--warning)">Delvis (${currentCount}/${row.quantity})</span>`;
                    } else {
                        return '<span class="badge badge-success">Plukket</span>';
                    }
                }
            }
        ],
        data: appState.pickListItems,
        onRowClick: (item) => openWeightModal(item.id)
    });
}

/**
 * Setter opp event listeners for plukk-modulen
 */
function setupPickingEventListeners() {
    // Event listeners som fortsatt bruker DOM-elementer direkte
    importPickFileEl.addEventListener('change', function(event) {
        handlePickFileImport(event);
    });
    
    closePickScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerPickContainerEl.style.display = 'none';
    });
    
    pickManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handlePickScan(pickManualScanEl.value);
        }
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#pickingModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportPickList(format);
        });
    });
}

/**
 * Oppdaterer UI for plukk-modulen
 */
export function updatePickingUI() {
    // Oppdater tabelldata
    if (pickingTable) {
        pickingTable.update(appState.pickListItems);
    } else {
        console.error('Tabellkomponent for plukk mangler');
    }
    
    // Variabler for totalberegninger
    let totalWeight = 0;
    let totalScannedItems = 0;
    let totalRequiredItems = 0;
    
    // Beregn totaler
    appState.pickListItems.forEach(item => {
        const currentCount = item.pickedCount || 0;
        
        // Legg til vekt for skannede varer
        if (currentCount > 0) {
            totalWeight += currentCount * (item.weight || 0);
        }
        
        // Tell opp totaler for statuslinje
        totalScannedItems += currentCount;
        totalRequiredItems += item.quantity;
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
    
    // Oppdater knappetilstander
    if (exportButton) exportButton.setDisabled(appState.pickListItems.length === 0);
    if (clearButton) clearButton.setDisabled(appState.pickListItems.length === 0);
    if (undoButton) undoButton.setDisabled(!appState.lastPickedItem);
}

/**
 * Filtrerer plukklisten basert på søkeord
 * @param {string} searchTerm - Søkeordet
 */
function filterPickList(searchTerm) {
    if (!pickingTable) return;
    
    if (!searchTerm || searchTerm.trim() === '') {
        // Vis alle elementer
        pickingTable.update(appState.pickListItems);
        return;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Filtrer elementer basert på søkeord
    const filteredItems = appState.pickListItems.filter(item => {
        return (
            (item.id && item.id.toLowerCase().includes(searchTermLower)) || 
            (item.description && item.description.toLowerCase().includes(searchTermLower))
        );
    });
    
    // Oppdater tabellen med filtrerte elementer
    pickingTable.update(filteredItems, false);
}

/**
 * Håndterer import av fil
 * @param {Event} event - Fil-input event
 */
function handlePickFileImport(event) {
    // Bruk den felles filimportfunksjonen fra core-module-handler
    handleModuleFileImport(event, 'pick', updatePickingUI);
    
    // Publiser hendelse om at data er lastet
    eventBus.publish(EventTypes.PICK_LIST_LOADED, {
        timestamp: new Date(),
        count: appState.pickListItems ? appState.pickListItems.length : 0,
        metadata: appState.pickListMetadata || {}
    });
}

/**
 * Kobler til Bluetooth-skanner for plukk
 */
async function connectToBluetoothPickScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await bluetoothScanner.connect();
    } catch (error) {
        showToast(error.message, 'error');
        
        // Publiser feilhendelse
        eventBus.publish(EventTypes.APP_ERROR, {
            source: 'bluetooth_scanner',
            message: error.message,
            module: 'pick'
        });
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
        
        // Publiser feilhendelse
        eventBus.publish(EventTypes.APP_ERROR, {
            source: 'camera_scanner',
            message: error.message,
            module: 'pick'
        });
    }
}

/**
 * Håndterer skanning for plukk med utvidet feillogging
 * @param {string|Object} barcode - Skannet strekkode
 */
function handlePickScan(barcode) {
    console.log("PLUKKDEBUG-P100: handlePickScan() starter med strekkode:", barcode);
    
    // Tøm input etter skanning
    if (pickManualScanEl) {
        pickManualScanEl.value = '';
    } else {
        console.warn("PLUKKADVARSEL-P101: pickManualScanEl er ikke definert");
    }
    
    // Bruk den generiske scan-handler funksjonen
    const result = handleModuleScan(barcode, 'pick');
    
    // Hvis skanningen var vellykket, oppdater UI og publiser hendelse
    if (result && result.success) {
        try {
            updatePickingUI();
            
            // Publiser hendelse om at vare er lagt til
            if (result.action === 'added') {
                eventBus.publish(EventTypes.PICK_ITEM_ADDED, {
                    barcode: barcode,
                    itemId: result.item ? result.item.id : null,
                    item: result.item,
                    timestamp: new Date()
                });
            }
            // Publiser hendelse om at vare er oppdatert (tellerhendelse)
            else if (result.action === 'updated') {
                eventBus.publish(EventTypes.PICK_ITEM_UPDATED, {
                    barcode: barcode,
                    itemId: result.item ? result.item.id : null,
                    item: result.item,
                    count: result.item ? result.item.pickedCount : 0,
                    timestamp: new Date()
                });
            }
            
            // Publiser at plukklisten er oppdatert
            eventBus.publish(EventTypes.PICK_LIST_UPDATED, {
                timestamp: new Date(),
                totalItems: appState.pickListItems.length,
                pickedItems: appState.pickListItems.filter(item => item.pickedCount && item.pickedCount > 0).length,
                isComplete: appState.pickListItems.every(item => (item.pickedCount || 0) >= item.quantity)
            });
            
            // Hvis plukking er fullført, publiser hendelse om det
            if (appState.pickListItems.every(item => (item.pickedCount || 0) >= item.quantity)) {
                eventBus.publish(EventTypes.PICK_LIST_COMPLETED, {
                    timestamp: new Date(),
                    itemCount: appState.pickListItems.length
                });
                
                // Vis melding til brukeren
                showToast('Plukklisten er fullført! Alle varer er plukket.', 'success', 5000);
            }
        } catch (uiError) {
            console.error(`PLUKKFEIL-P007: Feil ved oppdatering av UI:`, uiError);
            alert(`UI-FEIL P007: Kunne ikke oppdatere visningen: ${uiError.message}`);
            
            // Publiser feilhendelse
            eventBus.publish(EventTypes.APP_ERROR, {
                source: 'picking_ui_update',
                message: uiError.message,
                error: uiError,
                module: 'pick'
            });
        }
    }
    
    console.log(`PLUKKDEBUG-P116: handlePickScan() fullført for strekkode ${barcode}`);
}

/**
 * Angrer siste skanning
 */
function undoLastPickScan() {
    const lastItem = appState.lastPickedItem;
    
    // Bruk den felles undo-funksjonen fra core-module-handler
    const result = undoLastModuleScan('pick', updatePickingUI);
    
    if (result && result.success && lastItem) {
        // Publiser hendelse om at vare er fjernet
        eventBus.publish(EventTypes.PICK_ITEM_REMOVED, {
            itemId: lastItem.id,
            item: lastItem,
            timestamp: new Date()
        });
        
        // Publiser at plukklisten er oppdatert
        eventBus.publish(EventTypes.PICK_LIST_UPDATED, {
            timestamp: new Date(),
            totalItems: appState.pickListItems.length,
            pickedItems: appState.pickListItems.filter(item => item.pickedCount && item.pickedCount > 0).length,
            isComplete: appState.pickListItems.every(item => (item.pickedCount || 0) >= item.quantity)
        });
    }
}

/**
 * Eksporterer plukklisten
 * @param {string} format - Format for eksport (pdf, csv, json, txt, html)
 */
function exportPickList(format = 'pdf') {
    // Hent brukerinformasjon
    const userName = appState.user ? appState.user.name : 'ukjent';
    const now = new Date();
    const dateStr = formatDate(now, 'YYYY_MM_DD_HH');
    
    // Hent informasjon om opprinnelig filnavn
    let fileName = '';
    if (appState.pickListMetadata && appState.pickListMetadata.originalFilename) {
        // Bruk originalfilnavnet, men legg til brukernavn på starten
        fileName = `${userName}_${appState.pickListMetadata.originalFilename}`;
    } else {
        // Hvis vi ikke har originalfilnavn, bruk standard format
        fileName = `${userName}_Plukke_liste_TI${Math.floor(100000 + Math.random() * 900000)}_${dateStr}.pdf`;
    }
    
    // Sørg for at filnavnet er gyldig
    fileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    
    // Bruk den generiske eksportfunksjonen fra core-module-handler
    const result = exportModuleList(appState.pickListItems, 'pick', format, {
        title: 'Plukkliste',
        subtitle: 'Eksportert fra SnapScan',
        exportDate: now,
        showStatus: true,
        customFileName: fileName
    });
    
    // Publiser hendelse om at eksporten er gjennomført
    if (result && result.success) {
        eventBus.publish(EventTypes.DATA_SAVED, {
            type: 'pick_export',
            format: format,
            fileName: result.fileName,
            timestamp: new Date()
        });
    }
}

/**
 * Tømmer plukklisten
 */
function clearPickList() {
    // Bruk den felles clearModuleList-funksjonen fra core-module-handler
    const result = clearModuleList('pick', updatePickingUI);
    
    if (result && result.success) {
        // Publiser hendelse om at listen er tømt
        eventBus.publish(EventTypes.PICK_LIST_UPDATED, {
            timestamp: new Date(),
            totalItems: 0,
            pickedItems: 0,
            isComplete: false,
            cleared: true
        });
        
        // Vis melding til brukeren
        showToast('Plukklisten er tømt.', 'info');
    }
}