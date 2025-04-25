// receiving.js - Funksjonalitet for mottak-modulen
import { appState } from '../app.js';
import { showToast, blinkBackground, playErrorSound } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, bluetoothScanner } from './scanner.js';
import { openWeightModal } from './weights.js';
import { openQuantityModal, initQuantity } from './quantity.js';
import { 
    importFromCSV, 
    importFromJSON,
    importFromDeliverySlip,
    exportList, 
    exportWithFormat, 
    exportToPDF,
    handleFileImport
} from './import-export.js';
import { 
    mapBarcodeToProductId, 
    getProductDataFromBarcodes, 
    normalizeProductId,
    findDescriptionFromBarcodes,
    findWeightFromBarcodes
} from './barcode-matcher.js';
import {
    handleModuleScan,
    handleModuleFileImport,
    exportModuleList,
    undoLastModuleScan,
    clearModuleList
} from './core-module-handler.js';

// Importer UI-komponenter
import { ButtonComponent } from '../components/ButtonComponent.js';
import { TableComponent } from '../components/TableComponent.js';
import { SearchComponent } from '../components/SearchComponent.js';

// Komponenter
let receivingTable;
let receivingSearch;
let importButton;
let exportButton;
let clearButton;
let undoButton;
let connectScannerButton;
let cameraScannerButton;
let scanButton;
let deliverySlipButton;

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
let receiveSearchContainerEl;
let receiveButtonContainerEl;
let receiveTableContainerEl;

/**
 * Initialiserer mottak-modulen
 */
export function initReceiving() {
    console.log("Initialiserer mottak-modul");
    
    // Hent DOM-elementer
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
    
    // Nye container-elementer for komponenter
    receiveSearchContainerEl = document.getElementById('receiveSearchContainer');
    receiveButtonContainerEl = document.getElementById('receiveButtonContainer');
    receiveTableContainerEl = document.getElementById('receiveTableContainer');
    
    // Hvis container-elementene ikke eksisterer, oppretter vi dem
    if (!receiveSearchContainerEl) {
        receiveSearchContainerEl = document.createElement('div');
        receiveSearchContainerEl.id = 'receiveSearchContainer';
        receiveListEl.parentNode.insertBefore(receiveSearchContainerEl, receiveListEl);
    }
    
    if (!receiveButtonContainerEl) {
        receiveButtonContainerEl = document.createElement('div');
        receiveButtonContainerEl.id = 'receiveButtonContainer';
        receiveButtonContainerEl.className = 'button-container';
        receiveListEl.parentNode.insertBefore(receiveButtonContainerEl, receiveListEl);
    }
    
    if (!receiveTableContainerEl) {
        receiveTableContainerEl = document.createElement('div');
        receiveTableContainerEl.id = 'receiveTableContainer';
        receiveListEl.parentNode.replaceChild(receiveTableContainerEl, receiveListEl);
    }
    
    // VIKTIG FIX: Gjøre handleReceiveScan tilgjengelig globalt
    // Dette sikrer at funksjonen alltid er tilgjengelig for skanneren
    if (typeof window.handleReceiveScan !== 'function') {
        window.handleReceiveScan = handleReceiveScan;
        console.log("Registrerte window.handleReceiveScan");
    }
    
    // Initialiser kameraskanneren for mottak med modulspesifikk callback
    initCameraScanner(
        videoReceiveScannerEl, 
        canvasReceiveScannerEl, 
        scannerReceiveOverlayEl, 
        handleReceiveScan,
        updateScannerStatus,
        'receive'  // Nytt parameter: modulnavn
    );
    
    // Initialiser antallsmodulen for å sette opp event listeners
    initQuantity();
    
    // Initialiser UI-komponenter
    initComponents();
    
    // Legg til event listeners
    setupReceivingEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReceivingUI();
    
    console.log("Mottak-modul initialisert");
}

/**
 * Initialiserer UI-komponenter
 */
