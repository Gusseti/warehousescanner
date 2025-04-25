import { BaseComponent } from './BaseComponent.js';
import { ModuleContainerComponent } from './ModuleContainerComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * ModuleComponent - Basisklasse for alle moduler i applikasjonen
 * @extends BaseComponent
 */
export class ModuleComponent extends BaseComponent {
    /**
     * Oppretter en ny modulkomponent
     * @param {Object} options - Konfigurasjon for modulen
     * @param {string} options.moduleId - ID for modulen
     * @param {string} options.title - Tittel for modulen
     * @param {string} options.icon - FontAwesome-ikon for modulen
     * @param {HTMLElement|string} options.container - Containerelement eller CSS-selector
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            moduleId: '',
            title: 'Modul',
            icon: 'cube',
            container: '#appRoot',
            visible: false,
            isActive: false,
            className: ''
        };
        
        super({ ...defaultOptions, ...options });
        
        // Modulens tilstand
        this.isActive = this.options.isActive;
        this.componentRegistry = new Map();
        
        // Opprett container-komponent
        this.containerComponent = new ModuleContainerComponent({
            moduleId: this.options.moduleId,
            title: this.options.title,
            icon: this.options.icon,
            container: this.options.container,
            visible: this.options.visible,
            className: this.options.className
        });
        
        // Sett element-referansen
        this.element = this.containerComponent.element;
        
        // Initier modulen
        this.init();
    }
    
    /**
     * Initialiser modulen
     */
    init() {
        // Registrer hendelseslyttere
        this.registerEventListeners();
        
        // Initier UI-komponenter
        this.initComponents();
    }
    
    /**
     * Registrer hendelseslyttere
     */
    registerEventListeners() {
        // Lytt etter modulaktivering
        eventBus.subscribe('module:activate', (data) => {
            if (data.moduleId === this.options.moduleId) {
                this.activate();
            } else {
                this.deactivate();
            }
        });
    }
    
    /**
     * Initier UI-komponenter
     * Overskrides i subklasser
     */
    initComponents() {
        // Implementeres av subklasser
    }
    
    /**
     * Last moduldata
     * Overskrides i subklasser
     */
    loadData() {
        // Implementeres av subklasser
    }
    
    /**
     * Lagre moduldata
     * Overskrides i subklasser
     */
    saveData() {
        // Implementeres av subklasser
    }
    
    /**
     * Aktiver modulen
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.containerComponent.show();
        
        // Last data
        this.loadData();
        
        // Utløs hendelse
        eventBus.publish('module:activated', {
            moduleId: this.options.moduleId,
            instance: this
        });
        
        return this;
    }
    
    /**
     * Deaktiver modulen
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.containerComponent.hide();
        
        // Lagre data
        this.saveData();
        
        // Utløs hendelse
        eventBus.publish('module:deactivated', {
            moduleId: this.options.moduleId,
            instance: this
        });
        
        return this;
    }
    
    /**
     * Sjekk om modulen er aktiv
     * @returns {boolean} Om modulen er aktiv eller ikke
     */
    isModuleActive() {
        return this.isActive;
    }
    
    /**
     * Legg til en komponent i modulen
     * @param {string} id - ID for komponenten
     * @param {BaseComponent} component - Komponenten som skal legges til
     * @param {boolean} [appendToContent=true] - Om komponenten skal legges til i modulens innholdsseksjon
     */
    addComponent(id, component, appendToContent = true) {
        this.componentRegistry.set(id, component);
        this.containerComponent.addComponent(id, component, appendToContent);
        return this;
    }
    
    /**
     * Hent en komponent fra modulen
     * @param {string} id - ID for komponenten
     * @returns {BaseComponent|null} Komponenten eller null hvis den ikke finnes
     */
    getComponent(id) {
        return this.componentRegistry.get(id) || null;
    }
    
    /**
     * Fjern en komponent fra modulen
     * @param {string} id - ID for komponenten
     */
    removeComponent(id) {
        this.containerComponent.removeComponent(id);
        this.componentRegistry.delete(id);
        return this;
    }
    
    /**
     * Fjern alle komponenter fra modulen
     */
    clearComponents() {
        this.containerComponent.clearComponents();
        this.componentRegistry.clear();
        return this;
    }
    
    /**
     * Håndter hendelsen når en strekkode er skannet
     * @param {string} barcode - Den skannede strekkoden
     * @param {string} source - Kilden til strekkoden (bluetooth, camera, manual)
     */
    handleBarcodeScan(barcode, source) {
        // Implementeres av subklasser
        console.log(`Modul ${this.options.moduleId} mottok strekkode: ${barcode} fra ${source}`);
    }
    
    /**
     * Håndter ukjent strekkode
     * @param {string} barcode - Den ukjente strekkoden
     * @returns {boolean} Om strekkoden ble håndtert eller ikke
     */
    handleUnknownBarcode(barcode) {
        // Implementeres av subklasser
        console.log(`Modul ${this.options.moduleId} mottok ukjent strekkode: ${barcode}`);
        return false;
    }
    
    /**
     * Oppdater modulens UI
     */
    updateUI() {
        // Implementeres av subklasser
    }
    
    /**
     * Sett innholdet i modulen
     * @param {string|HTMLElement} content - Innholdet som skal settes
     */
    setContent(content) {
        this.containerComponent.setContent(content);
        return this;
    }
    
    /**
     * Legg til en node i modulens innholdsseksjon
     * @param {HTMLElement} node - Noden som skal legges til
     */
    appendChild(node) {
        this.containerComponent.appendChild(node);
        return this;
    }
    
    /**
     * Endre modulens tittel
     * @param {string} title - Ny tittel for modulen
     */
    setTitle(title) {
        this.options.title = title;
        this.containerComponent.setTitle(title);
        return this;
    }
    
    /**
     * Endre modulens ikon
     * @param {string} icon - Nytt FontAwesome-ikon for modulen
     */
    setIcon(icon) {
        this.options.icon = icon;
        this.containerComponent.setIcon(icon);
        return this;
    }
    
    /**
     * Fjern modulen fra DOM
     */
    remove() {
        // Fjern alle komponenter
        this.clearComponents();
        
        // Fjern container-komponenten
        this.containerComponent.remove();
        
        // Fjern event-abonnementer
        eventBus.unsubscribeAll(this);
    }
}