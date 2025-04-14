// import-export.js - Refaktorert versjon med konsolidert funksjonalitet
import { appState } from '../app.js';
import { showToast, formatDate } from './utils.js';
import { saveListsToStorage, saveBarcodeMapping } from './storage.js';

/**
 * Generisk funksjon for å håndtere filimport
 * @param {Event} event - Fil-input event
 * @param {string} context - Kontekst ('pick', 'receive', 'barcode')
 * @param {Function} callback - Callback funksjon som kalles etter vellykket import
 */
export function handleFileImport(event, context, callback) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vis laster-melding
    showToast(`Importerer ${getContextName(context)}...`, 'info');
    
    // Håndter ulike filtyper
    if (file.type === 'application/pdf') {
        // For PDF, bruk PDF-spesifikk import
        if (context === 'receive') {
            // For mottak, prøv først Kvik følgeseddel-import
            importFromReceiptPDF(file)
                .then(() => {
                    if (callback) callback();
                    saveListsToStorage();
                })
                .catch(error => {
                    // Hvis Kvik import feiler, prøv standard PDF-import
                    console.warn('Kvik følgeseddel-import feilet, prøver standard PDF-import:', error);
                    importFromPDF(file, context)
                        .then(() => {
                            if (callback) callback();
                            saveListsToStorage();
                        })
                        .catch(secondError => {
                            showToast('Feil ved import av PDF: ' + secondError.message, 'error');
                        });
                });
        } else {
            // For andre kontekster, bruk standard PDF-import
            importFromPDF(file, context)
                .then(() => {
                    if (callback) callback();
                    saveListsToStorage();
                })
                .catch(error => {
                    showToast('Feil ved import av PDF: ' + error.message, 'error');
                });
        }
    } else {
        // For andre filtyper, les innholdet som tekst
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                
                // Sjekk filtypen basert på filendelse eller innhold
                if (file.name.endsWith('.json')) {
                    importFromJSON(content, file.name, context);
                } else {
                    importFromCSV(content, file.name, context);
                }
                
                if (callback) callback();
                saveListsToStorage();
                
            } catch (error) {
                console.error('Feil ved import av fil:', error);
                showToast('Feil ved import av fil. Sjekk filformatet.', 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    // Reset file input
    event.target.value = '';
}

/**
 * Importerer data fra CSV/TXT fil
 * @param {string} content - Filinnhold
 * @param {string} fileName - Filnavn
 * @param {string} context - Kontekst ('pick', 'receive', 'barcode')
 */
export function importFromCSV(content, fileName, context) {
    // Sjekk om innholdet ligner på formatet fra PDF-en
    const isPDFFormat = content.includes('Varenr.') && content.includes('Beskrivelse') && content.includes('Bestilt');
    
    // Velg riktig delimiter basert på innholdet
    const delimiter = content.includes(';') ? ';' : ',';
    const lines = content.split('\n');
    
    // Hent riktig liste basert på kontekst
    let targetList = getTargetList(context);
    
    // Nullstill listene
    resetLists(context);
    
    if (isPDFFormat) {
        // Dette er formatet som matcher PDF-en
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Prøv å finne linjer som starter med varenummer-format (f.eks. "000-BH3242" eller "263-L01680")
            const match = line.match(/^(\d{3}-[A-Z0-9]+)\s+(\d+)\s+/);
            if (match) {
                const id = match[1].trim();
                
                // Finn beskrivelsen ved å lete etter tekst mellom tall og parenteser
                const descMatch = line.match(/\d+\s+________\s+________\s+(.*?)\s+\(\d+\)/);
                let description = "Ukjent beskrivelse";
                
                if (descMatch && descMatch[1]) {
                    description = descMatch[1].trim();
                }
                
                // Finn antall
                const quantityMatch = match[2];
                const quantity = parseInt(quantityMatch, 10) || 1;
                
                // Finn eller sett en standard vekt
                const weight = appState.itemWeights[id] || appState.settings.defaultItemWeight;
                
                addItemToList(targetList, id, description, quantity, weight, context);
            }
        }
    } else {
        // Standard CSV-format
        // Sjekk om filen har en header-rad
        let hasHeader = false;
        if (lines.length > 0) {
            const firstLine = lines[0].toLowerCase();
            hasHeader = firstLine.includes('vare') || 
                        firstLine.includes('id') || 
                        firstLine.includes('nummer') || 
                        firstLine.includes('beskrivelse');
        }
        
        // Start indeks for data (hopp over header om den finnes)
        const startIndex = hasHeader ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(delimiter);
            if (parts.length >= 2) {
                const id = parts[0].trim();
                const description = parts[1].trim();
                const quantity = parts.length > 2 ? parseInt(parts[2].trim(), 10) || 1 : 1;
                const weight = appState.itemWeights[id] || appState.settings.defaultItemWeight;
                
                addItemToList(targetList, id, description, quantity, weight, context);
            }
        }
    }
    
    // Vis tilbakemelding til brukeren
    showToast(`Importert liste med ${targetList.length} varer!`, 'success');
}

