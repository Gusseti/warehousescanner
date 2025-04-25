// returns.js - Funksjonalitet for retur-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, bluetoothScanner } from './scanner.js';
import { exportList, exportWithFormat, exportToPDF } from './import-export.js';
import { openWeightModal } from './weights.js';
import { handleScannedBarcode } from './barcode-handler.js';
import {
    handleModuleScan,
    handleModuleFileImport,
    exportModuleList,
    clearModuleList
} from './core-module-handler.js';

// Importer UI-komponenter
import { ButtonComponent } from '../components/ButtonComponent.js';
import { TableComponent } from '../components/TableComponent.js';
import { SearchComponent } from '../components/SearchComponent.js';
import { DropdownSearchComponent } from '../components/DropdownSearchComponent.js';

// Komponenter
let returnsTable;
let returnsSearch;
let exportButton;
let clearButton;
let connectScannerButton;
let cameraScannerButton;
let scanButton;
let conditionDropdown;

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
let returnItemConditionEl; // Tilstandsvelgeren
let returnSearchContainerEl;
let returnButtonContainerEl;
let returnTableContainerEl;

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
    returnItemConditionEl = document.getElementById('returnItemCondition');
    
    // Nye container-elementer for komponenter
    returnSearchContainerEl = document.getElementById('returnSearchContainer');
    returnButtonContainerEl = document.getElementById('returnButtonContainer');
    returnTableContainerEl = document.getElementById('returnTableContainer');
    
    // Hvis container-elementene ikke eksisterer, oppretter vi dem
    if (!returnSearchContainerEl) {
        returnSearchContainerEl = document.createElement('div');
        returnSearchContainerEl.id = 'returnSearchContainer';
        returnListEl.parentNode.insertBefore(returnSearchContainerEl, returnListEl);
    }
    
    if (!returnButtonContainerEl) {
        returnButtonContainerEl = document.createElement('div');
        returnButtonContainerEl.id = 'returnButtonContainer';
        returnButtonContainerEl.className = 'button-container';
        returnListEl.parentNode.insertBefore(returnButtonContainerEl, returnListEl);
    }
    
    if (!returnTableContainerEl) {
        returnTableContainerEl = document.createElement('div');
        returnTableContainerEl.id = 'returnTableContainer';
        returnListEl.parentNode.replaceChild(returnTableContainerEl, returnListEl);
    }
    
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
    
    // Initialiser UI-komponenter
    initComponents();
    
    // Legg til event listeners
    setupReturnsEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReturnsUI();
    
    console.log("Retur-modul initialisert");
}

/**
 * Initialiserer UI-komponenter
 */
function initComponents() {
    // Søkekomponent
    returnsSearch = new SearchComponent('returnSearchContainer', {
        placeholder: 'Søk i returlisten...',
        onSearch: (searchTerm) => filterReturnList(searchTerm)
    });
    
    // Tilstandsvelger dropdown
    conditionDropdown = new DropdownSearchComponent('returnItemConditionContainer', {
        label: 'Tilstand',
        options: [
            { value: 'uåpnet', label: 'Uåpnet' },
            { value: 'åpnet', label: 'Åpnet' },
            { value: 'skadet', label: 'Skadet' }
        ],
        defaultValue: 'uåpnet',
        id: 'returnItemCondition'
    });
    
    // Knapper
    connectScannerButton = new ButtonComponent('returnButtonContainer', {
        text: 'Koble til skanner',
        type: 'secondary',
        icon: 'bluetooth-icon',
        id: 'connectScannerReturn',
        onClick: () => connectToBluetoothReturnScanner()
    });
    
    cameraScannerButton = new ButtonComponent('returnButtonContainer', {
        text: 'Kameraskanner',
        type: 'secondary',
        icon: 'camera-icon',
        id: 'cameraScannerReturn',
        onClick: () => startReturnCameraScanning()
    });
    
    scanButton = new ButtonComponent('returnManualScanContainer', {
        text: 'Skann',
        type: 'success',
        id: 'returnManualScanBtn',
        onClick: () => handleReturnScan(returnManualScanEl.value, parseInt(returnQuantityEl.value) || 1)
    });
    
    exportButton = new ButtonComponent('returnButtonContainer', {
        text: 'Eksporter liste',
        type: 'info',
        icon: 'export-icon',
        id: 'returnExportBtn',
        onClick: () => exportReturnList('pdf'),
        disabled: appState.returnListItems.length === 0
    });
    
    clearButton = new ButtonComponent('returnButtonContainer', {
        text: 'Tøm liste',
        type: 'danger',
        icon: 'trash-icon',
        id: 'clearReturnList',
        onClick: () => clearReturnList(),
        disabled: appState.returnListItems.length === 0
    });
    
    // Tabellkomponent
    returnsTable = new TableComponent('returnTableContainer', {
        columns: [
            { field: 'id', title: 'Varenr', sortable: true },
            { field: 'description', title: 'Beskrivelse', sortable: true },
            { field: 'quantity', title: 'Antall', sortable: true },
            { 
                field: 'condition', 
                title: 'Tilstand', 
                sortable: true,
                renderer: (value, row, index) => {
                    let colorClass = '';
                    if (value === 'uåpnet') {
                        colorClass = 'condition-unopened';
                    } else if (value === 'åpnet') {
                        colorClass = 'condition-opened';
                    } else if (value === 'skadet') {
                        colorClass = 'condition-damaged';
                    }
                    return `<span class="condition-cell ${colorClass}" data-index="${index}">${value} <i class="fas fa-edit edit-icon"></i></span>`;
                }
            },
            { 
                field: 'weight', 
                title: 'Vekt', 
                sortable: true,
                renderer: (value, row) => `${((row.weight || 0) * row.quantity).toFixed(2)} ${appState.settings.weightUnit || 'kg'}`
            },
            { 
                field: 'actions', 
                title: 'Handlinger', 
                sortable: false,
                renderer: (value, row, index) => {
                    return `<button class="btn btn-danger remove-return-item" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>`;
                }
            }
        ],
        data: appState.returnListItems,
        onRowClick: (item, index) => openWeightModal(item.id),
        onCellClick: (cellElement, field, row, index) => {
            if (field === 'condition') {
                openConditionModal(index);
                return true; // Indikerer at vi har håndtert klikket
            }
            return false; // La standardhåndteringen fortsette
        },
        rowClassGenerator: (item) => {
            if (item.condition === 'uåpnet') return 'item-unopened';
            if (item.condition === 'åpnet') return 'item-opened';
            if (item.condition === 'skadet') return 'item-damaged';
            return '';
        }
    });
}

