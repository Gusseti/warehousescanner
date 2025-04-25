// filepath: s:\Workspace\GitHub\warehousescanner\js\components\BaseModule.js
import { ModuleComponent } from './ModuleComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * BaseModule - Standard basisklasse for alle applikasjonsmoduler
 * @extends ModuleComponent
 */
export class BaseModule extends ModuleComponent {
    /**
     * Opprett en ny basismodul
     * @param {Object} options - Konfigurasjonsalternativer
     * @param {string} options.moduleId - Modul-ID (obligatorisk)
     * @param {string} options.moduleName - Modulens visningsnavn
     * @param {string} options.moduleIcon - FontAwesome-ikon for modulen
     */
    constructor(options = {}) {
        super(options);
        
        const {
            moduleId = '',
            moduleName = 'Modul',
            moduleIcon = 'fas fa-box',
            hasImport = false,
            hasBluetooth = true,
            hasCamera = true,
            hasExport = true
        } = options;
        
        // Basis modul-egenskaper
        this.moduleId = moduleId;
        this.moduleName = moduleName;
        this.moduleIcon = moduleIcon;
        
        // Funksjonsflagg
        this.hasImport = hasImport;
        this.hasBluetooth = hasBluetooth;
        this.hasCamera = hasCamera;
        this.hasExport = hasExport;
        
        // Data og tilstandsvariabler
        this.items = [];
        this.scannedItems = [];
        this.isInitialized = false;
        this.scanHistory = [];
        
        // Knapper og elementer
        this.elementsCache = {};
        
        // Event-abonnementer
        this.eventSubscriptions = [];
        
        // Bind metoder til this-kontekst
        this._bindMethods();
    }
    
    /**
     * Bind klassemetoder til this-kontekst
     * @private
     */
    _bindMethods() {
        this.initialize = this.initialize.bind(this);
        this.handleBarcodeScan = this.handleBarcodeScan.bind(this);
        this.updateUI = this.updateUI.bind(this);
        this.showStatus = this.showStatus.bind(this);
        this.clearData = this.clearData.bind(this);
        this.exportData = this.exportData.bind(this);
        this.undoLastScan = this.undoLastScan.bind(this);
    }
    
    /**
     * Initialiser modulen
     * Denne bør kalles etter at DOM er lastet
     */
    initialize() {
        if (this.isInitialized) return;
        
        console.log(`Initialiserer ${this.moduleName}-modulen`);
        
        // Hent DOM-elementer
        this._cacheElements();
        
        // Registrer hendelseslyttere
        this._registerEventListeners();
        
        // Koble til event-bus kanaler
        this._subscribeToEvents();
        
        // Sett opp UI
        this.updateUI();
        
        this.isInitialized = true;
        
        // Publiser initialisert-event
        eventBus.publish('module:initialized', {
            moduleId: this.moduleId
        });
    }
    
    /**
     * Cache vanlige DOM-elementer for raskere tilgang
     * @private
     */
    _cacheElements() {
        // Implementeres av subklasser
        console.log('_cacheElements() må implementeres av subklasser');
    }
    
    /**
     * Registrer DOM-hendelseslyttere
     * @private
     */
    _registerEventListeners() {
        // Implementeres av subklasser
        console.log('_registerEventListeners() må implementeres av subklasser');
    }
    
    /**
     * Abonner på meldinger fra event bus
     * @private
     */
    _subscribeToEvents() {
        // Lytt til global strekkodeskanning
        const barcodeScanSubscription = eventBus.subscribe('barcode:scanned', data => {
            this.handleBarcodeScan(data.barcode, data.source);
        });
        
        this.eventSubscriptions.push(barcodeScanSubscription);
    }
    
    /**
     * Håndter skannet strekkode
     * @param {string} barcode - Den skannede strekkoden
     * @param {string} source - Kilden til strekkoden (bluetooth, kamera, manuell)
     */
    handleBarcodeScan(barcode, source = 'manual') {
        // Implementeres av subklasser
        console.log(`Strekkode mottatt: ${barcode} (kilde: ${source})`);
        console.log('handleBarcodeScan() må implementeres av subklasser');
    }
    
    /**
     * Oppdater brukergrensesnittet basert på gjeldende data
     */
    updateUI() {
        // Implementeres av subklasser
        console.log('updateUI() må implementeres av subklasser');
    }
    
    /**
     * Vis statusmelding i modulen
     * @param {string} message - Meldingen som skal vises
     * @param {string} type - Meldingstype (info, success, warning, error)
     */
    showStatus(message, type = 'info') {
        // Implementeres av subklasser
        console.log(`Status: ${message} (type: ${type})`);
    }
    
    /**
     * Tøm alle data i modulen
     */
    clearData() {
        // Implementeres av subklasser
        this.items = [];
        this.scannedItems = [];
        this.scanHistory = [];
        this.updateUI();
        
        // Publiser event
        eventBus.publish(`${this.moduleId}:cleared`, {
            moduleId: this.moduleId
        });
    }
    
    /**
     * Eksporter data fra modulen
     * @param {string} format - Eksportformat (pdf, csv, json, txt)
     */
    exportData(format = 'pdf') {
        // Implementeres av subklasser
        console.log(`Eksporterer data i ${format}-format`);
        console.log('exportData() må implementeres av subklasser');
    }
    
    /**
     * Angre siste skann
     */
    undoLastScan() {
        if (this.scanHistory.length === 0) {
            this.showStatus('Ingen skann å angre', 'warning');
            return;
        }
        
        const lastScan = this.scanHistory.pop();
        console.log('Angrer siste skann:', lastScan);
        
        // Implementeres videre av subklasser
        this.updateUI();
        
        // Publiser event
        eventBus.publish(`${this.moduleId}:undoScan`, {
            moduleId: this.moduleId,
            item: lastScan
        });
    }
    
    /**
     * Finn en vare basert på strekkode
     * @param {string} barcode - Strekkoden som skal søkes etter
     * @returns {Object|null} Vareobjektet hvis funnet, ellers null
     */
    findItemByBarcode(barcode) {
        return this.items.find(item => item.barcode === barcode) || null;
    }
    
    /**
     * Sjekk om en vare allerede er skannet
     * @param {string} barcode - Strekkoden til varen
     * @returns {boolean} True hvis varen er skannet, ellers false
     */
    isItemScanned(barcode) {
        return this.scannedItems.some(item => item.barcode === barcode);
    }
    
    /**
     * Lagre moduldata til lokalt lager
     */
    saveToStorage() {
        // Implementeres av subklasser
        console.log('saveToStorage() må implementeres av subklasser');
    }
    
    /**
     * Last moduldata fra lokalt lager
     */
    loadFromStorage() {
        // Implementeres av subklasser
        console.log('loadFromStorage() må implementeres av subklasser');
    }
    
    /**
     * Rydde opp ressurser ved destruksjon av modulen
     */
    destroy() {
        // Avregistrer abonnementer
        this.eventSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        
        // Tømmer eventSubscriptions-arrayet
        this.eventSubscriptions = [];
        
        // Fjern DOM-lyttere (implementeres av subklasser)
        
        this.isInitialized = false;
        
        // Publiser event
        eventBus.publish('module:destroyed', {
            moduleId: this.moduleId
        });
    }
}