/**
 * Importerer data fra JSON-fil
 * @param {string} content - Filinnhold
 * @param {string} fileName - Filnavn
 * @param {string} context - Kontekst ('pick', 'receive', 'barcode')
 */
export function importFromJSON(content, fileName, context) {
    try {
        const data = JSON.parse(content);
        
        // Hvis dette er en strekkodeoversikt
        if (context === 'barcode') {
            handleBarcodeJSON(data, fileName);
            return;
        }
        
        // Sjekk om dette er en liste eller strekkodeoversikt
        if (Array.isArray(data) || (data.items && Array.isArray(data.items))) {
            // Dette er en liste
            const itemsArray = data.items || data;
            
            const items = itemsArray.map(item => ({
                id: item.id || item.varenr,
                description: item.description || item.beskrivelse || 'Ukjent beskrivelse',
                quantity: item.quantity || item.antall || 1,
                weight: appState.itemWeights[item.id || item.varenr] || item.weight || appState.settings.defaultItemWeight
            }));
            
            // Hent riktig liste basert på kontekst
            let targetList = getTargetList(context);
            
            // Nullstill listene
            resetLists(context);
            
            // Legg til alle varer i listen
            items.forEach(item => {
                addItemToList(targetList, item.id, item.description, item.quantity, item.weight, context);
            });
            
            showToast(`Importert ${items.length} varer til ${getContextName(context)}listen!`, 'success');
        } else if (typeof data === 'object' && !Array.isArray(data)) {
            // Dette er trolig en strekkodeoversikt
            handleBarcodeJSON(data, fileName);
        }
    } catch (error) {
        console.error('Feil ved import av JSON:', error);
        showToast('Feil ved import av JSON-fil.', 'error');
    }
}

/**
 * Håndterer import av strekkodeoversikt
 * @param {Object} data - Strekkodedata
 * @param {string} fileName - Filnavn
 */
function handleBarcodeJSON(data, fileName) {
    if (typeof data === 'object' && !Array.isArray(data)) {
        console.log('Importerer strekkodeoversikt:', data);
        
        // Kombinerer med eksisterende mapping
        appState.barcodeMapping = { ...appState.barcodeMapping, ...data };
        
        // Lagre til localStorage
        saveBarcodeMapping();
        
        // Oppdater UI
        const barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
        if (barcodeFileInfoEl) {
            barcodeFileInfoEl.textContent = `Lastet inn: ${fileName} (${Object.keys(appState.barcodeMapping).length} strekkoder)`;
        }
        
        showToast(`Importert ${Object.keys(data).length} strekkoder!`, 'success');
    } else {
        showToast('Ugyldig strekkodeformat. Forventet objekt med strekkode-til-varenummer-mapping.', 'error');
    }
}

/**
 * Importerer data fra PDF-fil
 * @param {File} file - PDF-fil
 * @param {string} context - Kontekst ('pick', 'receive')
 * @returns {Promise} Løftebasert resultat av importeringen
 */
