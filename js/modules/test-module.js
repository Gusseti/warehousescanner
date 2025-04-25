/**
 * Test Module for SnapScan
 * This is a basic example module to demonstrate module structure with components
 */
class TestModule {
    constructor() {
        // Get or create module container
        this.container = document.getElementById('testModule');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'testModule';
            this.container.className = 'module-container';
            document.getElementById('moduleContainers').appendChild(this.container);
        }
        
        this.isActive = false;
        
        // Module's components
        this.components = {
            header: null,
            searchForm: null,
            resultsPanel: null,
            dataTable: null
        };
        
        // Initialize the module
        this.initialize();
    }
    
    initialize() {
        // Create container for components
        const contentContainer = document.createElement('div');
        contentContainer.className = 'container';
        this.container.appendChild(contentContainer);
        
        // Create and add module header component
        this.components.header = new ModuleHeaderComponent({
            title: 'Test Module',
            icon: 'flask',
            description: 'Dette er en testmodul for å demonstrere komponentbasert modulstruktur i SnapScan.'
        });
        contentContainer.appendChild(this.components.header.element);
        
        // Create module content container
        const moduleContent = document.createElement('div');
        moduleContent.className = 'module-content';
        contentContainer.appendChild(moduleContent);
        
        // Create and add search form component
        this.components.searchForm = new SearchFormComponent({
            id: 'testSearch',
            label: 'Skann eller skriv inn kode:',
            placeholder: 'Vare/lokasjonskode...',
            buttonText: 'Søk',
            buttonIcon: 'search',
            onSubmit: this.handleSearch.bind(this)
        });
        
        const searchCard = new CardComponent({
            title: 'Test Funksjonalitet',
            content: this.components.searchForm.element
        });
        moduleContent.appendChild(searchCard.element);
        
        // Create and add results panel component (initially hidden)
        this.components.resultsPanel = new ResultsPanelComponent({
            id: 'testResults',
            title: 'Resultater:'
        });
        this.components.searchForm.element.appendChild(this.components.resultsPanel.element);
        
        // Create and add data table component
        this.components.dataTable = new DataTableComponent({
            columns: ['Kode', 'Navn', 'Antall', 'Status', 'Handling'],
            data: [
                ['TEST-001', 'Testvare 1', '5', { type: 'badge', value: 'Klar', status: 'success' }, { type: 'button', value: 'Vis', action: this.handleItemView.bind(this, 'TEST-001') }],
                ['TEST-002', 'Testvare 2', '3', { type: 'badge', value: 'Venter', status: 'warning' }, { type: 'button', value: 'Vis', action: this.handleItemView.bind(this, 'TEST-002') }],
                ['TEST-003', 'Testvare 3', '0', { type: 'badge', value: 'Tomt', status: 'danger' }, { type: 'button', value: 'Vis', action: this.handleItemView.bind(this, 'TEST-003') }]
            ]
        });
        
        const tableCard = new CardComponent({
            title: 'Test Tabell',
            content: this.components.dataTable.element,
            className: 'mt-4'
        });
        moduleContent.appendChild(tableCard.element);
    }
    
    // Event handlers
    handleSearch(value) {
        console.log('Test search:', value);
        
        if (value) {
            // Show results with sample data
            this.components.resultsPanel.setContent([
                {
                    icon: 'box',
                    title: 'Eksempelvare',
                    details: [
                        'SKU: TEST-123',
                        'Lokasjon: A-01-02-03',
                        'Antall: 10 stk'
                    ]
                }
            ]);
            this.components.resultsPanel.show();
        } else {
            this.components.resultsPanel.hide();
        }
    }
    
    handleItemView(itemId) {
        console.log('View item:', itemId);
        alert(`Viser detaljer for: ${itemId}`);
    }
    
    // Public methods that can be called by the main app
    activate() {
        this.isActive = true;
        this.container.style.display = 'block';
        
        // Focus on the input when module is activated
        setTimeout(() => {
            this.components.searchForm.focus();
        }, 100);
        
        console.log('Test module activated');
    }
    
    deactivate() {
        this.isActive = false;
        this.container.style.display = 'none';
        console.log('Test module deactivated');
    }
}

