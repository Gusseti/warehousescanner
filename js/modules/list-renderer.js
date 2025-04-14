// list-renderer.js - Modul for å vise lister enhetlig på tvers av applikasjonen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { openWeightModal } from './weights.js';
import { calculateTotalWeight } from './weights.js';

/**
 * Renderer-klasse for å håndtere visning av lister
 */
export class ListRenderer {
    /**
     * Konstruerer en ny list-renderer instans
     * @param {Object} options - Konfigurasjonsvalg
     */
    constructor(options = {}) {
        this.options = {
            tableId: null,            // ID for tabell-elementet
            statusBarId: null,        // ID for statusbar-elementet
            remainingBarId: null,     // ID for remaining-bar-elementet
            statusTextId: null,       // ID for status-tekst-elementet
            totalWeightId: null,      // ID for total-vekt-elementet
            context: null,            // Kontekst ('pick', 'receive', 'return')
            itemList: [],             // Referanse til listen som skal vises
            trackingList: [],         // Referanse til listen over fullførte varer
            countProperty: null,      // Property-navn for tellefeltet
            completedProperty: null,  // Property-navn for fullført-feltet
            onItemClick: null,        // Callback ved klikk på vare
            onItemDblClick: null,     // Callback ved dobbeltklikk på vare
            actionButton: null,       // Config for ekstra handlingsknapp
            ...options
        };
        
        // Finn DOM-elementer
        this.tableElement = document.getElementById(this.options.tableId);
        this.statusBarElement = document.getElementById(this.options.statusBarId);
        this.remainingBarElement = document.getElementById(this.options.remainingBarId);
        this.statusTextElement = document.getElementById(this.options.statusTextId);
        this.totalWeightElement = document.getElementById(this.options.totalWeightId);
        
        // Valider at nødvendige elementer er funnet
        if (!this.tableElement) {
            console.error(`Fant ikke tabell-element med ID ${this.options.tableId}`);
        }
    }
    