function initComponents() {
    // Søkekomponent
    receivingSearch = new SearchComponent('receiveSearchContainer', {
        placeholder: 'Søk i mottakslisten...',
        onSearch: (searchTerm) => filterReceiveList(searchTerm)
    });
    
    // Knapper
    deliverySlipButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Importer leveranseseddel',
        type: 'primary',
        icon: 'upload-icon',
        id: 'importDeliverySlipBtn',
        onClick: () => {
            // Opprett et dedikert input-element for leveranseseddel
            const deliverySlipInput = document.createElement('input');
            deliverySlipInput.type = 'file';
            deliverySlipInput.accept = '.txt';
            
            // Håndter fil-utvelgelse
            deliverySlipInput.addEventListener('change', function(event) {
                if (event.target.files.length > 0) {
                    const file = event.target.files[0];
                    handleDeliverySlipImport(file);
                }
            });
            
            // Utløs fil-dialog
            deliverySlipInput.click();
        }
    });
    
    connectScannerButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Koble til skanner',
        type: 'secondary',
        icon: 'bluetooth-icon',
        id: 'connectScannerReceive',
        onClick: () => connectToBluetoothReceiveScanner()
    });
    
    cameraScannerButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Kameraskanner',
        type: 'secondary',
        icon: 'camera-icon',
        id: 'cameraScannerReceive',
        onClick: () => startReceiveCameraScanning()
    });
    
    scanButton = new ButtonComponent('receiveManualScanContainer', {
        text: 'Skann',
        type: 'success',
        id: 'receiveManualScanBtn',
        onClick: () => handleReceiveScan(receiveManualScanEl.value)
    });
    
    undoButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Angre siste',
        type: 'warning',
        icon: 'undo-icon',
        id: 'receiveUndoBtn',
        onClick: () => undoLastReceiveScan(),
        disabled: !appState.lastReceivedItem
    });
    
    exportButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Eksporter liste',
        type: 'info',
        icon: 'export-icon',
        id: 'receiveExportBtn',
        onClick: () => exportReceiveList('pdf'),
        disabled: appState.receiveListItems.length === 0
    });
    
    clearButton = new ButtonComponent('receiveButtonContainer', {
        text: 'Tøm liste',
        type: 'danger',
        icon: 'trash-icon',
        id: 'receiveClearBtn',
        onClick: () => clearReceiveList(),
        disabled: appState.receiveListItems.length === 0
    });
    
    // Tabellkomponent
    receivingTable = new TableComponent('receiveTableContainer', {
        columns: [
            { field: 'id', title: 'Varenr', sortable: true },
            { field: 'description', title: 'Beskrivelse', sortable: true },
            { 
                field: 'quantity', 
                title: 'Antall', 
                sortable: true,
                renderer: (value, row) => `${row.receivedCount || 0} / ${row.quantity}`
            },
            { 
                field: 'weight', 
                title: 'Vekt', 
                sortable: true,
                renderer: (value, row) => `${((row.weight || 0) * row.quantity).toFixed(2)} ${appState.settings.weightUnit || 'kg'}`
            },
            { 
                field: 'received', 
                title: 'Status', 
                sortable: true,
                renderer: (value, row) => {
                    const currentCount = row.receivedCount || 0;
                    if (currentCount === 0) {
                        return '<span class="badge" style="background-color: var(--gray)">Venter</span>';
                    } else if (currentCount < row.quantity) {
                        return `<span class="badge" style="background-color: var(--warning)">Delvis (${currentCount}/${row.quantity})</span>`;
                    } else {
                        return '<span class="badge badge-success">Mottatt</span>';
                    }
                }
            }
        ],
        data: appState.receiveListItems,
        onRowClick: (item) => openQuantityModal(item.id)
    });
}

/**
 * Setter opp event listeners for mottak-modulen
 */
function setupReceivingEventListeners() {
    closeReceiveScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerReceiveContainerEl.style.display = 'none';
    });
    
    receiveManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleReceiveScan(receiveManualScanEl.value);
        }
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#receivingModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportReceiveList(format);
        });
    });
}

/**
 * Oppdaterer UI for mottak-modulen
 */
