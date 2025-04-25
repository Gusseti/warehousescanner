// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\returns-module.js
import { ModuleComponent } from '../components/ModuleComponent.js';
import { ScanInputComponent } from '../components/ScanInputComponent.js';
import { TableComponent } from '../components/TableComponent.js';
import { ButtonComponent } from '../components/ButtonComponent.js';
import { QuantityModalComponent } from '../components/QuantityModalComponent.js';
import eventBus from '../modules/event-bus.js';
import { appState } from '../app.js';
import { saveListsToStorage } from './storage.js';
import { showToast } from './utils.js';

/**
 * ReturnsModule - Modul for håndtering av varer i retur
 * @extends ModuleComponent
 */
export class ReturnsModule extends ModuleComponent {
    constructor(options = {}) {
        super({
            moduleId: 'returns',
            title: 'Retur',
            icon: 'undo',
            ...options
        });
        
        // Modulspesifikke data
        this.returnItems = [];
        
        // Bind metoder til this-kontekst
        this.handleBarcodeScan = this.handleBarcodeScan.bind(this);
        this.handleTableRowClick = this.handleTableRowClick.bind(this);
        this.handleNewReturnClick = this.handleNewReturnClick.bind(this);
        this.handleCompleteClick = this.handleCompleteClick.bind(this);
        this.loadData = this.loadData.bind(this);
        this.saveData = this.saveData.bind(this);
        this.updateUI = this.updateUI.bind(this);
    }
    
    /**
     * Initialiser UI-komponenter
     */
    initComponents() {
        // Opprett scanInput-komponent
        const scanInput = new ScanInputComponent({
            id: 'returns-scan-input',
            placeholder: 'Skann eller skriv inn strekkode for å registrere retur...',
            onScan: this.handleBarcodeScan
        });
        
        // Opprett tabell-komponent
        const table = new TableComponent({
            id: 'returns-table',
            columns: [
                { header: 'Varenr.', field: 'itemId', sortable: true },
                { header: 'Beskrivelse', field: 'description', sortable: true },
                { header: 'Antall', field: 'quantity', sortable: true },
                { header: 'Årsak', field: 'reason', sortable: true },
                { header: 'Dato', field: 'date', sortable: true }
            ],
            onRowClick: this.handleTableRowClick
        });
        
        // Opprett knapp-komponenter
        const newReturnButton = new ButtonComponent({
            id: 'returns-new-return-btn',
            text: 'Ny retur',
            icon: 'plus',
            type: 'primary',
            onClick: this.handleNewReturnClick
        });
        
        const completeButton = new ButtonComponent({
            id: 'returns-complete-btn',
            text: 'Fullfør retur',
            icon: 'check',
            type: 'success',
            onClick: this.handleCompleteClick
        });
        
        // Opprett en div for knappene
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        
        // Legg til knappene i knappebeholderen
        newReturnButton.appendToContainer(buttonContainer);
        completeButton.appendToContainer(buttonContainer);
        
        // Legg til komponenter i modulen
        this.addComponent('scanInput', scanInput);
        this.addComponent('table', table);
        this.addComponent('newReturnButton', newReturnButton);
        this.addComponent('completeButton', completeButton);
        
        // Legg til knappebeholderen
        this.appendChild(buttonContainer);
        
        // Opprett kvantitetsmodal (registreres ikke som komponent)
        this.quantityModal = new QuantityModalComponent({
            title: 'Angi antall og årsak',
            showReasonField: true,
            onConfirm: ({ itemId, quantity, reason }) => {
                this.addItemToReturns(itemId, quantity, reason);
            }
        });
    }
    
    /**
     * Last data fra lagring
     */
    loadData() {
        // Last returvarer fra appState
        if (appState.returnItems && Array.isArray(appState.returnItems)) {
            this.returnItems = [...appState.returnItems];
        }
        
        // Oppdater UI
        this.updateUI();
    }
    
    /**
     * Lagre data til lagring
     */
    saveData() {
        // Oppdater appState med returvarer
        appState.returnItems = [...this.returnItems];
        
        // Lagre til localStorage
        saveListsToStorage();
        
        // Oppdater UI
        this.updateUI();
    }
    