export async function importFromPDF(file, context) {
    try {
        showToast('Leser PDF-fil...', 'info');
        
        // Hent riktig fileInfo-element basert på kontekst
        const fileInfoId = context === 'pick' ? 'pickFileInfo' : 'receiveFileInfo';
        const fileInfoElement = document.getElementById(fileInfoId);
            
        if (!fileInfoElement) {
            console.error(`FileInfo-element for kontekst ${context} finnes ikke`);
            throw new Error('Feil: Kunne ikke finne nødvendige grensesnittelementer.');
        }
        
        // Konverterer filen til en arraybuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Sjekk om PDF.js er tilgjengelig
        if (!window.pdfjsLib) {
            console.error('PDF.js biblioteket er ikke lastet');
            throw new Error('Feil: PDF-biblioteket er ikke tilgjengelig. Vennligst oppdater siden.');
        }
        
        // Setter worker path
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';
        
        // Laster PDF-dokumentet
        console.log('Starter lasting av PDF...');
        const loadingTask = window.pdfjsLib.getDocument(arrayBuffer);
        
        // Legg til fremgangspåvisning
        loadingTask.onProgress = function(progress) {
            console.log(`PDF lasteprogresjon: ${Math.round((progress.loaded / progress.total) * 100)}%`);
        };
        
        const pdf = await loadingTask.promise;
        console.log(`PDF lastet. Antall sider: ${pdf.numPages}`);
        
        // Nullstill listene
        resetLists(context);
        
        // Samle all tekst fra PDF-en
        const allTextLines = [];
        
        // Ekstraherer tekst fra hver side
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Behandler side ${i}...`);
            
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Konverter tekst-elementer til strenger
                const textItems = textContent.items.map(item => item.str);
                const pageText = textItems.join('\n');
                
                // Del opp teksten i linjer
                const lines = pageText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                
                console.log(`Side ${i}: Hentet ${lines.length} linjer`);
                allTextLines.push(...lines);
            } catch (error) {
                console.error(`Feil ved behandling av side ${i}:`, error);
            }
        }
        
        console.log(`Ekstrahert totalt ${allTextLines.length} linjer fra PDF-en`);
        
        if (allTextLines.length === 0) {
            throw new Error('Ingen tekst funnet i PDF-en. Sjekk at PDF-en ikke er skannet bilde eller passordbeskyttet.');
        }
        
        // Bruk parseProductLines for å identifisere produkter
        console.log('Starter parsing av produktlinjer...');
        const parsedItems = parseProductLinesFromPDF(allTextLines);
        console.log(`Identifisert ${parsedItems.length} produkter fra PDF-en`);
        
        // Hent riktig liste basert på kontekst
        let targetList = getTargetList(context);
        
        // Legg til alle varer i listen
        parsedItems.forEach(item => {
            addItemToList(
                targetList, 
                item.id, 
                item.description, 
                item.quantity, 
                appState.itemWeights[item.id] || appState.settings.defaultItemWeight, 
                context
            );
        });
        
        // Oppdater UI
        fileInfoElement.textContent = `Lastet inn: ${file.name} (${parsedItems.length} varer)`;
        
        if (parsedItems.length > 0) {
            showToast(`Importert ${parsedItems.length} varer fra PDF!`, 'success');
        } else {
            throw new Error('Ingen varer funnet i PDF-en. Prøv å importere som CSV i stedet.');
        }
        
        // Lagre endringer til localStorage
        saveListsToStorage();
        
        return { success: true, itemCount: parsedItems.length };
    } catch (error) {
        console.error('Feil ved import av PDF:', error);
        throw error;
    }
}

/**
 * Parser produktlinjer fra PDF-tekst
 * @param {Array} lines - Tekstlinjer fra PDF
 * @returns {Array} Liste med produkter
 */
function parseProductLinesFromPDF(lines) {
    // Prøv først med standard-metoden
    let products = parseProductLines(lines);
    
    // Hvis ingen produkter ble funnet, prøv den alternative metoden
    if (products.length === 0) {
        console.log('Standard parsing fant ingen produkter, prøver alternativ metode...');
        products = parseComplexProductLines(lines);
    }
    
    return products;
}

/**
 * Standard parser for produktlinjer
 * @param {Array} lines - Tekstlinjer
 * @returns {Array} Liste med produkter
 */
function parseProductLines(lines) {
    const products = [];
    // Regex-mønster for varenumre
    const productCodePattern = /^([A-Z0-9]{2,4}-[A-Z0-9]+-?[A-Z0-9]*|[A-Z]{2}\d{5}|[A-Z][A-Z0-9]{4,})/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Sjekk om linjen starter med et produkt-ID-mønster
        const match = line.match(productCodePattern);
        if (match) {
            const productId = match[1];
            
            // Sjekk om neste linje inneholder antall (et tall alene)
            if (i + 1 < lines.length) {
                const quantityLine = lines[i + 1].trim();
                const quantityMatch = quantityLine.match(/^(\d+)$/);
                
                if (quantityMatch) {
                    const quantity = parseInt(quantityMatch[1], 10);
                    
                    // Finn beskrivelsen som vanligvis kommer etter understreker
                    // Vi hopper vanligvis 5-6 linjer frem for å finne beskrivelsen
                    let description = "";
                    let j = i + 5; // Start fra ca. 5 linjer frem (etter understrekene)
                    
                    // Let etter beskrivelsen i de neste linjene
                    while (j < lines.length && j < i + 15) {
                        const textLine = lines[j].trim();
                        
                        // Stopp hvis vi har nådd neste produkt eller en linje med bare tall i parentes
                        if (textLine.match(productCodePattern) || textLine.match(/^\(\d+\)$/)) {
                            break;
                        }
                        
                        // Legg til denne linjen til beskrivelsen hvis den ikke er tom eller bare understrekninger
                        if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                            description += (description ? " " : "") + textLine;
                        }
                        
                        j++;
                    }
                    
                    // Rens beskrivelsen (fjern eventuelle parenteser med tall på slutten)
                    description = description.replace(/\(\d+\)$/, '').trim();
                    
                    if (description) {
                        products.push({
                            id: productId,
                            description: description,
                            quantity: quantity
                        });
                    }
                }
            }
        }
    }
    
    return products;
}

/**
 * Alternativ parser for komplekse produktlinjer
 * @param {Array} lines - Tekstlinjer
 * @returns {Array} Liste med produkter
 */
function parseComplexProductLines(lines) {
    const products = [];
    // Vi prøver ulike mønstre for å fange ulike varenummerformater
    const patterns = [
        /^(\d{3}-[A-Z][A-Z0-9]*-\d+)/,  // 000-XX-000 format
        /^(\d{3}-[A-Z][A-Z0-9]*)/,      // 000-XX format
        /^([A-Z]{2}\d{5})/,             // XX00000 format
        /^(BP\d{5})/,                   // BP00000 format
        /^([A-Z][A-Z0-9]{4,})/          // Andre alfanumeriske koder
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        let productId = null;
        
        // Prøv hvert mønster for å finne produkt-ID
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                productId = match[1];
                break;
            }
        }
        
        if (productId) {
            // Analyser resten av linjen eller neste linje for antall
            let quantity = 1; // Standard hvis ikke spesifisert
            let quantityFound = false;
            let description = "";
            
            // Sjekk først om antall er på samme linje
            const quantitySameLineMatch = line.substring(productId.length).trim().match(/^(\d+)/);
            if (quantitySameLineMatch) {
                quantity = parseInt(quantitySameLineMatch[1], 10);
                quantityFound = true;
                
                // Beskrivelsen kan være på samme linje etter antallet
                const descStart = line.indexOf(quantitySameLineMatch[0]) + quantitySameLineMatch[0].length;
                description = line.substring(descStart).trim();
            } 
            // Eller sjekk neste linje for antall
            else if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const quantityNextLineMatch = nextLine.match(/^(\d+)$/);
                
                if (quantityNextLineMatch) {
                    quantity = parseInt(quantityNextLineMatch[1], 10);
                    quantityFound = true;
                    i++; // Hopp over neste linje siden vi har behandlet den
                    
                    // Beskrivelsen kommer typisk etter noen understreker
                    let j = i + 5; // Start fra ca. 5 linjer frem
                    
                    while (j < lines.length && j < i + 15) {
                        const textLine = lines[j].trim();
                        let foundNextProduct = false;
                        
                        // Sjekk om vi har nådd neste produkt
                        for (const pattern of patterns) {
                            if (textLine.match(pattern)) {
                                foundNextProduct = true;
                                break;
                            }
                        }
                        
                        if (foundNextProduct || textLine.match(/^\(\d+\)$/)) {
                            break;
                        }
                        
                        // Legg til denne linjen til beskrivelsen
                        if (textLine && !textLine.match(/^_+$/) && !textLine.match(/^Leveret$/)) {
                            description += (description ? " " : "") + textLine;
                        }
                        
                        j++;
                    }
                }
            }
            
            // Rens beskrivelsen
            description = description.replace(/\(\d+\)$/, '').trim();
            
            // Legg til produktet hvis vi har funnet antall og har en beskrivelse
            if (quantityFound && (description || productId)) {
                products.push({
                    id: productId,
                    description: description || "Ukjent beskrivelse",
                    quantity: quantity
                });
            }
        }
    }
    
    return products;
}

/**
 * Importerer data fra Kvik følgeseddel-PDF
 * @param {File} file - PDF-fil
 * @returns {Promise} Løftebasert resultat av importen
 */
export async function importFromReceiptPDF(file) {
    try {
        showToast('Leser mottaksliste fra PDF...', 'info');
        
        // Konverter filen til en arraybuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Sjekk om PDF.js er tilgjengelig
        if (!window.pdfjsLib) {
            console.error('PDF.js biblioteket er ikke lastet');
            throw new Error('Feil: PDF-biblioteket er ikke tilgjengelig. Vennligst oppdater siden.');
        }
        
        // Setter worker path
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';
        
        // Laster PDF-dokumentet
        console.log('Starter lasting av mottaksliste PDF...');
        const loadingTask = window.pdfjsLib.getDocument(arrayBuffer);
        
        const pdf = await loadingTask.promise;
        console.log(`PDF lastet. Antall sider: ${pdf.numPages}`);
        
        // Samle all tekst fra PDF-en
        const allTextLines = [];
        
        // Ekstraherer tekst fra hver side
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Behandler side ${i}...`);
            
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Konverter tekst-elementer til strenger
                const textItems = textContent.items.map(item => item.str);
                const pageText = textItems.join('\n');
                
                // Del opp teksten i linjer
                const lines = pageText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                
                console.log(`Side ${i}: Hentet ${lines.length} linjer`);
                allTextLines.push(...lines);
            } catch (error) {
                console.error(`Feil ved behandling av side ${i}:`, error);
            }
        }
        
        if (allTextLines.length === 0) {
            throw new Error('Ingen tekst funnet i PDF-en.');
        }
        
        // Identifiser og behandle mottakslisten
        const items = processKvikReceiptLines(allTextLines);
        
        if (items.length === 0) {
            throw new Error('Ingen varer funnet i PDF-en.');
        }
        
        // Nullstill listene
        resetLists('receive');
        
        // Oppdater mottaksliste i appState
        appState.receiveListItems = items;
        
        saveListsToStorage();
        showToast(`Importert ${items.length} varer fra mottaksliste!`, 'success');
        
        return {
            success: true,
            itemCount: items.length
        };
    } catch (error) {
        console.error('Feil ved import av mottaksliste PDF:', error);
        showToast('Feil ved import: ' + error.message, 'error');
        throw error;
    }
}