export function updateReceivingUI() {
    // Oppdater tabelldata
    if (receivingTable) {
        receivingTable.update(appState.receiveListItems);
    } else {
        console.error('Tabellkomponent for mottak mangler');
    }
    
    // Variabler for totalberegninger
    let totalWeight = 0;
    let totalReceivedItems = 0;
    let totalRequiredItems = 0;
    
    // Beregn totaler
    appState.receiveListItems.forEach(item => {
        const currentCount = item.receivedCount || 0;
        
        // Legg til vekt for skannede varer
        if (currentCount > 0) {
            totalWeight += currentCount * (item.weight || 0);
        }
        
        // Tell opp totaler for statuslinje
        totalReceivedItems += currentCount;
        totalRequiredItems += item.quantity;
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
    
    // Oppdater knappetilstander
    if (exportButton) exportButton.setDisabled(appState.receiveListItems.length === 0);
    if (clearButton) clearButton.setDisabled(appState.receiveListItems.length === 0);
    if (undoButton) undoButton.setDisabled(!appState.lastReceivedItem);
}

/**
 * Filtrerer mottakslisten basert på søkeord
 * @param {string} searchTerm - Søkeordet
 */
function filterReceiveList(searchTerm) {
    if (!receivingTable) return;
    
    if (!searchTerm || searchTerm.trim() === '') {
        // Vis alle elementer
        receivingTable.update(appState.receiveListItems);
        return;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Filtrer elementer basert på søkeord
    const filteredItems = appState.receiveListItems.filter(item => {
        return (
            (item.id && item.id.toLowerCase().includes(searchTermLower)) || 
            (item.description && item.description.toLowerCase().includes(searchTermLower))
        );
    });
    
    // Oppdater tabellen med filtrerte elementer
    receivingTable.update(filteredItems, false);
}

// ...resten av koden forblir uendret...

/**
 * Kobler til Bluetooth-skanner for mottak
 */
async function connectToBluetoothReceiveScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await bluetoothScanner.connect();
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
 * @param {string} barcode - Skannet strekkode eller varenummer
 */
export function handleReceiveScan(barcode) {
    console.log(`Håndterer strekkode i mottak-modulen: ${barcode}`);
    
    if (!barcode) return;
    
    // Tøm input etter skanning
    if (receiveManualScanEl) {
        receiveManualScanEl.value = '';
    }
    
    // Bruk den generiske scan-handler funksjonen fra core-module-handler
    const result = handleModuleScan(barcode, 'receive');
    
    // Hvis skanningen var vellykket, oppdater UI
    if (result && result.success) {
        updateReceivingUI();
    }
}

/**
 * Angrer siste skanning
 */
function undoLastReceiveScan() {
    // Bruk den felles undo-funksjonen fra core-module-handler
    undoLastModuleScan('receive', updateReceivingUI);
}

/**
 * Eksporterer mottakslisten
 * @param {string} format - Format for eksport (pdf, csv, json, txt, html)
 */
function exportReceiveList(format = 'pdf') {
    // Bruk den generiske eksportfunksjonen fra core-module-handler
    exportModuleList(appState.receiveListItems, 'receive', format, {
        title: 'Mottaksliste',
        subtitle: 'Eksportert fra SnapScan',
        exportDate: new Date(),
        showStatus: true
    });
}

/**
 * Tømmer mottakslisten
 */
function clearReceiveList() {
    // Bruk den felles clearModuleList-funksjonen fra core-module-handler
    clearModuleList('receive', updateReceivingUI);
}

/**
 * Håndterer import av fil
 * @param {Event} event - Fil-input event
 * @param {boolean} appendMode - Legg til i eksisterende liste istedenfor å erstatte
 */
function handleReceiveFileImport(event, appendMode = false) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vis laster-melding
    const actionText = appendMode ? "Legger til" : "Importerer";
    showToast(`${actionText} mottaksliste...`, 'info');
    
    // Hvis vi ikke er i legg-til-modus og har eksisterende varer, spør brukeren
    if (!appendMode && appState.receiveListItems.length > 0) {
        if (!confirm('Du har allerede en aktiv mottaksliste. Vil du erstatte denne listen (OK) eller legge til i den eksisterende listen (Avbryt)?')) {
            // Brukeren valgte å legge til (Avbryt)
            appendMode = true;
        }
    }
    
    // Lagre eksisterende varer hvis vi er i legg-til-modus
    let existingItems = [];
    if (appendMode) {
        existingItems = [...appState.receiveListItems];
    }
    
    // Bruk den generiske filimportfunksjonen
    handleFileImport(file, 'receive', {
        onSuccess: () => {
            // Håndter legg-til-modus
            if (appendMode) {
                mergeReceivedItems(existingItems);
            }
            
            // Valider og rens importerte varer
            validateAndCleanReceivedItems();
            updateReceivingUI();
            saveListsToStorage();
            
            // Vis suksessmelding
            if (appendMode) {
                showToast(`Mottakslisten er utvidet med nye varer. Totalt ${appState.receiveListItems.length} varer.`, 'success');
            } else {
                showToast(`Mottaksliste importert med ${appState.receiveListItems.length} varer.`, 'success');
            }
        },
        onError: (error) => {
            console.error('Feil ved import av fil:', error);
            showToast('Feil ved import av fil: ' + error.message, 'error');
        }
    });
    
    // Reset file input
    event.target.value = '';
}

/**
 * Håndterer import av flere filer samtidig for mottak
 * - Enklere og mer direkte implementasjon for bedre pålitelighet
 * @param {FileList} files - Liste med filer som skal importeres
 * @param {boolean} appendMode - Legg til i eksisterende liste istedenfor å erstatte
 */
async function handleMultipleFilesImport(files, appendMode = true) {
    if (!files || files.length === 0) return;
    
    // Vis laster-melding
    const fileCount = files.length;
    showToast(`Importerer ${fileCount} ${fileCount === 1 ? 'fil' : 'filer'}...`, 'info');
    
    // Lagre eksisterende varer hvis vi er i append-modus
    const existingItems = appendMode ? [...appState.receiveListItems] : [];
    console.log(`Starter import av ${fileCount} filer. Eksisterende varer: ${existingItems.length}`);
    
    // Samlet liste med alle importerte varer
    let allImportedItems = [];
    
    // Prosesser hver fil separat
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Prosesserer fil ${i+1}/${fileCount}: "${file.name}"`);
        
        try {
            // Tøm appState.receiveListItems midlertidig for å håndtere hver fil separat
            appState.receiveListItems = [];
            
            if (file.type === 'application/pdf') {
                // For PDF-filer, bruker vi standard PDF import
                await importFromPDF(file, 'receive');
                console.log(`Importerte PDF-fil "${file.name}" - Fant ${appState.receiveListItems.length} varer`);
            } else {
                // For andre filtyper
                const content = await readFileAsText(file);
                
                if (file.name.endsWith('.json')) {
                    importFromJSON(content, file.name, 'receive');
                } else {
                    importFromCSV(content, file.name, 'receive');
                }
                
                console.log(`Importerte ${file.name} - Fant ${appState.receiveListItems.length} varer`);
            }
            
            // Legg til alle varer fra denne filen i vår samlede liste
            if (appState.receiveListItems.length > 0) {
                console.log(`Legger til ${appState.receiveListItems.length} varer fra "${file.name}" i total-listen`);
                allImportedItems = [...allImportedItems, ...appState.receiveListItems];
            }
            
        } catch (error) {
            console.error(`Feil ved import av fil ${file.name}:`, error);
            showToast(`Feil ved import av ${file.name}: ${error.message}`, 'error');
        }
        
        // Vis fremgangsstatus
        showToast(`Behandlet fil ${i+1} av ${fileCount}`, 'info');
    }
    
    console.log(`Etter enkel validering: ${allImportedItems.length} varer`);
    
    // Slå sammen eksisterende og nye varer (hvis appendMode)
    let combinedItems = appendMode ? [...existingItems, ...allImportedItems] : allImportedItems;
    console.log(`Kombinert liste (eksisterende + nye): ${combinedItems.length} varer`);
    
    // Deduplisering - fjern duplikater basert på varenummer
    const uniqueItemMap = {};
    
    combinedItems.forEach(item => {
        if (!item || !item.id) return;
        
        const itemId = item.id.trim();
        
        if (uniqueItemMap[itemId]) {
            // Denne varen eksisterer allerede i kartet, slå dem sammen
            const existingItem = uniqueItemMap[itemId];
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
            
            // Behold beste beskrivelse
            if (item.description && (!existingItem.description || 
                item.description.length > existingItem.description.length)) {
                existingItem.description = item.description;
            }
            
            // Bruk høyeste vekt
            if (item.weight && (!existingItem.weight || item.weight > existingItem.weight)) {
                existingItem.weight = item.weight;
            }
            
            // Behold høyeste receivedCount
            if ((item.receivedCount || 0) > (existingItem.receivedCount || 0)) {
                existingItem.receivedCount = item.receivedCount;
            }
        } else {
            // Dette er en ny vare, legg den til i listen
            // Sikre at alle nødvendige felter er satt
            uniqueItemMap[itemId] = {
                ...item,
                quantity: item.quantity || 1,
                weight: item.weight || appState.settings.defaultItemWeight || 1.0,
                receivedCount: item.receivedCount || 0,
                received: false,
                receivedAt: null
            };
        }
    });
    
    // Konverter map til array
    const finalItems = Object.values(uniqueItemMap);
    console.log(`Etter deduplisering: ${finalItems.length} unike varer`);
    
    // Oppdater appState
    appState.receiveListItems = finalItems;
    
    // Korrigere ekstreme verdier
    console.log('Korrigerer ekstreme vekter og antall...');
    for (const item of appState.receiveListItems) {
        // Korrigere ekstreme vekter
        if (item.weight > 1000 || item.weight <= 0) {
            console.log(`Korrigerer ekstrem vekt for ${item.id}: ${item.weight}kg -> 1.0kg`);
            item.weight = 1.0;
        }
        
        // Korrigere ekstreme antall
        if (item.quantity > 10000 || item.quantity <= 0) {
            console.log(`Korrigerer ekstremt antall for ${item.id}: ${item.quantity} -> 1`);
            item.quantity = 1;
        }
    }
    
    // Oppdater received status basert på receivedCount
    for (const item of appState.receiveListItems) {
        item.received = (item.receivedCount || 0) >= (item.quantity || 1);
    }
    
    // Oppdater UI og lagre endringer
    updateReceivingUI();
    saveListsToStorage();
    
    // Vis oppsummering
    console.log(`Import fullført: ${appState.receiveListItems.length} varer i den endelige listen`);
    showToast(`Import fullført. Totalt ${appState.receiveListItems.length} unike varer i mottakslisten.`, 'success');
}

/**
 * Leser en fil som tekst
 * @param {File} file - Filen som skal leses
 * @returns {Promise<string>} Innholdet av filen som tekst
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Viser suksessmelding etter import
 * @param {boolean} appendMode - Var det legg-til-modus?
 */
function showSuccessMessage(appendMode) {
    if (appendMode) {
        showToast(`Mottakslisten er utvidet med nye varer. Totalt ${appState.receiveListItems.length} varer.`, 'success');
    } else {
        showToast(`Mottaksliste importert med ${appState.receiveListItems.length} varer.`, 'success');
    }
}

/**
 * Slår sammen eksisterende mottaksliste med ny importert liste
 * @param {Array} existingItems - Eksisterende varer før import
 */
function mergeReceivedItems(existingItems) {
    if (!existingItems || existingItems.length === 0) return;
    
    const newItems = [...appState.receiveListItems];
    const mergedItems = [...existingItems];
    
    console.log(`MERGE DEBUG: Eksisterende varer: ${existingItems.length}, Nye varer: ${newItems.length}`);
    
    // Gå gjennom de nye varene
    newItems.forEach(newItem => {
        // Sjekk om varen allerede finnes i den eksisterende listen
        const existingItemIndex = mergedItems.findIndex(item => item.id === newItem.id);
        
        if (existingItemIndex !== -1) {
            // Varen finnes allerede - øk antallet
            const existingItem = mergedItems[existingItemIndex];
            
            // Legg sammen antall
            existingItem.quantity += newItem.quantity;
            
            // Behold høyeste vkt hvis de er forskjellige
            if (newItem.weight && (!existingItem.weight || newItem.weight > existingItem.weight)) {
                existingItem.weight = newItem.weight;
            }
            
            // Oppdater beskrivelse hvis den nye er bedre/lengre
            if (newItem.description && (!existingItem.description || newItem.description.length > existingItem.description.length)) {
                existingItem.description = newItem.description;
            }
            
            console.log(`Slått sammen duplikat vare '${newItem.id}': Nytt antall = ${existingItem.quantity}`);
        } else {
            // Varen finnes ikke - legg den til i listen
            mergedItems.push(newItem);
        }
    });
    
    // Oppdater den globale listen
    appState.receiveListItems = mergedItems;
    
    console.log(`MERGE DEBUG: Etter sammenslåing: ${appState.receiveListItems.length} varer`);
}

/**
 * Validerer og renser importerte varer
 * - Fjerner poster som inneholder "Kundenr." eller lignende
 * - Bruker produktnummer (varenr) direkte for identifisering
 * - Finner og korrigerer ekstreme vektverdier
 * - Korrigerer urimelige antallsverdier
 */
function validateAndCleanReceivedItems() {
    if (!appState.receiveListItems || appState.receiveListItems.length === 0) {
        return;
    }
    
    // Log opprinnelig antall for debugging
    const originalCount = appState.receiveListItems.length;
    console.log(`VALIDATION: Startet med ${originalCount} varer før validering`);
    
    const validatedItems = [];
    let filteredCount = 0;
    let fixedWeightCount = 0;
    let fixedQuantityCount = 0;
    
    // Maksimale fornuftige verdier
    const MAX_REASONABLE_WEIGHT = 1000; // kg per enhet
    const MAX_REASONABLE_QUANTITY = 10000; // antall av en vare
    
    // Sjekk hver vare i listen
    appState.receiveListItems.forEach((item, index) => {
        if (!item || !item.id) {
            console.log(`Ignorerte item #${index} med ugyldig ID:`, item);
            filteredCount++;
            return; // Hopp over denne posten
        }
        
        const itemId = item.id;
        
        // Sjekk om dette er en systempost (f.eks. kundenummer)
        if (itemId && (
            itemId.includes('Kundenr.') || 
            itemId.toLowerCase().includes('ordrenr') ||
            (itemId.match(/^[A-Z]{2}\d{6}/) && item.description && item.description.includes('Kundenr'))
        )) {
            console.log(`Filtrerte ut systempost: ${itemId}`);
            filteredCount++;
            return; // Hopp over denne posten
        }
        
        // Sjekk om det er snakk om et produkt vi kjenner igjen fra barcodes.json
        let productId = itemId;
        let description = item.description;
        
        // Hvis det er en ukjent strekkode, prøv å finne produktnummeret
        let isKnownProduct = false;
        
        // Sjekk om varenummeret (itemId) allerede er et produktnummer som finnes i barcodes.json
        for (const [barcode, data] of Object.entries(appState.barcodeMapping)) {
            const barcodeItemId = typeof data === 'object' ? data.id : data;
            // Sjekk om dette itemId matcher et produktnummer vi kjenner
            if (barcodeItemId === itemId) {
                isKnownProduct = true;
                // Hvis vi har en beskrivelse, bruk den
                if (typeof data === 'object' && data.description) {
                    description = data.description;
                }
                break;
            }
        }
        
        // Hvis vi ikke fant produktet, men det ser ut som et UKJ-prefiks,
        // prøv å ekstrahere det opprinnelige produktnummeret
        if (!isKnownProduct && itemId.startsWith('UKJ-')) {
            const parts = itemId.split('-');
            // UKJ-1-000-HS20860 format
            if (parts.length >= 3) {
                // Fjern UKJ-X- prefikset og bruk resten
                const originalProductId = parts.slice(2).join('-');
                productId = originalProductId;
            }
        }

        // Oppdater produktdetaljer
        item.id = productId;
        if (description) {
            item.description = description;
        }
        
        // Valider og korrieger vekt 
        if (item.weight === undefined || item.weight === null) {
            // Hvis vekten mangler, sett den til standard
            item.weight = appState.settings.defaultItemWeight || 1.0;
        } else {
            // Hvis vekten er ekstrem, korriget den
            const originalWeight = item.weight;
            
            // Sjekk om vekten er et ekstremt høyt tall (over MAX_REASONABLE_WEIGHT)
            if (item.weight > MAX_REASONABLE_WEIGHT) {
                item.weight = 1.0;
                fixedWeightCount++;
            }
            
            // Sjekk om vekten er en urimelig lav verdi
            if (item.weight <= 0) {
                item.weight = appState.settings.defaultItemWeight || 1.0;
                fixedWeightCount++;
            }
        }
        
        // Valider og korriget antall
        if (item.quantity === undefined || item.quantity === null) {
            // Hvis antall mangler, sett det til 1
            item.quantity = 1;
            fixedQuantityCount++;
        } else {
            const originalQuantity = item.quantity;
            
            // Sjekk om antallet er urimelig høyt (over MAX_REASONABLE_QUANTITY)
            if (item.quantity > MAX_REASONABLE_QUANTITY) {
                item.quantity = 1;
                fixedQuantityCount++;
            }
            
            // Sjekk om antallet er negativt eller 0
            if (item.quantity <= 0) {
                item.quantity = 1;
                fixedQuantityCount++;
            }
        }
        
        // Initialiser receivedCount om den ikke finnes
        if (item.receivedCount === undefined) {
            item.receivedCount = 0;
        }
        
        validatedItems.push(item);
    });
    
    // Oppdater listen med validerte varer
    appState.receiveListItems = validatedItems;
    
    // Logg resultatet med detaljert informasjon
    console.log(`VALIDATION: Filtrerte ut ${filteredCount} ugyldige oppføringer`);
    console.log(`VALIDATION: Korrigerte ${fixedWeightCount} varer med ekstreme vekter`);
    console.log(`VALIDATION: Korrigerte ${fixedQuantityCount} varer med ugyldige antall`);
    console.log(`VALIDATION: Beholdt ${validatedItems.length} av ${originalCount} varer etter validering`);
    
    // Oppdater grensesnittet for å vise riktig antall varer
    if (receiveFileInfoEl) {
        receiveFileInfoEl.textContent = `Aktiv mottaksliste: ${appState.receiveListItems.length} varer`;
    }
}

