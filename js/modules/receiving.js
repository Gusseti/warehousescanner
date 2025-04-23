// receiving.js - Funksjonalitet for mottak-modulen
import { appState } from '../app.js';
import { showToast, blinkBackground, playErrorSound } from './utils.js';
import { saveListsToStorage } from './storage.js';
import { updateScannerStatus } from './ui.js';
import { initCameraScanner, startCameraScanning, stopCameraScanning, connectToBluetoothScanner } from './scanner.js';
import { openWeightModal } from './weights.js';
import { openQuantityModal, initQuantity } from './quantity.js';
import { importFromCSV, importFromJSON, importFromPDF, importFromReceiptPDF, exportList, exportWithFormat, exportToPDF } from './import-export.js';


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
    console.log("Initialiserer mottak-modul");
    
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
    
    // Legg til event listeners
    setupReceivingEventListeners();
    
    // Oppdater UI basert på lagrede data
    updateReceivingUI();
    
    console.log("Mottak-modul initialisert");
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
        
        // Legg til hendelse for å angi antall ved dobbeltklikk
        tr.addEventListener('dblclick', function() {
            openQuantityModal(item.id);
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
                // Valider og rens importerte varer
                validateAndCleanReceivedItems();
                updateReceivingUI();
                saveListsToStorage();
            })
            .catch(error => {
                // Hvis Kvik import feiler, prøv standard PDF-import
                console.warn('Kvik følgeseddel-import feilet, prøver standard PDF-import:', error);
                importFromPDF(file, 'receive')
                    .then(() => {
                        // Valider og rens importerte varer
                        validateAndCleanReceivedItems();
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
                
                // Valider og rens importerte varer
                validateAndCleanReceivedItems();
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
 * Validerer og renser importerte varer
 * - Fjerner poster som inneholder "Kundenr." eller lignende
 * - Bruker produktnummer (varenr) direkte for identifisering
 */
function validateAndCleanReceivedItems() {
    if (!appState.receiveListItems || appState.receiveListItems.length === 0) {
        return;
    }

    const validatedItems = [];
    
    // Sjekk hver vare i listen
    appState.receiveListItems.forEach((item, index) => {
        const itemId = item.id;
        
        // Sjekk om dette er en systempost (f.eks. kundenummer)
        if (itemId && (
            itemId.includes('Kundenr.') || 
            itemId.toLowerCase().includes('ordrenr') ||
            (itemId.match(/^[A-Z]{2}\d{6}/) && item.description && item.description.includes('Kundenr'))
        )) {
            console.log(`Filtrerer ut systempost: ${itemId}`);
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
                console.log(`Ekstraherer originalt produktnummer fra ${itemId}: ${originalProductId}`);
                productId = originalProductId;
            }
        }

        // Oppdater produktdetaljer
        item.id = productId;
        if (description) {
            item.description = description;
        }
        
        // Valider vekten - hvis den er svært høy, sett til en default verdi
        if (item.weight && item.weight > 10000) {
            console.log(`Unormal vekt oppdaget for ${item.id}: ${item.weight}kg, justerer til standard vekt`);
            item.weight = appState.settings.defaultItemWeight || 1;
        }
        
        validatedItems.push(item);
    });
    
    // Oppdater listen med validerte varer
    appState.receiveListItems = validatedItems;
    
    // Logg resultatet
    console.log(`Validering fullført: ${validatedItems.length} varer beholdt`);
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
 * @param {string} barcode - Skannet strekkode eller varenummer
 */
export function handleReceiveScan(barcode) {
    if (appState.currentModule !== 'receiving') {
        console.log('Merk: handleReceiveScan kalles mens en annen modul er aktiv:', appState.currentModule);
        // Vi fortsetter likevel med funksjonen i tilfelle dette er et direkte kall
    }
    
    console.log('Håndterer strekkode i mottak-modulen:', barcode);
    
    if (!barcode) return;
    
    // Tøm input etter skanning
    if (receiveManualScanEl) {
        receiveManualScanEl.value = '';
    }
    
    // Normaliser input (fjern hvitspace, etc.)
    barcode = barcode.toString().trim();
    
    // Sjekk om input er et varenummer direkte
    let itemId = barcode;
    let description = 'Ukjent vare';
    let isDirectProductId = false;
    let isKnownItem = false;
    
    // Sjekk om det som ble skannet er et varenummer (ikke strekkode)
    // Produktnummer har ofte formatet 000-XX9999 eller lignende
    if (barcode.includes('-')) {
        // Sjekk om dette varenummeret finnes i vår database
        for (const [ean, data] of Object.entries(appState.barcodeMapping)) {
            const productId = typeof data === 'object' ? data.id : data;
            
            if (productId === barcode) {
                isDirectProductId = true;
                isKnownItem = true;
                itemId = barcode; // Behold varenummeret direkte
                // Finn beskrivelse hvis tilgjengelig
                if (typeof data === 'object' && data.description) {
                    description = data.description;
                }
                console.log('Fant varenummer direkte:', itemId, 'Beskrivelse:', description);
                break;
            }
        }
    }
    
    // Hvis ikke funnet som varenummer, sjekk om det er en strekkode
    if (!isDirectProductId && appState.barcodeMapping[barcode]) {
        isKnownItem = true;
        const data = appState.barcodeMapping[barcode];
        
        if (typeof data === 'object' && data.id) {
            itemId = data.id;
            description = data.description || 'Ukjent vare';
        } else {
            itemId = data;
        }
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Logger for debug
    console.log(`DEBUG INFO - Skannet: ${barcode}, Mappet til itemId: ${itemId}`);
    console.log(`DEBUG INFO - Mottaksliste inneholder ${appState.receiveListItems.length} varer`);
    
    // Finn varen i mottakslisten - her bruker vi alle mulige variasjoner
    // for å sikre at vi finner den riktige varen
    let item = null;
    
    // 1. Prøv først direkte med itemId
    item = appState.receiveListItems.find(item => item.id === itemId);
    
    // 2. Hvis ikke funnet, prøv direkte med opprinnelig barcode
    if (!item) {
        item = appState.receiveListItems.find(item => item.id === barcode);
        if (item) {
            console.log(`Fant vare med opprinnelig strekkode: ${barcode}`);
            itemId = barcode; // Bruk original strekkode siden det er det som er i listen
        }
    }
    
    // 3. Prøv case-insensitive sammenligning hvis fortsatt ikke funnet
    if (!item) {
        const lowerItemId = itemId.toLowerCase();
        item = appState.receiveListItems.find(item => 
            item.id.toLowerCase() === lowerItemId);
            
        if (item) {
            console.log(`Fant vare med case-insensitive sammenligning: ${item.id}`);
            itemId = item.id; // Bruk ID fra listen, den har riktig formatering
        }
    }
    
    // 4. Forsøk å finne nesten-matchende varer hvis ikke funnet
    if (!item) {
        // Fjern eventuelt mellomrom og bindestreker for sammenligning
        const cleanItemId = itemId.replace(/[\s-]/g, '');
        
        for (const listItem of appState.receiveListItems) {
            const cleanListItemId = listItem.id.replace(/[\s-]/g, '');
            if (cleanListItemId === cleanItemId) {
                item = listItem;
                console.log(`Fant vare med normalisert varenummer: ${listItem.id}`);
                itemId = listItem.id; // Bruk ID fra listen
                break;
            }
        }
    }
    
    // Logger hver vare i listen for debugging
    if (!item) {
        console.log('DEBUG: Kunne ikke finne varen. Her er alle varer i listen:');
        appState.receiveListItems.forEach(listItem => {
            console.log(`Liste-ID: ${listItem.id}, Beskrivelse: ${listItem.description}`);
        });
    }
    
    // Håndtere varer som ikke er i listen
    if (!item) {
        showToast(`Vare "${itemId}" finnes ikke i mottakslisten. Kun varer i mottakslisten kan skannes.`, 'error');
        blinkBackground('red');
        playErrorSound();
        return;
    }
    
    // Her fortsetter vi med eksisterende kode for å registrere varen
    // Initialisere tellefelt hvis det ikke eksisterer
    if (item.receivedCount === undefined) {
        item.receivedCount = 0;
    }
    
    // Sjekk om vi har mottatt alle enhetene av denne varen
    if (item.receivedCount >= item.quantity) {
        // Sjekk hvis vi har overstyr-innstilling for ferdig mottatte varer
        if (appState.settings.allowOverScanning) {
            // Fortsette med skanning (overskrider forventet antall)
            showToast(`Merk: ${item.quantity} enheter av "${itemId}" er allerede mottatt. Overskanning aktivert.`, 'warning');
            blinkBackground('orange');
        } else {
            // Stopp videre skanning av denne varen
            showToast(`Alle ${item.quantity} enheter av "${itemId}" er allerede mottatt! Videre skanning blokkert.`, 'error');
            blinkBackground('red');
            playErrorSound();
            return;
        }
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
    
    // Sjekk om alle varer er mottatt
    const unfinishedItems = appState.receiveListItems.filter(item => !item.received);
    
    if (unfinishedItems.length > 0) {
        // Beregn totalt antall umottatte varer og antall som mangler
        const totalUnreceived = unfinishedItems.reduce((sum, item) => {
            const remaining = item.quantity - (item.receivedCount || 0);
            return sum + remaining;
        }, 0);
        
        // Vis bekreftelsesdialog
        if (!confirm(`Advarsel: ${unfinishedItems.length} varelinjer (totalt ${totalUnreceived} enheter) er ikke ferdig mottatt.\n\nVil du eksportere likevel?`)) {
            return; // Brukeren valgte å avbryte
        }
    }
    
    try {
        if (format.toLowerCase() === 'pdf') {
            // Bruk den nye PDF-eksportfunksjonen
            exportToPDF(appState.receiveListItems, 'mottak', {
                title: 'Mottaksliste',
                subtitle: 'Eksportert fra SnapScan',
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