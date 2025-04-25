// filepath: s:\Workspace\GitHub\warehousescanner\js\components\TableComponent.js
import { BaseComponent } from './BaseComponent.js';

/**
 * TableComponent - En gjenbrukbar tabellkomponent som bruker HTML-templates
 * @extends BaseComponent
 */
export class TableComponent extends BaseComponent {
    /**
     * Oppretter en ny tabellkomponent
     * @param {Object} options - Konfigurasjon for tabellen
     * @param {Array} options.headers - Kolonneoverskrifter [{id: 'kolonneId', text: 'Visningstekst', width: '100px'}, ...]
     * @param {Array} options.data - Tabelldata [{ col1: 'verdi1', col2: 'verdi2', ... }, ...]
     * @param {Function} options.onRowClick - Callback for klikk på rad
     * @param {string} options.id - ID for tabellen (valgfritt)
     * @param {string} options.className - Ekstra CSS-klasser for tabellen
     * @param {HTMLElement|string} options.container - Containerelement eller CSS-selector der tabellen skal legges til
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            headers: [],
            data: [],
            onRowClick: null,
            id: `table-${Date.now()}`,
            className: '',
            container: null,
            templateId: 'tableComponentTemplate',
            emptyMessage: 'Ingen data tilgjengelig',
            rowClassName: '',
            selectable: false,
            onSelectionChange: null
        };
        
        super({ ...defaultOptions, ...options });
        
        // Tracking selected rows
        this.selectedRows = new Set();
        
        // Initier tabellen
        this.init();
    }
    
    /**
     * Initialiser tabellen med template
     */
    init() {
        // Last template
        this.loadTemplate();
        
        // Konfigurer tabellen
        this.configureTable();
        
        // Legg til i container om spesifisert
        if (this.options.container) {
            this.appendToContainer();
        }
    }
    
