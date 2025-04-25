// pdf-export.js - PDF eksport funksjonalitet med jsPDF
import { formatDate } from './utils.js';
import { appState } from '../app.js';
import { showToast } from './utils.js';

/**
 * Genererer en PDF for plukkliste eller annen liste med utvidet statistikk
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @param {Object} options - Ekstra alternativer for PDF-generering
 * @returns {Object} Blob med PDF-fil
 */
export async function generatePDF(items, type, options = {}) {
    // Sørg for at vi har jsPDF tilgjengelig
    if (typeof jspdf === 'undefined') {
        await loadJsPDF();
    }
    
    // Standardverdier for alternativer
    const defaultOptions = {
        title: `${capitalizeFirstLetter(type)}liste`,
        subtitle: '',
        exportDate: new Date(),
        logo: null,
        showStatus: true,
        pageSize: 'a4',
        pageOrientation: 'portrait',
        showProgressBar: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Opprett nytt PDF-dokument
    const doc = new jspdf.jsPDF({
        orientation: settings.pageOrientation,
        unit: 'mm',
        format: settings.pageSize
    });
    
    // Sett opp standardfonter
    doc.setFont('helvetica');
    
    // Marger
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const contentWidth = pageWidth - 2 * margin;
    
    // Sidetall-funksjon
    const addPageNumbers = () => {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Side ${i} av ${totalPages}`, pageWidth - margin - 25, pageHeight - margin);
        }
    };
    
    // Legg til overskrift
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.title, margin, margin + 5);
    
    // Legg til undertittel hvis angitt
    if (settings.subtitle) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.subtitle, margin, margin + 12);
    }
    
    // Legg til eksportdato
    doc.setFontSize(10);
    doc.setTextColor(100);
    const exportDateString = formatDate(settings.exportDate);
    doc.text(`Dato: ${exportDateString}`, margin, margin + 20);
    
    // Beregn sammendrag med utvidet statistikk
    const summary = calculateSummary(items, type);
    
    // Legg til sammendrag
    let metadataY = margin + 30;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Sammendrag:', margin, metadataY);
    doc.setFont('helvetica', 'normal');
    metadataY += 7;
    doc.text(`Antall varelinjer: ${summary.totalItems}`, margin, metadataY);
    
    if (settings.showStatus) {
        metadataY += 7;
        
        // Vis detaljert ferdigstillingsstatus
        const statusText = getStatusText(type);
        const statusMessage = `${statusText}: ${summary.completedItems} fullstendig, ${summary.partiallyCompletedItems} delvis, ${summary.uncompletedItems} ikke startet`;
        doc.text(statusMessage, margin, metadataY);
        
        // Vis enheter prosessert
        metadataY += 7;
        doc.text(`Enheter: ${summary.processedUnits} av ${summary.totalUnits} prosessert (${summary.percentComplete}%)`, margin, metadataY);
        
        // Legg til fremdriftslinje hvis aktivert
        if (settings.showProgressBar) {
            metadataY += 7;
            
            // Tegn bakgrunn for fremdriftslinje
            const progressBarWidth = 100; // 100mm
            const progressBarHeight = 5; // 5mm
            doc.setFillColor(240, 240, 240);
            doc.roundedRect(margin, metadataY, progressBarWidth, progressBarHeight, 1, 1, 'F');
            
            // Tegn fyllt del av fremdriftslinje
            const fillWidth = (summary.percentComplete / 100) * progressBarWidth;
            
            // Velg farge basert på fremdrift
            if (summary.percentComplete < 25) {
                doc.setFillColor(244, 67, 54); // Rød
            } else if (summary.percentComplete < 75) {
                doc.setFillColor(255, 152, 0); // Oransje
            } else {
                doc.setFillColor(76, 175, 80); // Grønn
            }
            
            doc.roundedRect(margin, metadataY, fillWidth, progressBarHeight, 1, 1, 'F');
            
            // Legg til prosentvis tekst i fremdriftslinjen
            doc.setFontSize(8);
            doc.setTextColor(0);
            const percentText = `${summary.percentComplete}%`;
            const textWidth = doc.getTextWidth(percentText);
            const textX = margin + (progressBarWidth / 2) - (textWidth / 2);
            const textY = metadataY + 3.5;
            
            // Sett kontrast tekst basert på fremdrift
            doc.setTextColor(0, 0, 0); // Svart tekst som standard
            doc.text(percentText, textX, textY);
            
            metadataY += progressBarHeight; // Legg til høyden på fremdriftslinjen
        }
    }
    
    metadataY += 7;
    doc.text(`Total vekt: ${summary.totalWeight.toFixed(2)} kg`, margin, metadataY);
    
    // Legg til metadata fra ordre hvis tilgjengelig
    if (options.ordrenr || options.kundenavn || options.selger) {
        metadataY += 10;
        doc.setFont('helvetica', 'bold');
        doc.text(`Ordreinfo:`, margin, metadataY);
        doc.setFont('helvetica', 'normal');
        
        if (options.ordrenr) {
            metadataY += 7;
            doc.text(`Ordrenr: ${options.ordrenr}`, margin, metadataY);
        }
        
        if (options.kundenavn) {
            metadataY += 7;
            doc.text(`Kunde: ${options.kundenavn}`, margin, metadataY);
        }
        
        if (options.selger) {
            metadataY += 7;
            doc.text(`Selger: ${options.selger}`, margin, metadataY);
        }
        
        if (options.jobbeskrivelse) {
            metadataY += 7;
            doc.text(`Jobbeskrivelse: ${options.jobbeskrivelse}`, margin, metadataY);
        }
    }
    
    // Legg til en skillelinje
    metadataY += 10;
    doc.setDrawColor(200);
    doc.line(margin, metadataY, pageWidth - margin, metadataY);
    
    // Legg til tabell
    const headers = getTableHeaders(type);
    const data = formatTableData(items, type);
    
    // Kalkuler kolonnestørrelser basert på innhold
    const columnWidths = calculateColumnWidths(headers, data, contentWidth);
    
    // Start y-posisjon for tabellen
    let tableY = metadataY + 5;
    
    // Tegn tabellhodet
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, tableY, contentWidth, 10, 'F');
    
    // Tegn kolonneoverskrifter
    doc.setTextColor(0);
    doc.setFontSize(9);
    
    let xOffset = margin;
    headers.forEach((header, index) => {
        doc.text(header, xOffset + 2, tableY + 6);
        xOffset += columnWidths[index];
    });
    
    tableY += 10;
    
    // Tegn tabelldata med vekslende bakgrunnsfarger
    doc.setFont('helvetica', 'normal');
    
    const rowHeight = 8;
    
    // Tegn tabellrader
    for (let i = 0; i < data.length; i++) {
        // Sjekk om vi trenger ny side
        if (tableY + rowHeight > pageHeight - margin) {
            doc.addPage();
            tableY = margin;
            
            // Tegn kolonneoverskrifter på ny side
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, tableY, contentWidth, 10, 'F');
            
            doc.setFont('helvetica', 'bold');
            xOffset = margin;
            headers.forEach((header, index) => {
                doc.text(header, xOffset + 2, tableY + 6);
                xOffset += columnWidths[index];
            });
            
            doc.setFont('helvetica', 'normal');
            tableY += 10;
        }
        
        // Tegn rad med alternerende bakgrunnsfarge
        if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, tableY, contentWidth, rowHeight, 'F');
        }
        
        // Tegn celleinnhold
        xOffset = margin;
        
        // Spesiell håndtering for status-styling
        const statusIndex = data[i].length - 2; // Status tekst er nest siste element
        const statusClassIndex = data[i].length - 1; // Status klasse er siste element
        const statusClass = data[i][statusClassIndex];
        
        for (let j = 0; j < data[i].length - 1; j++) { // -1 for å hoppe over statusClass
            // Spesiell formatering for status-kolonne
            if (j === statusIndex && settings.showStatus) {
                const statusText = data[i][j];
                const lastColX = xOffset;
                const lastColWidth = columnWidths[j];
                
                // Tegn fargede bokser for status basert på klasse
                if (statusClass === 'status-ja') {
                    // Grønn boks for "Ja"
                    doc.setFillColor(76, 175, 80); // #4CAF50
                    doc.setTextColor(255, 255, 255); // Hvit tekst
                    
                    // Tegn boks som dekker 80% av bredden og er sentrert
                    const boxWidth = lastColWidth * 0.8;
                    const boxX = lastColX + (lastColWidth - boxWidth) / 2;
                    doc.roundedRect(boxX, tableY + 1, boxWidth, rowHeight - 2, 1, 1, 'F');
                    
                    // Tegn tekst sentrert i boksen
                    doc.setFont('helvetica', 'bold');
                    const textWidth = doc.getTextWidth(statusText);
                    doc.text(statusText, boxX + (boxWidth/2) - (textWidth/2), tableY + 5.5);
                    doc.setFont('helvetica', 'normal');
                    
                } else if (statusClass === 'status-delvis') {
                    // Oransje boks for "Delvis"
                    doc.setFillColor(255, 152, 0); // #FF9800
                    doc.setTextColor(255, 255, 255); // Hvit tekst
                    
                    // Tegn boks som dekker 80% av bredden og er sentrert
                    const boxWidth = lastColWidth * 0.8;
                    const boxX = lastColX + (lastColWidth - boxWidth) / 2;
                    doc.roundedRect(boxX, tableY + 1, boxWidth, rowHeight - 2, 1, 1, 'F');
                    
                    // Tegn tekst sentrert i boksen
                    doc.setFont('helvetica', 'bold');
                    const textWidth = doc.getTextWidth(statusText);
                    doc.text(statusText, boxX + (boxWidth/2) - (textWidth/2), tableY + 5.5);
                    doc.setFont('helvetica', 'normal');
                    
                } else if (statusClass === 'status-nei') {
                    // Rød boks for "Nei"
                    doc.setFillColor(244, 67, 54); // #F44336
                    doc.setTextColor(255, 255, 255); // Hvit tekst
                    
                    // Tegn boks som dekker 80% av bredden og er sentrert
                    const boxWidth = lastColWidth * 0.8;
                    const boxX = lastColX + (lastColWidth - boxWidth) / 2;
                    doc.roundedRect(boxX, tableY + 1, boxWidth, rowHeight - 2, 1, 1, 'F');
                    
                    // Tegn tekst sentrert i boksen
                    doc.setFont('helvetica', 'bold');
                    const textWidth = doc.getTextWidth(statusText);
                    doc.text(statusText, boxX + (boxWidth/2) - (textWidth/2), tableY + 5.5);
                    doc.setFont('helvetica', 'normal');
                    
                } else {
                    // For returmodulen: Fargekoding basert på tilstand
                    if (type === 'retur') {
                        const condition = statusText.toLowerCase();
                        
                        if (condition === 'uåpnet') {
                            // Grønn boks for "Uåpnet"
                            doc.setFillColor(76, 175, 80, 0.8);
                            doc.setTextColor(255, 255, 255);
                        } else if (condition === 'åpnet') {
                            // Gul boks for "Åpnet"
                            doc.setFillColor(255, 193, 7, 0.8);
                            doc.setTextColor(0, 0, 0);
                        } else if (condition === 'skadet') {
                            // Rød boks for "Skadet"
                            doc.setFillColor(244, 67, 54, 0.8);
                            doc.setTextColor(255, 255, 255);
                        } else {
                            // Standard visning
                            doc.setTextColor(0);
                            doc.text(statusText, xOffset + 2, tableY + 5.5);
                            // Hopp til neste kolonne
                            xOffset += columnWidths[j];
                            continue;
                        }
                        
                        // Tegn boks for tilstand
                        const boxWidth = lastColWidth * 0.8;
                        const boxX = lastColX + (lastColWidth - boxWidth) / 2;
                        doc.roundedRect(boxX, tableY + 1, boxWidth, rowHeight - 2, 1, 1, 'F');
                        
                        // Tegn tekst sentrert i boksen
                        doc.setFont('helvetica', 'bold');
                        const textWidth = doc.getTextWidth(statusText);
                        doc.text(statusText, boxX + (boxWidth/2) - (textWidth/2), tableY + 5.5);
                        doc.setFont('helvetica', 'normal');
                    } else {
                        // Standard visning for andre verdier
                        doc.setTextColor(0);
                        doc.text(statusText, xOffset + 2, tableY + 5.5);
                    }
                }
            } else {
                // Vanlig tekstrendering for andre kolonner
                doc.setTextColor(0);
                doc.text(data[i][j], xOffset + 2, tableY + 5.5);
            }
            
            // Flytt til neste kolonne
            xOffset += columnWidths[j];
        }
        
        tableY += rowHeight;
    }
    
    // Tegn ramme rundt tabellen
    doc.setDrawColor(200);
    doc.rect(margin, metadataY + 5, contentWidth, tableY - (metadataY + 5), 'S');
    
    // Legg til vertikale skillelinjer i tabellen
    let lineX = margin;
    for (let i = 0; i < columnWidths.length - 1; i++) {
        lineX += columnWidths[i];
        doc.line(lineX, metadataY + 5, lineX, tableY);
    }
    
    // Legg til horisontale skillelinjer for hver rad
    for (let i = 0; i <= data.length; i++) {
        const lineY = metadataY + 5 + (i * rowHeight + (i === 0 ? 10 : 0));
        if (lineY < tableY) {
            doc.line(margin, lineY, margin + contentWidth, lineY);
        }
    }
    
    // Legg til notatlinje
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    tableY += 10;
    
    // Sjekk om vi trenger ny side for notater
    if (tableY + 25 > pageHeight - margin) {
        doc.addPage();
        tableY = margin + 10;
    }
    
    doc.text('Notater:', margin, tableY);
    
    // Tegn noen linjer for notater
    for (let i = 0; i < 3; i++) {
        const lineY = tableY + 6 + (i * 6);
        doc.setDrawColor(200);
        doc.line(margin, lineY, pageWidth - margin, lineY);
    }
    
    // Legg til sidetall
    addPageNumbers();
    
    // Legg til bunntekst med generert-info
    doc.setFontSize(7);
    doc.setTextColor(150);
    const userName = appState.user ? appState.user.name : 'ukjent bruker';
    doc.text(`Generert med SnapScan av ${userName}`, margin, pageHeight - margin);
    
    // Returner PDF som blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
}

/**
 * Eksporterer varer som PDF
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @param {Object} options - Ekstra alternativer for PDF-generering
 * @returns {Promise<void>}
 */
export async function exportPDF(items, type, options = {}) {
    try {
        // Generer PDF
        const pdfBlob = await generatePDF(items, type, options);
        
        // Opprett filnavn
        const today = options.exportDate || new Date();
        const dateStr = formatDate(today, 'YYYY_MM_DD_HH');
        
        // Hent brukernavn fra appState
        const userName = appState.user ? appState.user.name : 'ukjent';
        
        // Ekstraher kundenavn og ordrenummer fra originalt PDF-filnavn (hvis tilgjengelig)
        let customerName = '';
        let orderNumber = '';
        
        // Sjekk om det finnes en originalfil-referanse i DOM (f.eks. pickFileInfo)
        const fileInfoElement = type === 'plukk' ? 
            document.getElementById('pickFileInfo') : 
            document.getElementById('receiveFileInfo');
            
        if (fileInfoElement) {
            const fileInfoText = fileInfoElement.textContent || '';
            const pdfNameMatch = fileInfoText.match(/Lastet inn: (.+?)(?:\s\(\d+\s+varer\))?$/);
            
            if (pdfNameMatch && pdfNameMatch[1]) {
                // Originalfilnavn funnet
                const originalFilename = pdfNameMatch[1];
                console.log('Originalfilnavn funnet:', originalFilename);
                
                // Parsing av kundenavn og ordrenummer fra filnavn
                if (originalFilename.includes('Plukke_liste_') || originalFilename.includes('Plukkliste_')) {
                    // For filnavn med format: Kundenavn_Plukke_liste_Ordrenr_Dato
                    const splitPattern = originalFilename.includes('Plukke_liste_') ? 'Plukke_liste_' : 'Plukkliste_';
                    const parts = originalFilename.split(splitPattern);
                    
                    if (parts.length >= 2) {
                        // Kundenavn er den første delen
                        customerName = parts[0].replace(/_/g, ' ').trim();
                        
                        // Ordrenummer er starten av den andre delen frem til første underscore
                        const orderParts = parts[1].split('_');
                        if (orderParts.length >= 1) {
                            orderNumber = orderParts[0];
                        }
                    }
                }
            }
        }
        
        // Rens kundenavn for ugyldige filnavntegn
        customerName = customerName.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '_');
        
        // Generer filnavn med kundenavn, ordrenummer og bruker
        let filename = '';
        if (customerName && orderNumber) {
            filename = `${customerName}_${capitalizeFirstLetter(type)}_${orderNumber}_${userName}_${dateStr}.pdf`;
        } else if (customerName) {
            filename = `${customerName}_${capitalizeFirstLetter(type)}_${userName}_${dateStr}.pdf`;
        } else {
            filename = `${capitalizeFirstLetter(type)}_liste_${userName}_${dateStr}.pdf`;
        }
        
        // Sørg for at filnavnet ikke har ulovlige tegn
        filename = filename.replace(/\s+/g, '_');
        
        console.log(`Eksporterer med filnavn: ${filename}`);
        
        // Last ned PDF
        const url = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Rydd opp
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast(`${capitalizeFirstLetter(type)}liste eksportert som PDF`, 'success');
    } catch (error) {
        console.error('Feil ved eksport av PDF:', error);
        showToast('Kunne ikke eksportere PDF', 'error');
    }
}

/**
 * Genererer et filnavn for PDF-eksport
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @returns {string} Filnavn for PDF-eksporten
 */
export function generatePDFFilename(type) {
    const now = new Date();
    const dateStr = formatDate(now, 'YYYY_MM_DD_HH');
    
    // Hent brukernavn fra appState
    const userName = appState.user ? appState.user.name : 'ukjent';
    
    // Finn originalfilnavn fra DOM
    let customerName = '';
    let orderNumber = '';
    
    // Sjekk om det finnes en originalfil-referanse i DOM
    const fileInfoElement = type === 'plukk' ? 
        document.getElementById('pickFileInfo') : 
        document.getElementById('receiveFileInfo');
        
    if (fileInfoElement) {
        const fileInfoText = fileInfoElement.textContent || '';
        const pdfNameMatch = fileInfoText.match(/Lastet inn: (.+?)(?:\s\(\d+\s+varer\))?$/);
        
        if (pdfNameMatch && pdfNameMatch[1]) {
            // Originalfilnavn funnet
            const originalFilename = pdfNameMatch[1];
            console.log('Originalfilnavn funnet for filnavngenerering:', originalFilename);
            
            // Parsing av kundenavn og ordrenummer fra filnavn
            if (originalFilename.includes('Plukke_liste_') || originalFilename.includes('Plukkliste_')) {
                // For filnavn med format: Kundenavn_Plukke_liste_Ordrenr_Dato
                const splitPattern = originalFilename.includes('Plukke_liste_') ? 'Plukke_liste_' : 'Plukkliste_';
                const parts = originalFilename.split(splitPattern);
                
                if (parts.length >= 2) {
                    // Kundenavn er den første delen
                    customerName = parts[0].replace(/_/g, ' ').trim();
                    
                    // Ordrenummer er starten av den andre delen frem til første underscore
                    const orderParts = parts[1].split('_');
                    if (orderParts.length >= 1) {
                        orderNumber = orderParts[0];
                    }
                }
            }
        }
    }
    
    // Generer filnavn med kundenavn, ordrenummer og bruker
    let filename = '';
    if (customerName && orderNumber) {
        // Rens kundenavn for ugyldige filnavntegn og erstatt mellomrom med understrek
        customerName = customerName.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '_');
        customerName = customerName.replace(/\s+/g, '_');
        
        filename = `${customerName}_${capitalizeFirstLetter(type)}_${orderNumber}_${userName}_${dateStr}.pdf`;
    } else if (customerName) {
        // Rens kundenavn for ugyldige filnavntegn og erstatt mellomrom med understrek
        customerName = customerName.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '_');
        customerName = customerName.replace(/\s+/g, '_');
        
        filename = `${customerName}_${capitalizeFirstLetter(type)}_${userName}_${dateStr}.pdf`;
    } else if (orderNumber) {
        filename = `${capitalizeFirstLetter(type)}_${orderNumber}_${userName}_${dateStr}.pdf`;
    } else {
        filename = `${capitalizeFirstLetter(type)}liste_${dateStr}.pdf`;
    }
    
    console.log(`Genererer filnavn: ${filename}`);
    return filename;
}

/**
 * Laster jsPDF-biblioteket dynamisk hvis det ikke er lastet
 * @returns {Promise} Promise som løses når biblioteket er lastet
 */
function loadJsPDF() {
    return new Promise((resolve, reject) => {
        if (typeof jspdf !== 'undefined') {
            resolve();
            return;
        }
        
        // Last jsPDF fra CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Kunne ikke laste jsPDF-biblioteket.'));
        
        document.head.appendChild(script);
    });
}

/**
 * Beregner sammendrag for liste med utvidet statistikk
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @returns {Object} Utvidet sammendrag av listen
 */
function calculateSummary(items, type) {
    let totalItems = items.length;
    let totalWeight = 0;
    let completedItems = 0;
    let partiallyCompletedItems = 0;
    let uncompletedItems = 0;
    let totalUnits = 0;
    let processedUnits = 0;

    items.forEach(item => {
        const quantity = item.quantity || 1;
        const weight = item.weight || 0;
        
        totalUnits += quantity;
        totalWeight += quantity * weight;

        // Prosesserte enheter og status basert på type
        let processedCount = 0;
        let isCompleted = false;
        
        if (type === 'plukk') {
            processedCount = item.pickedCount || 0;
            isCompleted = item.picked || processedCount >= quantity;
        } else if (type === 'mottak') {
            processedCount = item.receivedCount || 0;
            isCompleted = item.received || processedCount >= quantity;
        } else if (type === 'retur') {
            processedCount = item.returnedCount || 0; 
            isCompleted = item.returned || processedCount >= quantity;
        }
        
        processedUnits += processedCount;
        
        // Kategorisering av varestatus
        if (isCompleted) {
            completedItems++;
        } else if (processedCount > 0) {
            partiallyCompletedItems++;
        } else {
            uncompletedItems++;
        }
    });

    // Beregn prosentvis ferdigstillelse
    const percentComplete = totalUnits > 0 ? Math.round((processedUnits / totalUnits) * 100) : 0;

    return {
        totalItems,
        completedItems,
        partiallyCompletedItems,
        uncompletedItems,
        totalWeight: parseFloat(totalWeight.toFixed(2)),
        totalUnits,
        processedUnits,
        percentComplete
    };
}

/**
 * Henter tabellkolonner basert på type
 * @param {string} type - Type liste
 * @returns {Array} Overskrifter for tabellkolonner
 */
function getTableHeaders(type) {
    const headers = ['Varenummer', 'Beskrivelse', 'Antall', 'Vekt (kg)'];
    
    if (type === 'plukk') {
        headers.push('Plukket');
    } else if (type === 'mottak') {
        headers.push('Mottatt');
    } else if (type === 'retur') {
        headers.push('Tilstand'); // Endret fra 'Returnert' til 'Tilstand'
    }
    
    return headers;
}

/**
 * Formaterer tabelldata fra varer
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @returns {Array} Formatert tabelldata
 */
function formatTableData(items, type) {
    // Definer fargekoding for tilstand
    const conditionColors = {
        'uåpnet': { text: 'Uåpnet', color: 'rgba(76, 175, 80, 0.1)' }, // Grønn
        'åpnet': { text: 'Åpnet', color: 'rgba(255, 193, 7, 0.1)' }, // Gul
        'skadet': { text: 'Skadet', color: 'rgba(244, 67, 54, 0.1)' }  // Rød
    };
    
    return items.map(item => {
        // Begrens beskrivelseslengden for bedre lesbarhet
        const maxDescLength = 60; // Juster dette etter behov
        let description = item.description;
        if (description && description.length > maxDescLength) {
            description = description.substring(0, maxDescLength) + '...';
        }
        
        const row = [
            item.id,
            description || 'Ukjent beskrivelse',
        ];
        
        // Sett riktig antallsformat basert på type
        if (type === 'retur') {
            // For retur viser vi bare antallet
            row.push(`${item.quantity}`);
        } else {
            // For plukk/mottak viser vi forhold mellom skannet og totalt
            const countField = type === 'plukk' ? 'pickedCount' : 'receivedCount';
            row.push(`${item[countField] || 0} / ${item.quantity}`);
        }
        
        // Legg til vekt
        row.push((item.weight * item.quantity).toFixed(2));
        
        // Legg til status basert på type
        if (type === 'plukk') {
            if (item.picked) {
                row.push('Ja');
                row.push('status-ja'); // Legg til klasse for styling
            } else if ((item.pickedCount || 0) > 0) {
                row.push(`Delvis (${item.pickedCount}/${item.quantity})`);
                row.push('status-delvis'); // Legg til klasse for styling
            } else {
                row.push('Nei');
                row.push('status-nei'); // Legg til klasse for styling
            }
        } else if (type === 'mottak') {
            if (item.received) {
                row.push('Ja');
                row.push('status-ja'); // Legg til klasse for styling
            } else if ((item.receivedCount || 0) > 0) {
                row.push(`Delvis (${item.receivedCount}/${item.quantity})`);
                row.push('status-delvis'); // Legg til klasse for styling
            } else {
                row.push('Nei');
                row.push('status-nei'); // Legg til klasse for styling
            }
        } else if (type === 'retur') {
            // For retur viser vi tilstanden i stedet for bare "Ja"
            const condition = item.condition || 'uåpnet';
            const conditionInfo = conditionColors[condition] || { text: condition, color: '' };
            row.push(conditionInfo.text);
            // For retur bruker vi ikke fargekoding på samme måte
        }
        
        return row;
    });
}

/**
 * Beregner kolonnestørrelser basert på innhold
 * @param {Array} headers - Kolonneoverskrifter
 * @param {Array} data - Tabelldata
 * @param {number} totalWidth - Total bredde tilgjengelig
 * @returns {Array} Kolonnestørrelser
 */
function calculateColumnWidths(headers, data, totalWidth) {
    // Standard kolonnestørrelser som prosentandeler - gi beskrivelseskolonnen mer plass
    const defaultWidths = [0.15, 0.45, 0.12, 0.13, 0.15]; // Beskrivelse får 45% av bredden
    
    // Konverter til faktiske bredder
    return defaultWidths.map(width => totalWidth * width);
}

/**
 * Få status-tekst basert på type
 * @param {string} type - Type liste
 * @returns {string} Status-tekst
 */
function getStatusText(type) {
    if (type === 'plukk') {
        return 'Plukkede varer';
    } else if (type === 'mottak') {
        return 'Mottatte varer';
    } else if (type === 'retur') {
        return 'Returnerte varer';
    }
    return 'Status';
}

/**
 * Gjør første bokstav stor
 * @param {string} text - Tekst
 * @returns {string} Tekst med stor forbokstav
 */
function capitalizeFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}