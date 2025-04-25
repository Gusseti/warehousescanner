// filepath: s:\Workspace\GitHub\warehousescanner\js\components\ModuleContainerComponent.js
import { BaseComponent } from './BaseComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * ModuleContainerComponent - Container for moduler i applikasjonen
 * @extends BaseComponent
 */
export class ModuleContainerComponent extends BaseComponent {
    /**
     * Oppretter en ny modulcontainer
     * @param {Object} options - Konfigurasjon for modulcontaineren
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
            className: ''
        };
        
        super({ ...defaultOptions, ...options });
        
        // Modulens tilstand
        this.isVisible = this.options.visible;
        this.childComponents = new Map();
        
        // Initier komponenten
        this.init();
    }
    
    /**
     * Initialiser modulcontaineren
     */
    init() {
        this.createContainerElement();
        this.appendToContainer();
        
        // Lytt etter hendelser
        this.registerEventListeners();
    }
    
    /**
     * Opprett container-elementet for modulen
     */
    createContainerElement() {
        // Opprett hovedcontainer
        this.element = document.createElement('div');
        this.element.className = `module-container ${this.options.className}`.trim();
        this.element.id = `${this.options.moduleId}Module`;
        this.element.style.display = this.isVisible ? 'block' : 'none';
        
        // Only create card for non-picking modules
        if (this.options.moduleId !== 'picking') {
            // Opprett kortcontainer
            this.cardElement = document.createElement('div');
            this.cardElement.className = 'card';
            this.element.appendChild(this.cardElement);
            
            // Opprett tittel-element
            this.titleElement = document.createElement('div');
            this.titleElement.className = 'card-title';
            this.cardElement.appendChild(this.titleElement);
            
            // Opprett ikonet
            const iconElement = document.createElement('i');
            iconElement.className = `fas fa-${this.options.icon}`;
            this.titleElement.appendChild(iconElement);
            
            // Legg til tittel
            this.titleElement.appendChild(document.createTextNode(` ${this.options.title}`));
            
            // Opprett hovedinnholdsseksjon
            this.contentElement = document.createElement('div');
            this.contentElement.className = 'module-section';
            this.cardElement.appendChild(this.contentElement);
        } else {
            // For picking module, create a hidden content element
            // This ensures the API still works but doesn't display the card
            this.cardElement = document.createElement('div');
            this.cardElement.style.display = 'none';
            this.element.appendChild(this.cardElement);
            
            this.titleElement = document.createElement('div');
            this.titleElement.style.display = 'none';
            this.cardElement.appendChild(this.titleElement);
            
            this.contentElement = document.createElement('div');
            this.contentElement.style.display = 'none';
            this.cardElement.appendChild(this.contentElement);
        }
    }
    