    /**
     * Last template og opprett tabell-element
     */
    loadTemplate() {
        // Finn template
        const template = document.getElementById(this.options.templateId);
        if (!template) {
            console.error(`Template not found: ${this.options.templateId}`);
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        this.container = clone.querySelector('.list-container');
        this.table = clone.querySelector('table');
        this.thead = clone.querySelector('thead tr');
        this.tbody = clone.querySelector('tbody');
        
        // Lagre referanse til elementer
        this.element = this.container;
    }
    
    /**
     * Konfigurer tabellen basert på opsjoner
     */
    configureTable() {
        if (!this.table) return;
        
        // Sett ID
        if (this.options.id) {
            this.table.id = this.options.id;
        }
        
        // Sett klasser
        if (this.options.className) {
            this.table.className += ` ${this.options.className}`;
        }
        
        // Opprett kolonneoverskrifter
        this.renderHeaders();
        
        // Opprett tabellrader
        this.renderRows();
    }
    
    /**
     * Render kolonneoverskrifter
     */
    renderHeaders() {
        if (!this.thead) return;
        
        // Tøm eksisterende overskrifter
        this.thead.innerHTML = '';
        
        // Legg til checkbox-kolonne hvis tabellen er selectable
        if (this.options.selectable) {
            const checkboxHeader = document.createElement('th');
            checkboxHeader.className = 'selection-column';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
            
            checkboxHeader.appendChild(checkbox);
            this.thead.appendChild(checkboxHeader);
        }
        
        // Legg til hver kolonneoverskrift
        this.options.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text || header.id;
            
            if (header.width) {
                th.style.width = header.width;
            }
            
            if (header.align) {
                th.style.textAlign = header.align;
            }
            
            if (header.className) {
                th.className = header.className;
            }
            
            // Legg til sorteringsikon hvis sortable
            if (header.sortable) {
                th.classList.add('sortable');
                const sortIcon = document.createElement('i');
                sortIcon.className = 'fas fa-sort';
                th.appendChild(document.createTextNode(' '));
                th.appendChild(sortIcon);
                
                // Legg til sorteringsfunksjonalitet
                th.addEventListener('click', () => this.sortBy(header.id));
            }
            
            this.thead.appendChild(th);
        });
    }
    
    /**
     * Render tabellrader
     */
    renderRows() {
        if (!this.tbody) return;
        
        // Tøm eksisterende rader
        this.tbody.innerHTML = '';
        
        // Vis melding hvis ingen data
        if (!this.options.data || this.options.data.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = this.options.selectable 
                ? this.options.headers.length + 1 
                : this.options.headers.length;
            cell.textContent = this.options.emptyMessage;
            cell.classList.add('empty-table-message');
            row.appendChild(cell);
            this.tbody.appendChild(row);
            return;
        }
        
        // Legg til hver rad
        this.options.data.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Legg til rad-CSS-klasser
            if (this.options.rowClassName) {
                row.className = this.options.rowClassName;
            }
            
            // Legg til data-attributter
            row.dataset.index = index;
            
            // Legg til eventuelle rad-spesifikke klasser eller tilstander
            if (item._rowClass) {
                row.classList.add(item._rowClass);
            }
            
            if (item._selected) {
                row.classList.add('selected');
                this.selectedRows.add(index);
            }
            
            // Legg til klikk-handler
            if (typeof this.options.onRowClick === 'function') {
                row.addEventListener('click', (e) => {
                    // Ikke utløs klikk-hendelsen hvis det var checkboxen som ble klikket
                    if (e.target.type === 'checkbox') return;
                    this.options.onRowClick(item, index, e);
                });
                
                // Legg til klasse for å vise at raden er klikkbar
                row.classList.add('clickable-row');
            }
            
            // Legg til checkbox-celle hvis tabellen er selectable
            if (this.options.selectable) {
                const checkboxCell = document.createElement('td');
                checkboxCell.className = 'selection-column';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = item._selected || false;
                
                checkbox.addEventListener('change', (e) => {
                    this.toggleSelectRow(index, e.target.checked);
                });
                
                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell);
            }
            
            // Legg til hver celle
            this.options.headers.forEach(header => {
                const cell = document.createElement('td');
                const value = item[header.id];
                
                // Legg til celleinnhold
                if (header.renderer) {
                    // Bruk tilpasset renderer hvis angitt
                    cell.innerHTML = header.renderer(value, item, index);
                } else if (header.template) {
                    // Bruk template hvis angitt
                    let content = header.template;
                    Object.keys(item).forEach(key => {
                        content = content.replace(new RegExp(`{${key}}`, 'g'), item[key]);
                    });
                    cell.innerHTML = content;
                } else {
                    // Standard celleinnhold
                    cell.textContent = value !== undefined ? value : '';
                }
                
                // Sett celletilpasset CSS
                if (header.cellClass) {
                    cell.className = header.cellClass;
                }
                
                if (header.align) {
                    cell.style.textAlign = header.align;
                }
                
                row.appendChild(cell);
            });
            
            this.tbody.appendChild(row);
        });
    }
    
    /**
     * Sorter tabellen etter en kolonne
     * @param {string} columnId - ID for kolonnen
     */
    sortBy(columnId) {
        // Finn header-elementet
        const headerIndex = this.options.headers.findIndex(h => h.id === columnId);
        if (headerIndex === -1) return;
        
        const header = this.options.headers[headerIndex];
        const headerEl = this.thead.querySelectorAll('th')[
            this.options.selectable ? headerIndex + 1 : headerIndex
        ];
        
        // Snu sorteringsrekkefølgen hvis samme kolonne klikkes igjen
        if (this.currentSortColumn === columnId) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = columnId;
            this.currentSortDirection = 'asc';
        }
        
        // Oppdater sorteringsikonet
        const allIcons = this.thead.querySelectorAll('.fas');
        allIcons.forEach(icon => {
            icon.className = 'fas fa-sort';
        });
        
        const icon = headerEl.querySelector('.fas');
        if (icon) {
            icon.className = this.currentSortDirection === 'asc' 
                ? 'fas fa-sort-up' 
                : 'fas fa-sort-down';
        }
        
        // Utfør sortering
        const sortedData = [...this.options.data].sort((a, b) => {
            let valueA = a[columnId];
            let valueB = b[columnId];
            
            // Bruk sorteringsfunksjon hvis angitt
            if (header.sorter) {
                return header.sorter(a, b, this.currentSortDirection);
            }
            
            // Standard sortering
            if (valueA === valueB) return 0;
            
            // Håndter numeriske verdier
            if (!isNaN(valueA) && !isNaN(valueB)) {
                valueA = Number(valueA);
                valueB = Number(valueB);
            }
            
            // String sammenligning for ikke-numeriske verdier
            if (typeof valueA === 'string') valueA = valueA.toLowerCase();
            if (typeof valueB === 'string') valueB = valueB.toLowerCase();
            
            if (this.currentSortDirection === 'asc') {
                return valueA < valueB ? -1 : 1;
            } else {
                return valueA > valueB ? -1 : 1;
            }
        });
        
        // Oppdater data og render tabellen på nytt
        this.options.data = sortedData;
        this.renderRows();
    }
    
    /**
     * Legg tabellen til i en container
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
     * Oppdater tabelldata og render tabellen på nytt
     * @param {Array} data - Nye tabelldata
     */
    setData(data) {
        this.options.data = data || [];
        this.selectedRows.clear();
        this.renderRows();
        return this;
    }
    
    /**
     * Oppdater kolonneoverskrifter og render tabellen på nytt
     * @param {Array} headers - Nye kolonneoverskrifter
     */
    setHeaders(headers) {
        this.options.headers = headers || [];
        this.renderHeaders();
        this.renderRows();
        return this;
    }
    
    /**
     * Legg til en rad i tabellen
     * @param {Object} rowData - Raddata
     * @param {boolean} [render=true] - Om tabellen skal rendres på nytt
     */
    addRow(rowData, render = true) {
        this.options.data.push(rowData);
        if (render) this.renderRows();
        return this;
    }
    
    /**
     * Fjern en rad fra tabellen
     * @param {number} index - Indeks for raden som skal fjernes
     * @param {boolean} [render=true] - Om tabellen skal rendres på nytt
     */
    removeRow(index, render = true) {
        if (index >= 0 && index < this.options.data.length) {
            this.options.data.splice(index, 1);
            this.selectedRows.delete(index);
            
            // Oppdater indekser for valgte rader
            const newSelected = new Set();
            this.selectedRows.forEach(i => {
                if (i > index) newSelected.add(i - 1);
                else if (i < index) newSelected.add(i);
            });
            this.selectedRows = newSelected;
            
            if (render) this.renderRows();
        }
        return this;
    }
    
    /**
     * Oppdater en rad i tabellen
     * @param {number} index - Indeks for raden som skal oppdateres
     * @param {Object} rowData - Nye raddata
     * @param {boolean} [render=true] - Om tabellen skal rendres på nytt
     */
    updateRow(index, rowData, render = true) {
        if (index >= 0 && index < this.options.data.length) {
            // Behold _selected status
            if (this.options.data[index]._selected) {
                rowData._selected = true;
            }
            
            this.options.data[index] = rowData;
            if (render) this.renderRows();
        }
        return this;
    }
    
    /**
     * Merk eller avmerk alle rader
     * @param {boolean} selected - Om alle rader skal merkes eller avmerkes
     */
    toggleSelectAll(selected) {
        if (selected) {
            // Merk alle rader
            this.options.data.forEach((item, index) => {
                item._selected = true;
                this.selectedRows.add(index);
            });
        } else {
            // Avmerk alle rader
            this.options.data.forEach(item => {
                item._selected = false;
            });
            this.selectedRows.clear();
        }
        
        // Oppdater UI
        this.renderRows();
        
        // Utløs hendelse
        if (typeof this.options.onSelectionChange === 'function') {
            const selectedItems = this.getSelectedItems();
            this.options.onSelectionChange(selectedItems, selectedItems.length);
        }
        
        return this;
    }
    
    /**
     * Merk eller avmerk en rad
     * @param {number} index - Indeks for raden
     * @param {boolean} selected - Om raden skal merkes eller avmerkes
     */
    toggleSelectRow(index, selected) {
        if (index >= 0 && index < this.options.data.length) {
            this.options.data[index]._selected = selected;
            
            if (selected) {
                this.selectedRows.add(index);
            } else {
                this.selectedRows.delete(index);
            }
            
            // Oppdater UI
            const rows = this.tbody.querySelectorAll('tr');
            if (rows[index]) {
                if (selected) {
                    rows[index].classList.add('selected');
                } else {
                    rows[index].classList.remove('selected');
                }
                
                // Oppdater checkbox
                const checkbox = rows[index].querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = selected;
                }
            }
            
            // Oppdater "velg alle" checkbox
            if (this.thead) {
                const selectAllCheckbox = this.thead.querySelector('input[type="checkbox"]');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = this.selectedRows.size === this.options.data.length;
                    selectAllCheckbox.indeterminate = 
                        this.selectedRows.size > 0 && 
                        this.selectedRows.size < this.options.data.length;
                }
            }
            
            // Utløs hendelse
            if (typeof this.options.onSelectionChange === 'function') {
                const selectedItems = this.getSelectedItems();
                this.options.onSelectionChange(selectedItems, selectedItems.length);
            }
        }
        
        return this;
    }
    
    /**
     * Hent alle valgte elementer
     * @returns {Array} Array med valgte elementer
     */
    getSelectedItems() {
        return this.options.data.filter(item => item._selected);
    }
    
    /**
     * Hent indekser for alle valgte rader
     * @returns {Array} Array med indekser for valgte rader
     */
    getSelectedIndexes() {
        return Array.from(this.selectedRows);
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