    /**
     * Rendrer listen til DOM
     */
    render() {
        if (!this.tableElement) return;
        
        // Få referanse til listen basert på kontekst
        const list = this.getListForContext();
        if (!list) return;
        
        // Tøm tabellen
        const tbody = this.tableElement.querySelector('tbody');
        if (!tbody) {
            console.error('Tbody ikke funnet i tabellen');
            return;
        }
        
        tbody.innerHTML = '';
        
        // Variabler for totalberegninger
        let totalItems = 0;
        let processedItems = 0;
        let totalWeight = 0;
        let processedWeight = 0;
        
        // Prosesser hver vare
        list.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            // Beregn status basert på kontekst
            const { isCompleted, currentCount } = this.getItemStatus(item);
            
            // Sett CSS-klasse basert på status
            if (isCompleted) {
                tr.classList.add(this.getCompletedClassName());
            } else if (currentCount > 0) {
                tr.classList.add('partially-scanned');
            }
            
            // Beregn vekter
            const itemTotalWeight = (item.weight || 0) * item.quantity;
            const scannedWeight = (item.weight || 0) * currentCount;
            
            // Legg til i totaler
            totalItems += item.quantity;
            processedItems += currentCount;
            totalWeight += itemTotalWeight;
            processedWeight += scannedWeight;
            
            // Generer HTML for denne raden
            tr.innerHTML = this.generateRowHtml(item, index);
            
            // Legg til event listeners
            if (this.options.onItemClick) {
                tr.addEventListener('click', () => this.options.onItemClick(item, index));
            }
            
            // Default: Dobbeltklikk åpner vektmodal
            tr.addEventListener('dblclick', () => {
                if (this.options.onItemDblClick) {
                    this.options.onItemDblClick(item, index);
                } else {
                    openWeightModal(item.id);
                }
            });
            
            // Legg til event listeners for handlingsknapper
            tr.querySelectorAll('.action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Hindre at klikket når raden
                    const action = btn.getAttribute('data-action');
                    const itemIndex = parseInt(btn.getAttribute('data-index'));
                    
                    this.handleActionClick(action, itemIndex);
                });
            });
            
            tbody.appendChild(tr);
        });
        
        // Oppdater statuslinje
        this.updateStatusBar(processedItems, totalItems);
        
        // Oppdater totalvekt
        this.updateTotalWeight(processedWeight);
    }
    
    /**
     * Genererer HTML for en tabellrad
     * @param {Object} item - Varepost
     * @param {number} index - Indeks i listen
     * @returns {string} HTML for raden
     */
    generateRowHtml(item, index) {
        const { isCompleted, currentCount } = this.getItemStatus(item);
        const statusHtml = this.generateStatusHtml(item, isCompleted, currentCount);
        
        // Base HTML med varenummer, beskrivelse og vekt
        let html = `
            <td>${item.id}</td>
            <td>${item.description || 'Ukjent vare'}</td>
            <td>${currentCount} / ${item.quantity}</td>
            <td>${((item.weight || 0) * item.quantity).toFixed(2)} ${appState.settings.weightUnit}</td>
        `;
        
        // Legg til statuskolonne
        if (this.options.context === 'return') {
            // For retur viser vi handlingsknapper i stedet for status
            html += `
                <td>
                    <button class="btn btn-danger btn-sm action-btn" data-action="remove" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        } else {
            html += `<td>${statusHtml}</td>`;
        }
        
        return html;
    }
    
    /**
     * Genererer HTML for status-kolonnen
     * @param {Object} item - Varepost
     * @param {boolean} isCompleted - Om varen er fullført
     * @param {number} currentCount - Nåværende antall skannet
     * @returns {string} HTML for statusfeltet
     */
    generateStatusHtml(item, isCompleted, currentCount) {
        if (isCompleted) {
            return `<span class="badge badge-success">Fullført</span>`;
        } else if (currentCount > 0) {
            return `<span class="badge" style="background-color: var(--warning)">Delvis (${currentCount}/${item.quantity})</span>`;
        } else {
            return `<span class="badge" style="background-color: var(--gray)">Venter</span>`;
        }
    }
    
    /**
     * Oppdaterer statuslinjen
     * @param {number} processed - Antall prosesserte varer
     * @param {number} total - Totalt antall varer
     */
    updateStatusBar(processed, total) {
        if (!this.statusBarElement || !this.remainingBarElement || !this.statusTextElement) {
            return;
        }
        
        // Beregn prosentandel
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        // Oppdater statuslinjene
        this.statusBarElement.style.width = `${percentage}%`;
        this.remainingBarElement.style.width = `${100 - percentage}%`;
        
        // Oppdater statustekst
        const contextName = this.getContextActionName();
        this.statusTextElement.textContent = `${processed} av ${total} varer ${contextName} (${percentage}%)`;
    }
    
    /**
     * Oppdaterer totalvekt-visningen
     * @param {number} weight - Total vekt
     */
    updateTotalWeight(weight) {
        if (this.totalWeightElement) {
            this.totalWeightElement.textContent = `${weight.toFixed(2)} ${appState.settings.weightUnit}`;
        }
    }
    
    /**
     * Håndterer klikk på handlingsknapper
     * @param {string} action - Handlingen som skal utføres
     * @param {number} index - Indeks til varen i listen
     */
    handleActionClick(action, index) {
        const list = this.getListForContext();
        if (!list || index < 0 || index >= list.length) return;
        
        const item = list[index];
        
        switch (action) {
            case 'remove':
                if (confirm(`Er du sikker på at du vil fjerne vare "${item.id}" fra listen?`)) {
                    list.splice(index, 1);
                    showToast(`Vare "${item.id}" fjernet!`, 'warning');
                    this.render(); // Oppdater visningen
                }
                break;
            
            // Legg til flere handlinger her etter behov
            
            default:
                // Hvis vi har en tilpasset handlingsfunksjon, kall den
                if (this.options.actionButton && this.options.actionButton.onAction) {
                    this.options.actionButton.onAction(action, item, index);
                    this.render(); // Oppdater visningen
                }
        }
    }
    
    /**
     * Returnerer CSS-klasse for fullførte varer
     * @returns {string} CSS-klassenavn
     */
    getCompletedClassName() {
        switch (this.options.context) {
            case 'pick': return 'picked';
            case 'receive': return 'received';
            case 'return': return 'returned';
            default: return 'completed';
        }
    }
    
    /**
     * Returnerer liste basert på kontekst
     * @returns {Array} Referanse til lista som skal vises
     */
    getListForContext() {
        // Hvis en spesifikk liste er angitt, bruk den
        if (Array.isArray(this.options.itemList)) {
            return this.options.itemList;
        }
        
        // Ellers, bruk kontekst for å finne listen
        switch (this.options.context) {
            case 'pick': return appState.pickListItems;
            case 'receive': return appState.receiveListItems;
            case 'return': return appState.returnListItems;
            default: return [];
        }
    }
    
    /**
     * Returnerer status for en vare
     * @param {Object} item - Varepost
     * @returns {Object} Status-objekt med isCompleted og currentCount
     */
    getItemStatus(item) {
        switch (this.options.context) {
            case 'pick':
                return {
                    isCompleted: item.picked === true,
                    currentCount: item.pickedCount || 0
                };
            
            case 'receive':
                return {
                    isCompleted: item.received === true,
                    currentCount: item.receivedCount || 0
                };
            
            case 'return':
                // For retur er alt alltid fullført
                return {
                    isCompleted: true,
                    currentCount: item.quantity || 0
                };
            
            default:
                // Bruk egendefinerte properties hvis de er angitt
                if (this.options.completedProperty && this.options.countProperty) {
                    return {
                        isCompleted: item[this.options.completedProperty] === true,
                        currentCount: item[this.options.countProperty] || 0
                    };
                }
                
                return { isCompleted: false, currentCount: 0 };
        }
    }
    
    /**
     * Returnerer handlingsnavn for konteksten
     * @returns {string} Handlingsnavn
     */
    getContextActionName() {
        switch (this.options.context) {
            case 'pick': return 'plukket';
            case 'receive': return 'mottatt';
            case 'return': return 'returnert';
            default: return 'behandlet';
        }
    }
}

/**
 * Factory-funksjon for å lage en list-renderer for plukk
 * @param {string} tableId - ID til tabellen
 * @param {Function} onItemClick - Callback ved klikk på vare
 * @returns {ListRenderer} Ny list-renderer instans
 */
export function createPickingRenderer(tableId, onItemClick = null) {
    return new ListRenderer({
        tableId: tableId,
        statusBarId: 'pickStatusPicked',
        remainingBarId: 'pickStatusRemaining',
        statusTextId: 'pickStatusText',
        totalWeightId: 'totalWeight',
        context: 'pick',
        itemList: appState.pickListItems,
        trackingList: appState.pickedItems,
        countProperty: 'pickedCount',
        completedProperty: 'picked',
        onItemClick: onItemClick
    });
}

/**
 * Factory-funksjon for å lage en list-renderer for mottak
 * @param {string} tableId - ID til tabellen
 * @param {Function} onItemClick - Callback ved klikk på vare
 * @returns {ListRenderer} Ny list-renderer instans
 */
export function createReceivingRenderer(tableId, onItemClick = null) {
    return new ListRenderer({
        tableId: tableId,
        statusBarId: 'receiveStatusReceived',
        remainingBarId: 'receiveStatusRemaining',
        statusTextId: 'receiveStatusText',
        totalWeightId: 'totalReceiveWeight',
        context: 'receive',
        itemList: appState.receiveListItems,
        trackingList: appState.receivedItems,
        countProperty: 'receivedCount',
        completedProperty: 'received',
        onItemClick: onItemClick
    });
}

/**
 * Factory-funksjon for å lage en list-renderer for retur
 * @param {string} tableId - ID til tabellen
 * @param {Function} onItemClick - Callback ved klikk på vare
 * @returns {ListRenderer} Ny list-renderer instans
 */
export function createReturnsRenderer(tableId, onItemClick = null) {
    return new ListRenderer({
        tableId: tableId,
        statusBarId: null, // Retur har ikke statusbar
        remainingBarId: null,
        statusTextId: null,
        totalWeightId: 'totalReturnWeight',
        context: 'return',
        itemList: appState.returnListItems,
        onItemClick: onItemClick,
        // For retur legger vi til tilpasset fjern-handling
        actionButton: {
            label: 'Fjern',
            icon: 'fa-trash',
            onAction: (action, item, index) => {
                if (action === 'remove') {
                    appState.returnListItems.splice(index, 1);
                }
            }
        }
    });
}