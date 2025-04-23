// import-export.js - Håndtering av import og eksport
import { appState } from '../app.js';
import { showToast, formatDate } from './utils.js';
import { saveListsToStorage, saveBarcodeMapping } from './storage.js';
import { generatePDF, generatePDFFilename } from './pdf-export.js';

/**
 * Importerer data fra CSV/TXT fil
 * @param {string} content - Filinnhold
 * @param {string} fileName - Filnavn
 * @param {string} type - Type import (pick, receive)
 */
export function importFromCSV(content, fileName, type) {
    // Sjekk om innholdet ligner på formatet fra PDF-en
    const isPDFFormat = content.includes('Varenr.') && content.includes('Beskrivelse') && content.includes('Bestilt');
    
    // Velg riktig delimiter basert på innholdet
    const delimiter = content.includes(';') ? ';' : ',';
    const lines = content.split('\n');
    
    // Nullstill listene
    if (type === 'pick') {
        appState.pickListItems = [];
        appState.pickedItems = [];
        appState.lastPickedItem = null;
    } else if (type === 'receive') {
        appState.receiveListItems = [];
        appState.receivedItems = [];
        appState.lastReceivedItem = null;
    }
    
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
                
                const newItem = {
                    id: id,
                    description: description,
                    quantity: quantity,
                    weight: weight
                };
                
                if (type === 'pick') {
                    newItem.picked = false;
                    newItem.pickedAt = null;
                    newItem.pickedCount = 0;
                    appState.pickListItems.push(newItem);
                } else if (type === 'receive') {
                    newItem.received = false;
                    newItem.receivedAt = null;
                    newItem.receivedCount = 0;
                    appState.receiveListItems.push(newItem);
                }
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
                
                const newItem = {
                    id: id,
                    description: description,
                    quantity: quantity,
                    weight: weight
                };
                
                if (type === 'pick') {
                    newItem.picked = false;
                    newItem.pickedAt = null;
                    newItem.pickedCount = 0;
                    appState.pickListItems.push(newItem);
                } else if (type === 'receive') {
                    newItem.received = false;
                    newItem.receivedAt = null;
                    newItem.receivedCount = 0;
                    appState.receiveListItems.push(newItem);
                }
            }
        }
    }
    
    // Vis tilbakemelding til brukeren
    showToast(`Importert liste med ${type === 'pick' ? appState.pickListItems.length : appState.receiveListItems.length} varer!`, 'success');
}

/**
 * Importerer data fra JSON-fil
 * @param {string} content - Filinnhold
 * @param {string} fileName - Filnavn
 * @param {string} type - Type import (pick, receive, barcode)
 */