/**
 * Prosesserer linjer fra Kvik følgeseddel-PDF
 * @param {Array<string>} lines - Tekstlinjer fra PDF
 * @returns {Array<Object>} Array med vareposter
 */
function processKvikReceiptLines(lines) {
    const items = [];
    let currentPalleId = null;
    
    // Sjekk om dette er en Kvik følgeseddel
    const isKvikReceipt = lines.some(line => 
        line.includes('Kvik') && (line.includes('Følgeseddel') || line.includes('ordrenummer'))
    );
    
    if (!isKvikReceipt) {
        console.warn('Dette ser ikke ut som en Kvik følgeseddel');
        return [];
    }
    
    console.log("Dokumentet er gjenkjent som Kvik følgeseddel");
    
    // Finn linjer som inneholder varenummer-mønster og analyse antall og plukket informasjon
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip tomme linjer
        if (!line) continue;
        
        // Sjekk om dette er en 9-sifret palle-ID alene på linjen
        if (/^\d{9}$/.test(line)) {
            currentPalleId = line;
            console.log(`Fant ny Palle ID: ${currentPalleId}`);
            continue;
        }
        
        // Sjekk om linjen starter med et varenummer-mønster
        const productCodeMatch = line.match(/^(\d{3}-[A-Z0-9]+-?\d*|[A-Z]{2}\d{5}|[A-Z0-9]{2}\d{3,5}|BP\d{5}|HV\d{1,4}(-\d+)?)/);
        
        if (productCodeMatch) {
            // Dette er starten på en produktlinje
            const productId = productCodeMatch[1];
            
            // Sjekk om det er 3 tall på slutten av linjen (bestilt, plukket, gjenstående)
            const numbersMatch = line.match(/(\d+)\s+(\d+)\s+(\d+)$/);
            
            // Hvis tall finnes på denne linjen
            if (numbersMatch) {
                const bestilt = parseInt(numbersMatch[1]);
                const plukket = parseInt(numbersMatch[2]);
                const gjenstaaende = parseInt(numbersMatch[3]);
                
                // Finn beskrivelsen (mellom varenummer og tallene)
                const descriptionStart = productId.length;
                const descriptionEnd = line.lastIndexOf(numbersMatch[0]);
                const description = line.substring(descriptionStart, descriptionEnd).trim();
                
                items.push({
                    id: productId,
                    description: description,
                    quantity: bestilt,  // Bruk 'bestilt' som antall
                    weight: appState.itemWeights[productId] || appState.settings.defaultItemWeight,
                    received: plukket === bestilt,
                    receivedAt: plukket === bestilt ? new Date() : null,
                    receivedCount: plukket,
                    palleId: currentPalleId
                });
                
                console.log(`Behandlet produkt: ${productId}, Bestilt: ${bestilt}, Plukket: ${plukket}`);
            } else {
                // Hvis tallene ikke er på samme linje, søk fremover for å finne beskrivelsen og tallene
                let j = i + 1;
                let combinedDescription = line.substring(productId.length).trim();
                let bestilt = 0, plukket = 0, gjenstaaende = 0;
                let foundNumbers = false;
                
                // Søk fremover i maks 5 linjer for å finne tallene
                while (j < Math.min(i + 5, lines.length) && !foundNumbers) {
                    const nextLine = lines[j].trim();
                    
                    // Sjekk om dette er bare 3 tall
                    const numbersOnlyMatch = nextLine.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
                    if (numbersOnlyMatch) {
                        bestilt = parseInt(numbersOnlyMatch[1]);
                        plukket = parseInt(numbersOnlyMatch[2]);
                        gjenstaaende = parseInt(numbersOnlyMatch[3]);
                        foundNumbers = true;
                        j++;
                        break;
                    }
                    
                    // Alternativt, sjekk om tall finnes på slutten av denne linjen
                    const numbersEndMatch = nextLine.match(/(\d+)\s+(\d+)\s+(\d+)$/);
                    if (numbersEndMatch) {
                        bestilt = parseInt(numbersEndMatch[1]);
                        plukket = parseInt(numbersEndMatch[2]);
                        gjenstaaende = parseInt(numbersEndMatch[3]);
                        foundNumbers = true;
                        
                        // Legg til beskrivelse frem til tallene
                        const descEnd = nextLine.lastIndexOf(numbersEndMatch[0]);
                        if (descEnd > 0) {
                            combinedDescription += " " + nextLine.substring(0, descEnd).trim();
                        }
                        j++;
                        break;
                    }
                    
                    // Hvis ingen tall funnet, legg til i beskrivelsen
                    combinedDescription += " " + nextLine;
                    j++;
                }
                
                // Hvis vi fant bestilt/plukket tall
                if (foundNumbers) {
                    items.push({
                        id: productId,
                        description: combinedDescription,
                        quantity: bestilt,  // Bruk 'bestilt' som antall
                        weight: appState.itemWeights[productId] || appState.settings.defaultItemWeight,
                        received: plukket === bestilt,
                        receivedAt: plukket === bestilt ? new Date() : null,
                        receivedCount: plukket,
                        palleId: currentPalleId
                    });
                    
                    console.log(`Behandlet produkt: ${productId}, Bestilt: ${bestilt}, Plukket: ${plukket}`);
                    
                    // Hopp frem til etter den siste linjen vi behandlet
                    i = j - 1;
                }
                // Hvis vi ikke fant tall, men vi har en beskrivelse og produktID
                else if (productId) {
                    console.log(`Fant produkt ${productId} men ingen tall-info - antar 1 bestilt, 0 plukket`);
                    // Som en fallback, opprett et element med default-verdier
                    items.push({
                        id: productId,
                        description: combinedDescription || "Ukjent beskrivelse",
                        quantity: 1,  // Default antall
                        weight: appState.itemWeights[productId] || appState.settings.defaultItemWeight,
                        received: false,
                        receivedAt: null,
                        receivedCount: 0,
                        palleId: currentPalleId
                    });
                    
                    // Hopp frem til etter den siste linjen vi behandlet
                    i = j - 1;
                }
            }
        }
    }
    
    console.log(`Ferdig med å behandle følgeseddel. Fant ${items.length} produkter.`);
    return items;
}

