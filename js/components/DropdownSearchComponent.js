// DropdownSearchComponent.js - En gjenbrukbar komponent for dropdown-søk
import { BaseComponent } from './BaseComponent.js';

export class DropdownSearchComponent extends BaseComponent {
    /**
     * Oppretter en ny dropdown-søkekomponent
     * @param {string} containerId - ID på container-elementet
     * @param {Object} options - Konfigurasjon for komponenten
     * @param {Array} options.items - Array med elementer for søk
     * @param {Function} options.onSelect - Callback når et element velges
     * @param {string} options.placeholder - Plassholder for søkefeltet
     * @param {number} options.maxResults - Maksimalt antall resultater å vise
     * @param {string} options.noResultsText - Tekst som vises når ingen resultater finnes
     */
    constructor(containerId, options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            items: [],
            onSelect: null,
            placeholder: 'Søk...',
            maxResults: 10,
            noResultsText: 'Ingen resultater funnet',
            className: '',
            id: null,
            valueField: 'id',
            displayField: 'name',
            additionalDisplayField: null,
            minSearchLength: 1,
            searchDelay: 300,
            clearOnSelect: true,
            matchFromStart: false,
            autoCreate: true, // Enable auto-creation of missing containers
            containerClass: 'dropdown-search-container', // Default class for auto-created containers
            parent: options.parent || document.querySelector('main') || document.body // Default parent
        };
        
        super(containerId, { ...defaultOptions, ...options });
        
        // Interne tilstander
        this.searchTimer = null;
        this.isDropdownOpen = false;
        this.selectedIndex = -1;
        this.results = [];
        this.currentValue = '';
        