export function importFromJSON(content, fileName, type) {
    try {
        const data = JSON.parse(content);
        
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
            
            if (type === 'pick') {
                // Nullstill plukklisten
                appState.pickListItems = [];
                appState.pickedItems = [];
                appState.lastPickedItem = null;
                
                // Legg til plukk-spesifikke felt
                appState.pickListItems = items.map(item => ({
                    ...item,
                    picked: false,
                    pickedAt: null,
                    pickedCount: 0
                }));
                
                showToast(`Importert ${items.length} varer til plukklisten!`, 'success');
            } else if (type === 'receive') {
                // Nullstill mottakslisten
                appState.receiveListItems = [];
                appState.receivedItems = [];
                appState.lastReceivedItem = null;
                
                // Legg til mottak-spesifikke felt
                appState.receiveListItems = items.map(item => ({
                    ...item,
                    received: false,
                    receivedAt: null,
                    receivedCount: 0
                }));
                
                showToast(`Importert ${items.length} varer til mottakslisten!`, 'success');
            }
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
 * @param {string} type - Type import (pick, receive)
 * @returns {Promise} Løftebasert resultat av importeringen
 */
export async function importFromPDF(file, type) {
    try {
        showToast('Leser PDF-fil...', 'info');
        
        // Sjekk at nødvendige DOM-elementer eksisterer før vi fortsetter
        const fileInfoElement = type === 'pick' ? 
            document.getElementById('pickFileInfo') : 
            document.getElementById('receiveFileInfo');
            
        if (!fileInfoElement) {
            console.error(`FileInfo-element for type ${type} finnes ikke`);
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
        if (type === 'pick') {
            appState.pickListItems = [];
            appState.pickedItems = [];
            appState.lastPickedItem = null;
        } else if (type === 'receive') {
            appState.receiveListItems = [];
            appState.receivedItems = [];
            appState.lastReceivedItem = null;
        }
        
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
        
        // Bruk parseProductLinesWithFallback-funksjonen for å identifisere produkter
        console.log('Starter parsing av produktlinjer...');
        const parsedItems = parseProductLinesFromPDF(allTextLines);
        console.log(`Identifisert ${parsedItems.length} produkter fra PDF-en`);
        
        // Legg til de nødvendige feltene basert på type
        let items = [];
        if (type === 'pick') {
            items = parsedItems.map(item => ({
                ...item,
                weight: appState.itemWeights[item.id] || appState.settings.defaultItemWeight,
                picked: false,
                pickedAt: null,
                pickedCount: 0
            }));
            
            appState.pickListItems = items;
            
            // Oppdater UI
            fileInfoElement.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
        } else if (type === 'receive') {
            items = parsedItems.map(item => ({
                ...item,
                weight: appState.itemWeights[item.id] || appState.settings.defaultItemWeight,
                received: false,
                receivedAt: null,
                receivedCount: 0
            }));
            
            appState.receiveListItems = items;
            
            // Oppdater UI
            fileInfoElement.textContent = `Lastet inn: ${file.name} (${items.length} varer)`;
        }
        
        if (items.length > 0) {
            showToast(`Importert ${items.length} varer fra PDF!`, 'success');
        } else {
            throw new Error('Ingen varer funnet i PDF-en. Prøv å importere som CSV i stedet.');
        }
        
        // Lagre endringer til localStorage
        saveListsToStorage();
        
        return { success: true, itemCount: items.length };
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
    
    // Legg til denne linjen for å returnere produktene
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
    if (type === 'retur') headers.push('Tilstand'); // Ny kolonne for retur

    // Legg til CSS-klasser for tilstandsfarger
    const conditionColors = {
        'uåpnet': 'background-color: rgba(76, 175, 80, 0.1);', // Grønn
        'åpnet': 'background-color: rgba(255, 193, 7, 0.1);', // Gul
        'skadet': 'background-color: rgba(244, 67, 54, 0.1);'  // Rød
    };

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
        if (type === 'retur') {
            const condition = item.condition || 'uåpnet';
            row.push(condition);

            // Legg til farge for tilstand
            const colorStyle = conditionColors[condition] || '';
            row.push(colorStyle);
        }

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
        if (type === 'retur') {
            txt += `  Tilstand: ${item.condition || 'uåpnet'}\n`;  // Legg til tilstand for returvarer
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
            /* Tilstand-fargekoding */
            .unopened { background-color: rgba(76, 175, 80, 0.1); }
            .opened { background-color: rgba(255, 193, 7, 0.1); }
            .damaged { background-color: rgba(244, 67, 54, 0.1); }
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
                    ${type === 'retur' ? '<th>Tilstand</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${items.map(item => {
                    // Bestem CSS-klasse basert på tilstand hvis dette er en returliste
                    let rowClass = '';
                    if (type === 'retur' && item.condition) {
                        if (item.condition === 'uåpnet') rowClass = 'unopened';
                        else if (item.condition === 'åpnet') rowClass = 'opened';
                        else if (item.condition === 'skadet') rowClass = 'damaged';
                    }
                    
                    return `
                    <tr class="${rowClass}">
                        <td>${item.id}</td>
                        <td>${item.description}</td>
                        <td>${item.quantity || 1}</td>
                        <td>${(item.weight || 0).toFixed(2)} kg</td>
                        ${type === 'plukk' ? `<td>${item.picked ? 'Ja' : 'Nei'}</td>` : ''}
                        ${type === 'mottak' ? `<td>${item.received ? 'Ja' : 'Nei'}</td>` : ''}
                        ${type === 'retur' ? `<td>${item.condition || 'uåpnet'}</td>` : ''}
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
}

/**
 * Eksporterer liste til PDF-format
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @param {Object} options - Alternativer for PDF-generering
 */
export async function exportToPDF(items, type, options = {}) {
    if (!items || items.length === 0) {
        showToast('Ingen varer å eksportere!', 'warning');
        return;
    }
    
    try {
        showToast('Genererer PDF...', 'info');
        
        // Generer PDF
        const pdfBlob = await generatePDF(items, type, options);
        const fileName = generatePDFFilename(type);
        
        // Last ned PDF
        const url = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Rydd opp
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast(`Liste eksportert som ${fileName}!`, 'success');
    } catch (error) {
        console.error('Feil ved eksport til PDF:', error);
        showToast('Kunne ikke generere PDF. ' + error.message, 'error');
    }
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

// Legg til i import-export.js

/**
 * Importerer data fra kvittering-PDF fra Kvik følgeseddel
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

// Oppdatert funksjon for processKvikReceiptLines i import-export.js

/**
 * Prosesserer linjer fra Kvik følgeseddel-PDF
 * @param {Array<string>} lines - Tekstlinjer fra PDF
 * @returns {Array<Object>} Array med vareposter
 */
function processKvikReceiptLines(lines) {
    const items = [];
    const seenProductIds = new Set(); // For å unngå duplikater
    
    try {
        // Sjekk om dette er en Kvik følgeseddel
        const isKvikReceipt = lines.some(line => 
            line.includes('Kvik') && (line.includes('Følgeseddel') || line.includes('ordrenummer'))
        );
        
        if (!isKvikReceipt) {
            console.warn('Dette ser ikke ut som en Kvik følgeseddel');
            return [];
        }
        
        console.log("Dokumentet er gjenkjent som Kvik følgeseddel");
        
        // Find tabellhode for å identifisere kolonnene
        let tableHeaderIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Varenummer') && 
                lines[i].includes('Beskrivelse') && 
                lines[i].includes('Bestilt') && 
                lines[i].includes('Plukket')) {
                tableHeaderIndex = i;
                break;
            }
        }
        
        if (tableHeaderIndex === -1) {
            console.warn('Kunne ikke finne tabellhode i Kvik følgeseddel');
        }
        
        // Finn rader som er vareposter i tabellformat
        let currentPalleId = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip tomme linjer eller for korte linjer
            if (!line || line.length < 3) continue;
            
            // Sjekk etter Palle ID format (9-sifret nummer alene på en linje)
            if (/^\d{9}$/.test(line)) {
                currentPalleId = line;
                console.log(`Fant Palle ID: ${currentPalleId}`);
                continue;
            }
            
            // Hop over linjer med bank/kontoinformasjon og andre metadata
            if (line.includes('NDEANOKK') || 
                line.includes('NO3960210700601') || 
                line.includes('kontonummer') || 
                line.includes('info@kvik.com') || 
                line.includes('Nordea') ||
                line.includes('IBAN') ||
                line.includes('BIC') ||
                line.includes('Telefonnr') ||
                line.includes('Organisasjonsnr') ||
                line.includes('Bank:') ||
                line.includes('E-post:') ||
                line.includes('Side') ||
                line.includes('Varenummer') ||
                line.includes('Paller:')) {
                continue;
            }
            
            // Identifiser produktlinjer basert på et produktkode-mønster
            const productPatterns = [
                /^\d{3}-[A-Z][A-Z0-9]+-\d+/, // 000-XX-000 format
                /^\d{3}-[A-Z][A-Z0-9]+/,     // 000-XX format
                /^[0-9]{3}-[A-Z0-9]/,        // 000-X format
                /^[A-Z]{2}\d{5}/,           // XX00000 format
                /^BP\d{5}/,                 // BP00000 format
                /^HV\d{1,2}(-\d+)?/,        // HV00 eller HV00-000 format
                /^HV\d{2,5}/,               // HV0000 format
                /^[A-Z0-9]+-[A-Z0-9]+/,     // XX-YY format
                /^[A-Z]\d{4,5}/,            // X0000 format
                /^ID\d{5}/,                 // ID00000 format
                /^IB\d{5}/,                 // IB00000 format
                /^IP\d{5,6}/,               // IP00000 format
                /^K\d{5}/,                  // K00000 format
                /^SB\d{5}/,                 // SB00000 format
                /^\d{3}-[A-Z]/,             // 000-X format
                /^\d{3}-[TDKOU]/,           // 000-T format
                /^[A-Z]{1,3}\d{4,5}/        // XX0000 format
            ];
            
            // Finn produkt-ID på starten av linjen
            let productId = null;
            for (const pattern of productPatterns) {
                const match = line.match(pattern);
                if (match && match.index === 0) { // Starter på starten av linjen
                    productId = match[0];
                    break;
                }
            }
            
            // Hvis vi fant en produkt-ID
            if (productId) {
                // Skip spesielle linjer
                if (line.includes('Paller:') || /^\d{9}, \d{9}/.test(line)) {
                    continue;
                }
                
                // Unngå å tolke palle-ID-linjer og tall alene som produkter
                if (/^\d{9}$/.test(productId) || /^\d{1,3}$/.test(productId)) {
                    continue;
                }
                
                // Unngå duplikater av samme produkt-ID, men tillat samme vare på forskjellige paller
                const productKey = `${productId}-${currentPalleId || 'default'}`;
                if (seenProductIds.has(productKey)) {
                    continue;
                }
                
                // VIKTIG ENDRING: Forbedret søk etter antall i linjen
                let bestilt = 1; // Standard antall hvis ikke spesifisert
                let beskrivelse = '';
                
                // Fjern produkt-ID fra starten av linjen
                let remainingLine = line.substring(productId.length).trim();
                
                // Søk etter antall og status-tall på slutten av linjen
                // Typisk format: "Beskrivelse  3  3  0" (bestilt, plukket, gjenstående)
                const numberPattern = /(\d+)\s+(\d+)\s+(\d+)$/;
                const numbersMatch = remainingLine.match(numberPattern);
                
                if (numbersMatch) {
                    // VIKTIG: Korrekt utpakking av tallene
                    bestilt = parseInt(numbersMatch[1], 10);
                    const plukket = parseInt(numbersMatch[2], 10);
                    const gjenstaaende = parseInt(numbersMatch[3], 10);
                    
                    // Verifiser at tallene gir mening (bestilt = plukket + gjenstående)
                    if (bestilt !== plukket + gjenstaaende) {
                        console.warn(`Misforhold i tall for ${productId}: Bestilt=${bestilt}, Plukket=${plukket}, Gjenstående=${gjenstaaende}`);
                    }
                    
                    // Beskrivelsen er alt mellom produkt-ID og tallene
                    const endOfDescIndex = remainingLine.lastIndexOf(numbersMatch[0]);
                    beskrivelse = remainingLine.substring(0, endOfDescIndex).trim();
                } else {
                    // Alternativ metode for å finne antall
                    // Søk etter tall på slutten av linjen eller i neste linje
                    const singleNumberMatch = remainingLine.match(/(\d+)$/);
                    if (singleNumberMatch) {
                        bestilt = parseInt(singleNumberMatch[1], 10);
                        beskrivelse = remainingLine.substring(0, remainingLine.lastIndexOf(singleNumberMatch[0])).trim();
                    } else {
                        // Hvis ingen tall på denne linjen, prøv neste linje
                        if (i + 1 < lines.length) {
                            const nextLine = lines[i + 1].trim();
                            // Søk etter tall på neste linje
                            const nextLineNumberMatch = nextLine.match(/^(\d+)$/);
                            if (nextLineNumberMatch) {
                                bestilt = parseInt(nextLineNumberMatch[1], 10);
                                i++; // Hopp over neste linje
                            }
                        }
                        
                        // Bruk resten av linjen som beskrivelse
                        beskrivelse = remainingLine;
                    }
                }
                
                // Hvis beskrivelsen fortsatt er tom, forsøk å finne en i nærliggende linjer
                if (!beskrivelse || beskrivelse.length < 3) {
                    // Søk i neste linje
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        // Sjekk at neste linje ikke er et nytt produkt
                        if (!nextLine.match(/^\d{3}-[A-Z]/) && !nextLine.match(/^[A-Z]{2}\d{5}/)) {
                            beskrivelse = nextLine;
                            i++; // Hopp over neste linje
                        }
                    }
                }
                
                // Hvis beskrivelsen fortsatt er tom, søk i hele dokumentet
                if (!beskrivelse || beskrivelse.length < 3) {
                    for (let j = 0; j < lines.length; j++) {
                        if (j !== i && lines[j].includes(productId)) {
                            const otherDesc = lines[j].substring(lines[j].indexOf(productId) + productId.length).trim();
                            if (otherDesc.length > beskrivelse.length) {
                                beskrivelse = otherDesc.replace(/\d+\s+\d+\s+\d+$/, '').trim();
                                break;
                            }
                        }
                    }
                }
                
                // Fallback til produktID hvis ingen beskrivelse er funnet
                if (!beskrivelse || beskrivelse.length < 3) {
                    beskrivelse = `Vare ${productId}`;
                }
                
                // Trim long descriptions to avoid UI issues
                if (beskrivelse.length > 100) {
                    beskrivelse = beskrivelse.substring(0, 97) + '...';
                }
                
                // Opprett varen og legg til i listen med korrekt antall
                if (productId && bestilt > 0) {
                    items.push({
                        id: productId,
                        description: beskrivelse,
                        quantity: bestilt, // VIKTIG: Her bruker vi det korrekte antallet
                        weight: appState.itemWeights[productId] || appState.settings.defaultItemWeight,
                        received: false,
                        receivedAt: null,
                        receivedCount: 0,
                        palleId: currentPalleId
                    });
                    
                    seenProductIds.add(productKey);
                    console.log(`Importert produkt: ${productId}, Beskrivelse: ${beskrivelse}, Antall: ${bestilt}`);
                }
            }
        }
        
        console.log(`Ferdig med å behandle følgeseddel. Fant ${items.length} produkter.`);
        
        // Return sorted items for better UX
        return items.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
        console.error('Feil under parsing av Kvik følgeseddel:', error);
        return items; // Returner det vi har så langt
    }
}

/**
 * Behandler linjer fra mottaksliste-PDF
 * @param {Array<string>} lines - Tekstlinjer fra PDF
 * @returns {Array<Object>} Array med vareposter
 */
function processReceiptLines(lines) {
    const items = [];
    let currentPalleId = null;
    
    // Finn "Følgeseddel" eller lignende for å identifisere dokumentet
    const isReceiptDocument = lines.some(line => 
        line.includes('Følgeseddel') || 
        line.includes('Kvik ordrenummer') ||
        line.includes('Palle id')
    );
    
    if (!isReceiptDocument) {
        console.warn('Dette ser ikke ut som en mottaksliste/følgeseddel');
    }
    
    // Finn linjer som starter med "Palle id"
    const palleIdHeader = lines.findIndex(line => line.includes('Palle id'));
    if (palleIdHeader === -1) {
        console.warn('Fant ikke "Palle id" i dokumentet, bruker standard format');
    }
    
    // Finn alle paller og deres varer
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Sjekk om dette er en palle-id linje (tom celle for palle-id indikerer samme palle)
        if (line.match(/^\d{9,}$/)) {
            currentPalleId = line;
            continue;
        }
        
        // Sjekk om dette er en ordentlig varelinje
        // Vi ser etter et mønster med varenummer, beskrivelse, bestilt, plukket og gjenstående
        const lineMatch = line.match(/^(\d{3}-[A-Z0-9]+-\d+|[A-Z]{2}\d{5}|[A-Z0-9-]+)\s(.+?)\s(\d+)\s(\d+)\s(\d+)$/);
        
        if (lineMatch) {
            const varenummer = lineMatch[1];
            const beskrivelse = lineMatch[2].trim();
            const bestilt = parseInt(lineMatch[3]);
            const plukket = parseInt(lineMatch[4]);
            const gjenstående = parseInt(lineMatch[5]);
            
            // Sjekk at tallene gir mening (bestilt = plukket + gjenstående)
            if (bestilt === plukket + gjenstående) {
                items.push({
                    id: varenummer,
                    description: beskrivelse,
                    quantity: bestilt,
                    weight: appState.itemWeights[varenummer] || appState.settings.defaultItemWeight,
                    received: plukket === bestilt,
                    receivedAt: plukket === bestilt ? new Date() : null,
                    receivedCount: plukket,
                    palleId: currentPalleId
                });
            }
        }
        // Sekundær sjekk for annet format som ikke har bestilt/plukket/gjenstående tall
        else {
            const simpleMatch = line.match(/^(\d{3}-[A-Z0-9]+-\d+|[A-Z]{2}\d{5}|[A-Z0-9-]+)\s(.+?)$/);
            if (simpleMatch) {
                const varenummer = simpleMatch[1];
                const beskrivelse = simpleMatch[2].trim();
                
                // Se etter tall i neste linje
                if (i+1 < lines.length && /^\d+$/.test(lines[i+1].trim())) {
                    const antall = parseInt(lines[i+1].trim());
                    i++; // Hopp over antallslinjen
                    
                    items.push({
                        id: varenummer,
                        description: beskrivelse,
                        quantity: antall,
                        weight: appState.itemWeights[varenummer] || appState.settings.defaultItemWeight,
                        received: false,
                        receivedAt: null,
                        receivedCount: 0,
                        palleId: currentPalleId
                    });
                }
            }
        }
    }
    
    return items;
}