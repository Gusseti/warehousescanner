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
    
    let setupCount = 0;
    
    inputFields.forEach(field => {
        const inputElement = document.getElementById(field.id);
        if (inputElement) {
            console.log(`Setter opp dropdown for ${field.id}`);
            setupItemSearch(inputElement, field.module);
            setupCount++;
        } else {
            console.warn(`Input-element ${field.id} ble ikke funnet`);
        }
    });
    
    console.log(`Dropdown-søk initialisert for ${setupCount} felt`);
    
    // Legg til global lytter for å lukke alle dropdowns når man klikker utenfor
    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.item-search-results');
        dropdowns.forEach(dropdown => {
            // Lukk dropdown hvis klikket var utenfor både dropdown og input
            if (!dropdown.contains(e.target) && 
                !e.target.classList.contains('item-search-input')) {
                dropdown.style.display = 'none';
            }
        });
    });
    
    // Hvis ingen elementer ble satt opp, prøv igjen om litt
    if (setupCount === 0) {
        console.log('Ingen inputfelt funnet. Prøver igjen om 500ms...');
        setTimeout(initDropdownSearch, 500);
        return;
    }
    
    console.log('Dropdown-søk initialisering fullført');
}

/**
 * Setter opp søk med dropdown for et inputfelt
 * @param {HTMLElement} inputElement - Input-elementet
 * @param {string} module - Modulnavnet (picking, receiving, returns)
 */
