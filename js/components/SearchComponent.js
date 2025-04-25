// SearchComponent.js - En gjenbrukbar søke-komponent
import { BaseComponent } from './BaseComponent.js';

export class SearchComponent extends BaseComponent {
    /**
     * Oppretter en ny søke-komponent
     * @param {string} containerId - ID på container-elementet der søkefeltet skal rendres
     * @param {Object} options - Konfigurasjon for søkefeltet
     * @param {Function} options.onSearch - Callback som kalles når søkeordet endres
     * @param {number} options.debounceMs - Tid i ms før søk utføres etter tastetrykk
     * @param {string} options.placeholder - Plassholder-tekst for søkefeltet
     * @param {boolean} options.clearButton - Om søkefeltet skal ha en tøm-knapp
     */
    constructor(containerId, options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            onSearch: null,
            debounceMs: 300,
            placeholder: 'Søk...',
            clearButton: true,
            className: '',
            id: null,
            initialValue: '',
            searchFields: [] // Felter som skal søkes i
        };
        
        super(containerId, { ...defaultOptions, ...options });
        
        this.debounceTimer = null;
        this.currentValue = this.options.initialValue;
        
        this.render();
    }
    
    /**
     * Rendrer søkekomponenten i container-elementet
     */
    render() {
        if (!this.container) return;
        
        // Tøm container
        this.container.innerHTML = '';
        
        // Opprett søkeboks-container
        this.searchContainer = this.createElement('div', {
            className: `search-container ${this.options.className}`.trim()
        });
        
        // Opprett søkefelt
        this.searchInput = this.createElement('input', {
            type: 'text',
            className: 'search-input',
            placeholder: this.options.placeholder,
            value: this.currentValue,
            id: this.options.id || `${this.containerId}-search`,
            onInput: (e) => this.handleInput(e)
        });
        
        // Opprett søkeikon
        this.searchIcon = this.createElement('span', {
            className: 'search-icon'
        });
        this.searchIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
        `;
        
        // Legg til tøm-knapp hvis konfigurert
        if (this.options.clearButton) {
            this.clearButton = this.createElement('button', {
                className: 'search-clear-button' + (this.currentValue ? ' visible' : ''),
                type: 'button',
                onClick: () => this.clearSearch()
            });
            this.clearButton.innerHTML = '&times;';
        }
        
        // Sett sammen komponenten
        this.searchContainer.appendChild(this.searchIcon);
        this.searchContainer.appendChild(this.searchInput);
        if (this.clearButton) {
            this.searchContainer.appendChild(this.clearButton);
        }
        
        this.container.appendChild(this.searchContainer);
        
        // Lagre referanser til elementer
        this.elements.searchContainer = this.searchContainer;
        this.elements.searchInput = this.searchInput;
        this.elements.searchIcon = this.searchIcon;
        if (this.clearButton) {
            this.elements.clearButton = this.clearButton;
        }
        
        return this.searchContainer;
    }
    
    /**
     * Håndterer input i søkefeltet
     * @param {Event} event - Input-hendelsen
     */
    handleInput(event) {
        const value = event.target.value;
        this.currentValue = value;
        
        // Vis/skjul tøm-knappen
        if (this.clearButton) {
            if (value) {
                this.clearButton.classList.add('visible');
            } else {
                this.clearButton.classList.remove('visible');
            }
        }
        
        // Bruk debouncing for å redusere antall søk
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.triggerSearch(value);
        }, this.options.debounceMs);
    }
    
    /**
     * Utløser søkefunksjonen
     * @param {string} searchTerm - Søkeordet
     */
    triggerSearch(searchTerm) {
        if (typeof this.options.onSearch === 'function') {
            this.options.onSearch(searchTerm, this.options.searchFields);
        }
        
        // Trigger custom event for søk
        const event = new CustomEvent('search', {
            detail: {
                value: searchTerm,
                fields: this.options.searchFields
            }
        });
        this.container.dispatchEvent(event);
    }
    
    /**
     * Tømmer søkefeltet
     */
    clearSearch() {
        this.searchInput.value = '';
        this.currentValue = '';
        
        if (this.clearButton) {
            this.clearButton.classList.remove('visible');
        }
        
        // Utløs søk med tom verdi
        this.triggerSearch('');
        
        // Sett fokus tilbake til søkefeltet
        this.searchInput.focus();
    }
    
    /**
     * Setter søkeverdien programmatisk
     * @param {string} value - Ny søkeverdi
     * @param {boolean} triggerEvent - Om søkehendelsen skal utløses
     */
    setValue(value, triggerEvent = true) {
        this.searchInput.value = value;
        this.currentValue = value;
        
        // Vis/skjul tøm-knappen
        if (this.clearButton) {
            if (value) {
                this.clearButton.classList.add('visible');
            } else {
                this.clearButton.classList.remove('visible');
            }
        }
        
        if (triggerEvent) {
            this.triggerSearch(value);
        }
    }
    
    /**
     * Returnerer gjeldende søkeverdi
     * @returns {string} Gjeldende søkeverdi
     */
    getValue() {
        return this.currentValue;
    }
    
    /**
     * Setter fokus på søkefeltet
     */
    focus() {
        if (this.searchInput) {
            this.searchInput.focus();
        }
    }
}