// Component classes
class Component {
    constructor(options = {}) {
        this.options = options;
        this.element = null;
        this.createElements();
    }
    
    createElements() {
        // To be implemented by child classes
    }
}

class ModuleHeaderComponent extends Component {
    createElements() {
        this.element = document.createElement('div');
        this.element.className = 'module-header-section';
        
        const heading = document.createElement('h2');
        
        if (this.options.icon) {
            const icon = document.createElement('i');
            icon.className = `fas fa-${this.options.icon}`;
            heading.appendChild(icon);
            heading.appendChild(document.createTextNode(' '));
        }
        
        heading.appendChild(document.createTextNode(this.options.title || 'Module'));
        this.element.appendChild(heading);
        
        if (this.options.description) {
            const description = document.createElement('p');
            description.className = 'module-description';
            description.textContent = this.options.description;
            this.element.appendChild(description);
        }
    }
}

class CardComponent extends Component {
    createElements() {
        this.element = document.createElement('div');
        this.element.className = 'card' + (this.options.className ? ' ' + this.options.className : '');
        
        if (this.options.title) {
            const header = document.createElement('div');
            header.className = 'card-header';
            
            const title = document.createElement('h3');
            title.textContent = this.options.title;
            header.appendChild(title);
            
            this.element.appendChild(header);
        }
        
        const body = document.createElement('div');
        body.className = 'card-body';
        
        if (typeof this.options.content === 'string') {
            body.innerHTML = this.options.content;
        } else if (this.options.content instanceof HTMLElement) {
            body.appendChild(this.options.content);
        }
        
        this.element.appendChild(body);
    }
}

class SearchFormComponent extends Component {
    createElements() {
        this.element = document.createElement('div');
        this.element.className = 'form-section';
        
        if (this.options.description) {
            const description = document.createElement('p');
            description.textContent = this.options.description;
            this.element.appendChild(description);
        }
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        if (this.options.label) {
            const label = document.createElement('label');
            label.setAttribute('for', this.options.id || 'searchInput');
            label.textContent = this.options.label;
            formGroup.appendChild(label);
        }
        
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.id = this.options.id || 'searchInput';
        this.inputElement.className = 'form-control';
        this.inputElement.placeholder = this.options.placeholder || '';
        inputGroup.appendChild(this.inputElement);
        
        const button = document.createElement('button');
        button.className = 'btn btn-primary';
        
        if (this.options.buttonIcon) {
            const icon = document.createElement('i');
            icon.className = `fas fa-${this.options.buttonIcon}`;
            button.appendChild(icon);
            button.appendChild(document.createTextNode(' '));
        }
        
        button.appendChild(document.createTextNode(this.options.buttonText || 'Søk'));
        inputGroup.appendChild(button);
        
        formGroup.appendChild(inputGroup);
        this.element.appendChild(formGroup);
        
        // Set up event listeners
        button.addEventListener('click', () => {
            if (typeof this.options.onSubmit === 'function') {
                this.options.onSubmit(this.inputElement.value.trim());
            }
        });
        
        this.inputElement.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' && typeof this.options.onSubmit === 'function') {
                this.options.onSubmit(this.inputElement.value.trim());
            }
        });
    }
    
    focus() {
        if (this.inputElement) {
            this.inputElement.focus();
        }
    }
    
    getValue() {
        return this.inputElement ? this.inputElement.value.trim() : '';
    }
    
    setValue(value) {
        if (this.inputElement) {
            this.inputElement.value = value;
        }
    }
}

class ResultsPanelComponent extends Component {
    createElements() {
        this.element = document.createElement('div');
        this.element.className = 'results-area';
        this.element.id = this.options.id || 'resultsPanel';
        this.element.style.display = 'none';
        
        if (this.options.title) {
            const heading = document.createElement('h4');
            heading.textContent = this.options.title;
            this.element.appendChild(heading);
        }
        
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'results-content';
        this.element.appendChild(this.contentElement);
    }
    
