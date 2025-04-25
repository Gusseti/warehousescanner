// filepath: s:\Workspace\GitHub\warehousescanner\js\components\ScanInputComponent.js
import { BaseComponent } from './BaseComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * ScanInputComponent - Komponent for skanning og manuell inntasting av strekkoder
 * @extends BaseComponent
 */
export class ScanInputComponent extends BaseComponent {
    /**
     * Oppretter en ny skannekomponent
     * @param {Object} options - Konfigurasjon for komponenten
     * @param {string} options.id - ID for komponenten
     * @param {string} options.placeholder - Plassholder for input-feltet
     * @param {Function} options.onScan - Callback for når en strekkode er skannet
     * @param {HTMLElement|string} options.container - Containerelement eller CSS-selector
     * @param {string} options.buttonText - Tekst på registreringsknappen
     * @param {string} options.moduleId - ID for modulen komponenten tilhører
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            id: `scan-input-${Date.now()}`,
            placeholder: 'Skann eller skriv inn varenummer',
            onScan: null,
            container: null,
            buttonText: 'Registrer',
            templateId: 'scanInputComponentTemplate',
            moduleId: 'general',
            clearAfterScan: true
        };
        
        super({ ...defaultOptions, ...options });
        
        // Initier komponenten
        this.init();
    }
    
    /**
     * Initialiser komponenten
     */
    init() {
        // Last template
        this.loadTemplate();
        
        // Konfigurer komponenten
        this.configureComponent();
        
        // Legg til i container om spesifisert
        if (this.options.container) {
            this.appendToContainer();
        }
    }
    
    /**
     * Last template og opprett komponent-element
     */
    loadTemplate() {
        // Finn template
        const template = document.getElementById(this.options.templateId);
        
        // If template doesn't exist, create a default one
        if (!template) {
            console.warn(`Template not found: ${this.options.templateId}, creating default template`);
            
            // Create default HTML structure
            const div = document.createElement('div');
            div.className = 'scan-input-group';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'scan-input';
            input.placeholder = this.options.placeholder || 'Skann eller skriv inn varenummer';
            
            const button = document.createElement('button');
            button.className = 'scan-button';
            button.innerHTML = `<i class="fas fa-barcode"></i> <span>${this.options.buttonText || 'Registrer'}</span>`;
            
            div.appendChild(input);
            div.appendChild(button);
            
            this.element = div;
            this.inputField = input;
            this.scanButton = button;
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        this.element = clone.querySelector('.scan-input-group');
        this.inputField = clone.querySelector('input');
        this.scanButton = clone.querySelector('button');
    }
    
    /**
     * Konfigurer komponenten basert på opsjoner
     */
    configureComponent() {
        if (!this.element) return;
        
        // Sett ID
        if (this.options.id) {
            this.element.id = this.options.id;
            this.inputField.id = `${this.options.id}-input`;
            this.scanButton.id = `${this.options.id}-button`;
        }
        
        // Sett placeholder
        if (this.options.placeholder) {
            this.inputField.placeholder = this.options.placeholder;
        }
        
        // Sett knappetekst
        if (this.options.buttonText) {
            // Finn span i knappen og oppdater teksten
            const span = this.scanButton.querySelector('span') || this.scanButton;
            span.textContent = this.options.buttonText;
        }
        
        // Legg til event listeners
        this.registerEventListeners();
    }
    
    /**
     * Registrer hendelseslyttere
     */
    registerEventListeners() {
        // Lytt etter klikk på skanneknappen
        this.scanButton.addEventListener('click', this.handleScanButtonClick.bind(this));
        
        // Lytt etter Enter-tastetrykk i input-feltet
        this.inputField.addEventListener('keypress', this.handleInputKeypress.bind(this));
        
        // Lytt etter skannehendelser fra Bluetooth-skanner
        this.registerExternalScanListener();
    }
    
    /**
     * Håndter klikk på skanneknappen
     */
    handleScanButtonClick() {
        const barcode = this.inputField.value.trim();
        if (barcode) {
            this.processBarcode(barcode, 'manual');
        }
    }
    
    /**
     * Håndter Enter-tastetrykk i input-feltet
     * @param {KeyboardEvent} event - Tastehendelse
     */
    handleInputKeypress(event) {
        if (event.key === 'Enter') {
            const barcode = this.inputField.value.trim();
            if (barcode) {
                this.processBarcode(barcode, 'manual');
            }
        }
    }
    
    /**
     * Registrer lytter for eksterne skannehendelser
     */
    registerExternalScanListener() {
        // Abonner på globale strekkodehendelser fra Bluetooth eller kamera
        eventBus.subscribe('barcode:scanned', data => {
            // Sjekk om hendelsen er ment for denne modulen
            if (data.moduleId === this.options.moduleId || !data.moduleId) {
                // Vis strekkoden i input-feltet
                this.inputField.value = data.barcode;
                // Behandle strekkoden
                this.processBarcode(data.barcode, data.source || 'external');
            }
        });
    }
    
    /**
     * Behandle en skannet strekkode
     * @param {string} barcode - Den skannede strekkoden
     * @param {string} source - Kilden til strekkoden (bluetooth, camera, manual)
     */
    processBarcode(barcode, source) {
        // Kall onScan-callback hvis definert
        if (typeof this.options.onScan === 'function') {
            this.options.onScan(barcode, source);
        }
        
        // Tøm input-feltet hvis konfigurert til det
        if (this.options.clearAfterScan) {
            this.inputField.value = '';
        }
        
        // Gi tilbakemelding til brukeren
        this.giveFeedback();
    }
    
    /**
     * Gi visuell tilbakemelding til brukeren
     */
    giveFeedback() {
        // Blink input-feltet for å vise at strekkoden er registrert
        this.inputField.classList.add('scan-success');
        setTimeout(() => {
            this.inputField.classList.remove('scan-success');
        }, 300);
    }
    
    /**
     * Legg komponenten til i en container
     * @param {HTMLElement|string} [container] - Container-element eller CSS-selector
     */
    appendToContainer(container) {
        const targetContainer = container || this.options.container;
        if (!targetContainer || !this.element) return;
        
        let containerElement;
        if (typeof targetContainer === 'string') {
            containerElement = document.querySelector(targetContainer);
        } else {
            containerElement = targetContainer;
        }
        
        if (containerElement) {
            containerElement.appendChild(this.element);
        }
    }
    
    /**
     * Sett fokus på input-feltet
     */
    focus() {
        if (this.inputField) {
            this.inputField.focus();
        }
        return this;
    }
    
    /**
     * Sett eller hent strekkoden i input-feltet
     * @param {string} [value] - Ny verdi for input-feltet (valgfritt)
     * @returns {string|ScanInputComponent} - Strekkoden eller this for chaining
     */
    value(value) {
        if (value === undefined) {
            return this.inputField ? this.inputField.value : '';
        }
        
        if (this.inputField) {
            this.inputField.value = value;
        }
        
        return this;
    }
    
    /**
     * Aktiver eller deaktiver input-feltet og skanneknappen
     * @param {boolean} isDisabled - Om komponenten skal være deaktivert
     */
    setDisabled(isDisabled) {
        if (this.inputField) {
            this.inputField.disabled = isDisabled;
        }
        
        if (this.scanButton) {
            this.scanButton.disabled = isDisabled;
        }
        
        return this;
    }
    
    /**
     * Fjern komponenten fra DOM
     */
    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}