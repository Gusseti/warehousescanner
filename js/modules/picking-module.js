// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\picking-module.js
import { BaseModule } from '../components/BaseModule.js';
import eventBus from '../modules/event-bus.js';
import { getModalManager } from './modal-manager.js';

/**
 * PickingModule - Håndterer plukking av varer
 * @extends BaseModule
 */
export class PickingModule extends BaseModule {
    /**
     * Oppretter en ny plukkemodul
     */
    constructor() {
        super({
            moduleId: 'picking',
            moduleName: 'Plukk',
            moduleIcon: 'fas fa-clipboard-list',
            hasImport: true,
            hasBluetooth: true,
            hasCamera: true,
            hasExport: true
        });
        
        // Plukk-spesifikke data
        this.totalWeight = 0;
        this.importedFile = null;
    }
    
    /**
     * Cache DOM-elementer for raskere tilgang
     * @override
     * @private
     */
    _cacheElements() {
        // Create a helper function to safely get elements
        const safeGetElement = (id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with ID '${id}' not found, creating a placeholder`);
                // Create placeholder element
                const placeholder = document.createElement('div');
                placeholder.id = id;
                document.body.appendChild(placeholder);
                return placeholder;
            }
            return element;
        };

        // Create pickingModule container if it doesn't exist
        const container = safeGetElement('pickingModule');
        
        // Create missing elements
        if (!document.getElementById('pickList')) {
            const pickList = document.createElement('table');
            pickList.id = 'pickList';
            pickList.className = 'pick-list-table';
            pickList.innerHTML = '<thead><tr><th>Kode</th><th>Beskrivelse</th><th>Antall</th><th>Vekt</th><th>Status</th></tr></thead><tbody></tbody>';
            container.appendChild(pickList);
        }

        this.elementsCache = {
            // Containere
            container: safeGetElement('pickingModule'),
            cameraContainer: safeGetElement('cameraScannerPickContainer'),
            
            // Input og status
            manualScanInput: safeGetElement('pickManualScan'),
            fileInfo: safeGetElement('pickFileInfo'),
            totalWeightDisplay: safeGetElement('totalWeight'),
            
            // Status og fremgang
            statusBar: {
                picked: safeGetElement('pickStatusPicked'),
                remaining: safeGetElement('pickStatusRemaining'),
                text: safeGetElement('pickStatusText')
            },
            
            // Liste - safely get pickList and its tbody
            itemList: (function() {
                const pickList = safeGetElement('pickList');
                let tbody = pickList.querySelector('tbody');
                if (!tbody) {
                    tbody = document.createElement('tbody');
                    pickList.appendChild(tbody);
                }
                return tbody;
            })(),
            
            // Knapper
            importBtn: safeGetElement('importPickBtn'),
            importFileInput: safeGetElement('importPickFile'),
            connectBluetoothBtn: safeGetElement('connectScannerPick'),
            cameraBtn: safeGetElement('cameraScannerPick'),
            manualScanBtn: safeGetElement('pickManualScanBtn'),
            undoBtn: safeGetElement('pickUndoBtn'),
            exportBtn: safeGetElement('pickExportBtn'),
            clearBtn: safeGetElement('pickClearBtn'),
            
            // Kamera-elementer
            closeCameraBtn: safeGetElement('closePickScanner'),
            switchCameraBtn: safeGetElement('switchCameraPick'),
            
            // Eksporter-dropdown - safely get dropdown items
            exportDropdownItems: document.querySelectorAll('#pickExportBtn + .dropdown-content a') || []
        };
    }
    
    /**
     * Registrer hendelseslyttere
     * @override
     * @private
     */
    _registerEventListeners() {
        const { 
            importBtn, importFileInput, connectBluetoothBtn, cameraBtn, 
            manualScanBtn, manualScanInput, undoBtn, clearBtn, 
            closeCameraBtn, switchCameraBtn, exportDropdownItems 
        } = this.elementsCache;
        
        // Import
        importBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', this.handleFileImport.bind(this));
        
        // Skanning
        connectBluetoothBtn.addEventListener('click', this.connectBluetoothScanner.bind(this));
        cameraBtn.addEventListener('click', this.openCameraScanner.bind(this));
        closeCameraBtn.addEventListener('click', this.closeCameraScanner.bind(this));
        switchCameraBtn.addEventListener('click', this.switchCamera.bind(this));
        
        // Manuell inntasting
        manualScanBtn.addEventListener('click', () => {
            const barcode = manualScanInput.value.trim();
            if (barcode) {
                this.handleBarcodeScan(barcode, 'manual');
                manualScanInput.value = '';
            }
        });
        
        manualScanInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const barcode = manualScanInput.value.trim();
                if (barcode) {
                    this.handleBarcodeScan(barcode, 'manual');
                    manualScanInput.value = '';
                }
            }
        });
        
        // Håndteringsknapper
        undoBtn.addEventListener('click', this.undoLastScan.bind(this));
        clearBtn.addEventListener('click', () => {
            if (confirm('Er du sikker på at du vil tømme plukklisten?')) {
                this.clearData();
            }
        });
        
        // Eksportknapper
        exportDropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const format = e.target.getAttribute('data-format');
                this.exportData(format);
            });
        });
    }
    
    /**
     * Håndter skannet strekkode
     * @override
     * @param {string} barcode - Den skannede strekkoden
     * @param {string} source - Kilden til strekkoden (bluetooth, kamera, manuell)
     */
    handleBarcodeScan(barcode, source = 'manual') {
        console.log(`Plukk: Strekkode skannet: ${barcode} (kilde: ${source})`);
        
        if (!barcode) return;
        
        // Finn varen i plukkliste
        const item = this.findItemByBarcode(barcode);
        
        if (!item) {
            this.showStatus(`Ukjent strekkode: ${barcode}`, 'warning');
            // Utløs hendelse for ukjent strekkode
            eventBus.publish('barcode:unknown', {
                barcode,
                moduleId: this.moduleId
            });
            return;
        }
        
        // Sjekk om varen allerede er skannet
        if (this.isItemScanned(barcode)) {
            this.showStatus(`${item.description} er allerede plukket`, 'info');
            return;
        }
        
        // Legg til i skannede varer
        const scannedItem = { ...item, scannedAt: new Date() };
        this.scannedItems.push(scannedItem);
        this.scanHistory.push(scannedItem);
        
        // Hvis varen ikke har en definert vekt, åpne vektmodal
        if (!item.weight || item.weight === 0) {
            const modalManager = getModalManager();
            modalManager.openWeightModal(barcode, 1);
        } else {
            // Ellers, oppdater totalvekt direkte
            this.totalWeight += parseFloat(item.weight) || 0;
        }
        
        // Oppdater UI
        this.updateUI();
        
        // Vise status
        this.showStatus(`${item.description} lagt til i plukk`, 'success');
        
        // Aktiver knapper
        this.elementsCache.undoBtn.disabled = false;
        this.elementsCache.exportBtn.disabled = false;
        this.elementsCache.clearBtn.disabled = false;
        
        // Lagre til lokal lagring
        this.saveToStorage();
        
        // Utløs hendelse
        eventBus.publish('picking:itemScanned', {
            item: scannedItem,
            scannedItems: this.scannedItems,
            totalItems: this.items.length
        });
    }
    
    /**
     * Oppdater brukergrensesnittet
     * @override
     */
    updateUI() {
        // Oppdater totalt antall og vekt
        const { totalWeightDisplay, statusBar, itemList } = this.elementsCache;
        const totalItems = this.items.length;
        const scannedCount = this.scannedItems.length;
        
        // Oppdater progresjonsbar
        if (totalItems > 0) {
            const progressPercent = (scannedCount / totalItems) * 100;
            statusBar.picked.style.width = `${progressPercent}%`;
            statusBar.remaining.style.width = `${100 - progressPercent}%`;
            statusBar.text.textContent = `${scannedCount} av ${totalItems} varer plukket (${Math.round(progressPercent)}%)`;
        } else {
            statusBar.picked.style.width = '0%';
            statusBar.remaining.style.width = '100%';
            statusBar.text.textContent = '0 av 0 varer plukket (0%)';
        }
        
        // Oppdater totalvekt
        totalWeightDisplay.textContent = `${this.totalWeight.toFixed(2)} kg`;
        
        // Oppdater item liste
        this.renderItemList();
    }
    
    /**
     * Render varelisten i UI
     * @private
     */
    renderItemList() {
        const { itemList } = this.elementsCache;
        
        // Tøm eksisterende liste
        itemList.innerHTML = '';
        
        // Sorter varene: først ikke-plukket, deretter plukket
        const sortedItems = [...this.items].sort((a, b) => {
            const aScanned = this.isItemScanned(a.barcode);
            const bScanned = this.isItemScanned(b.barcode);
            if (aScanned === bScanned) return 0;
            return aScanned ? 1 : -1;
        });
        
        // Opprett og legg til listelementer
        sortedItems.forEach(item => {
            const isScanned = this.isItemScanned(item.barcode);
            const row = document.createElement('tr');
            
            if (isScanned) {
                row.classList.add('scanned-item');
            }
            
            row.innerHTML = `
                <td>${item.barcode}</td>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.weight ? parseFloat(item.weight).toFixed(2) : '0.00'}</td>
                <td>
                    <span class="status-badge ${isScanned ? 'status-scanned' : 'status-pending'}">
                        ${isScanned ? 'Plukket' : 'Venter'}
                    </span>
                </td>
            `;
            
            // Legg til hendelseslytter for rader
            row.addEventListener('click', () => {
                if (!isScanned) {
                    this.handleBarcodeScan(item.barcode, 'click');
                }
            });
            
            itemList.appendChild(row);
        });
    }
    
    /**
     * Håndter filimport
     * @param {Event} event - Change-event fra input[type=file]
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.importedFile = file;
        this.elementsCache.fileInfo.textContent = `Fil lastet: ${file.name}`;
        
        // Simulerer filimport for demonstrasjon
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            
            // For demonstrasjonsformål, bare lag noen eksempeldata
            // I en virkelig implementasjon ville du tolke innholdet i filen
            const exampleItems = [
                { barcode: '123456', description: 'Test produkt 1', quantity: 2, weight: 1.5 },
                { barcode: '234567', description: 'Test produkt 2', quantity: 1, weight: 2.5 },
                { barcode: '345678', description: 'Test produkt 3', quantity: 3, weight: 0.75 }
            ];
            
            this.items = exampleItems;
            this.scannedItems = [];
            this.totalWeight = 0;
            this.scanHistory = [];
            
            this.updateUI();
            this.showStatus(`Importerte ${this.items.length} varer`, 'success');
            
            // Informer systemet om importen
            eventBus.publish('picking:fileImported', {
                file: this.importedFile,
                itemCount: this.items.length
            });
        };
        
        reader.readAsText(file);
    }
    
    /**
     * Eksporter data fra modulen
     * @override
     * @param {string} format - Eksportformat (pdf, html, csv, json, txt)
     */
    exportData(format = 'pdf') {
        if (this.scannedItems.length === 0) {
            this.showStatus('Ingen varer å eksportere', 'warning');
            return;
        }
        
        // Simulerer eksport for demonstrasjon
        this.showStatus(`Eksporterer ${this.scannedItems.length} varer i ${format}-format`, 'info');
        
        // Utløs eksport-hendelse
        eventBus.publish('picking:exported', {
            format: format,
            items: this.scannedItems,
            totalItems: this.items.length,
            totalWeight: this.totalWeight,
            exportDate: new Date()
        });
        
        // I en ekte implementasjon ville du bruke en eksportmodul her
        console.log(`Eksporterer plukkdata i ${format}-format`);
    }
    
    /**
     * Tøm alle data i modulen
     * @override
     */
    clearData() {
        super.clearData();
        this.importedFile = null;
        this.totalWeight = 0;
        this.elementsCache.fileInfo.textContent = 'Ingen fil lastet inn';
        this.elementsCache.undoBtn.disabled = true;
        this.elementsCache.exportBtn.disabled = true;
        this.elementsCache.clearBtn.disabled = true;
        
        this.showStatus('Plukklisten er tømt', 'info');
    }
    
    /**
     * Vis statusmelding i modulen
     * @override
     * @param {string} message - Meldingen som skal vises
     * @param {string} type - Meldingstype (info, success, warning, error)
     */
    showStatus(message, type = 'info') {
        // Implementer statusvisning (kan bruke toast eller annen feedback)
        console.log(`Plukk status: ${message} (type: ${type})`);
        
        // Bruk event bus til å vise status i UI
        eventBus.publish('ui:showStatus', {
            message,
            type,
            moduleId: this.moduleId
        });
    }
    
    /**
     * Koble til Bluetooth-strekkodeskanner
     */
    connectBluetoothScanner() {
        // Delegere til bluetooth-modul via event bus
        eventBus.publish('scanner:requestConnection', {
            moduleId: this.moduleId
        });
    }
    
    /**
     * Åpne kameraskanner
     */
    openCameraScanner() {
        this.elementsCache.cameraContainer.style.display = 'block';
        
        // Delegere til kameramodul via event bus
        eventBus.publish('camera:open', {
            moduleId: this.moduleId,
            videoElement: 'videoPickScanner',
            canvasElement: 'canvasPickScanner'
        });
    }
    
    /**
     * Lukk kameraskanner
     */
    closeCameraScanner() {
        this.elementsCache.cameraContainer.style.display = 'none';
        
        // Delegere til kameramodul via event bus
        eventBus.publish('camera:close', {
            moduleId: this.moduleId
        });
    }
    
    /**
     * Bytt kamera (front/bak)
     */
    switchCamera() {
        // Delegere til kameramodul via event bus
        eventBus.publish('camera:switch', {
            moduleId: this.moduleId
        });
    }
    
    /**
     * Overskriver undoLastScan for å håndtere vekter
     * @override
     */
    undoLastScan() {
        if (this.scanHistory.length === 0) {
            this.showStatus('Ingen skann å angre', 'warning');
            return;
        }
        
        const lastScan = this.scanHistory.pop();
        
        // Fjern fra skannede varer
        this.scannedItems = this.scannedItems.filter(item => 
            item.barcode !== lastScan.barcode
        );
        
        // Oppdater totalvekt
        this.totalWeight -= parseFloat(lastScan.weight) || 0;
        if (this.totalWeight < 0) this.totalWeight = 0;
        
        // Oppdater UI
        this.updateUI();
        
        // Aktivere/deaktivere knapper
        this.elementsCache.undoBtn.disabled = this.scanHistory.length === 0;
        this.elementsCache.exportBtn.disabled = this.scannedItems.length === 0;
        this.elementsCache.clearBtn.disabled = this.scannedItems.length === 0;
        
        // Vis status
        this.showStatus(`Angret siste skann: ${lastScan.description}`, 'info');
        
        // Lagre til lokal lagring
        this.saveToStorage();
        
        // Publiser event
        eventBus.publish('picking:undoScan', {
            moduleId: this.moduleId,
            item: lastScan
        });
    }
    
    /**
     * Lagre moduldata til lokalt lager
     * @override
     */
    saveToStorage() {
        if (!window.currentUserData) return;
        
        const { id, storageKey } = window.currentUserData;
        const userData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        userData.pickings = userData.pickings || [];
        
        // Finn eksisterende data eller lag ny
        const currentSession = {
            id: `picking_${Date.now()}`,
            date: new Date().toISOString(),
            items: this.items,
            scannedItems: this.scannedItems,
            totalWeight: this.totalWeight
        };
        
        // Lagre den nyeste økten først
        userData.pickings.unshift(currentSession);
        
        // Behold bare de 10 siste øktene
        if (userData.pickings.length > 10) {
            userData.pickings = userData.pickings.slice(0, 10);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(userData));
    }
    
    /**
     * Last moduldata fra lokalt lager
     * @override
     */
    loadFromStorage() {
        if (!window.currentUserData) return;
        
        const { storageKey } = window.currentUserData;
        const userData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        // Sjekk om det finnes lagrede plukkdata
        if (userData.pickings && userData.pickings.length > 0) {
            const lastSession = userData.pickings[0];
            
            // Gjenopprett data
            this.items = lastSession.items || [];
            this.scannedItems = lastSession.scannedItems || [];
            this.totalWeight = lastSession.totalWeight || 0;
            
            // Gjenoppbygg scanHistory
            this.scanHistory = [...this.scannedItems];
            
            // Oppdater UI
            this.updateUI();
            
            // Aktiver/deaktiver knapper
            const hasScannedItems = this.scannedItems.length > 0;
            this.elementsCache.undoBtn.disabled = !hasScannedItems;
            this.elementsCache.exportBtn.disabled = !hasScannedItems;
            this.elementsCache.clearBtn.disabled = !hasScannedItems;
            
            return true;
        }
        
        return false;
    }
}