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
 * Setter opp dropdown for et inputfelt
 * @param {HTMLElement} inputElement - Input-elementet
 * @param {string} module - Modulnavnet (picking, receiving, returns)
 */
function setupDropdownForInput(inputElement, module) {
    // Opprett container for dropdown
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'dropdown-container';
    inputElement.parentNode.insertBefore(dropdownContainer, inputElement.nextSibling);
    
    // Opprett dropdown-listen
    const dropdownList = document.createElement('ul');
    dropdownList.className = 'dropdown-list';
    dropdownList.style.display = 'none';
    dropdownContainer.appendChild(dropdownList);
    
    // Legg til input event for å vise matchende varer
    inputElement.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length < 2) {
            dropdownList.style.display = 'none';
            return;
        }
        
        // Finn matchende varer basert på modulen
        let items = [];
        if (module === 'picking') {
            items = appState.pickListItems;
        } else if (module === 'receiving') {
            items = appState.receiveListItems;
        } else if (module === 'returns') {
            // For retur, bruk mappingen av strekkoder
            items = Object.keys(appState.barcodeMapping).map(code => {
                return {
                    code: code,
                    description: appState.barcodeMapping[code]
                };
            });
        }
        
        // Filter items basert på søkeord
        const matches = items.filter(item => 
            (item.code && item.code.toLowerCase().includes(searchTerm)) || 
            (item.description && item.description.toLowerCase().includes(searchTerm))
        );
        
        // Oppdater dropdown-liste
        dropdownList.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.code} - ${item.description || 'Ukjent'}`;
                li.addEventListener('click', function() {
                    inputElement.value = item.code;
                    dropdownList.style.display = 'none';
                    
                    // Utløs registreringshendelse basert på modul
                    const scanButton = module === 'picking' ? 
                        document.getElementById('pickManualScanBtn') :
                        module === 'receiving' ? 
                            document.getElementById('receiveManualScanBtn') : 
                            document.getElementById('returnManualScanBtn');
                            
                    if (scanButton) {
                        scanButton.click();
                    }
                });
                dropdownList.appendChild(li);
            });
            dropdownList.style.display = 'block';
        } else {
            dropdownList.style.display = 'none';
        }
    });
    
    // Skjul dropdown når inputfeltet mister fokus
    inputElement.addEventListener('blur', function() {
        // Kort forsinkelse for å tillate klikk på dropdown-elementet
        setTimeout(() => {
            dropdownList.style.display = 'none';
        }, 200);
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
    const barcodeItems = [];
    if (appState.barcodeMapping) {
        for (const [barcode, itemData] of Object.entries(appState.barcodeMapping)) {
            // Sjekk om varen allerede finnes i allItems
            let itemId, description;
            
            // Støtter både gammelt format (bare varenr) og nytt format (objekt med id og description)
            if (typeof itemData === 'object' && itemData !== null) {
                itemId = itemData.id;
                description = itemData.description || `Strekkode: ${barcode}`;
            } else {
                itemId = itemData;
                description = `Strekkode: ${barcode}`;
            }
            
            const existingItem = allItems.find(item => item.id === itemId);
            
            if (existingItem) {
                // Legg til strekkoden i eksisterende vare for søkbarhet
                if (!existingItem.barcodes) {
                    existingItem.barcodes = [];
                }
                existingItem.barcodes.push(barcode);
                
                // Oppdater beskrivelse hvis den mangler
                if (!existingItem.description && description) {
                    existingItem.description = description;
                }
            } else {
                // Opprett en ny vare basert på strekkode-informasjon
                barcodeItems.push({
                    id: itemId,
                    description: description,
                    barcodes: [barcode]
                });
            }
        }
    }
    
    // Kombiner alle varer
    const combinedItems = [...allItems, ...barcodeItems];
    
    // Fjern duplikater basert på varenummer
    const uniqueItems = [];
    const itemIds = new Set();
    
    combinedItems.forEach(item => {
        if (item && item.id && !itemIds.has(item.id)) {
            itemIds.add(item.id);
            uniqueItems.push(item);
        }
    });
    
    // Filtrer basert på søketekst
    if (search) {
        items = uniqueItems.filter(item => 
            // Søk i varenummer
            item.id.toLowerCase().includes(search) || 
            // Søk i beskrivelse
            (item.description && item.description.toLowerCase().includes(search)) || 
            // Søk i strekkoder
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
            // Prioriter eksakte treff på varenummer
            const aExactId = a.id.toLowerCase() === search ? -2 : 0;
            const bExactId = b.id.toLowerCase() === search ? -2 : 0;
            
            // Deretter prioriter varer som starter med søketeksten
            const aStartsWithId = a.id.toLowerCase().startsWith(search) ? -1 : 0;
            const bStartsWithId = b.id.toLowerCase().startsWith(search) ? -1 : 0;
            
            return (aExactId + aStartsWithId) - (bExactId + bStartsWithId);
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