        this.render();
    }
    
    /**
     * Rendrer dropdown-søkekomponenten
     */
    render() {
        if (!this.container) {
            if (this.options.autoCreate) {
                this.container = this.createElement('div', {
                    className: this.options.containerClass,
                    id: this.containerId
                });
                this.options.parent.appendChild(this.container);
            } else {
                return;
            }
        }
        
        // Tøm container
        this.container.innerHTML = '';
        
        // Opprett hovedcontainer
        this.searchContainer = this.createElement('div', {
            className: `dropdown-search ${this.options.className}`.trim(),
            id: this.options.id || `${this.containerId}-dropdown-search`
        });
        
        // Opprett søkefelt
        this.searchInput = this.createElement('input', {
            type: 'text',
            className: 'dropdown-search-input',
            placeholder: this.options.placeholder,
            onInput: (e) => this.handleInput(e),
            onFocus: () => this.handleFocus(),
            onBlur: (e) => this.handleBlur(e),
            onKeyDown: (e) => this.handleKeyDown(e)
        });
        
        // Opprett dropdown-resultat-container (skjult som standard)
        this.resultsContainer = this.createElement('div', {
            className: 'dropdown-results'
        });
        
        // Sett sammen komponenten
        this.searchContainer.appendChild(this.searchInput);
        this.searchContainer.appendChild(this.resultsContainer);
        this.container.appendChild(this.searchContainer);
        
        // Lagre referanser til elementer
        this.elements.searchContainer = this.searchContainer;
        this.elements.searchInput = this.searchInput;
        this.elements.resultsContainer = this.resultsContainer;
        
        // Legg til event listener for å fange klikk utenfor dropdown
        document.addEventListener('click', (e) => {
            if (!this.searchContainer.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        return this.searchContainer;
    }
    
    /**
     * Håndterer input i søkefeltet
     * @param {Event} event - Input-hendelsen
     */
    handleInput(event) {
        const value = event.target.value;
        this.currentValue = value;
        
        clearTimeout(this.searchTimer);
        
        if (value.length < this.options.minSearchLength) {
            this.closeDropdown();
            return;
        }
        
        // Søk med forsinkelse for å redusere antall søk under typing
        this.searchTimer = setTimeout(() => {
            this.performSearch(value);
        }, this.options.searchDelay);
    }
    
    /**
     * Utfører søk basert på søketekst
     * @param {string} searchText - Søketeksten
     */
    performSearch(searchText) {
        if (searchText.length < this.options.minSearchLength) return;
        
        const searchLower = searchText.toLowerCase();
        
        // Filtrer elementer basert på søketekst
        this.results = this.options.items.filter(item => {
            const displayValue = String(item[this.options.displayField] || '').toLowerCase();
            
            // Søkestrategi basert på konfigurasjonen
            if (this.options.matchFromStart) {
                return displayValue.startsWith(searchLower);
            } else {
                return displayValue.includes(searchLower);
            }
        }).slice(0, this.options.maxResults);
        
        this.renderResults();
        this.openDropdown();
    }
    
    /**
     * Rendrer søkeresultatene i dropdown-menyen
     */
    renderResults() {
        this.resultsContainer.innerHTML = '';
        
        if (this.results.length === 0) {
            const noResultsItem = this.createElement('div', {
                className: 'dropdown-no-results',
                textContent: this.options.noResultsText
            });
            this.resultsContainer.appendChild(noResultsItem);
            return;
        }
        
        // Opprett elementer for hvert resultat
        this.results.forEach((item, index) => {
            const resultItem = this.createElement('div', {
                className: 'dropdown-result-item',
                'data-index': index,
                onClick: () => this.selectItem(index)
            });
            
            // Hovedtekst for elementet
            const displayText = this.createElement('div', {
                className: 'dropdown-result-text',
                textContent: item[this.options.displayField] || ''
            });
            resultItem.appendChild(displayText);
            
            // Ekstra informasjon hvis konfigurert
            if (this.options.additionalDisplayField && item[this.options.additionalDisplayField]) {
                const additionalText = this.createElement('div', {
                    className: 'dropdown-result-subtext',
                    textContent: item[this.options.additionalDisplayField]
                });
                resultItem.appendChild(additionalText);
            }
            
            this.resultsContainer.appendChild(resultItem);
        });
        
        // Nullstill valgt element
        this.selectedIndex = -1;
    }
    
    /**
     * Velger et element fra dropdown-listen
     * @param {number} index - Indeks for det valgte elementet
     */
    selectItem(index) {
        if (index >= 0 && index < this.results.length) {
            const selectedItem = this.results[index];
            
            // Trigger onSelect callback
            if (typeof this.options.onSelect === 'function') {
                this.options.onSelect(selectedItem, index);
            }
            
            // Trigger custom event
            const event = new CustomEvent('itemselect', {
                detail: {
                    item: selectedItem,
                    index: index
                }
            });
            this.container.dispatchEvent(event);
            
            // Tøm søkefeltet hvis konfigurert
            if (this.options.clearOnSelect) {
                this.searchInput.value = '';
                this.currentValue = '';
            } else {
                // Eller vis displayField i søkefeltet
                this.searchInput.value = selectedItem[this.options.displayField] || '';
                this.currentValue = this.searchInput.value;
            }
            
            this.closeDropdown();
        }
    }
    
    /**
     * Håndterer fokus på søkefeltet
     */
    handleFocus() {
        // Utfør søk hvis det er søketekst
        if (this.currentValue.length >= this.options.minSearchLength) {
            this.performSearch(this.currentValue);
        }
    }
    
    /**
     * Håndterer tastetrykk i søkefeltet
     * @param {KeyboardEvent} event - Tastetrykkhendelsen
     */
    handleKeyDown(event) {
        if (!this.isDropdownOpen) return;
        
        switch (event.key) {
            case 'ArrowDown':
                // Gå til neste element
                event.preventDefault();
                this.navigateResults(1);
                break;
                
            case 'ArrowUp':
                // Gå til forrige element
                event.preventDefault();
                this.navigateResults(-1);
                break;
                
            case 'Enter':
                // Velg det markerte elementet
                event.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectItem(this.selectedIndex);
                }
                break;
                
            case 'Escape':
                // Lukk dropdown
                event.preventDefault();
                this.closeDropdown();
                break;
        }
    }
    
    /**
     * Navigerer gjennom resultatene med tastatur
     * @param {number} direction - Retning (1 for ned, -1 for opp)
     */
    navigateResults(direction) {
        const resultItems = this.resultsContainer.querySelectorAll('.dropdown-result-item');
        if (resultItems.length === 0) return;
        
        // Fjern tidligere markering
        if (this.selectedIndex >= 0 && this.selectedIndex < resultItems.length) {
            resultItems[this.selectedIndex].classList.remove('selected');
        }
        
        // Beregn ny indeks med wrap-around
        this.selectedIndex = (this.selectedIndex + direction) % resultItems.length;
        
        // Håndter negative indekser (når man går opp fra første element)
        if (this.selectedIndex < 0) {
            this.selectedIndex = resultItems.length - 1;
        }
        
        // Marker nytt element
        resultItems[this.selectedIndex].classList.add('selected');
        
        // Sørg for at elementet er synlig i dropdown
        resultItems[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
    
    /**
     * Håndterer tap av fokus fra søkefeltet
     * @param {FocusEvent} event - Fokushendelsen
     */
    handleBlur(event) {
        // Lukk dropdown med forsinkelse for å tillate klikk på resultatene
        setTimeout(() => {
            this.closeDropdown();
        }, 200);
    }
    
    /**
     * Åpner dropdown-menyen
     */
    openDropdown() {
        if (this.results.length === 0 && !this.options.noResultsText) {
            this.closeDropdown();
            return;
        }
        
        this.resultsContainer.style.display = 'block';
        this.isDropdownOpen = true;
        this.searchContainer.classList.add('open');
    }
    
    /**
     * Lukker dropdown-menyen
     */
    closeDropdown() {
        this.resultsContainer.style.display = 'none';
        this.isDropdownOpen = false;
        this.searchContainer.classList.remove('open');
    }
    
    /**
     * Setter elementlisten programmatisk
     * @param {Array} items - Nye elementer for dropdown-søk
     */
    setItems(items) {
        this.options.items = items;
        // Utfør nytt søk hvis dropdown er åpen
        if (this.isDropdownOpen && this.currentValue.length >= this.options.minSearchLength) {
            this.performSearch(this.currentValue);
        }
    }
    
    /**
     * Setter søkeverdien programmatisk
     * @param {string} value - Ny søkeverdi
     * @param {boolean} triggerSearch - Om søk skal utføres
     */
    setValue(value, triggerSearch = true) {
        this.searchInput.value = value;
        this.currentValue = value;
        
        if (triggerSearch && value.length >= this.options.minSearchLength) {
            this.performSearch(value);
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