function setupItemSearch(inputElement, module) {
    try {
        // Fjern eventuell eksisterende oppsett først
        cleanupExistingSearch(inputElement);
        
        // Opprett ny søkecontainer
        const searchContainer = document.createElement('div');
        searchContainer.className = 'item-search-container';
        
        // Plasser søkecontaineren der inputfeltet var
        const parentNode = inputElement.parentNode;
        parentNode.insertBefore(searchContainer, inputElement);
        
        // Flytt inputfeltet inn i søkecontaineren
        searchContainer.appendChild(inputElement);
        
        // Legg til søkeikon
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search item-search-icon';
        searchContainer.appendChild(searchIcon);
        
        // Legg til klasser og attributter på inputfeltet
        inputElement.className = 'item-search-input';
        inputElement.setAttribute('placeholder', 'Søk vare (nr, navn, strekkode)...');
        inputElement.setAttribute('autocomplete', 'off');
        
        // Opprett dropdown-resultatliste
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'item-search-results';
        searchContainer.appendChild(resultsContainer);
        
        // Håndter input events
        inputElement.addEventListener('input', function() {
            const searchText = this.value.trim();
            // Vis resultater allerede fra første tegn
            if (searchText.length >= 1) {
                updateSearchResults(resultsContainer, searchText, module);
                resultsContainer.style.display = 'block';
                
                // Sikre at dropdown holder seg innenfor vinduet
                ensureVisibleInViewport(resultsContainer);
            } else {
                resultsContainer.style.display = 'none';
            }
        });
        
        // Også kjør et testforsøk på å vise dropdown når vi setter opp feltet
        const testEvent = new Event('input', { bubbles: true });
        inputElement.dispatchEvent(testEvent);
        
        // Vis resultater når feltet får fokus
        inputElement.addEventListener('focus', function() {
            const searchText = this.value.trim();
            if (searchText.length >= 1) {
                updateSearchResults(resultsContainer, searchText, module);
                resultsContainer.style.display = 'block';
            }
        });
        
        // Håndterer Tab-tasten spesielt
        inputElement.addEventListener('keydown', function(e) {
            // Hvis dropdown ikke vises, gjør ingenting spesielt
            if (resultsContainer.style.display === 'none') return;
            
            const items = resultsContainer.querySelectorAll('.item-result');
            if (items.length === 0) return;
            
            let activeIndex = -1;
            items.forEach((item, index) => {
                if (item.classList.contains('active')) {
                    activeIndex = index;
                }
            });
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveResult(items, activeIndex + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveResult(items, activeIndex - 1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex >= 0) {
                        items[activeIndex].click();
                    } else if (items.length > 0) {
                        // Hvis ingen er aktiv, velg første element
                        items[0].click();
                    }
                    break;
                case 'Tab':
                    if (activeIndex >= 0) {
                        e.preventDefault();
                        items[activeIndex].click();
                    } else if (items.length > 0) {
                        // Hvis ingen er aktiv, velg første element
                        e.preventDefault();
                        items[0].click();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    resultsContainer.style.display = 'none';
                    break;
            }
        });
        
        // Legg til en data-attributt så vi kan bekrefte at oppsettet er ferdig
        inputElement.setAttribute('data-dropdown-ready', 'true');
        console.log(`Dropdown oppsett fullført for ${inputElement.id}`);
        
    } catch (error) {
        console.error(`Feil ved oppsett av dropdown for ${inputElement?.id || 'ukjent'}:`, error);
    }
}

/**
 * Fjerner eventuelle eksisterende søkeoppsett
 * @param {HTMLElement} inputElement - Input-elementet
 */
function cleanupExistingSearch(inputElement) {
    // Fjern eksisterende containere hvis de finnes
    const existingContainer = inputElement.closest('.item-search-container');
    if (existingContainer) {
        const parent = existingContainer.parentNode;
        parent.insertBefore(inputElement, existingContainer);
        existingContainer.remove();
    }
    
    // Fjern eventuelle eksisterende klasser fra tidligere oppsett
    inputElement.classList.remove('search-input', 'item-search-input');
}

/**
 * Sikrer at resultatlisten er synlig i viewport
 * @param {HTMLElement} resultsContainer - Container for resultatlisten
 */
function ensureVisibleInViewport(resultsContainer) {
    setTimeout(() => {
        const rect = resultsContainer.getBoundingClientRect();
        // Juster hvis listen går utenfor høyre side
        if (rect.right > window.innerWidth) {
            resultsContainer.style.left = 'auto';
            resultsContainer.style.right = '0';
        }
        // Juster hvis listen går utenfor bunnen
        if (rect.bottom > window.innerHeight) {
            const maxHeight = window.innerHeight - rect.top - 20;
            resultsContainer.style.maxHeight = maxHeight + 'px';
        }
    }, 0);
}

/**
 * Setter aktivt element i resultatlisten
 * @param {NodeList} items - Liste med resultatelementer
 * @param {number} index - Indeks til elementet som skal aktiveres
 */
function setActiveResult(items, index) {
    // Fjern aktiv klasse fra alle elementer
    items.forEach(item => item.classList.remove('active'));
    
    // Sett aktiv klasse på valgt element
    if (index >= 0 && index < items.length) {
        items[index].classList.add('active');
        // Scroll til elementet om nødvendig
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

/**
 * Fremhever søkeordet i en tekst på en mer presis måte
 * @param {string} text - Teksten som skal vises
 * @param {string} search - Søkeordet som skal fremheves
 * @returns {string} HTML med fremhevet søkeord
 */
function highlightText(text, search) {
    if (!text || !search || search.trim() === '') return text || '';
    
    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    
    // Kun tall - vi må behandle tall spesielt
    if (/^\d+$/.test(search)) {
        // For tall behandler vi først hele matchende tall
        if (lowerText === lowerSearch) {
            // Hele teksten er identisk med søket
            return `<span class="highlight">${text}</span>`;
        }
        
        // For varenummer og strekkoder, vi vil kun fremheve hvis tallet er på starten
        if (text.startsWith(search)) {
            return `<span class="highlight">${text.substring(0, search.length)}</span>${text.substring(search.length)}`;
        }
        
        // Ellers fremhever vi kun i starten av ordet etter bindestrek eller mellomrom
        // Dette er viktig for varenummer som ofte har formatet XXX-YYY-ZZZ
        const parts = [];
        let lastIndex = 0;
        const pattern = new RegExp(`(^|[^\\d])(${escapeRegExp(lowerSearch)})(?=[^\\d]|$)`, 'g');
        let match;
        
        while ((match = pattern.exec(lowerText)) !== null) {
            const matchIndex = match.index + match[1].length; // Juster for "look-behind" gruppen
            
            // Legg til tekst før dette treffet
            parts.push(text.substring(lastIndex, matchIndex));
            
            // Legg til det fremhevede søketreffet
            parts.push(`<span class="highlight">${text.substring(matchIndex, matchIndex + search.length)}</span>`);
            
            lastIndex = matchIndex + search.length;
        }
        
        // Legg til resten av teksten
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }
        
        return parts.length > 1 ? parts.join('') : text;
    } 
    // For ord (ikke bare tall)
    else {
        // For hele ord, bruker word boundary
        const regExp = new RegExp(`\\b(${escapeRegExp(lowerSearch)})\\b`, 'gi');
        return text.replace(regExp, '<span class="highlight">$&</span>');
    }
}

/**
 * Escaper spesialtegn for RegExp
 * @param {string} string - Strengen som skal escapes
 * @returns {string} Escaped streng
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Oppdaterer resultatlisten basert på søk
 * @param {HTMLElement} resultsContainer - Container for resultatlisten
 * @param {string} searchText - Søketekst
 * @param {string} module - Modulnavn
 */
function updateSearchResults(resultsContainer, searchText, module) {
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
                // Legg til strekkoden i eksisterende vare for søkbarhet, men kun hvis den ikke allerede finnes
                if (!existingItem.barcodes) {
                    existingItem.barcodes = [];
                }
                // Sjekk om strekkoden allerede er lagt til for å unngå duplikater
                if (!existingItem.barcodes.includes(barcode)) {
                    existingItem.barcodes.push(barcode);
                }
                
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
        items = uniqueItems.filter(item => {
            // Lag en score for hvor godt dette elementet matcher søket
            item.searchScore = 0;
            
            // Sjekk varenummer - nøyaktig match er best
            if (item.id.toLowerCase() === search) {
                item.searchScore += 100; // Veldig høy score for eksakt match på varenummer
                item.matchType = 'exact-id';
            } else if (item.id.toLowerCase().startsWith(search)) {
                item.searchScore += 75; // Høy score for match i starten av varenummeret
                item.matchType = 'starts-with-id';
            } else if (item.id.toLowerCase().includes(search)) {
                item.searchScore += 50; // Lavere score for match et sted i varenummeret
                item.matchType = 'contains-id';
            }
            
            // Sjekk beskrivelse
            if (item.description) {
                if (item.description.toLowerCase() === search) {
                    item.searchScore += 90; // Høy score for eksakt match på beskrivelse
                    item.matchType = item.matchType || 'exact-description';
                } else if (item.description.toLowerCase().startsWith(search)) {
                    item.searchScore += 65; // God score for match i starten av beskrivelsen
                    item.matchType = item.matchType || 'starts-with-description';
                } else if (item.description.toLowerCase().includes(search)) {
                    item.searchScore += 40; // Score for match et sted i beskrivelsen
                    item.matchType = item.matchType || 'contains-description';
                }
                
                // Sjekk for match på hele ord i beskrivelsen
                const words = item.description.toLowerCase().split(/\s+/);
                if (words.some(word => word === search)) {
                    item.searchScore += 50; // Bonus for match på hele ord
                }
            }
            
            // Sjekk strekkoder
            if (item.barcodes && item.barcodes.length > 0) {
                // Se om noen av strekkodene matcher søket
                for (const barcode of item.barcodes) {
                    if (barcode.toLowerCase() === search) {
                        item.searchScore += 95; // Nesten like høy score som eksakt match på varenummer
                        item.matchType = item.matchType || 'exact-barcode';
                        break;
                    } else if (barcode.toLowerCase().startsWith(search)) {
                        item.searchScore += 70; // Høy score for match i starten av strekkoden
                        item.matchType = item.matchType || 'starts-with-barcode';
                        break;
                    } else if (barcode.toLowerCase().includes(search)) {
                        item.searchScore += 45; // Score for match et sted i strekkoden
                        item.matchType = item.matchType || 'contains-barcode';
                        break;
                    }
                }
            }
            
            // Returner true hvis det var noen form for match
            return item.searchScore > 0;
        });
        
        // Sorter basert på score - høyeste score først
        items.sort((a, b) => b.searchScore - a.searchScore);
    } else {
        items = uniqueItems;
        // Hvis ingen søketekst, sorter alfabetisk på varenummer
        items.sort((a, b) => a.id.localeCompare(b.id));
    }
    
    // Marker elementer som er i den aktuelle modulens liste
    items.forEach(item => {
        switch (module) {
            case 'picking':
                item.inCurrentList = appState.pickListItems?.some(i => i.id === item.id);
                break;
            case 'receiving':
                item.inCurrentList = appState.receiveListItems?.some(i => i.id === item.id);
                break;
            case 'returns':
                item.inCurrentList = appState.returnListItems?.some(i => i.id === item.id);
                break;
        }
    });
    
    // Sorter slik at elementer som er i den aktuelle listen kommer først
    if (items.length > 1) {
        items.sort((a, b) => {
            // Først etter om de er i listen
            if (a.inCurrentList && !b.inCurrentList) return -1;
            if (!a.inCurrentList && b.inCurrentList) return 1;
            
            // Deretter etter score
            return b.searchScore - a.searchScore;
        });
    }
    
    // Begrens til maks 15 resultater for bedre ytelse
    items = items.slice(0, 15);
    
    // Tøm resultatcontaineren
    resultsContainer.innerHTML = '';
    
    // Vis melding hvis ingen resultater ble funnet
    if (items.length === 0) {
        resultsContainer.innerHTML = '<div class="item-no-results">Ingen varer funnet</div>';
        return;
    }
    
    // Legg til header med antall resultater
    const moduleNames = {
        'picking': 'Plukkliste',
        'receiving': 'Mottaksliste',
        'returns': 'Returliste'
    };
    
    const header = document.createElement('div');
    header.className = 'item-results-header';
    header.innerHTML = `
        <span>Søkeresultater</span>
        <span class="item-results-count">${items.length} vare${items.length !== 1 ? 'r' : ''}</span>
    `;
    resultsContainer.appendChild(header);
    
    // Opprett en container for resultatlisten
    const resultsList = document.createElement('div');
    resultsList.className = 'item-results-list';
    resultsContainer.appendChild(resultsList);
    
    // Legg til hvert element i resultatlisten
    items.forEach(item => {
        // Opprett element for resultatet
        const resultItem = document.createElement('div');
        resultItem.className = 'item-result';
        
        // Legg til klasser basert på match-type og om varen er i listen
        if (item.inCurrentList) {
            resultItem.classList.add('in-list');
            
            // Legg til tooltip
            const listName = moduleNames[module];
            resultItem.setAttribute('data-tooltip', `Varen er i ${listName}`);
        }
        
        if (item.matchType === 'exact-id' || item.matchType === 'exact-barcode') {
            resultItem.classList.add('exact-match');
        }
        
        // Legg til varenummer og beskrivelse
        const infoContainer = document.createElement('div');
        infoContainer.className = 'item-info';
        
        const number = document.createElement('div');
        number.className = 'item-number';
        
        // Fremhev søketeksten i varenummeret
        number.innerHTML = highlightText(item.id, search);
        
        const description = document.createElement('div');
        description.className = 'item-description';
        
        // Fremhev søketeksten i beskrivelsen
        description.innerHTML = highlightText(item.description || 'Ingen beskrivelse', search);
        
        infoContainer.appendChild(number);
        infoContainer.appendChild(description);
        resultItem.appendChild(infoContainer);
        
        // Legg til strekkode hvis tilgjengelig
        if (item.barcodes && item.barcodes.length > 0) {
            // Finn strekkoden som best matcher søketeksten
            let bestMatchingBarcode = item.barcodes[0];
            for (const barcode of item.barcodes) {
                if (barcode.toLowerCase().includes(search)) {
                    bestMatchingBarcode = barcode;
                    break;
                }
            }
            
            const barcodeElement = document.createElement('div');
            barcodeElement.className = 'item-barcode';
            
            const barcodeIcon = document.createElement('i');
            barcodeIcon.className = 'fas fa-barcode';
            
            barcodeElement.appendChild(barcodeIcon);
            
            // Fremhev søketeksten i strekkoden
            const barcodeTextSpan = document.createElement('span');
            barcodeTextSpan.innerHTML = ' ' + highlightText(bestMatchingBarcode, search);
            barcodeElement.appendChild(barcodeTextSpan);
            
            if (item.barcodes.length > 1) {
                const moreBarcodes = document.createElement('span');
                moreBarcodes.className = 'item-barcode-more';
                moreBarcodes.textContent = `+${item.barcodes.length - 1}`;
                moreBarcodes.title = item.barcodes.join(', ');
                barcodeElement.appendChild(moreBarcodes);
            }
            
            resultItem.appendChild(barcodeElement);
        }
        
        // Legg til klikkevents
        resultItem.addEventListener('click', function() {
            // Sett varenummeret i inputfeltet
            const inputElement = resultsContainer.parentNode.querySelector('.item-search-input');
            inputElement.value = item.id;
            resultsContainer.style.display = 'none';
            
            // Utløs et input-event for å oppdatere andre lyttere
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Utløs en spesiell hendelse som andre moduler kan lytte på
            const selectEvent = new CustomEvent('item-selected', { 
                detail: { 
                    id: item.id, 
                    description: item.description,
                    barcodes: item.barcodes,
                    module: module
                }
            });
            inputElement.dispatchEvent(selectEvent);
            
            // Fokuser på inputfeltet igjen
            inputElement.focus();
        });
        
        resultsList.appendChild(resultItem);
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