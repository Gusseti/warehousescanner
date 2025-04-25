// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\receiving-module.js
import { BaseModule } from '../components/BaseModule.js';
import eventBus from '../modules/event-bus.js';
import { getModalManager } from './modal-manager.js';
import { getStorageManager } from './storage.js';

/**
 * ReceivedModule - Håndterer varemottak
 * @extends BaseModule
 */
export class ReceivedModule extends BaseModule {
    /**
     * Oppretter en ny mottaksmodul
     */
    constructor() {
        super({
            moduleId: 'receiving',
            moduleName: 'Varemottak',
            moduleIcon: 'fas fa-truck-loading',
            hasImport: true,
            hasBluetooth: true,
            hasCamera: true,
            hasExport: true
        });
        
        this.storageManager = getStorageManager();
        this.modalManager = getModalManager();
        this.receivedItems = [];
    }
    
    /**
     * Cache DOM-elementer for raskere tilgang
     * @override
     * @private
     */
    _cacheElements() {
        this.elementsCache = {
            // Containere
            container: document.getElementById('receivingModule'),
            receivingList: document.getElementById('receivingList'),
            
            // Skjemaelementer
            scanInput: document.getElementById('receivingScanInput'),
            
            // Knapper
            scanBtn: document.getElementById('receivingScanBtn'),
            completeBtn: document.getElementById('completeReceivingBtn'),
            clearBtn: document.getElementById('clearReceivingBtn')
        };
    }
    
    /**
     * Registrer hendelseslyttere
     * @override
     * @private
     */
    _registerEventListeners() {
        const { scanBtn, completeBtn, clearBtn, scanInput } = this.elementsCache;
        
        // Skanning
        if (scanBtn) scanBtn.addEventListener('click', this.handleScan.bind(this));
        if (scanInput) scanInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleScan();
        });
        
        // Fullføring og tilbakestilling
        if (completeBtn) completeBtn.addEventListener('click', this.completeReceiving.bind(this));
        if (clearBtn) clearBtn.addEventListener('click', this.clearReceiving.bind(this));
        
        // Lytt til hendelser fra skanneren
        eventBus.subscribe('barcode:scanned', this.handleBarcodeScanned.bind(this));
    }
    
    /**
     * Håndterer skanning av strekkoder
     */
    handleScan() {
        const { scanInput } = this.elementsCache;
        const barcode = scanInput.value.trim();
        
        if (barcode) {
            this.handleBarcodeScanned(barcode);
            scanInput.value = '';
            scanInput.focus();
        }
    }
    
    /**
     * Håndterer skannede strekkoder
     * @param {string} barcode - Skannet strekkode
     */
    handleBarcodeScanned(barcode) {
        // Implementer logikk for å legge til varer i mottakslisten
        // For eksempel:
        this.addReceivedItem({
            barcode,
            timestamp: new Date().toISOString(),
            quantity: 1,
            status: 'received'
        });
    }
    
    /**
     * Legger til en vare i mottakslisten
     * @param {Object} item - Vareelement
     */
    addReceivedItem(item) {
        this.receivedItems.push(item);
        this.renderReceivedItems();
        this.showNotification(`Vare med strekkode ${item.barcode} er lagt til`, 'success');
    }
    
    /**
     * Renderer mottatte varer i listen
     */
    renderReceivedItems() {
        const { receivingList } = this.elementsCache;
        
        if (!receivingList) return;
        
        receivingList.innerHTML = '';
        
        if (this.receivedItems.length === 0) {
            receivingList.innerHTML = '<tr><td colspan="4">Ingen varer er skannet ennå</td></tr>';
            return;
        }
        
        this.receivedItems.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.barcode}</td>
                <td>${item.quantity}</td>
                <td>${new Date(item.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-danger" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            const deleteBtn = row.querySelector('button');
            deleteBtn.addEventListener('click', () => this.removeReceivedItem(index));
            
            receivingList.appendChild(row);
        });
    }
    
    /**
     * Fjerner en vare fra mottakslisten
     * @param {number} index - Indeks for varen som skal fjernes
     */
    removeReceivedItem(index) {
        if (index >= 0 && index < this.receivedItems.length) {
            const item = this.receivedItems[index];
            this.receivedItems.splice(index, 1);
            this.renderReceivedItems();
            this.showNotification(`Vare med strekkode ${item.barcode} er fjernet`, 'info');
        }
    }
    
    /**
     * Fullfører varemottaket
     */
    completeReceiving() {
        if (this.receivedItems.length === 0) {
            this.showNotification('Ingen varer er skannet ennå', 'warning');
            return;
        }
        
        // Lagre mottaket
        const receivingData = {
            items: [...this.receivedItems],
            completedAt: new Date().toISOString(),
            userId: this.getCurrentUserId()
        };
        
        // Lagre til lokal lagring
        const savedReceivings = this.storageManager.getItem('receivings') || [];
        savedReceivings.push(receivingData);
        this.storageManager.setItem('receivings', savedReceivings);
        
        this.showNotification('Varemottak fullført og lagret', 'success');
        this.clearReceiving();
        
        // Publiser hendelse om at et varemottak er fullført
        eventBus.publish('receiving:completed', receivingData);
    }
    
    /**
     * Tilbakestiller varemottaket
     */
    clearReceiving() {
        this.receivedItems = [];
        this.renderReceivedItems();
        
        const { scanInput } = this.elementsCache;
        if (scanInput) scanInput.value = '';
        
        this.showNotification('Varemottaket er tilbakestilt', 'info');
    }
    
    /**
     * Henter ID for innlogget bruker
     * @returns {string} Bruker-ID eller 'unknown'
     */
    getCurrentUserId() {
        const currentUser = this.storageManager.getItem('currentUser');
        return currentUser ? currentUser.id : 'unknown';
    }
    
    /**
     * Vis notifikasjon til brukeren
     * @param {string} message - Meldingstekst
     * @param {string} type - Notifikasjonstype ('success', 'error', 'warning', 'info')
     */
    showNotification(message, type = 'info') {
        eventBus.publish('notification:show', { message, type });
    }
    
    /**
     * Initialiser visning av modulen
     * @override
     */
    initialize() {
        super.initialize();
        this.renderReceivedItems();
        
        const { scanInput } = this.elementsCache;
        if (scanInput) scanInput.focus();
    }
}