/**
 * Setter opp event listeners for retur-modulen
 */
function setupReturnsEventListeners() {
    closeReturnScannerEl.addEventListener('click', function() {
        stopCameraScanning();
        cameraScannerReturnContainerEl.style.display = 'none';
    });
    
    returnManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleReturnScan(returnManualScanEl.value, parseInt(returnQuantityEl.value) || 1);
        }
    });
    
    // Eksportformat velgere
    document.querySelectorAll('#returnsModule .dropdown-content a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const format = this.getAttribute('data-format');
            exportReturnList(format);
        });
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
    
    // Lytter på remove-return-item knapper (delegert til tabellen)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.remove-return-item')) {
            const button = e.target.closest('.remove-return-item');
            const index = parseInt(button.getAttribute('data-index'));
            removeReturnItem(index);
        }
    });
}

/**
 * Filtrerer returlisten basert på søkeord
 * @param {string} searchTerm - Søkeordet
 */
function filterReturnList(searchTerm) {
    if (!returnsTable) return;
    
    if (!searchTerm || searchTerm.trim() === '') {
        // Vis alle elementer
        returnsTable.update(appState.returnListItems);
        return;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    
    // Filtrer elementer basert på søkeord
    const filteredItems = appState.returnListItems.filter(item => {
        return (
            (item.id && item.id.toLowerCase().includes(searchTermLower)) || 
            (item.description && item.description.toLowerCase().includes(searchTermLower)) ||
            (item.condition && item.condition.toLowerCase().includes(searchTermLower))
        );
    });
    
    // Oppdater tabellen med filtrerte elementer
    returnsTable.update(filteredItems, false);
}

/**
 * Oppdaterer UI for retur-modulen
 */
export function updateReturnsUI() {
    // Oppdater tabelldata
    if (returnsTable) {
        returnsTable.update(appState.returnListItems);
    } else {
        console.error('Tabellkomponent for retur mangler');
    }
    
    // Beregn total vekt
    let totalWeight = 0;
    appState.returnListItems.forEach(item => {
        totalWeight += item.quantity * (item.weight || 0);
    });
    
    // Oppdater totalvekt
    if (totalReturnWeightEl) {
        totalReturnWeightEl.textContent = `${totalWeight.toFixed(2)} ${appState.settings.weightUnit || 'kg'}`;
    }
    
    // Oppdater knappetilstander
    if (exportButton) exportButton.setDisabled(appState.returnListItems.length === 0);
    if (clearButton) clearButton.setDisabled(appState.returnListItems.length === 0);
}

/**
 * Kobler til Bluetooth-skanner for retur
 */
async function connectToBluetoothReturnScanner() {
    try {
        showToast('Kobler til Bluetooth-skanner...', 'info');
        await bluetoothScanner.connect();
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
    
    // Tøm input etter skanning
    if (returnManualScanEl) {
        returnManualScanEl.value = '';
    }
    
    // Retur-modulen bruker en annen tilnærming enn de andre modulene
    // Isteden for å bruke en forhåndsdefinert liste med varer,
    // lar vi brukeren legge til varer direkte i en liste
    
    // Her bruker vi ikke handleModuleScan direkte siden retur-modulen
    // har en annen logikk enn plukk og mottak
    
    // Håndterer tilfeller der barcode er et objekt
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
    const condition = conditionDropdown ? conditionDropdown.getValue() : 'uåpnet';
    
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
    // Bruk den generiske eksportfunksjonen fra core-module-handler
    exportModuleList(appState.returnListItems, 'return', format, {
        title: 'Returliste',
        subtitle: 'Eksportert fra SnapScan',
        exportDate: new Date(),
        showStatus: true
    });
}

/**
 * Tømmer returlisten
 */
function clearReturnList() {
    // Bruk den felles clearModuleList-funksjonen fra core-module-handler
    clearModuleList('return', updateReturnsUI);
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