    setContent(results) {
        this.contentElement.innerHTML = '';
        
        if (!results || !results.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'text-muted';
            emptyMessage.textContent = 'Ingen resultater funnet.';
            this.contentElement.appendChild(emptyMessage);
            return;
        }
        
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            if (result.icon) {
                const iconContainer = document.createElement('div');
                iconContainer.className = 'result-icon';
                
                const icon = document.createElement('i');
                icon.className = `fas fa-${result.icon}`;
                iconContainer.appendChild(icon);
                
                resultItem.appendChild(iconContainer);
            }
            
            const details = document.createElement('div');
            details.className = 'result-details';
            
            if (result.title) {
                const title = document.createElement('h5');
                title.className = 'result-title';
                title.textContent = result.title;
                details.appendChild(title);
            }
            
            if (result.details && result.details.length) {
                result.details.forEach(detail => {
                    const detailPara = document.createElement('p');
                    detailPara.textContent = detail;
                    details.appendChild(detailPara);
                });
            }
            
            resultItem.appendChild(details);
            this.contentElement.appendChild(resultItem);
        });
    }
    
    show() {
        this.element.style.display = 'block';
        this.element.style.opacity = '0';
        setTimeout(() => {
            this.element.style.transition = 'opacity 0.3s ease';
            this.element.style.opacity = '1';
        }, 10);
    }
    
    hide() {
        this.element.style.display = 'none';
    }
}

class DataTableComponent extends Component {
    createElements() {
        this.element = document.createElement('table');
        this.element.className = 'data-table';
        
        // Create header
        if (this.options.columns && this.options.columns.length) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            this.options.columns.forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                headerRow.appendChild(th);
            });
            
            thead.appendChild(headerRow);
            this.element.appendChild(thead);
        }
        
        // Create body
        const tbody = document.createElement('tbody');
        
        if (this.options.data && this.options.data.length) {
            this.options.data.forEach(rowData => {
                const row = document.createElement('tr');
                
                rowData.forEach(cellData => {
                    const cell = document.createElement('td');
                    
                    if (typeof cellData === 'object') {
                        // Handle special cell types
                        if (cellData.type === 'badge') {
                            const badge = document.createElement('span');
                            badge.className = `badge badge-${cellData.status || 'primary'}`;
                            badge.textContent = cellData.value;
                            cell.appendChild(badge);
                        } else if (cellData.type === 'button') {
                            const button = document.createElement('button');
                            button.className = 'btn btn-sm btn-outline';
                            button.textContent = cellData.value;
                            
                            if (typeof cellData.action === 'function') {
                                button.addEventListener('click', cellData.action);
                            }
                            
                            cell.appendChild(button);
                        }
                    } else {
                        cell.textContent = cellData;
                    }
                    
                    row.appendChild(cell);
                });
                
                tbody.appendChild(row);
            });
        }
        
        this.element.appendChild(tbody);
    }
    
    updateData(newData) {
        const tbody = this.element.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (newData && newData.length) {
            newData.forEach(rowData => {
                const row = document.createElement('tr');
                
                rowData.forEach(cellData => {
                    const cell = document.createElement('td');
                    
                    if (typeof cellData === 'object') {
                        // Handle special cell types
                        if (cellData.type === 'badge') {
                            const badge = document.createElement('span');
                            badge.className = `badge badge-${cellData.status || 'primary'}`;
                            badge.textContent = cellData.value;
                            cell.appendChild(badge);
                        } else if (cellData.type === 'button') {
                            const button = document.createElement('button');
                            button.className = 'btn btn-sm btn-outline';
                            button.textContent = cellData.value;
                            
                            if (typeof cellData.action === 'function') {
                                button.addEventListener('click', cellData.action);
                            }
                            
                            cell.appendChild(button);
                        }
                    } else {
                        cell.textContent = cellData;
                    }
                    
                    row.appendChild(cell);
                });
                
                tbody.appendChild(row);
            });
        }
    }
}

// Add the Test module to the app namespace when the script loads
(function() {
    if (!window.app) {
        window.app = {};
    }
    
    window.app.testModule = new TestModule();
    
    // Register this module with the app's module system if it exists
    if (typeof window.app.registerModule === 'function') {
        window.app.registerModule('test', window.app.testModule);
    }
})();