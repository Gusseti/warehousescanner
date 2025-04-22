// dropdown-search.js - Funksjonalitet for søkbar dropdown for varenumre
import { appState } from '../app.js';

/**
 * Initialiserer dropdown-søk for alle relevante input-felt
 */
export function initDropdownSearch() {
    console.log('Initialiserer dropdown-søk...');
    
    // Finn alle inputfeltene for varenumre
    const inputFields = [
        { id: 'pickManualScan', module: 'picking' },
        { id: 'receiveManualScan', module: 'receiving' },
        { id: 'returnManualScan', module: 'returns' }
    ];
    
    inputFields.forEach(field => {
        const inputElement = document.getElementById(field.id);
        if (inputElement) {
            console.log(`Setter opp dropdown for ${field.id}`);
            setupDropdownForInput(inputElement, field.module);
        } else {
            console.warn(`Input-element ${field.id} ble ikke funnet`);
        }
    });
    
    // Legg til global lytter for å lukke alle dropdowns når man klikker utenfor
    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.search-dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && 
                !e.target.classList.contains('search-input')) {
                dropdown.style.display = 'none';
            }
        });
    });
    
    console.log('Dropdown-søk initialisert');
}

/**
 * Setter opp dropdown for et spesifikt inputfelt
 * @param {HTMLElement} inputElement - Input-elementet
 * @param {string} module - Modulnavn (picking, receiving, returns)
 */
function setupDropdownForInput(inputElement, module) {
    // Lag dropdown-container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'search-dropdown';
    dropdownContainer.style.display = 'none';
    
    // Legg til i DOM rett etter inputfeltet
    inputElement.parentNode.style.position = 'relative';
    inputElement.parentNode.appendChild(dropdownContainer);
    
    // Legg til klasse på inputfeltet for styling
    inputElement.classList.add('search-input');
    
    // Legg til fokus-event for å vise dropdown
    inputElement.addEventListener('focus', function() {
        // Oppdater dropdown-innhold basert på gjeldende lister
        updateDropdownContent(dropdownContainer, inputElement.value, module);
        dropdownContainer.style.display = 'block';
    });
    
    // Legg til input-event for å filtrere dropdown
    inputElement.addEventListener('input', function() {
        updateDropdownContent(dropdownContainer, inputElement.value, module);
        dropdownContainer.style.display = 'block';
    });
    
    // Legg til keydown-event for å navigere i dropdown med piltaster
    inputElement.addEventListener('keydown', function(e) {
        const items = dropdownContainer.querySelectorAll('.dropdown-item');
        if (!items.length) return;
        
        let activeIndex = -1;
        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('active')) {
                activeIndex = i;
                break;
            }
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex < items.length - 1) ? activeIndex + 1 : 0;
            setActiveItem(items, activeIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex > 0) ? activeIndex - 1 : items.length - 1;
            setActiveItem(items, activeIndex);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            items[activeIndex].click();
        } else if (e.key === 'Escape') {
            dropdownContainer.style.display = 'none';
        }
    });
}

/**
 * Setter aktivt element i dropdown
 * @param {NodeList} items - Liste med dropdown-elementer
 * @param {number} index - Indeks til aktivt element
 */