    /**
     * Registrer hendelseslyttere
     */
    registerEventListeners() {
        // Lytt etter modulaktivering
        eventBus.subscribe('module:activate', (data) => {
            if (data.moduleId === this.options.moduleId) {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // Lytt etter moduldeaktivering
        eventBus.subscribe('module:deactivate', (data) => {
            if (data.moduleId === this.options.moduleId) {
                this.hide();
            }
        });
    }
    
    /**
     * Vis modulen
     */
    show() {
        if (this.element) {
            this.element.style.display = 'block';
            this.isVisible = true;
            
            // Informer child-komponenter
            this.notifyChildren('visible');
            
            // Utløs hendelse
            eventBus.publish('module:shown', {
                moduleId: this.options.moduleId
            });
        }
        return this;
    }
    
    /**
     * Skjul modulen
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.isVisible = false;
            
            // Informer child-komponenter
            this.notifyChildren('hidden');
            
            // Utløs hendelse
            eventBus.publish('module:hidden', {
                moduleId: this.options.moduleId
            });
        }
        return this;
    }
    
    /**
     * Sjekk om modulen er synlig
     * @returns {boolean} Om modulen er synlig eller ikke
     */
    isModuleVisible() {
        return this.isVisible;
    }
    
    /**
     * Legg til en underkomponent i modulen
     * @param {string} id - ID for komponenten
     * @param {BaseComponent} component - Komponenten som skal legges til
     * @param {boolean} [appendToContent=true] - Om komponenten skal legges til i modulens innholdsseksjon
     */
    addComponent(id, component, appendToContent = true) {
        this.childComponents.set(id, component);
        
        // Legg komponenten til i innholdsseksjonen hvis angitt
        if (appendToContent && component.element && this.contentElement) {
            this.contentElement.appendChild(component.element);
        }
        
        return this;
    }
    
    /**
     * Hent en underkomponent fra modulen
     * @param {string} id - ID for komponenten
     * @returns {BaseComponent|null} Komponenten eller null hvis den ikke finnes
     */
    getComponent(id) {
        return this.childComponents.get(id) || null;
    }
    
    /**
     * Fjern en underkomponent fra modulen
     * @param {string} id - ID for komponenten
     */
    removeComponent(id) {
        const component = this.childComponents.get(id);
        if (component) {
            // Fjern fra DOM hvis mulig
            if (component.element && component.element.parentNode) {
                component.element.parentNode.removeChild(component.element);
            }
            
            // Fjern fra Map
            this.childComponents.delete(id);
        }
        
        return this;
    }
    
    /**
     * Fjern alle underkomponenter fra modulen
     */
    clearComponents() {
        // Fjern alle komponenter fra DOM
        this.childComponents.forEach(component => {
            if (component.element && component.element.parentNode) {
                component.element.parentNode.removeChild(component.element);
            }
        });
        
        // Tøm Map
        this.childComponents.clear();
        
        return this;
    }
    
    /**
     * Informer alle underkomponenter om en hendelse
     * @param {string} event - Hendelsen som har oppstått
     * @param {Object} [data] - Eventuelle data som skal sendes med hendelsen
     */
    notifyChildren(event, data = {}) {
        this.childComponents.forEach(component => {
            // Hvis komponenten har en onParentEvent-metode, kall den
            if (typeof component.onParentEvent === 'function') {
                component.onParentEvent(event, data);
            }
        });
        
        return this;
    }
    
    /**
     * Legg modulcontaineren til i en container
     * @param {HTMLElement|string} [container] - Container-element eller CSS-selector
     */
    appendToContainer(container) {
        const targetContainer = container || this.options.container;
        if (!targetContainer || !this.element) return this;
        
        let containerElement;
        if (typeof targetContainer === 'string') {
            containerElement = document.querySelector(targetContainer);
        } else {
            containerElement = targetContainer;
        }
        
        if (containerElement) {
            containerElement.appendChild(this.element);
        }
        
        return this;
    }
    
    /**
     * Legg til HTML-innhold i modulens innholdsseksjon
     * @param {string} html - HTML-innholdet som skal legges til
     */
    setContent(html) {
        if (this.contentElement) {
            this.contentElement.innerHTML = html;
        }
        return this;
    }
    
    /**
     * Legg til et element i modulens innholdsseksjon
     * @param {HTMLElement} element - Elementet som skal legges til
     */
    appendChild(element) {
        if (this.contentElement && element) {
            this.contentElement.appendChild(element);
        }
        return this;
    }
    
    /**
     * Endre modulens tittel
     * @param {string} title - Ny tittel for modulen
     */
    setTitle(title) {
        this.options.title = title;
        
        if (this.titleElement) {
            // Finn tekst-noden og oppdater den
            let textNode = null;
            for (let i = 0; i < this.titleElement.childNodes.length; i++) {
                if (this.titleElement.childNodes[i].nodeType === Node.TEXT_NODE) {
                    textNode = this.titleElement.childNodes[i];
                    break;
                }
            }
            
            if (textNode) {
                textNode.nodeValue = ` ${title}`;
            } else {
                // Legg til ny tekstnode hvis ingen eksisterer
                this.titleElement.appendChild(document.createTextNode(` ${title}`));
            }
        }
        
        return this;
    }
    
    /**
     * Endre modulens ikon
     * @param {string} icon - Nytt FontAwesome-ikon for modulen
     */
    setIcon(icon) {
        this.options.icon = icon;
        
        if (this.titleElement) {
            const iconElement = this.titleElement.querySelector('i');
            if (iconElement) {
                iconElement.className = `fas fa-${icon}`;
            }
        }
        
        return this;
    }
    
    /**
     * Fjern komponenten fra DOM
     */
    remove() {
        // Fjern alle underkomponenter først
        this.clearComponents();
        
        // Fjern event-abonnementer
        eventBus.unsubscribeAll(this);
        
        // Fjern fra DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}