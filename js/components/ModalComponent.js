// ModalComponent.js - Base component for modal dialogs
import { BaseComponent } from './BaseComponent.js';
import { ButtonComponent } from './ButtonComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * ModalComponent - Komponent for modalvinduer
 * @extends BaseComponent
 */
export class ModalComponent extends BaseComponent {
    /**
     * Oppretter en ny modalkomponent
     * @param {Object} options - Konfigurasjon for modalen
     * @param {string} options.id - ID for modalen
     * @param {string} options.title - Tittel for modalen
     * @param {string|HTMLElement} options.content - Innhold for modalen (HTML-string eller element)
     * @param {Array} options.buttons - Knapper for modalen [{text, type, onClick, dismissOnClick}]
     * @param {boolean} options.closable - Om modalen kan lukkes med X-knapp
     * @param {boolean} options.backdrop - Om modalen skal ha bakgrunnsoverlegg som kan klikkes på
     * @param {Function} options.onClose - Callback for når modalen lukkes
     * @param {Function} options.onOpen - Callback for når modalen åpnes
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            id: `modal-${Date.now()}`,
            title: 'Modal',
            content: '',
            buttons: [
                {
                    text: 'Lukk',
                    type: 'secondary',
                    dismissOnClick: true
                }
            ],
            closable: true,
            backdrop: true,
            container: document.body,
            onClose: null,
            onOpen: null,
            templateId: 'modalTemplate',
            size: 'medium', // small, medium, large, fullscreen
            className: ''
        };
        
        super({ ...defaultOptions, ...options });
        
        // Tilstand
        this.isOpen = false;
        this.buttonComponents = [];
        
        // Initier komponenten
        this.init();
    }
    
    /**
     * Initialiser komponenten
     */
    init() {
        // Last template
        this.loadTemplate();
        
        // Konfigurer modalen
        this.configureModal();
        
        // Legg til i container om spesifisert
        if (this.options.container) {
            this.addToContainer(this.options.container);
        }
    }
    