    /**
     * Oppdater UI
     */
    updateUI() {
        // Hent tabellkomponenten
        const table = this.getComponent('table');
        if (table) {
            // Oppdater tabelldata
            table.setData(this.returnItems);
        }
    }
    
    /**
     * Håndter strekkodeskanning
     * @param {string} barcode - Den skannede strekkoden
     * @param {string} source - Kilden til strekkoden
     */
    handleBarcodeScan(barcode, source) {
        console.log(`Returmodul: Skannet strekkode ${barcode} fra ${source}`);
        
        // Finn vare i produktregister
        const product = appState.products.find(p => p.barcode === barcode);
        
        if (product) {
            // Spør om antall og årsak
            this.quantityModal.setItemId(product.name || barcode);
            this.quantityModal.setDefaultQuantity(1);
            this.quantityModal.open();
        } else {
            // Ukjent strekkode - videresend til håndtering
            eventBus.publish('barcode:unknown', {
                barcode,
                source,
                moduleId: this.options.moduleId
            });
        }
    }
    
    /**
     * Legg til vare i returvarer
     * @param {string} itemId - Varenummer
     * @param {number} quantity - Antall
     * @param {string} reason - Årsak til retur
     */
    addItemToReturns(itemId, quantity, reason) {
        // Finn vare i produktregister
        const product = appState.products.find(p => p.name === itemId || p.barcode === itemId);
        
        if (product) {
            // Sjekk om varen allerede er i listen (med samme årsak)
            const existingItem = this.returnItems.find(item => 
                item.itemId === product.barcode && item.reason === reason);
            
            if (existingItem) {
                // Oppdater antall
                existingItem.quantity += quantity;
                existingItem.date = new Date().toLocaleString();
            } else {
                // Legg til ny vare
                this.returnItems.push({
                    itemId: product.barcode,
                    description: product.name,
                    quantity: quantity,
                    reason: reason || 'Ikke angitt',
                    date: new Date().toLocaleString()
                });
            }
            
            // Lagre data
            this.saveData();
            
            // Vis bekreftelse
            showToast(`La til ${quantity} stk ${product.name} i retur`);
        }
    }
    
    /**
     * Håndter klikk på rad i tabellen
     * @param {Object} rowData - Data for raden
     * @param {Event} event - Klikkhendelsen
     */
    handleTableRowClick(rowData, event) {
        console.log('Klikket på rad i returtabellen:', rowData);
        
        // Implementeres senere: Vis detaljer, endre antall, etc.
    }
    
    /**
     * Håndter klikk på "Ny retur"-knappen
     */
    handleNewReturnClick() {
        if (this.returnItems.length > 0) {
            if (confirm('Er du sikker på at du vil starte en ny retur? Eksisterende returvarer vil bli tømt.')) {
                this.returnItems = [];
                this.saveData();
                showToast('Ny retur startet');
            }
        } else {
            showToast('Ny retur startet');
        }
    }
    
    /**
     * Håndter klikk på "Fullfør retur"-knappen
     */
    handleCompleteClick() {
        if (this.returnItems.length === 0) {
            showToast('Ingen varer er registrert for retur', 'error');
            return;
        }
        
        // Generer returrapport
        const report = {
            type: 'returns',
            date: new Date().toLocaleString(),
            items: [...this.returnItems],
            totalItems: this.returnItems.reduce((sum, item) => sum + item.quantity, 0)
        };
        
        // Lagre rapport i historikk
        if (!appState.history) {
            appState.history = [];
        }
        
        appState.history.push(report);
        saveListsToStorage();
        
        // Tøm returlisten
        this.returnItems = [];
        this.saveData();
        
        // Vis bekreftelse
        showToast('Varer til retur fullført og lagret i historikk');
        
        // Utløs hendelse for returrapport
        eventBus.publish('report:created', {
            type: 'returns',
            report
        });
    }
    
    /**
     * Håndter ukjent strekkode
     * @param {string} barcode - Den ukjente strekkoden
     * @returns {boolean} Om strekkoden ble håndtert eller ikke
     */
    handleUnknownBarcode(barcode) {
        // Implementasjon av ukjente strekkoder kan legges til her
        return false; // Videresend til global håndtering
    }
}