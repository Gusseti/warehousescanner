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
    exportToPDF 
} from './import-export.js';

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
    // Fjernet referanser til importReceiveFileEl og importReceiveBtnEl som ikke lenger eksisterer i HTML
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
    // Fjernet referanser til importReceiveBtnEl og importReceiveFileEl som ikke lenger eksisterer

    // Ny eventlytter for Delivery Slip-knappen
    const importDeliverySlipBtn = document.getElementById('importDeliverySlipBtn');
    if (importDeliverySlipBtn) {
        importDeliverySlipBtn.addEventListener('click', function() {
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
        });
    }
    
    // Fjernet referanse til addReceiveBtn som ikke lenger eksisterer
    
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
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            
            // Sjekk filtypen basert på filendelse eller innhold
            if (file.name.endsWith('.json')) {
                importFromJSON(content, file.name, 'receive');
            } else if (file.name === 'Delivery slip.txt' || file.name.toLowerCase().includes('delivery slip')) {
                // Spesialhåndtering for Delivery slip.txt
                importFromDeliverySlip(content, file.name, 'receive');
            } else {
                importFromCSV(content, file.name, 'receive');
            }
            
            // Håndter legg-til-modus
            if (appendMode) {
                mergeReceivedItems(existingItems);
            }
            
            // Valider og rens importerte varer
            validateAndCleanReceivedItems();
            updateReceivingUI();
            saveListsToStorage();
            
            showSuccessMessage(appendMode);
            
        } catch (error) {
            console.error('Feil ved import av fil:', error);
            showToast('Feil ved import av fil. Sjekk filformatet.', 'error');
        }
    };
    
    reader.readAsText(file);
    
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
    
    console.log(`Total mengde importerte varer før deduplisering: ${allImportedItems.length}`);
    
    // Enkel validering - fjern varer uten ID
    allImportedItems = allImportedItems.filter(item => item && item.id);
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
            // Dette er en ny vare, legg den til i kartet
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
 * Kobler til Bluetooth-skanner for mottak
 */