/**
 * Hjelpefunksjoner for import/eksport
 */

/**
 * Henter riktig liste basert på kontekst
 * @param {string} context - Kontekst ('pick', 'receive', 'return', 'barcode')
 * @returns {Array} Referanse til riktig liste
 */
function getTargetList(context) {
    switch (context) {
        case 'pick': return appState.pickListItems;
        case 'receive': return appState.receiveListItems;
        case 'return': return appState.returnListItems;
        default: return [];
    }
}

/**
 * Nullstiller lister basert på kontekst
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 */
function resetLists(context) {
    switch (context) {
        case 'pick':
            appState.pickListItems = [];
            appState.pickedItems = [];
            appState.lastPickedItem = null;
            break;
        case 'receive':
            appState.receiveListItems = [];
            appState.receivedItems = [];
            appState.lastReceivedItem = null;
            break;
        case 'return':
            appState.returnListItems = [];
            break;
    }
}

/**
 * Legger til en vare i en liste
 * @param {Array} list - Listen som skal oppdateres
 * @param {string} id - Varenummer
 * @param {string} description - Beskrivelse
 * @param {number} quantity - Antall
 * @param {number} weight - Vekt
 * @param {string} context - Kontekst ('pick', 'receive', 'return')
 */
function addItemToList(list, id, description, quantity, weight, context) {
    // Opprett basisitem
    const newItem = {
        id: id,
        description: description || 'Ukjent beskrivelse',
        quantity: quantity,
        weight: weight
    };
    
    // Legg til kontekstspesifikke felt
    switch (context) {
        case 'pick':
            newItem.picked = false;
            newItem.pickedAt = null;
            newItem.pickedCount = 0;
            break;
        case 'receive':
            newItem.received = false;
            newItem.receivedAt = null;
            newItem.receivedCount = 0;
            break;
        case 'return':
            newItem.returnedAt = new Date();
            break;
    }
    
    // Legg til i listen
    list.push(newItem);
}