function setActiveItem(items, index) {
    items.forEach(item => item.classList.remove('active'));
    if (index >= 0 && index < items.length) {
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

/**
 * Oppdaterer innholdet i dropdown basert på søk
 * @param {HTMLElement} dropdownContainer - Dropdown-container
 * @param {string} searchText - Søketekst
 * @param {string} module - Modulnavn
 */
function updateDropdownContent(dropdownContainer, searchText, module) {
    // Hent alle relevante varer basert på modul
    let items = [];
    const search = searchText.toLowerCase();
    
    // 1. Kombiner varer fra alle lister for å vise alle tilgjengelige varer
    const allItems = [
        ...getValidItems(appState.pickListItems || []),
        ...getValidItems(appState.receiveListItems || []),
        ...getValidItems(appState.returnListItems || [])
    ];
    
    // 2. Legg til varer fra strekkode-mappingen
    if (appState.barcodeMapping) {
        for (const [barcode, itemId] of Object.entries(appState.barcodeMapping)) {
            // Sjekk om varen allerede finnes i allItems
            const existingItem = allItems.find(item => item.id === itemId);
            
            if (existingItem) {
                // Legg til strekkoden i eksisterende vare for søkbarhet
                if (!existingItem.barcodes) {
                    existingItem.barcodes = [];
                }
                existingItem.barcodes.push(barcode);
            } else {
                // Opprett en ny vare basert på strekkode-informasjon
                allItems.push({
                    id: itemId,
                    description: `Strekkode: ${barcode}`,
                    barcodes: [barcode]
                });
            }
        }
    }
    
    // Fjern duplikater basert på varenummer
    const uniqueItems = [];
    const itemIds = new Set();
    
    allItems.forEach(item => {
        if (item && item.id && !itemIds.has(item.id)) {
            itemIds.add(item.id);
            uniqueItems.push(item);
        }
    });
    
    // Filtrer basert på søketekst
    if (search) {
        items = uniqueItems.filter(item => 
            item.id.toLowerCase().includes(search) || 
            (item.description && item.description.toLowerCase().includes(search)) || 
            // Søk også i strekkoder
            (item.barcodes && item.barcodes.some(barcode => 
                barcode.toLowerCase().includes(search)
            ))
        );
    } else {
        items = uniqueItems;
    }
    
    // Sorter etter relevans - varer som starter med søketeksten kommer først
    if (search) {
        items.sort((a, b) => {
            const aStartsWithId = a.id.toLowerCase().startsWith(search) ? -1 : 0;
            const bStartsWithId = b.id.toLowerCase().startsWith(search) ? -1 : 0;
            return aStartsWithId - bStartsWithId;
        });
    }
    
    // Begrens til maks 15 resultater for bedre ytelse
    items = items.slice(0, 15);
    
    // Bygg HTML for dropdown
    dropdownContainer.innerHTML = '';
    
    if (items.length === 0) {
        dropdownContainer.innerHTML = '<div class="dropdown-no-results">Ingen varer funnet</div>';
        return;
    }
    
    items.forEach(item => {
        const dropdownItem = document.createElement('div');
        dropdownItem.className = 'dropdown-item';
        
        // Bruk matchende fargeformatering
        const isInPickList = appState.pickListItems?.some(i => i.id === item.id);
        const isInReceiveList = appState.receiveListItems?.some(i => i.id === item.id);
        const isInReturnList = appState.returnListItems?.some(i => i.id === item.id);
        
        if ((module === 'picking' && isInPickList) || 
            (module === 'receiving' && isInReceiveList) || 
            (module === 'returns' && isInReturnList)) {
            dropdownItem.classList.add('in-current-list');
        }
        
        // Vis strekkoder hvis tilgjengelig
        let barcodesHtml = '';
        if (item.barcodes && item.barcodes.length > 0) {
            const displayBarcodes = item.barcodes.slice(0, 2); // Vis maks 2 strekkoder
            barcodesHtml = `<div class="item-barcodes">${displayBarcodes.join(', ')}</div>`;
        }
        
        // Formater varenummer og beskrivelse
        dropdownItem.innerHTML = `
            <div class="item-info">
                <div class="item-id">${item.id}</div>
                <div class="item-description">${item.description || 'Ingen beskrivelse'}</div>
            </div>
            ${barcodesHtml}
        `;
        
        // Legg til klikkevents
        dropdownItem.addEventListener('click', function() {
            // Sett varenummeret i inputfeltet
            const inputElement = dropdownContainer.parentNode.querySelector('.search-input');
            inputElement.value = item.id;
            dropdownContainer.style.display = 'none';
            
            // Utløs et input-event for å oppdatere andre lyttere
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Fokuser på inputfeltet igjen
            inputElement.focus();
        });
        
        dropdownContainer.appendChild(dropdownItem);
    });
}

/**
 * Filtrerer bort ugyldige elementer fra en array
 * @param {Array} items - Array med varer
 * @returns {Array} Filtrert array
 */
function getValidItems(items) {
    return items.filter(item => item && typeof item === 'object' && item.id);
}

// Ingen eksport her siden vi allerede har eksportert initDropdownSearch øverst i filen