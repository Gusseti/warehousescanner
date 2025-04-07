// Vent til dokumentet er fullstendig lastet
document.addEventListener('DOMContentLoaded', function() {
    // Datamodell for plukking
    let pickListItems = [];
    let pickedItems = [];
    let lastPickedItem = null;
    
    // Datamodell for mottak
    let receiveListItems = [];
    let receivedItems = [];
    let lastReceivedItem = null;
    
    // Datamodell for retur
    let returnListItems = [];
    
    // Bluetooth-skanner
    let bluetoothDevice = null;
    let isConnected = false;
    
    // Strekkodeoversikt
    let barcodeMapping = {}; 
    
    // Innstillinger
    let settings = {
        weightUnit: 'kg',
        defaultItemWeight: 1.0
    };
    
    // Vektdata for varer
    let itemWeights = {};
    
    // Gjeldende modul
    let currentModule = null;
    
    // DOM elementer - Hovedmeny
    const mainMenuEl = document.getElementById('mainMenu');
    const backButtonEl = document.getElementById('backButton');
    const menuItemsEl = document.querySelectorAll('.menu-item');
    
    // DOM elementer - Skanner
    const scannerIndicatorEl = document.getElementById('scannerIndicator');
    const scannerStatusEl = document.getElementById('scannerStatus');
    
    // DOM elementer - Modul containere
    const moduleContainersEl = document.querySelectorAll('.module-container');
    
    // DOM elementer - Plukk
    const importPickFileEl = document.getElementById('importPickFile');
    const importPickBtnEl = document.getElementById('importPickBtn');
    const pickFileInfoEl = document.getElementById('pickFileInfo');
    const connectScannerPickEl = document.getElementById('connectScannerPick');
    const pickListEl = document.getElementById('pickList');
    const pickStatusPickedEl = document.getElementById('pickStatusPicked');
    const pickStatusRemainingEl = document.getElementById('pickStatusRemaining');
    const pickStatusTextEl = document.getElementById('pickStatusText');
    const pickManualScanEl = document.getElementById('pickManualScan');
    const pickManualScanBtnEl = document.getElementById('pickManualScanBtn');
    const pickUndoBtnEl = document.getElementById('pickUndoBtn');
    const pickExportBtnEl = document.getElementById('pickExportBtn');
    const pickClearBtnEl = document.getElementById('pickClearBtn');
    const totalWeightEl = document.getElementById('totalWeight');
    
    // DOM elementer - Mottak
    const importReceiveFileEl = document.getElementById('importReceiveFile');
    const importReceiveBtnEl = document.getElementById('importReceiveBtn');
    const receiveFileInfoEl = document.getElementById('receiveFileInfo');
    const connectScannerReceiveEl = document.getElementById('connectScannerReceive');
    const receiveListEl = document.getElementById('receiveList');
    const receiveStatusReceivedEl = document.getElementById('receiveStatusReceived');
    const receiveStatusRemainingEl = document.getElementById('receiveStatusRemaining');
    const receiveStatusTextEl = document.getElementById('receiveStatusText');
    const receiveManualScanEl = document.getElementById('receiveManualScan');
    const receiveManualScanBtnEl = document.getElementById('receiveManualScanBtn');
    const receiveUndoBtnEl = document.getElementById('receiveUndoBtn');
    const receiveExportBtnEl = document.getElementById('receiveExportBtn');
    const receiveClearBtnEl = document.getElementById('receiveClearBtn');
    const totalReceiveWeightEl = document.getElementById('totalReceiveWeight');
    
    // DOM elementer - Retur
    const connectScannerReturnEl = document.getElementById('connectScannerReturn');
    const returnListEl = document.getElementById('returnList');
    const returnManualScanEl = document.getElementById('returnManualScan');
    const returnQuantityEl = document.getElementById('returnQuantity');
    const returnManualScanBtnEl = document.getElementById('returnManualScanBtn');
    const returnExportBtnEl = document.getElementById('returnExportBtn');
    const clearReturnListEl = document.getElementById('clearReturnList');
    const totalReturnWeightEl = document.getElementById('totalReturnWeight');
    
    // DOM elementer - Innstillinger
    const weightUnitEl = document.getElementById('weightUnit');
    const defaultItemWeightEl = document.getElementById('defaultItemWeight');
    const importBarcodeFileEl = document.getElementById('importBarcodeFile');
    const importBarcodeBtnEl = document.getElementById('importBarcodeBtn');
    const barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
    const clearBarcodeDataEl = document.getElementById('clearBarcodeData');
    const clearAllDataEl = document.getElementById('clearAllData');
    
    // DOM elementer - Vektmodal
    const weightModalEl = document.getElementById('weightModal');
    const weightModalItemIdEl = document.getElementById('weightModalItemId');
    const itemWeightEl = document.getElementById('itemWeight');
    const saveWeightBtnEl = document.getElementById('saveWeightBtn');
    const cancelWeightBtnEl = document.getElementById('cancelWeightBtn');
    const closeWeightModalEl = document.getElementById('closeWeightModal');
    
    // DOM elementer - Toast
    const toastEl = document.getElementById('toast');
    
    // Event listeners - Hovedmeny
    menuItemsEl.forEach(item => {
        item.addEventListener('click', function() {
            const module = this.getAttribute('data-module');
            showModule(module);
        });
    });
    
    backButtonEl.addEventListener('click', function() {
        showMainMenu();
    });
    
    // Event listeners - Plukk
    importPickBtnEl.addEventListener('click', function() {
        importPickFileEl.click();
    });
    
    importPickFileEl.addEventListener('change', function(event) {
        handleFileImport(event, 'pick');
    });
    
    connectScannerPickEl.addEventListener('click', function() {
        connectToScanner();
    });
    
    pickManualScanBtnEl.addEventListener('click', function() {
        handleScan(pickManualScanEl.value, 'pick');
    });
    
    pickManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleScan(pickManualScanEl.value, 'pick');
        }
    });
    
    pickUndoBtnEl.addEventListener('click', function() {
        undoLastScan('pick');
    });
    
    pickExportBtnEl.addEventListener('click', function() {
        exportList('pick');
    });
    
    pickClearBtnEl.addEventListener('click', function() {
        clearList('pick');
    });
    
    // Event listeners - Mottak
    importReceiveBtnEl.addEventListener('click', function() {
        importReceiveFileEl.click();
    });
    
    importReceiveFileEl.addEventListener('change', function(event) {
        handleFileImport(event, 'receive');
    });
    
    connectScannerReceiveEl.addEventListener('click', function() {
        connectToScanner();
    });
    
    receiveManualScanBtnEl.addEventListener('click', function() {
        handleScan(receiveManualScanEl.value, 'receive');
    });
    
    receiveManualScanEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleScan(receiveManualScanEl.value, 'receive');
        }
    });
    
    receiveUndoBtnEl.addEventListener('click', function() {
        undoLastScan('receive');
    });
    
    receiveExportBtnEl.addEventListener('click', function() {
        exportList('receive');
    });
    
    receiveClearBtnEl.addEventListener('click', function() {
        clearList('receive');
    });
    
    // Event listeners - Retur
    connectScannerReturnEl.addEventListener('click', function() {
        connectToScanner();
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
        exportList('return');
    });
    
    clearReturnListEl.addEventListener('click', function() {
        clearList('return');
    });
    
    // Event listeners - Innstillinger
    weightUnitEl.addEventListener('change', function() {
        settings.weightUnit = this.value;
        saveSettings();
        updateAllWeights();
    });
    
    defaultItemWeightEl.addEventListener('change', function() {
        settings.defaultItemWeight = parseFloat(this.value) || 1.0;
        saveSettings();
    });
    
    importBarcodeBtnEl.addEventListener('click', function() {
        importBarcodeFileEl.click();
    });
    
    importBarcodeFileEl.addEventListener('change', handleBarcodeFileImport);
    
    clearBarcodeDataEl.addEventListener('click', function() {
        barcodeMapping = {};
        saveBarcodeMapping();
        barcodeFileInfoEl.textContent = 'Ingen strekkoder lastet inn';
        showToast('Strekkodedata er slettet', 'warning');
    });
    
    clearAllDataEl.addEventListener('click', function() {
        if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres.')) {
            localStorage.clear();
            location.reload();
        }
    });
    
    // Event listeners - Vektmodal
    saveWeightBtnEl.addEventListener('click', function() {
        const itemId = weightModalItemIdEl.textContent;
        const weight = parseFloat(itemWeightEl.value) || settings.defaultItemWeight;
        
        itemWeights[itemId] = weight;
        saveItemWeights();
        
        // Oppdater vekter i alle moduler
        updateAllWeights();
        
        weightModalEl.style.display = 'none';
    });
    
    cancelWeightBtnEl.addEventListener('click', function() {
        weightModalEl.style.display = 'none';
    });
    
    closeWeightModalEl.addEventListener('click', function() {
        weightModalEl.style.display = 'none';
    });
    
    // Last inn data fra localStorage
    loadBarcodeMappingFromStorage();
    loadSettings();
    loadItemWeights();
    
    // Funksjon for å vise hovedmenyen
    function showMainMenu() {
        currentModule = null;
        backButtonEl.style.display = 'none';
        
        // Skjul alle moduler
        moduleContainersEl.forEach(container => {
            container.style.display = 'none';
        });
        
        // Vis hovedmenyen
        mainMenuEl.style.display = 'flex';
    }
    
    // Funksjon for å vise en modul
    function showModule(module) {
        currentModule = module;
        
        // Skjul hovedmenyen
        mainMenuEl.style.display = 'none';
        
        // Skjul alle moduler
        moduleContainersEl.forEach(container => {
            container.style.display = 'none';
        });
        
        // Vis den valgte modulen
        const moduleEl = document.getElementById(module + 'Module');
        if (moduleEl) {
            moduleEl.style.display = 'flex';
        }
        
        // Vis tilbakeknappen
        backButtonEl.style.display = 'block';
        
        // Oppdater UI for modulen
        if (module === 'picking') {
            updateUI('pick');
        } else if (module === 'receiving') {
            updateUI('receive');
        } else if (module === 'returns') {
            updateReturnUI();
        }
    }
    
    // Funksjon for å koble til Bluetooth-skanner
    async function connectToScanner() {
        if (!navigator.bluetooth) {
            showToast('Bluetooth støttes ikke i denne nettleseren. Vennligst bruk Chrome eller Edge.', 'error');
            return;
        }
        
        try {
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                // Filtrer etter enheter som støtter serieport-profil eller HID
                acceptAllDevices: true, 
                optionalServices: ['battery_service', '0000ffe0-0000-1000-8000-00805f9b34fb']
            });
            
            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
            
            showToast('Kobler til skanner...', 'warning');
            
            const server = await bluetoothDevice.gatt.connect();
            isConnected = true;
            
            // Dette er et eksempel - du må tilpasse tjeneste- og karakteristikk-UUIDs til din spesifikke skanner
            try {
                const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
                const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
                
                // Slå på notifikasjoner for å motta data
                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', handleScannerData);
                
                updateScannerStatus(true);
                showToast('Skanner tilkoblet!', 'success');
            } catch (error) {
                console.error('Kunne ikke koble til skanner-tjeneste:', error);
                showToast('Kunne ikke koble til skanner-tjeneste. Sjekk at skanneren er på og støtter Bluetooth LE.', 'error');
                isConnected = false;
                updateScannerStatus(false);
            }
            
        } catch (error) {
            console.error('Bluetooth-tilkobling feilet:', error);
            showToast('Bluetooth-tilkobling avbrutt eller feilet.', 'error');
            updateScannerStatus(false);
        }
    }
    
    // Håndter frakobling
    function onDisconnected() {
        isConnected = false;
        updateScannerStatus(false);
        showToast('Skanner frakoblet!', 'warning');
    }

    // Funksjon for å håndtere import av strekkoder
    function handleBarcodeFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                if (file.name.endsWith('.json')) {
                    handleBarcodeJSON(JSON.parse(content), file.name);
                } else {
                    showToast('Feil filformat. Kun JSON-filer støttes for strekkodeoversikt.', 'error');
                }
            } catch (error) {
                console.error('Feil ved import av strekkodeoversikt:', error);
                showToast('Feil ved import av strekkodeoversikt.', 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    // Oppdater skanner-statusindikator
    function updateScannerStatus(connected) {
        if (connected) {
            scannerIndicatorEl.classList.add('connected');
            scannerStatusEl.textContent = `Skanner: Tilkoblet (${bluetoothDevice.name || 'Ukjent enhet'})`;
        } else {
            scannerIndicatorEl.classList.remove('connected');
            scannerStatusEl.textContent = 'Skanner: Ikke tilkoblet';
        }
    }
    
    // Håndter data fra skanneren
    function handleScannerData(event) {
        const value = event.target.value;
        const textDecoder = new TextDecoder('utf-8');
        const barcode = textDecoder.decode(value).trim();
        
        if (barcode) {
            if (currentModule === 'picking') {
                handleScan(barcode, 'pick');
            } else if (currentModule === 'receiving') {
                handleScan(barcode, 'receive');
            } else if (currentModule === 'returns') {
                handleReturnScan(barcode, parseInt(returnQuantityEl.value) || 1);
            }
        }
    }
    
    // Oppdatert handleScan-funksjon som garantert oppdaterer vekt
    function handleScan(barcode, type) {
        if (!barcode) return;
        
        // Tøm input etter skanning
        if (type === 'pick') {
            pickManualScanEl.value = '';
        } else if (type === 'receive') {
            receiveManualScanEl.value = '';
        }
        
        // Sjekk om strekkoden finnes i barcode mapping
        let itemId = barcode;
        if (barcodeMapping[barcode]) {
            itemId = barcodeMapping[barcode];
            console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
        }
        
        // Finn riktig liste og data basert på type
        let items, scannedItems, undoBtn;
        if (type === 'pick') {
            items = pickListItems;
            scannedItems = pickedItems;
            undoBtn = pickUndoBtnEl;
        } else if (type === 'receive') {
            items = receiveListItems;
            scannedItems = receivedItems;
            undoBtn = receiveUndoBtnEl;
        }
        
        // Finn varen i listen
        const item = items.find(item => item.id === itemId);
        
        if (!item) {
            // Varen finnes ikke i listen
            if (type === 'receive') {
                // For mottak, legg til varen hvis den ikke finnes
                const newItem = {
                    id: itemId,
                    description: 'Ukjent vare',
                    quantity: 1,
                    weight: itemWeights[itemId] || settings.defaultItemWeight,
                    received: false,
                    receivedAt: null,
                    receivedCount: 0 // Nytt felt for å spore antall mottatte varer
                };
                
                receiveListItems.push(newItem);
                
                // Åpne vektmodal for å angi vekt
                openWeightModal(itemId);
                
                // Fortsett med skanning
                handleScan(barcode, type);
                return;
            } else {
                showToast(`Feil: Vare "${itemId}" finnes ikke i listen!`, 'error');
                return;
            }
        }
        
        // Initialisere tellefelter hvis de ikke eksisterer
        if (type === 'pick' && item.pickedCount === undefined) {
            item.pickedCount = 0;
        } else if (type === 'receive' && item.receivedCount === undefined) {
            item.receivedCount = 0;
        }
        
        // Sjekk om vi har skannet alle enhetene av denne varen
        const currentCount = type === 'pick' ? item.pickedCount : item.receivedCount;
        
        if (currentCount >= item.quantity) {
            showToast(`Alle ${item.quantity} enheter av "${itemId}" er allerede registrert!`, 'warning');
            return;
        }
        
        // Øk antallet skannede enheter
        if (type === 'pick') {
            item.pickedCount++;
            
            // Merk varen som fullstendig plukket hvis alle enheter er skannet
            if (item.pickedCount >= item.quantity) {
                item.picked = true;
                item.pickedAt = new Date();
                
                // Legg til i listen over fullstendig plukkede varer
                if (!pickedItems.includes(itemId)) {
                    pickedItems.push(itemId);
                }
            }
        } else if (type === 'receive') {
            item.receivedCount++;
            
            // Merk varen som fullstendig mottatt hvis alle enheter er skannet
            if (item.receivedCount >= item.quantity) {
                item.received = true;
                item.receivedAt = new Date();
                
                // Legg til i listen over fullstendig mottatte varer
                if (!receivedItems.includes(itemId)) {
                    receivedItems.push(itemId);
                }
            }
        }
        
        // Lagre sist skannede vare for angrefunksjonalitet
        if (type === 'pick') {
            lastPickedItem = {
                id: itemId,
                timestamp: new Date()
            };
        } else if (type === 'receive') {
            lastReceivedItem = {
                id: itemId,
                timestamp: new Date()
            };
        }
        
        // Direkte debugging av vektberegning før UI-oppdatering
        const totalWeight = calculateTotalWeight(type);
        console.log(`Før UI-oppdatering: Total vekt for ${type}: ${totalWeight.toFixed(2)} ${settings.weightUnit}`);
        
        // Oppdater UI
        updateUI(type);
        
        // Direkte debugging av vektelement etter UI-oppdatering
        const weightEl = type === 'pick' ? 
            document.getElementById('totalWeight') : 
            document.getElementById('totalReceiveWeight');
        console.log(`Etter UI-oppdatering: Vektelement innhold:`, weightEl ? weightEl.textContent : 'Ikke funnet');
        
        // Vis tilbakemelding til brukeren
        const remainingCount = item.quantity - (type === 'pick' ? item.pickedCount : item.receivedCount);
        
        if (remainingCount > 0) {
            showToast(`Vare "${itemId}" registrert! ${remainingCount} av ${item.quantity} gjenstår.`, 'info');
        } else {
            showToast(`Vare "${itemId}" fullstendig registrert!`, 'success');
        }
        
        // Aktiver angre-knapp
        undoBtn.disabled = false;
    }
    
    // Håndter skanning av returvare
    function handleReturnScan(barcode, quantity) {
        if (!barcode) return;
        
        // Tøm input etter skanning
        returnManualScanEl.value = '';
        
        // Sjekk om strekkoden finnes i barcode mapping
        let itemId = barcode;
        if (barcodeMapping[barcode]) {
            itemId = barcodeMapping[barcode];
            console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
        }
        
        // Sjekk om varen allerede er i returlisten
        const existingItem = returnListItems.find(item => item.id === itemId);
        
        if (existingItem) {
            // Øk antallet hvis varen allerede er i listen
            existingItem.quantity += quantity;
            showToast(`Vare "${itemId}" antall økt til ${existingItem.quantity}!`, 'success');
        } else {
            // Legg til ny vare i returlisten
            const newItem = {
                id: itemId,
                description: 'Returvare', // Vi kjenner ikke beskrivelsen
                quantity: quantity,
                weight: itemWeights[itemId] || settings.defaultItemWeight,
                returnedAt: new Date()
            };
            
            returnListItems.push(newItem);
            
            // Åpne vektmodal for å angi vekt
            openWeightModal(itemId);
            
            showToast(`Vare "${itemId}" lagt til som retur!`, 'success');
        }
        
        // Oppdater UI
        updateReturnUI();
        
        // Aktiver eksportknapp og tøm-knapp
        returnExportBtnEl.disabled = false;
        clearReturnListEl.disabled = false;
    }
    
    // Oppdatert angrefunksjon for å håndtere antall
    function undoLastScan(type) {
        let lastItem, items, scannedItems, undoBtn;
        
        if (type === 'pick') {
            lastItem = lastPickedItem;
            items = pickListItems;
            scannedItems = pickedItems;
            undoBtn = pickUndoBtnEl;
        } else if (type === 'receive') {
            lastItem = lastReceivedItem;
            items = receiveListItems;
            scannedItems = receivedItems;
            undoBtn = receiveUndoBtnEl;
        }
        
        if (!lastItem) return;
        
        // Finn varen som skal angres
        const item = items.find(item => item.id === lastItem.id);
        if (item) {
            if (type === 'pick') {
                // Reduser antall plukkede
                if (item.pickedCount > 0) {
                    item.pickedCount--;
                }
                
                // Fjern fra fullstendig plukkede hvis antallet nå er mindre enn totalen
                if (item.pickedCount < item.quantity) {
                    item.picked = false;
                    item.pickedAt = null;
                    
                    // Fjern fra listen over fullstendig plukkede varer
                    const index = scannedItems.indexOf(item.id);
                    if (index !== -1) {
                        scannedItems.splice(index, 1);
                    }
                }
            } else if (type === 'receive') {
                // Reduser antall mottatte
                if (item.receivedCount > 0) {
                    item.receivedCount--;
                }
                
                // Fjern fra fullstendig mottatte hvis antallet nå er mindre enn totalen
                if (item.receivedCount < item.quantity) {
                    item.received = false;
                    item.receivedAt = null;
                    
                    // Fjern fra listen over fullstendig mottatte varer
                    const index = scannedItems.indexOf(item.id);
                    if (index !== -1) {
                        scannedItems.splice(index, 1);
                    }
                }
            }
        }
        
        // Finn forrige skannede vare å angre til
        // I en ekte implementasjon ville du ha en historikk av skanninger
        if (type === 'pick') {
            lastPickedItem = null; // Fjern siste skannede når det er angret
        } else if (type === 'receive') {
            lastReceivedItem = null; // Fjern siste skannede når det er angret
        }
        
        // Deaktiver angre-knapp hvis ingen flere varer kan angres
        undoBtn.disabled = true;
        
        // Oppdater UI
        updateUI(type);
        showToast('Siste skanning er angret!', 'warning');
    }
    
    // Fjern en vare fra returlisten
    function removeReturnItem(index) {
        if (index >= 0 && index < returnListItems.length) {
            returnListItems.splice(index, 1);
            updateReturnUI();
            
            if (returnListItems.length === 0) {
                returnExportBtnEl.disabled = true;
                clearReturnListEl.disabled = true;
            }
            
            showToast('Vare fjernet fra returliste!', 'warning');
        }
    }
    
    // Importere fil (plukkliste eller mottaksliste)
    function handleFileImport(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Vis laster-melding
        showToast('Importerer liste...', 'info');
        
        // Håndter ulike filtyper
        if (file.type === 'application/pdf') {
            importFromPDF(file, type);
        } else {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    
                    // Sjekk filtypen basert på filendelse eller innhold
                    if (file.name.endsWith('.json')) {
                        importFromJSON(content, file.name, type);
                    } else {
                        importFromCSV(content, file.name, type);
                    }
                    
                } catch (error) {
                    console.error('Feil ved import av fil:', error);
                    showToast('Feil ved import av fil. Sjekk filformatet.', 'error');
                }
            };
            
            reader.readAsText(file);
        }
    }
    
    // Importere fra CSV/TXT fil
    function importFromCSV(content, fileName, type) {
        // Sjekk om innholdet ligner på formatet fra PDF-en
        const isPDFFormat = content.includes('Varenr.') && content.includes('Beskrivelse') && content.includes('Bestilt');
        
        // Velg riktig delimiter basert på innholdet
        const delimiter = content.includes(';') ? ';' : ',';
        const lines = content.split('\n');
        
        // Nullstill listene
        if (type === 'pick') {
            pickListItems = [];
            pickedItems = [];
            lastPickedItem = null;
        } else if (type === 'receive') {
            receiveListItems = [];
            receivedItems = [];
            lastReceivedItem = null;
        }
        
        if (isPDFFormat) {
            // Dette er formatet som matcher PDF-en
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Prøv å finne linjer som starter med varenummer-format (f.eks. "000-BH3242" eller "263-L01680")
                const match = line.match(/^(\d{3}-[A-Z0-9]+)\s+(\d+)\s+/);
                if (match) {
                    const id = match[1].trim();
                    
                    // Finn beskrivelsen ved å lete etter tekst mellom tall og parenteser
                    const descMatch = line.match(/\d+\s+________\s+________\s+(.*?)\s+\(\d+\)/);
                    let description = "Ukjent beskrivelse";
                    
                    if (descMatch && descMatch[1]) {
                        description = descMatch[1].trim();
                    }
                    
                    // Finn antall
                    const quantityMatch = match[2];
                    const quantity = parseInt(quantityMatch, 10) || 1;
                    
                    // Finn eller sett en standard vekt
                    const weight = itemWeights[id] || settings.defaultItemWeight;
                    
                    const newItem = {
                        id: id,
                        description: description,
                        quantity: quantity,
                        weight: weight
                    };
                    
                    if (type === 'pick') {
                        newItem.picked = false;
                        newItem.pickedAt = null;
                        pickListItems.push(newItem);
                    } else if (type === 'receive') {
                        newItem.received = false;
                        newItem.receivedAt = null;
                        receiveListItems.push(newItem);
                    }
                }
            }
        } else {
            // Standard CSV-format
            // Sjekk om filen har en header-rad
            let hasHeader = false;
            if (lines.length > 0) {
                const firstLine = lines[0].toLowerCase();
                hasHeader = firstLine.includes('vare') || 
                            firstLine.includes('id') || 
                            firstLine.includes('nummer') || 
                            firstLine.includes('beskrivelse');
            }
            
            // Start indeks for data (hopp over header om den finnes)
            const startIndex = hasHeader ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = line.split(delimiter);
                if (parts.length >= 2) {
                    const id = parts[0].trim();
                    const description = parts[1].trim();
                    const quantity = parts.length > 2 ? parseInt(parts[2].trim(), 10) || 1 : 1;
                    const weight = itemWeights[id] || settings.defaultItemWeight;
                    
                    const newItem = {
                        id: id,
                        description: description,
                        quantity: quantity,
                        weight: weight
                    };
                    
                    if (type === 'pick') {
                        newItem.picked = false;
                        newItem.pickedAt = null;
                        pickListItems.push(newItem);
                    } else if (type === 'receive') {
                        newItem.received = false;
                        newItem.receivedAt = null;
                        receiveListItems.push(newItem);
                    }
                }
            }
        }
        
        // Oppdater UI
        if (type === 'pick') {
            pickFileInfoEl.textContent = `Lastet inn: ${fileName} (${pickListItems.length} varer)`;
            updateUI('pick');
            
            // Aktiver/deaktiver knapper
            pickExportBtnEl.disabled = pickListItems.length === 0;
            pickClearBtnEl.disabled = pickListItems.length === 0;
            pickUndoBtnEl.disabled = true;
        } else if (type === 'receive') {
            receiveFileInfoEl.textContent = `Lastet inn: ${fileName} (${receiveListItems.length} varer)`;
            updateUI('receive');
            
            // Aktiver/deaktiver knapper
            receiveExportBtnEl.disabled = receiveListItems.length === 0;
            receiveClearBtnEl.disabled = receiveListItems.length === 0;
            receiveUndoBtnEl.disabled = true;
        }
        
        showToast(`Importert liste med ${type === 'pick' ? pickListItems.length : receiveListItems.length} varer!`, 'success');
    }
    
    // Importere fra JSON-fil
    function importFromJSON(content, fileName, type) {
        try {
            const data = JSON.parse(content);
            
            // Sjekk om dette er en liste eller strekkodeoversikt
            if (Array.isArray(data)) {
                // Dette er en liste
                const items = data.map(item => ({
                    id: item.id || item.varenr,
                    description: item.description || item.beskrivelse || 'Ukjent beskrivelse',
                    quantity: item.quantity || item.antall || 1,
                    weight: itemWeights[item.id || item.varenr] || item.weight || settings.defaultItemWeight
                }));
                
                if (type === 'pick') {
                    // Legg til plukk-spesifikke felt
                    pickListItems = items.map(item => ({
                        ...item,
                        picked: false,
                        pickedAt: null
                    }));
                    
                    pickedItems = [];
                    lastPickedItem = null;
                    
                    // Oppdater UI
                    pickFileInfoEl.textContent = `Lastet inn: ${fileName} (${pickListItems.length} varer)`;
                    updateUI('pick');
                    
                    // Aktiver/deaktiver knapper
                    pickExportBtnEl.disabled = pickListItems.length === 0;
                    pickClearBtnEl.disabled = pickListItems.length === 0;
                    pickUndoBtnEl.disabled = true;
                } else if (type === 'receive') {
                    // Legg til mottak-spesifikke felt
                    receiveListItems = items.map(item => ({
                        ...item,
                        received: false,
                        receivedAt: null
                    }));
                    
                    receivedItems = [];
                    lastReceivedItem = null;
                    
                    // Oppdater UI
                    receiveFileInfoEl.textContent = `Lastet inn: ${fileName} (${receiveListItems.length} varer)`;
                    updateUI('receive');
                    
                    // Aktiver/deaktiver knapper
                    receiveExportBtnEl.disabled = receiveListItems.length === 0;
                    receiveClearBtnEl.disabled = receiveListItems.length === 0;
                    receiveUndoBtnEl.disabled = true;
                }
                
                showToast(`Importert ${items.length} varer!`, 'success');
            } else {
                // Dette er trolig en strekkodeoversikt
                handleBarcodeJSON(data, fileName);
            }
        } catch (error) {
            console.error('Feil ved import av JSON:', error);
            showToast('Feil ved import av JSON-fil.', 'error');
        }
    }

    // Funksjon for å eksportere lister
    function exportList(type) {
        let items, fileName;
        
        if (type === 'pick') {
            items = pickListItems;
            fileName = 'plukkliste_eksport.json';
        } else if (type === 'receive') {
            items = receiveListItems;
            fileName = 'mottaksliste_eksport.json';
        } else if (type === 'return') {
            items = returnListItems;
            fileName = 'returliste_eksport.json';
        }
        
        // Sjekk om det faktisk er noen varer å eksportere
        if (!items || items.length === 0) {
            showToast('Ingen varer å eksportere!', 'warning');
            return;
        }
        
        // Opprett eksportdata med tellefelter og tidsmerker
        const exportData = items.map(item => {
            const exportItem = { ...item };
            
            // Konverter Date-objekter til ISO-strenger
            if (type === 'pick' && exportItem.pickedAt) {
                exportItem.pickedAt = exportItem.pickedAt instanceof Date ? 
                    exportItem.pickedAt.toISOString() : exportItem.pickedAt;
            } else if (type === 'receive' && exportItem.receivedAt) {
                exportItem.receivedAt = exportItem.receivedAt instanceof Date ? 
                    exportItem.receivedAt.toISOString() : exportItem.receivedAt;
            } else if (type === 'return' && exportItem.returnedAt) {
                exportItem.returnedAt = exportItem.returnedAt instanceof Date ? 
                    exportItem.returnedAt.toISOString() : exportItem.returnedAt;
            }
            
            return exportItem;
        });
        
        // Legg til metadata om eksporten
        const finalExport = {
            exportDate: new Date().toISOString(),
            exportType: type,
            items: exportData,
            summary: {
                totalItems: items.length,
                completedItems: type === 'pick' ? 
                    items.filter(item => item.picked).length : 
                    type === 'receive' ? 
                        items.filter(item => item.received).length : 
                        items.length,
                totalWeight: calculateTotalWeight(items)
            }
        };
        
        // Opprett JSON-streng
        const jsonString = JSON.stringify(finalExport, null, 2);
        
        // Opprett blob og nedlastingslink
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = fileName;
        
        // Utløs nedlasting
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Rydd opp
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast(`Liste eksportert som ${fileName}!`, 'success');
    }

    // Hjelpefunksjon for å beregne totalvekt direkte
    function calculateTotalWeight(type) {
        let items;
        
        if (type === 'pick') {
            items = pickListItems || [];
        } else if (type === 'receive') {
            items = receiveListItems || [];
        } else if (type === 'return') {
            items = returnListItems || [];
        } else {
            return 0;
        }
        
        return items.reduce((total, item) => {
            const count = type === 'pick' ? 
                (item.pickedCount || 0) : 
                type === 'receive' ? 
                    (item.receivedCount || 0) : 
                    (item.quantity || 0);
                    
            return total + (count * (item.weight || 0));
        }, 0);
    }
    
    async function importFromPDF(file, type) {
        try {
            showToast('Leser PDF-fil...', 'info');
            
            // Sjekk at nødvendige DOM-elementer eksisterer før vi fortsetter
            const fileInfoElement = type === 'pick' ? pickFileInfoEl : receiveFileInfoEl;
            if (!fileInfoElement) {
                console.error(`FileInfo-element for type ${type} finnes ikke`);
                showToast('Feil: Kunne ikke finne nødvendige grensesnittelementer.', 'error');
                return;
            }
            
            // Konverterer filen til en arraybuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Setter worker path
            if (!window.pdfjsLib) {
                console.error('PDF.js biblioteket er ikke lastet');
                showToast('Feil: PDF-biblioteket er ikke tilgjengelig. Vennligst oppdater siden.', 'error');
                return;
            }
            
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';
            
            // Laster PDF-dokumentet
            console.log('Starter lasting av PDF...');
            const loadingTask = window.pdfjsLib.getDocument(arrayBuffer);
            
            // Legg til fremgangspåvisning
            loadingTask.onProgress = function(progress) {
                console.log(`PDF lasteprogresjon: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            };
            
            const pdf = await loadingTask.promise;
            console.log(`PDF lastet. Antall sider: ${pdf.numPages}`);
            
            // Nullstill listene
            if (type === 'pick') {
                pickListItems = [];
                pickedItems = [];
                lastPickedItem = null;
            } else if (type === 'receive') {
                receiveListItems = [];
                receivedItems = [];
                lastReceivedItem = null;
            }
            
            // Samle all tekst fra PDF-en
            const allTextLines = [];
            
            // Ekstraherer tekst fra hver side
            for (let i = 1; i <= pdf.numPages; i++) {
                console.log(`Behandler side ${i}...`);
                
                try {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    // Konverter tekst-elementer til strenger
                    const textItems = textContent.items.map(item => item.str);
                    const pageText = textItems.join('\n');
                    
                    // Del opp teksten i linjer
                    const lines = pageText.split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    
                    console.log(`Side ${i}: Hentet ${lines.length} linjer`);
                    allTextLines.push(...lines);
                } catch (error) {
                    console.error(`Feil ved behandling av side ${i}:`, error);
                }
            }
            
            console.log(`Ekstrahert totalt ${allTextLines.length} linjer fra PDF-en`);
            
            if (allTextLines.length === 0) {
                showToast('Ingen tekst funnet i PDF-en. Sjekk at PDF-en ikke er skannet bilde eller passordbeskyttet.', 'error');
                return;
            }
            
            // Bruk parseProductLinesWithFallback-funksjonen for å identifisere produkter
            console.log('Starter parsing av produktlinjer...');
            const parsedItems = parseProductLinesWithFallback(allTextLines);
            console.log(`Identifisert ${parsedItems.length} produkter fra PDF-en:`, parsedItems);
            
            // Legg til de nødvendige feltene basert på type
            let items = [];
            if (type === 'pick') {
                items = parsedItems.map(item => ({
                    ...item,
                    weight: itemWeights[item.id] || settings.defaultItemWeight,
                    picked: false,
                    pickedAt: null,
                    pickedCount: 0 // Legg til tellefeltet
                }));
                
                pickListItems = items;
                
                // Oppdater UI - sjekk at elementet eksisterer
                if (pickFileInfoEl) {
                    pickFileInfoEl.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
                }
                
                // Oppdater UI
                updateUI('pick');
                
                // Aktiver/deaktiver knapper - sjekk at de eksisterer
                if (pickExportBtnEl) pickExportBtnEl.disabled = items.length === 0;
                if (pickClearBtnEl) pickClearBtnEl.disabled = items.length === 0;
                if (pickUndoBtnEl) pickUndoBtnEl.disabled = true;
            } else if (type === 'receive') {
                items = parsedItems.map(item => ({
                    ...item,
                    weight: itemWeights[item.id] || settings.defaultItemWeight,
                    received: false,
                    receivedAt: null,
                    receivedCount: 0 // Legg til tellefeltet
                }));
                
                receiveListItems = items;
                
                // Oppdater UI - sjekk at elementet eksisterer
                if (receiveFileInfoEl) {
                    receiveFileInfoEl.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
                }
                
                // Oppdater UI
                updateUI('receive');
                
                // Aktiver/deaktiver knapper
                if (receiveExportBtnEl) receiveExportBtnEl.disabled = items.length === 0;
                if (receiveClearBtnEl) receiveClearBtnEl.disabled = items.length === 0;
                if (receiveUndoBtnEl) receiveUndoBtnEl.disabled = true;
            }
            
            if (items.length > 0) {
                showToast(`Importert ${items.length} varer fra PDF!`, 'success');
                console.log('PDF-import fullført med suksess');
            } else {
                showToast('Ingen varer funnet i PDF-en. Prøv å importere som CSV i stedet.', 'warning');
                console.log('PDF-import fullført, men ingen varer funnet');
            }
            
        } catch (error) {
            console.error('Feil ved import av PDF:', error);
            showToast(`PDF import feilet: ${error.message}. Kontroller at PDF-en er i riktig format og ikke er skadet.`, 'error');
        }
    }
    
    // Behandle strekkode JSON
    function handleBarcodeJSON(data, fileName) {
        if (typeof data === 'object' && !Array.isArray(data)) {
            barcodeMapping = data;
            saveBarcodeMapping();
            barcodeFileInfoEl.textContent = `Lastet inn: ${fileName} (${Object.keys(barcodeMapping).length} strekkoder)`;
            showToast(`Importert ${Object.keys(barcodeMapping).length} strekkoder!`, 'success');
        } else {
            showToast('Ugyldig strekkodeformat. Forventet objekt med strekkode-til-varenummer-mapping.', 'error');
        }
    }
    
    // Åpne vektmodal
    function openWeightModal(itemId) {
        weightModalItemIdEl.textContent = itemId;
        itemWeightEl.value = itemWeights[itemId] || settings.defaultItemWeight;
        weightModalEl.style.display = 'block';
    }
    
    // Oppdatert updateUI-funksjon med fokus på korrekt vektberegning
    function updateUI(type) {
        let items, listEl, statusPickedEl, statusRemainingEl, statusTextEl, scannedItems, totalWeightEl;
        
        if (type === 'pick') {
            items = pickListItems || [];
            listEl = pickListEl;
            statusPickedEl = pickStatusPickedEl;
            statusRemainingEl = pickStatusRemainingEl;
            statusTextEl = pickStatusTextEl;
            scannedItems = pickedItems || [];
            totalWeightEl = document.getElementById('totalWeight'); // Bruk direkte ID i stedet for this.totalWeightEl
        } else if (type === 'receive') {
            items = receiveListItems || [];
            listEl = receiveListEl;
            statusPickedEl = receiveStatusReceivedEl;
            statusRemainingEl = receiveStatusRemainingEl;
            statusTextEl = receiveStatusTextEl;
            scannedItems = receivedItems || [];
            totalWeightEl = document.getElementById('totalReceiveWeight');
        } else {
            console.error(`Ugyldig type: ${type}`);
            return; // Avslutt tidlig hvis typen er ugyldig
        }
        
        // Sikre at vi har en referanse til tabellen
        if (!listEl) {
            console.error(`Tabellreferanse for type ${type} mangler`);
            return; // Avslutt funksjonen tidlig hvis viktige elementer mangler
        }
        
        // Deklarerer tbody kun én gang
        const tbody = listEl.querySelector('tbody');
        if (!tbody) {
            console.error(`Tbody for ${type} ikke funnet`);
            return;
        }
        
        // Tøm tabellen
        tbody.innerHTML = '';
        
        let totalWeight = 0;
        let totalScannedItems = 0;
        let totalRequiredItems = 0;
        
        // Prosesser hver vare
        items.forEach(item => {
            // Initialisere tellefelter hvis de ikke eksisterer
            if (type === 'pick' && item.pickedCount === undefined) {
                item.pickedCount = 0;
            } else if (type === 'receive' && item.receivedCount === undefined) {
                item.receivedCount = 0;
            }
            
            const tr = document.createElement('tr');
            const isFullyScanned = (type === 'pick' && item.picked) || (type === 'receive' && item.received);
            const currentCount = type === 'pick' ? item.pickedCount : item.receivedCount;
            
            // Regn ut statusfarge basert på skannet antall
            if (currentCount > 0) {
                if (currentCount >= item.quantity) {
                    tr.classList.add(type === 'pick' ? 'picked' : 'received');
                } else {
                    tr.classList.add('partially-scanned');
                }
                
                // VIKTIG: Legg til vekt for skannede varer - basert på faktisk skannede antall
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
                <td>${itemTotalWeight.toFixed(2)} ${settings.weightUnit}</td>
                <td>${
                    currentCount === 0 ? 
                        `<span class="badge" style="background-color: var(--gray)">Venter</span>` :
                    currentCount < item.quantity ? 
                        `<span class="badge" style="background-color: var(--warning)">Delvis (${currentCount}/${item.quantity})</span>` :
                        `<span class="badge badge-success">${type === 'pick' ? 'Plukket' : 'Mottatt'}</span>`
                }
                </td>
            `;
            
            // Legg til hendelse for å angi vekt
            tr.addEventListener('dblclick', function() {
                openWeightModal(item.id);
            });
            
            tbody.appendChild(tr);
        });
        
        // Logg vektberegning for debugging
        console.log(`Total vekt beregnet: ${totalWeight.toFixed(2)} ${settings.weightUnit}`, {
            items: items.filter(item => (type === 'pick' ? item.pickedCount : item.receivedCount) > 0)
        });
        
        // Oppdater statuslinjen
        const percentage = totalRequiredItems > 0 ? Math.round((totalScannedItems / totalRequiredItems) * 100) : 0;
        
        if (statusPickedEl) statusPickedEl.style.width = `${percentage}%`;
        if (statusRemainingEl) statusRemainingEl.style.width = `${100 - percentage}%`;
        
        if (statusTextEl) {
            if (type === 'pick') {
                statusTextEl.textContent = `${totalScannedItems} av ${totalRequiredItems} varer plukket (${percentage}%)`;
            } else if (type === 'receive') {
                statusTextEl.textContent = `${totalScannedItems} av ${totalRequiredItems} varer mottatt (${percentage}%)`;
            }
        }
        
        // Oppdater totalvekt (med sjekk) - VIKTIG ENDRING HER
        if (totalWeightEl) {
            totalWeightEl.textContent = `${totalWeight.toFixed(2)} ${settings.weightUnit || 'kg'}`;
        } else {
            console.error(`Vektelement for type ${type} ikke funnet`);
        }
    }
    
    // Optimalisert PDF-importfunksjon for plukklister
async function importFromPDF(file, type) {
    try {
        showToast('Leser PDF-fil...', 'info');
        
        // Konverterer filen til en arraybuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Setter worker path
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';
        
        // Laster PDF-dokumentet
        console.log('Starter lasting av PDF...');
        const loadingTask = window.pdfjsLib.getDocument(arrayBuffer);
        
        // Legg til fremgangspåvisning
        loadingTask.onProgress = function(progress) {
            console.log(`PDF lasteprogresjon: ${progress.loaded / progress.total * 100}%`);
        };
        
        const pdf = await loadingTask.promise;
        console.log(`PDF lastet. Antall sider: ${pdf.numPages}`);
        
        // Nullstill listene
        if (type === 'pick') {
            pickListItems = [];
            pickedItems = [];
            lastPickedItem = null;
        } else if (type === 'receive') {
            receiveListItems = [];
            receivedItems = [];
            lastReceivedItem = null;
        }
        
        // Samle all tekst fra PDF-en
        const allTextLines = [];
        
        // Ekstraherer tekst fra hver side
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Behandler side ${i}...`);
            
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Konverter tekst-elementer til strenger
                const textItems = textContent.items.map(item => item.str);
                const pageText = textItems.join('\n');
                
                // Del opp teksten i linjer
                const lines = pageText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                
                console.log(`Side ${i}: Hentet ${lines.length} linjer`);
                allTextLines.push(...lines);
            } catch (error) {
                console.error(`Feil ved behandling av side ${i}:`, error);
            }
        }
        
        console.log(`Ekstrahert totalt ${allTextLines.length} linjer fra PDF-en`);
        
        if (allTextLines.length === 0) {
            showToast('Ingen tekst funnet i PDF-en. Sjekk at PDF-en ikke er skannet bilde eller passordbeskyttet.', 'error');
            return;
        }
        
        // Bruk den forbedrede parsefunksjonen for å identifisere produkter
        const parsedItems = parseProductLines(allTextLines);
        console.log(`Identifisert ${parsedItems.length} produkter fra PDF-en`);
        
        // Legg til de nødvendige feltene basert på type
        let items = [];
        if (type === 'pick') {
            items = parsedItems.map(item => ({
                ...item,
                weight: itemWeights[item.id] || settings.defaultItemWeight,
                picked: false,
                pickedAt: null
            }));
            
            pickListItems = items;
            pickFileInfoEl.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
            updateUI('pick');
            
            // Aktiver/deaktiver knapper
            pickExportBtnEl.disabled = items.length === 0;
            pickClearBtnEl.disabled = items.length === 0;
            pickUndoBtnEl.disabled = true;
        } else if (type === 'receive') {
            items = parsedItems.map(item => ({
                ...item,
                weight: itemWeights[item.id] || settings.defaultItemWeight,
                received: false,
                receivedAt: null
            }));
            
            receiveListItems = items;
            receiveFileInfoEl.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
            updateUI('receive');
            
            // Aktiver/deaktiver knapper
            receiveExportBtnEl.disabled = items.length === 0;
            receiveClearBtnEl.disabled = items.length === 0;
            receiveUndoBtnEl.disabled = true;
        }
        
        if (items.length > 0) {
            showToast(`Importert ${items.length} varer fra PDF!`, 'success');
        } else {
            showToast('Ingen varer funnet i PDF-en. Prøv å importere som CSV i stedet.', 'warning');
        }
        
    } catch (error) {
        console.error('Feil ved import av PDF:', error);
        showToast(`PDF import feilet: ${error.message}. Kontroller at PDF-en er i riktig format og ikke er skadet.`, 'error');
    }
}

// Parsefunksjon spesielt tilpasset for plukklister
function parseProductLines(lines) {
    const products = [];
    // Forbedret regex-mønster basert på analysen av plukklisteformatet
    const productCodePattern = /^([A-Z0-9]{2,4}-[A-Z0-9]+-?[A-Z0-9]*|[A-Z]{2}\d{5}|[A-Z][A-Z0-9]{4,})/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Sjekk om linjen starter med et produkt-ID-mønster
        const match = line.match(productCodePattern);
        if (match) {
            const productId = match[1];
            
            // Sjekk om neste linje inneholder antall (et tall alene)
            if (i + 1 < lines.length) {
                const quantityLine = lines[i + 1].trim();
                const quantityMatch = quantityLine.match(/^(\d+)$/);
                
                if (quantityMatch) {
                    const quantity = parseInt(quantityMatch[1], 10);
                    
                    // Finn beskrivelsen som vanligvis kommer etter understreker
                    // Vi hopper vanligvis 5-6 linjer frem for å finne beskrivelsen
                    let description = "";
                    let j = i + 5; // Start fra ca. 5 linjer frem (etter understrekene)
                    
                    // Let etter beskrivelsen i de neste linjene
                    while (j < lines.length && j < i + 15) {
                        const textLine = lines[j].trim();
                        
                        // Stopp hvis vi har nådd neste produkt eller en linje med bare tall i parentes
                        if (textLine.match(productCodePattern) || textLine.match(/^\(\d+\)$/)) {
                            break;
                        }
                        
                        // Legg til denne linjen til beskrivelsen hvis den ikke er tom eller bare understrekninger
                        if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                            description += (description ? " " : "") + textLine;
                        }
                        
                        j++;
                    }
                    
                    // Rens beskrivelsen (fjern eventuelle parenteser med tall på slutten)
                    description = description.replace(/\(\d+\)$/, '').trim();
                    
                    if (description) {
                        products.push({
                            id: productId,
                            description: description,
                            quantity: quantity
                        });
                    }
                }
            }
        }
    }
    
    return products;
}

// Alternativ parsing-metode for mer komplekse plukklister
function parseComplexProductLines(lines) {
    const products = [];
    // Vi prøver ulike mønstre for å fange ulike varenummerformater
    const patterns = [
        /^(\d{3}-[A-Z][A-Z0-9]*-\d+)/,  // 000-XX-000 format
        /^(\d{3}-[A-Z][A-Z0-9]*)/,      // 000-XX format
        /^([A-Z]{2}\d{5})/,             // XX00000 format
        /^(BP\d{5})/,                   // BP00000 format
        /^([A-Z][A-Z0-9]{4,})/          // Andre alfanumeriske koder
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        let productId = null;
        
        // Prøv hvert mønster for å finne produkt-ID
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                productId = match[1];
                break;
            }
        }
        
        if (productId) {
            // Analyser resten av linjen eller neste linje for antall
            let quantity = 1; // Standard hvis ikke spesifisert
            let quantityFound = false;
            let description = "";
            
            // Sjekk første om antall er på samme linje
            const quantitySameLineMatch = line.substring(productId.length).trim().match(/^(\d+)/);
            if (quantitySameLineMatch) {
                quantity = parseInt(quantitySameLineMatch[1], 10);
                quantityFound = true;
                
                // Beskrivelsen kan være på samme linje etter antallet
                const descStart = line.indexOf(quantitySameLineMatch[0]) + quantitySameLineMatch[0].length;
                description = line.substring(descStart).trim();
            } 
            // Eller sjekk neste linje for antall
            else if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const quantityNextLineMatch = nextLine.match(/^(\d+)$/);
                
                if (quantityNextLineMatch) {
                    quantity = parseInt(quantityNextLineMatch[1], 10);
                    quantityFound = true;
                    i++; // Hopp over neste linje siden vi har behandlet den
                    
                    // Beskrivelsen kommer typisk etter noen understreker
                    let j = i + 5; // Start fra ca. 5 linjer frem
                    
                    while (j < lines.length && j < i + 15) {
                        const textLine = lines[j].trim();
                        let foundNextProduct = false;
                        
                        // Sjekk om vi har nådd neste produkt
                        for (const pattern of patterns) {
                            if (textLine.match(pattern)) {
                                foundNextProduct = true;
                                break;
                            }
                        }
                        
                        if (foundNextProduct || textLine.match(/^\(\d+\)$/)) {
                            break;
                        }
                        
                        // Legg til denne linjen til beskrivelsen
                        if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                            description += (description ? " " : "") + textLine;
                        }
                        
                        j++;
                    }
                }
            }
            
            // Rens beskrivelsen
            description = description.replace(/\(\d+\)$/, '').trim();
            
            // Legg til produktet hvis vi har funnet antall og har en beskrivelse
            if (quantityFound && (description || productId)) {
                products.push({
                    id: productId,
                    description: description || "Ukjent beskrivelse",
                    quantity: quantity
                });
            }
        }
    }
    
    return products;
}

// Korrigert parseProductLinesWithFallback-funksjon
function parseProductLinesWithFallback(lines) {
    // Hvis vi ikke har parseProductLines-funksjonene definert, definer dem
    if (typeof parseProductLines !== 'function') {
        // Standard parsefunksjon
        window.parseProductLines = function(lines) {
            const products = [];
            // Forbedret regex-mønster basert på analysen av plukklisteformatet
            const productCodePattern = /^([A-Z0-9]{2,4}-[A-Z0-9]+-?[A-Z0-9]*|[A-Z]{2}\d{5}|[A-Z][A-Z0-9]{4,})/;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Sjekk om linjen starter med et produkt-ID-mønster
                const match = line.match(productCodePattern);
                if (match) {
                    const productId = match[1];
                    
                    // Sjekk om neste linje inneholder antall (et tall alene)
                    if (i + 1 < lines.length) {
                        const quantityLine = lines[i + 1].trim();
                        const quantityMatch = quantityLine.match(/^(\d+)$/);
                        
                        if (quantityMatch) {
                            const quantity = parseInt(quantityMatch[1], 10);
                            
                            // Finn beskrivelsen som vanligvis kommer etter understreker
                            // Vi hopper vanligvis 5-6 linjer frem for å finne beskrivelsen
                            let description = "";
                            let j = i + 5; // Start fra ca. 5 linjer frem (etter understrekene)
                            
                            // Let etter beskrivelsen i de neste linjene
                            while (j < lines.length && j < i + 15) {
                                const textLine = lines[j].trim();
                                
                                // Stopp hvis vi har nådd neste produkt eller en linje med bare tall i parentes
                                if (textLine.match(productCodePattern) || textLine.match(/^\(\d+\)$/)) {
                                    break;
                                }
                                
                                // Legg til denne linjen til beskrivelsen hvis den ikke er tom eller bare understrekninger
                                if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                                    description += (description ? " " : "") + textLine;
                                }
                                
                                j++;
                            }
                            
                            // Rens beskrivelsen (fjern eventuelle parenteser med tall på slutten)
                            description = description.replace(/\(\d+\)$/, '').trim();
                            
                            if (description) {
                                products.push({
                                    id: productId,
                                    description: description,
                                    quantity: quantity
                                });
                            }
                        }
                    }
                }
            }
            
            return products;
        };
        
        // Alternativ parsing-metode for mer komplekse plukklister
        window.parseComplexProductLines = function(lines) {
            const products = [];
            // Vi prøver ulike mønstre for å fange ulike varenummerformater
            const patterns = [
                /^(\d{3}-[A-Z][A-Z0-9]*-\d+)/,  // 000-XX-000 format
                /^(\d{3}-[A-Z][A-Z0-9]*)/,      // 000-XX format
                /^([A-Z]{2}\d{5})/,             // XX00000 format
                /^(BP\d{5})/,                   // BP00000 format
                /^([A-Z][A-Z0-9]{4,})/          // Andre alfanumeriske koder
            ];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                let productId = null;
                
                // Prøv hvert mønster for å finne produkt-ID
                for (const pattern of patterns) {
                    const match = line.match(pattern);
                    if (match) {
                        productId = match[1];
                        break;
                    }
                }
                
                if (productId) {
                    // Analyser resten av linjen eller neste linje for antall
                    let quantity = 1; // Standard hvis ikke spesifisert
                    let quantityFound = false;
                    let description = "";
                    
                    // Sjekk først om antall er på samme linje
                    const quantitySameLineMatch = line.substring(productId.length).trim().match(/^(\d+)/);
                    if (quantitySameLineMatch) {
                        quantity = parseInt(quantitySameLineMatch[1], 10);
                        quantityFound = true;
                        
                        // Beskrivelsen kan være på samme linje etter antallet
                        const descStart = line.indexOf(quantitySameLineMatch[0]) + quantitySameLineMatch[0].length;
                        description = line.substring(descStart).trim();
                    } 
                    // Eller sjekk neste linje for antall
                    else if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        const quantityNextLineMatch = nextLine.match(/^(\d+)$/);
                        
                        if (quantityNextLineMatch) {
                            quantity = parseInt(quantityNextLineMatch[1], 10);
                            quantityFound = true;
                            i++; // Hopp over neste linje siden vi har behandlet den
                            
                            // Beskrivelsen kommer typisk etter noen understreker
                            let j = i + 5; // Start fra ca. 5 linjer frem
                            
                            while (j < lines.length && j < i + 15) {
                                const textLine = lines[j].trim();
                                let foundNextProduct = false;
                                
                                // Sjekk om vi har nådd neste produkt
                                for (const pattern of patterns) {
                                    if (textLine.match(pattern)) {
                                        foundNextProduct = true;
                                        break;
                                    }
                                }
                                
                                if (foundNextProduct || textLine.match(/^\(\d+\)$/)) {
                                    break;
                                }
                                
                                // Legg til denne linjen til beskrivelsen
                                if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                                    description += (description ? " " : "") + textLine;
                                }
                                
                                j++;
                            }
                        }
                    }
                    
                    // Rens beskrivelsen
                    description = description.replace(/\(\d+\)$/, '').trim();
                    
                    // Legg til produktet hvis vi har funnet antall og har en beskrivelse
                    if (quantityFound && (description || productId)) {
                        products.push({
                            id: productId,
                            description: description || "Ukjent beskrivelse",
                            quantity: quantity
                        });
                    }
                }
            }
            
            return products;
        };
    }
    
    // Prøv standard parsing først
    let products = parseProductLines(lines);
    
    // Hvis ingen produkter ble funnet, prøv den alternative metoden
    if (products.length === 0) {
        console.log('Standard parsing fant ingen produkter, prøver alternativ metode...');
        products = parseComplexProductLines(lines);
    }
    
    return products;
}
    
    // Tøm liste
    function clearList(type) {
        if (!confirm(`Er du sikker på at du vil tømme ${type === 'pick' ? 'plukklisten' : type === 'receive' ? 'mottakslisten' : 'returlisten'}?`)) {
            return;
        }
        
        if (type === 'pick') {
            pickListItems = [];
            pickedItems = [];
            lastPickedItem = null;
            
            pickFileInfoEl.textContent = 'Ingen fil lastet inn';
            pickUndoBtnEl.disabled = true;
            pickExportBtnEl.disabled = true;
            pickClearBtnEl.disabled = true;
            
            updateUI('pick');
        } else if (type === 'receive') {
            receiveListItems = [];
            receivedItems = [];
            lastReceivedItem = null;
            
            receiveFileInfoEl.textContent = 'Ingen fil lastet inn';
            receiveUndoBtnEl.disabled = true;
            receiveExportBtnEl.disabled = true;
            receiveClearBtnEl.disabled = true;
            
            updateUI('receive');
        } else if (type === 'return') {
            returnListItems = [];
            
            returnExportBtnEl.disabled = true;
            clearReturnListEl.disabled = true;
            
            updateReturnUI();
        }
        
        showToast(`${type === 'pick' ? 'Plukkliste' : type === 'receive' ? 'Mottaksliste' : 'Returliste'} tømt!`, 'warning');
    }
    
    // Oppdater alle vekter i alle moduler
    function updateAllWeights() {
        if (currentModule === 'picking') {
            updateUI('pick');
        } else if (currentModule === 'receiving') {
            updateUI('receive');
        } else if (currentModule === 'returns') {
            updateReturnUI();
        }
    }
    
    // Vis toast-melding
    function showToast(message, type = 'info') {
        toastEl.textContent = message;
        toastEl.className = `toast ${type}`;
        toastEl.style.display = 'block';
        
        setTimeout(() => {
            toastEl.style.display = 'none';
        }, 3000);
    }
    
    // Lagre strekkodeoversikt til localStorage
    function saveBarcodeMapping() {
        localStorage.setItem('barcodeMapping', JSON.stringify(barcodeMapping));
    }
    
    // Last inn strekkodeoversikt fra localStorage
    function loadBarcodeMappingFromStorage() {
        const mapping = localStorage.getItem('barcodeMapping');
        if (mapping) {
            try {
                barcodeMapping = JSON.parse(mapping);
                barcodeFileInfoEl.textContent = `Lastet inn: ${Object.keys(barcodeMapping).length} strekkoder`;
            } catch (error) {
                console.error('Feil ved lasting av strekkodeoversikt:', error);
                barcodeMapping = {};
            }
        }
    }
    
    // Lagre innstillinger til localStorage
    function saveSettings() {
        localStorage.setItem('settings', JSON.stringify(settings));
    }
    
    // Last inn innstillinger fra localStorage
    function loadSettings() {
        const storedSettings = localStorage.getItem('settings');
        if (storedSettings) {
            try {
                settings = JSON.parse(storedSettings);
                
                // Oppdater UI med innstillingene
                weightUnitEl.value = settings.weightUnit;
                defaultItemWeightEl.value = settings.defaultItemWeight;
            } catch (error) {
                console.error('Feil ved lasting av innstillinger:', error);
            }
        }
    }
    
    // Lagre vektdata til localStorage
    function saveItemWeights() {
        localStorage.setItem('itemWeights', JSON.stringify(itemWeights));
    }
    
    // Last inn vektdata fra localStorage
    function loadItemWeights() {
        const storedWeights = localStorage.getItem('itemWeights');
        if (storedWeights) {
            try {
                itemWeights = JSON.parse(storedWeights);
            } catch (error) {
                console.error('Feil ved lasting av vektdata:', error);
                itemWeights = {};
            }
        }
    }
    
    // Registrer service worker for offline funksjonalitet
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrert:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registrering feilet:', error);
                });
        });
    }
    
    // Initialiser appen - start med hovedmenyen
    showMainMenu();
});