/**
 * Få lokalisert navn for kontekst
 * @param {string} context - Kontekst ('pick', 'receive', 'return', 'barcode')
 * @returns {string} Lokalisert navn
 */
function getContextName(context) {
    switch (context) {
        case 'pick': return 'plukkliste';
        case 'receive': return 'mottaksliste';
        case 'return': return 'returliste';
        case 'barcode': return 'strekkodeoversikt';
        default: return context;
    }
}

/**
 * Eksporterer liste til forskjellige formater
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @param {string} format - Eksportformat (json, csv, txt, html)
 */
export function exportList(items, type, format = 'json') {
    if (!items || items.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }

    // Sett opp filnavn
    let fileName = 'eksport';
    switch (type) {
        case 'plukk':
            fileName = 'plukkliste_eksport';
            break;
        case 'mottak':
            fileName = 'mottaksliste_eksport';
            break;
        case 'retur':
            fileName = 'returliste_eksport';
            break;
    }

    // Beregn sammendrag
    const summary = calculateSummary(items, type);

    // Generer eksportinnhold basert på format
    let content = '';
    let mimeType = 'application/json';

    switch (format.toLowerCase()) {
        case 'csv':
            content = generateCSV(items, type);
            fileName += '.csv';
            mimeType = 'text/csv';
            break;
        case 'txt':
            content = generateTXT(items, type, summary);
            fileName += '.txt';
            mimeType = 'text/plain';
            break;
        case 'html':
            content = generateHTML(items, type, summary);
            fileName += '.html';
            mimeType = 'text/html';
            break;
        case 'json':
        default:
            content = JSON.stringify({
                exportDate: new Date().toISOString(),
                exportType: type,
                summary: summary,
                items: items
            }, null, 2);
            fileName += '.json';
            break;
    }

    // Opprett blob og nedlastingslink
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName;

    // Utløs nedlasting
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Rydd opp
    setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }, 100);

    showToast(`Liste eksportert som ${fileName}!`, 'success');
}