async function connectToBluetoothReceiveScanner() {
    try {
        showToast('HID-skannerstøtte er aktivert. Koble til skanneren via Windows Bluetooth-innstillinger. Du kan nå begynne å skanne.', 'info');
        
        // Sjekk om skanneren allerede er koblet til via Windows Bluetooth
        const deviceInfo = bluetoothScanner.getDeviceInfo();
        if (deviceInfo) {
            showToast(`Allerede koblet til: ${deviceInfo.name}`, 'success');
        } else {
            // Prøv Web Bluetooth-tilkobling som backup hvis brukeren foretrekker det
            await bluetoothScanner.connect();
        }
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
            itemId = barcode; // Bruk original strekkode siden det er det som er i listen
        }
    }
    
    // 3. Prøv case-insensitive sammenligning hvis fortsatt ikke funnet
    if (!item) {
        const lowerItemId = itemId.toLowerCase();
        item = appState.receiveListItems.find(item => 
            item.id.toLowerCase() === lowerItemId);
            
        if (item) {
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
                itemId = listItem.id; // Bruk ID fra listen
                break;
            }
        }
    }
    
    // Håndtere varer som ikke er i listen
    if (!item) {
        console.error(`Vare "${itemId}" finnes ikke i mottakslisten`);
        
        // NYTT: Vis tydelig statusmelding i toppen
        showStatusMessage(`Vare "${itemId}" finnes ikke i mottakslisten!`, 'error', 5000);
        
        showToast(`Vare "${itemId}" finnes ikke i mottakslisten. Kun varer i mottakslisten kan skannes.`, 'error');
        blinkBackground('red');
        playErrorSound();
        return;
    }
    
    // NYTT: Scroll til og fremhev raden i tabellen
    const scrollSuccess = scrollToTableRow(itemId, 'receiveList', true);
    console.log(`Scroll til vare ${itemId} i tabellen: ${scrollSuccess ? 'vellykket' : 'mislykket'}`);
    
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
            
            // NYTT: Vis statusmelding om overskanning
            showStatusMessage(`Merk: ${item.quantity} enheter av "${itemId}" er allerede mottatt. Overskanning aktivert.`, 'warning', 3000);
            
            showToast(`Merk: ${item.quantity} enheter av "${itemId}" er allerede mottatt. Overskanning aktivert.`, 'warning');
            blinkBackground('orange');
        } else {
            // Stopp videre skanning av denne varen
            
            // NYTT: Vis tydelig statusmelding i toppen
            showStatusMessage(`MAKS OPPNÅDD: Alle ${item.quantity} enheter av "${itemId}" er allerede mottatt!`, 'error', 5000);
            
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
        
        // NYTT: Vis statusmelding for fullstendig mottatt vare
        showStatusMessage(`Vare "${itemId}" er fullstendig mottatt!`, 'success', 3000);
        
        // NYTT: Spill suksesslyd
        playSuccessSound();
    } else {
        // NYTT: Vis statusmelding for delvis mottatt vare
        const remainingCount = item.quantity - item.receivedCount;
        showStatusMessage(`Mottatt vare "${itemId}" (${item.receivedCount}/${item.quantity}) - ${remainingCount} gjenstår`, 'info', 3000);
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

/**
 * Slår sammen og fjerner duplikater i mottakslisten
 * Denne kjøres etter import av flere filer for å sikre at 
 * duplikater på tvers av filer håndteres riktig
 */
function mergeAndDedupReceivedItems() {
    if (appState.receiveListItems.length === 0) return;
    
    console.log(`DEDUPE: Starter med ${appState.receiveListItems.length} varer`);
    
    // Bygg opp et nytt map basert på ID
    const mergedMap = {};
    
    // Gå gjennom alle varer
    appState.receiveListItems.forEach((item, index) => {
        if (!item || !item.id) {
            console.log(`DEDUPE: Ignorerer vare #${index} med manglende ID`);
            return; // Hopp over ugyldige varer
        }
        
        const itemId = item.id;
        console.log(`DEDUPE: Prosesserer vare med ID ${itemId}`);
        
        if (mergedMap[itemId]) {
            // Denne varen finnes allerede - slå sammen
            const existingItem = mergedMap[itemId];
            
            // Summer antall
            existingItem.quantity += item.quantity || 1;
            
            // Behold høyeste vekt hvis de er forskjellige
            if (item.weight && (!existingItem.weight || item.weight > existingItem.weight)) {
                existingItem.weight = item.weight;
            }
            
            // Maksimer receivedCount
            existingItem.receivedCount = Math.max(existingItem.receivedCount || 0, item.receivedCount || 0);
            
            // Oppdater beskrivelse hvis den nye er bedre/lengre
            if (item.description && (!existingItem.description || item.description.length > existingItem.description.length)) {
                existingItem.description = item.description;
            }
            
            console.log(`DEDUPE: Slått sammen duplikat '${itemId}' - Nytt antall = ${existingItem.quantity}, mottatt = ${existingItem.receivedCount || 0}`);
        } else {
            // Varen finnes ikke - legg den til i kartet
            // Sikre at alle nødvendige felter er satt
            mergedMap[itemId] = { 
                ...item,
                quantity: item.quantity || 1,
                weight: item.weight || appState.settings.defaultItemWeight || 1.0,
                receivedCount: item.receivedCount || 0
            };
            console.log(`DEDUPE: La til ny vare '${itemId}' - Antall = ${mergedMap[itemId].quantity}`);
        }
    });
    
    // Konverter map til array og sorter etter ID
    const mergedArray = Object.values(mergedMap);
    
    // Oppdater received-status basert på receivedCount
    mergedArray.forEach(item => {
        item.received = (item.receivedCount || 0) >= (item.quantity || 1);
    });
    
    // Sorter listen
    mergedArray.sort((a, b) => {
        // Sorter først etter leverandør (første del av varenr)
        const aPrefix = a.id.split('-')[0] || '';
        const bPrefix = b.id.split('-')[0] || '';
        if (aPrefix !== bPrefix) {
            return aPrefix.localeCompare(bPrefix);
        }
        // Deretter alfabetisk på hele varenummeret
        return a.id.localeCompare(b.id);
    });
    
    // Oppdater den globale listen
    appState.receiveListItems = mergedArray;
    
    console.log(`DEDUPE: Etter sammenslåing: ${appState.receiveListItems.length} unike varer`);
}

/**
 * Hjelpeefunksjon for å normalisere varenummer 
 * slik at vi kan matche på tvers av formatteringer
 */
function normalizeProductId(id) {
    if (!id) return '';
    // Fjern eventuelle ekstra mellomrom før og etter
    return id.trim();
}

/**
 * Beriker varen med informasjon fra barcodes.json hvis tilgjengelig
 */
function enrichItemFromBarcodes(item) {
    if (!item || !item.id) return;
    
    // Sjekk om dette varenummeret er kjent i barcodes.json
    for (const [barcode, data] of Object.entries(appState.barcodeMapping)) {
        const productId = typeof data === 'object' ? data.id : data;
        
        // Sjekk for direkte match på varenummer
        if (productId === item.id) {
            // Oppdater beskrivelse hvis tilgjengelig
            if (typeof data === 'object' && data.description && (!item.description || data.description.length > item.description.length)) {
                item.description = data.description;
            }
            
            // Oppdater vekt hvis tilgjengelig
            if (typeof data === 'object' && data.weight && (!item.weight || data.weight > item.weight)) {
                item.weight = data.weight;
            }
            
            break;
        }
    }
}

/**
 * Validerer importerte varer og fjerner ugyldige oppføringer
 */
function validateImportedItems(items) {
    if (!items || items.length === 0) return [];
    
    const validItems = [];
    let filteredCount = 0;
    let correctedCount = 0;
    
    // Maksimale fornuftige verdier
    const MAX_REASONABLE_WEIGHT = 1000; // kg per enhet
    const MAX_REASONABLE_QUANTITY = 10000; // antall av en vare
    
    items.forEach(item => {
        if (!item || !item.id) {
            filteredCount++;
            return; // Hopp over ugyldige oppføringer
        }
        
        // Sjekk om dette er en systempost (f.eks. kundenummer)
        if (item.id.includes('Kundenr.') || 
            item.id.toLowerCase().includes('ordrenr') || 
            (item.id.match(/^[A-Z]{2}\d{6}/) && item.description && item.description.includes('Kundenr'))) {
            filteredCount++;
            return;
        }
        
        let modified = false;
        
        // Valider og korrieger vekt
        if (item.weight === undefined || item.weight === null) {
            item.weight = appState.settings.defaultItemWeight || 1.0;
            modified = true;
        } else if (item.weight > MAX_REASONABLE_WEIGHT || item.weight <= 0) {
            item.weight = appState.settings.defaultItemWeight || 1.0;
            modified = true;
        }
        
        // Valider og korriget antall
        if (item.quantity === undefined || item.quantity === null) {
            item.quantity = 1;
            modified = true;
        } else if (item.quantity > MAX_REASONABLE_QUANTITY || item.quantity <= 0) {
            item.quantity = 1;
            modified = true;
        }
        
        // Initialiser mottaksfelt
        if (item.receivedCount === undefined) {
            item.receivedCount = 0;
        }
        
        if (item.received === undefined) {
            item.received = false;
        }
        
        if (modified) {
            correctedCount++;
        }
        
        validItems.push(item);
    });
    
    return validItems;
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