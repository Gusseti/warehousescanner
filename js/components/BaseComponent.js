// BaseComponent.js - Basisklasse for alle UI-komponenter
export class BaseComponent {
    /**
     * Oppretter en ny komponent
     * @param {string|Object} containerId - ID på container-elementet der komponenten skal rendres eller options objekt
     * @param {Object} options - Konfigurasjon for komponenten
     */
    constructor(containerId, options = {}) {
        // Handle case where first parameter is options object instead of containerId
        if (typeof containerId === 'object' && containerId !== null && !options.containerId) {
            options = containerId;
            containerId = options.containerId || options.moduleId || null;
        }
        
        this.containerId = containerId;
        this.options = options;
        this.elements = {};
        
        // Handle cases where containerId is null or undefined
        if (!containerId) {
            // Create a div element that can be used internally
            this.container = document.createElement('div');
            // Don't show error when null is explicitly passed
            return;
        }
        
        // Try to find existing container
        this.container = document.getElementById(containerId);
        
        // If container doesn't exist, create it if autoCreate option is set
        if (!this.container && options.autoCreate) {
            this.container = document.createElement('div');
            this.container.id = containerId;
            
            // If parent is specified, append to it
            if (options.parent) {
                const parent = typeof options.parent === 'string' 
                    ? document.getElementById(options.parent) 
                    : options.parent;
                
                if (parent) {
                    parent.appendChild(this.container);
                } else {
                    console.warn(`Parent for container '${containerId}' not found`);
                    // Append to body as fallback
                    document.body.appendChild(this.container);
                }
            } else if (options.appendToBody) {
                // Append to body if specified
                document.body.appendChild(this.container);
            } else {
                // Default: append to body anyway to avoid orphaned elements
                document.body.appendChild(this.container);
                console.log(`Container med ID '${containerId}' ble opprettet og lagt til i body`);
            }
            
            // Apply className if provided
            if (options.containerClass) {
                this.container.className = options.containerClass;
            }
            
            console.log(`Container med ID '${containerId}' ble opprettet automatisk`);
        } else if (!this.container) {
            // Only log error if container doesn't exist and autoCreate is not set
            console.warn(`Container med ID '${containerId}' ble ikke funnet, oppretter automatisk`);
            
            // Create it anyway to avoid errors
            this.container = document.createElement('div');
            this.container.id = containerId;
            document.body.appendChild(this.container);
        }
    }
    
    /**
     * Rendrer komponenten i containeren
     */
    render() {
        if (!this.container) return;
        
        // Basisklasse-implementasjon, skal overskrives i underklasser
        console.warn('render() metoden er ikke implementert for denne komponenten');
    }
    
    /**
     * Fjerner komponenten
     */
    remove() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
    
    /**
     * Oppdaterer komponenten med nye data
     * @param {Object} data - Nye data for komponenten
     */
    update(data) {
        // Basisklasse-implementasjon, skal overskrives i underklasser
        console.warn('update() metoden er ikke implementert for denne komponenten');
    }
    
    /**
     * Skaper et HTML-element med gitte egenskaper
     * @param {string} tag - HTML tag-navn
     * @param {Object} attributes - Attributter for elementet
     * @param {string|HTMLElement} content - Innhold (tekst eller annet element)
     * @returns {HTMLElement} Det opprettede elementet
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        // Sett attributter
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
                // Event listeners (onClick, onInput, etc.)
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else {
                element.setAttribute(key, value);
            }
        }
        
        // Sett innhold
        if (content) {
            if (typeof content === 'string') {
                element.textContent = content;
            } else if (content instanceof HTMLElement) {
                element.appendChild(content);
            }
        }
        
        return element;
    }
    
    /**
     * Legger til en event listener på et element
     * @param {HTMLElement|string} element - Elementet eller ID på elementet
     * @param {string} event - Navnet på eventet
     * @param {Function} callback - Callback-funksjonen
     */
    on(element, event, callback) {
        const el = typeof element === 'string' 
            ? document.getElementById(element) 
            : element;
            
        if (el) {
            el.addEventListener(event, callback);
        }
    }
}