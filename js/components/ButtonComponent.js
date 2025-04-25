// ButtonComponent.js - En gjenbrukbar knapp-komponent som bruker HTML-templates
import { BaseComponent } from './BaseComponent.js';

/**
 * ButtonComponent - En gjenbrukbar knapp-komponent som bruker HTML-templates
 * @extends BaseComponent
 */
export class ButtonComponent extends BaseComponent {
    /**
     * Oppretter en ny knapp-komponent
     * @param {Object} options - Konfigurasjon for knappen
     * @param {string} options.text - Knappeteksten
     * @param {string} options.type - Knappetype (primary, secondary, danger, etc.)
     * @param {string} options.icon - FontAwesome-ikon for knappen (uten 'fas fa-' prefix)
     * @param {Function} options.onClick - Callback for klikk-hendelsen
     * @param {boolean} options.disabled - Om knappen skal være disabled (standard: false)
     * @param {string} options.id - ID for knappen (valgfritt)
     * @param {string} options.className - Ekstra CSS-klasser for knappen
     * @param {HTMLElement|string} options.container - Containerelement eller CSS-selector der knappen skal legges til
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            text: 'Knapp',
            type: 'primary',
            icon: null,
            onClick: null,
            disabled: false,
            className: '',
            id: `btn-${Date.now()}`,
            container: null,
            templateId: 'buttonComponentTemplate'
        };
        
        super({ ...defaultOptions, ...options });
        
        // Initier knappen
        this.init();
    }
    
    /**
     * Initialiser knappen med template
     */
    init() {
        // Last template
        this.loadTemplate();
        
        // Konfigurer knappen
        this.configureButton();
        
        // Legg til i container om spesifisert
        if (this.options.container) {
            this.appendToContainer();
        }
    }
    
    /**
     * Last template og opprett knapp-element
     */
    loadTemplate() {
        // Finn template
        const template = document.getElementById(this.options.templateId);
        
        // If template doesn't exist, create a default one
        if (!template) {
            console.warn(`Template not found: ${this.options.templateId}, creating default button`);
            
            // Create default button
            this.button = document.createElement('button');
            this.button.className = `btn btn-${this.options.type} ${this.options.className}`.trim();
            
            // Create icon if needed
            if (this.options.icon) {
                this.iconElement = document.createElement('i');
                this.iconElement.className = `fas fa-${this.options.icon}`;
                this.button.appendChild(this.iconElement);
            }
            
            // Create text element
            this.textElement = document.createElement('span');
            this.textElement.textContent = this.options.text;
            this.button.appendChild(this.textElement);
            
            // Save reference to element
            this.element = this.button;
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        this.button = clone.querySelector('button');
        
        // Lagre referanse til elementer
        this.element = this.button;
        this.iconElement = this.button.querySelector('i');
        this.textElement = this.button.querySelector('span');
    }
    
    /**
     * Konfigurer knappen basert på opsjoner
     */
    configureButton() {
        if (!this.button) return;
        
        // Sett ID
        if (this.options.id) {
            this.button.id = this.options.id;
        }
        
        // Sett type og klasser
        this.button.className = `btn btn-${this.options.type} ${this.options.className}`.trim();
        
        // Sett disabled-status
        this.button.disabled = this.options.disabled;
        
        // Sett ikon
        if (this.options.icon) {
            if (!this.iconElement) {
                this.iconElement = document.createElement('i');
                this.button.insertBefore(this.iconElement, this.button.firstChild);
            }
            this.iconElement.className = `fas fa-${this.options.icon}`;
        } else if (this.iconElement) {
            this.iconElement.remove();
            this.iconElement = null;
        }
        
        // Sett tekst
        if (this.options.text) {
            if (!this.textElement) {
                this.textElement = document.createElement('span');
                this.button.appendChild(this.textElement);
            }
            this.textElement.textContent = this.options.text;
        } else if (this.textElement) {
            this.textElement.remove();
            this.textElement = null;
        }
        
        // Legg til klikk-handler
        if (typeof this.options.onClick === 'function') {
            this.button.addEventListener('click', this.handleClick.bind(this));
        }
    }
    
    /**
     * Håndter klikk-hendelser
     * @param {Event} event - Klikk-hendelsen
     */
    handleClick(event) {
        if (!this.options.disabled && typeof this.options.onClick === 'function') {
            this.options.onClick(event, this);
        }
    }
    
    /**
     * Legg knappen til i en container
     * @param {HTMLElement|string} [container] - Container-element eller CSS-selector (bruker this.options.container hvis ikke angitt)
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
     * Aktiverer eller deaktiverer knappen
     * @param {boolean} isDisabled - Om knappen skal være deaktivert
     */
    setDisabled(isDisabled) {
        this.options.disabled = isDisabled;
        if (this.button) {
            this.button.disabled = isDisabled;
        }
        return this;
    }
    
    /**
     * Endrer knappeteksten
     * @param {string} text - Ny tekst for knappen
     */
    setText(text) {
        this.options.text = text;
        if (this.textElement) {
            this.textElement.textContent = text;
        }
        return this;
    }
    
    /**
     * Endrer knappeikonet
     * @param {string} icon - Nytt FontAwesome-ikon (uten 'fas fa-' prefix)
     */
    setIcon(icon) {
        this.options.icon = icon;
        
        if (!icon && this.iconElement) {
            this.iconElement.remove();
            this.iconElement = null;
        } else if (icon) {
            if (!this.iconElement) {
                this.iconElement = document.createElement('i');
                this.button.insertBefore(this.iconElement, this.button.firstChild);
            }
            this.iconElement.className = `fas fa-${icon}`;
        }
        
        return this;
    }
    
    /**
     * Endrer knappetype (primary, secondary, danger, etc.)
     * @param {string} type - Ny type for knappen
     */
    setType(type) {
        // Fjern gammel type-klasse
        if (this.button) {
            this.button.classList.remove(`btn-${this.options.type}`);
        }
        
        // Sett ny type
        this.options.type = type;
        
        // Legg til ny type-klasse
        if (this.button) {
            this.button.classList.add(`btn-${type}`);
        }
        
        return this;
    }
    
    /**
     * Legger til eller fjerner en CSS-klasse på knappen
     * @param {string} className - Klassenavn som skal legges til eller fjernes
     * @param {boolean} add - True for å legge til, false for å fjerne
     */
    toggleClass(className, add) {
        if (this.button && className) {
            if (add !== false) {
                this.button.classList.add(className);
            } else {
                this.button.classList.remove(className);
            }
        }
        return this;
    }
    
    /**
     * Fjerner komponenten fra DOM
     */
    remove() {
        if (this.button) {
            // Fjern event listener
            this.button.removeEventListener('click', this.handleClick.bind(this));
            
            // Fjern fra DOM
            if (this.button.parentNode) {
                this.button.parentNode.removeChild(this.button);
            }
        }
    }
}