/**
 * Laster inn Delivery slip.txt direkte
 */
async function loadDeliverySlip() {
    try {
        showToast('Laster inn leveranseseddel...', 'info');
        
        // Hent Delivery slip.txt-filen direkte fra rotmappen
        const response = await fetch('Delivery slip.txt');
        if (!response.ok) {
            throw new Error('Kunne ikke finne "Delivery slip.txt". Sjekk at filen finnes i rotmappen.');
        }
        
        const content = await response.text();
        if (!content || content.trim().length === 0) {
            throw new Error('Filen "Delivery slip.txt" er tom.');
        }
        
        // Spør brukeren om vi skal erstatte eller legge til i eksisterende liste
        let appendMode = false;
        if (appState.receiveListItems.length > 0) {
            if (!confirm('Du har allerede en aktiv mottaksliste. Vil du erstatte denne listen (OK) eller legge til i den eksisterende listen (Avbryt)?')) {
                // Brukeren valgte å legge til (Avbryt)
                appendMode = true;
            }
        }
        
        // Lagre eksisterende varer hvis vi er i legg-til-modus
        let existingItems = [];
        if (appendMode) {
            existingItems = [...appState.receiveListItems];
        }
        
        // Importer leveranseseddelen
        importFromDeliverySlip(content, 'Delivery slip.txt', 'receive');
        
        // Håndter legg-til-modus
        if (appendMode) {
            mergeReceivedItems(existingItems);
        }
        
        // Valider og rens importerte varer
        validateAndCleanReceivedItems();
        updateReceivingUI();
        saveListsToStorage();
        
        showToast(`Leveranseseddel importert med ${appState.receiveListItems.length} varer!`, 'success');
        
    } catch (error) {
        console.error('Feil ved lasting av Delivery slip.txt:', error);
        showToast('Feil: ' + error.message, 'error');
    }
}