/**
 * Beregner sammendrag for liste
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @returns {Object} Sammendrag av listen
 */
function calculateSummary(items, type) {
    let totalItems = items.length;
    let totalWeight = 0;
    let completedItems = 0;

    items.forEach(item => {
        const quantity = item.quantity || 1;
        const weight = item.weight || 0;
        totalWeight += quantity * weight;

        // Sjekk fullførte varer basert på type
        if (type === 'plukk' && item.picked) {
            completedItems++;
        } else if (type === 'mottak' && item.received) {
            completedItems++;
        } else if (type === 'retur') {
            completedItems++;
        }
    });

    return {
        totalItems,
        completedItems,
        totalWeight: parseFloat(totalWeight.toFixed(2))
    };
}

/**
 * Genererer CSV-eksport
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @returns {string} CSV-innhold
 */
function generateCSV(items, type) {
    // Definer kolonner basert på type
    const headers = ['Varenummer', 'Beskrivelse', 'Antall', 'Vekt'];
    
    // Legg til type-spesifikke kolonner
    if (type === 'plukk') headers.push('Plukket');
    if (type === 'mottak') headers.push('Mottatt');

    // Start CSV med headers
    let csv = headers.join(';') + '\n';

    // Legg til data for hver vare
    items.forEach(item => {
        const row = [
            item.id, 
            item.description, 
            item.quantity || 1, 
            (item.weight || 0).toFixed(2)
        ];

        // Legg til type-spesifikke verdier
        if (type === 'plukk') row.push(item.picked ? 'Ja' : 'Nei');
        if (type === 'mottak') row.push(item.received ? 'Ja' : 'Nei');

        csv += row.join(';') + '\n';
    });

    return csv;
}