    /**
     * Last template og opprett modal-element
     */
    loadTemplate() {
        // Finn template
        const template = document.getElementById(this.options.templateId);
        
        // If template doesn't exist, create a default one
        if (!template) {
            console.warn(`Template not found: ${this.options.templateId}, creating default modal`);
            
            // Create modal structure
            this.element = document.createElement('div');
            this.element.className = 'modal';
            
            const modalDialog = document.createElement('div');
            modalDialog.className = 'modal-dialog';
            
            this.modalContent = document.createElement('div');
            this.modalContent.className = 'modal-content';
            
            this.headerElement = document.createElement('div');
            this.headerElement.className = 'modal-header';
            
            this.titleElement = document.createElement('h5');
            this.titleElement.className = 'modal-title';
            this.titleElement.textContent = this.options.title;
            
            this.closeButton = document.createElement('button');
            this.closeButton.type = 'button';
            this.closeButton.className = 'close';
            this.closeButton.innerHTML = '&times;';
            
            this.bodyElement = document.createElement('div');
            this.bodyElement.className = 'modal-body';
            
            this.footerElement = document.createElement('div');
            this.footerElement.className = 'modal-footer';
            
            // Assemble modal
            this.headerElement.appendChild(this.titleElement);
            this.headerElement.appendChild(this.closeButton);
            
            this.modalContent.appendChild(this.headerElement);
            this.modalContent.appendChild(this.bodyElement);
            this.modalContent.appendChild(this.footerElement);
            
            modalDialog.appendChild(this.modalContent);
            this.element.appendChild(modalDialog);
            
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        this.element = clone.querySelector('.modal');
        this.modalContent = this.element.querySelector('.modal-content');
        this.headerElement = this.element.querySelector('.modal-header');
        this.titleElement = this.element.querySelector('.modal-title');
        this.bodyElement = this.element.querySelector('.modal-body');
        this.footerElement = this.element.querySelector('.modal-footer');
        this.closeButton = this.element.querySelector('.close');
    }
    
    /**
     * Konfigurer modalen basert på opsjoner
     */
    configureModal() {
        if (!this.element) return;
        
        // Sett ID
        this.element.id = this.options.id;
        
        // Legg til eventuell custom klasse
        if (this.options.className) {
            this.element.classList.add(this.options.className);
        }
        
        // Sett størrelse
        this.element.classList.add(`modal-${this.options.size}`);
        
        // Sett tittel
        this.titleElement.textContent = this.options.title;
        
        // Sett innhold
        this.setContent(this.options.content);
        
        // Konfigurer lukkeknapp
        if (this.options.closable && this.closeButton) {
            this.closeButton.style.display = 'block';
            this.closeButton.addEventListener('click', () => this.close());
        } else if (this.closeButton) {
            this.closeButton.style.display = 'none';
        }
        
        // Konfigurer bakgrunnsoverlegg
        if (this.options.backdrop) {
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.close();
                }
            });
        }
        
        // Opprett knapper
        this.createButtons();
        
        // Registrer escape-tast for å lukke modalen
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    /**
     * Opprett knapper for modalen
     */
    createButtons() {
        // Fjern eksisterende knapper
        this.footerElement.innerHTML = '';
        this.buttonComponents = [];
        
        // Legg til nye knapper
        this.options.buttons.forEach((buttonConfig, index) => {
            const button = new ButtonComponent({
                text: buttonConfig.text,
                type: buttonConfig.type || 'secondary',
                icon: buttonConfig.icon,
                id: `${this.options.id}-btn-${index}`,
                onClick: (e) => {
                    // Kall onClick-callback hvis definert
                    if (typeof buttonConfig.onClick === 'function') {
                        buttonConfig.onClick(e, this);
                    }
                    
                    // Lukk modalen hvis angitt
                    if (buttonConfig.dismissOnClick) {
                        this.close();
                    }
                }
            });
            
            // Legg til i footer
            button.appendToContainer(this.footerElement);
            
            // Lagre referanse
            this.buttonComponents.push(button);
        });
    }
    
    /**
     * Håndter tastetrykk (for Escape-tast)
     * @param {KeyboardEvent} event - Tastehendelsen
     */
    handleKeyDown(event) {
        if (event.key === 'Escape' && this.isOpen && this.options.closable) {
            this.close();
        }
    }
    
    /**
     * Sett modalens innhold
     * @param {string|HTMLElement} content - Innhold for modalen
     */
    setContent(content) {
        if (!this.bodyElement) return this;
        
        // Tøm innhold
        this.bodyElement.innerHTML = '';
        
        // Legg til nytt innhold
        if (typeof content === 'string') {
            this.bodyElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.bodyElement.appendChild(content);
        }
        
        return this;
    }
    
    /**
     * Sett modalens tittel
     * @param {string} title - Ny tittel for modalen
     */
    setTitle(title) {
        this.options.title = title;
        
        if (this.titleElement) {
            this.titleElement.textContent = title;
        }
        
        return this;
    }
    
    /**
     * Oppdater knapper for modalen
     * @param {Array} buttons - Nye knapper for modalen
     */
    setButtons(buttons) {
        this.options.buttons = buttons;
        this.createButtons();
        return this;
    }
    
    /**
     * Åpne modalen
     */
    open() {
        if (this.isOpen) return this;
        
        // Vis modal
        this.element.classList.add('active');
        this.isOpen = true;
        
        // Utløs hendelse
        eventBus.publish('modal:opened', {
            id: this.options.id,
            instance: this
        });
        
        // Kall onOpen-callback hvis definert
        if (typeof this.options.onOpen === 'function') {
            this.options.onOpen(this);
        }
        
        // Lås scrolling på bakgrunn
        document.body.classList.add('modal-open');
        
        return this;
    }
    
    /**
     * Lukk modalen
     */
    close() {
        if (!this.isOpen) return this;
        
        // Skjul modal
        this.element.classList.remove('active');
        this.isOpen = false;
        
        // Utløs hendelse
        eventBus.publish('modal:closed', {
            id: this.options.id,
            instance: this
        });
        
        // Kall onClose-callback hvis definert
        if (typeof this.options.onClose === 'function') {
            this.options.onClose(this);
        }
        
        // Fjern scrolling-lås på bakgrunn
        document.body.classList.remove('modal-open');
        
        return this;
    }
    
    /**
     * Hent knappen med angitt indeks
     * @param {number} index - Indeks for knappen
     * @returns {ButtonComponent|null} Knappen eller null hvis den ikke finnes
     */
    getButton(index) {
        return this.buttonComponents[index] || null;
    }
    
    /**
     * Aktiver eller deaktiver en knapp
     * @param {number} index - Indeks for knappen
     * @param {boolean} isDisabled - Om knappen skal være deaktivert
     */
    setButtonDisabled(index, isDisabled) {
        const button = this.getButton(index);
        if (button) {
            button.setDisabled(isDisabled);
        }
        return this;
    }
    
    /**
     * Endre tekst på en knapp
     * @param {number} index - Indeks for knappen
     * @param {string} text - Ny tekst for knappen
     */
    setButtonText(index, text) {
        const button = this.getButton(index);
        if (button) {
            button.setText(text);
        }
        return this;
    }
    
    /**
     * Fjern komponenten fra DOM
     */
    remove() {
        // Fjern event listener
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Fjern knapper
        this.buttonComponents.forEach(button => {
            button.remove();
        });
        
        // Fjern fra DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
    
    /**
     * Adds the modal to a container
     * @param {HTMLElement|string} container - Container element or CSS selector
     */
    addToContainer(container) {
        if (!container || !this.element) return this;
        
        let containerElement;
        if (typeof container === 'string') {
            containerElement = document.querySelector(container);
        } else {
            containerElement = container;
        }
        
        if (containerElement) {
            containerElement.appendChild(this.element);
        }
        
        return this;
    }
}