/**
 * Håndterer import av Delivery Slip filer
 * @param {File} file - Delivery Slip tekstfil
 */
function handleDeliverySlipImport(file) {
    if (!file) return;
    
    // Vis laster-melding
    showToast('Importerer leveranseseddel...', 'info');
    
    // Sjekk om brukeren vil erstatte eller legge til i eksisterende liste
    let appendMode = false;
    if (appState.receiveListItems.length > 0) {
        if (!confirm('Du har allerede en aktiv mottaksliste. Vil du erstatte denne listen (OK) eller legge til i den eksisterende listen (Avbryt)?')) {
            // Brukeren valgte å legge til (Avbryt)
            appendMode = true;
        }
    }
    
    // Lagre eksisterende varer hvis vi er i legg-til-modus
    let existingItems = [];
    if (appendMode) {
        existingItems = [...appState.receiveListItems];
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            
            if (!content || content.trim().length === 0) {
                throw new Error('Filen er tom.');
            }
            
            // Importer leveranseseddelen
            importFromDeliverySlip(content, file.name, 'receive');
            
            // Håndter legg-til-modus
            if (appendMode) {
                mergeReceivedItems(existingItems);
            }
            
            // Valider og rens importerte varer
            validateAndCleanReceivedItems();
            updateReceivingUI();
            saveListsToStorage();
            
            showToast(`Leveranseseddel importert med ${appState.receiveListItems.length} varer!`, 'success');
            
        } catch (error) {
            console.error('Feil ved import av leveranseseddel:', error);
            showToast('Feil: ' + error.message, 'error');
        }
    };
    
    reader.onerror = function() {
        showToast('Kunne ikke lese filen. Vennligst prøv igjen.', 'error');
    };
    
    reader.readAsText(file);
}