/**
 * Genererer TXT-eksport
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @param {Object} summary - Sammendrag av listen
 * @returns {string} Tekst-innhold
 */
function generateTXT(items, type, summary) {
    let txt = `SnapScan - ${type.toUpperCase()}LISTE\n`;
    txt += `Eksportdato: ${new Date().toLocaleString('nb-NO')}\n\n`;

    txt += `SAMMENDRAG\n`;
    txt += `-------------------\n`;
    txt += `Total antall varer: ${summary.totalItems}\n`;
    txt += `Fullførte varer: ${summary.completedItems}\n`;
    txt += `Total vekt: ${summary.totalWeight} kg\n\n`;

    txt += `VAREDETALJER\n`;
    txt += `-------------------\n`;

    items.forEach((item, index) => {
        txt += `Vare ${index + 1}:\n`;
        txt += `  Varenummer: ${item.id}\n`;
        txt += `  Beskrivelse: ${item.description}\n`;
        txt += `  Antall: ${item.quantity || 1}\n`;
        txt += `  Vekt (pr. enhet): ${(item.weight || 0).toFixed(2)} kg\n`;

        if (type === 'plukk') {
            txt += `  Plukket: ${item.picked ? 'Ja' : 'Nei'}\n`;
        }
        if (type === 'mottak') {
            txt += `  Mottatt: ${item.received ? 'Ja' : 'Nei'}\n`;
        }
        txt += '\n';
    });

    return txt;
}

/**
 * Genererer HTML-eksport
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @param {Object} summary - Sammendrag av listen
 * @returns {string} HTML-innhold
 */
function generateHTML(items, type, summary) {
    return `
    <!DOCTYPE html>
    <html lang="no">
    <head>
        <meta charset="UTF-8">
        <title>SnapScan - ${type.toUpperCase()}LISTE</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
        </style>
    </head>
    <body>
    <h1>SnapScan - ${type.toUpperCase()}LISTE</h1>
        <p>Eksportdato: ${new Date().toLocaleString('nb-NO')}</p>

        <div class="summary">
            <h2>Sammendrag</h2>
            <p>Total antall varer: ${summary.totalItems}</p>
            <p>Fullførte varer: ${summary.completedItems}</p>
            <p>Total vekt: ${summary.totalWeight} kg</p>
        </div>

        <h2>Varedetaljer</h2>
        <table>
            <thead>
                <tr>
                    <th>Varenummer</th>
                    <th>Beskrivelse</th>
                    <th>Antall</th>
                    <th>Vekt (pr. enhet)</th>
                    ${type === 'plukk' ? '<th>Plukket</th>' : ''}
                    ${type === 'mottak' ? '<th>Mottatt</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td>${item.id}</td>
                        <td>${item.description}</td>
                        <td>${item.quantity || 1}</td>
                        <td>${(item.weight || 0).toFixed(2)} kg</td>
                        ${type === 'plukk' ? `<td>${item.picked ? 'Ja' : 'Nei'}</td>` : ''}
                        ${type === 'mottak' ? `<td>${item.received ? 'Ja' : 'Nei'}</td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
}

/**
 * Utvidet eksportfunksjon med støtte for PDF
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @param {string} format - Eksportformat (json, csv, txt, html, pdf)
 */
export function exportWithFormat(items, type, format) {
    if (format.toLowerCase() === 'pdf') {
        exportToPDF(items, type);
    } else {
        exportList(items, type, format);
    }
}