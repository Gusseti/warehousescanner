// pdf-export.js - PDF eksport funksjonalitet med jsPDF
import { formatDate } from './utils.js';

/**
 * Genererer en PDF for plukkliste eller annen liste
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
        pageOrientation: 'portrait'
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
    
    // Beregn sammendrag
    const summary = calculateSummary(items, type);
    
    // Legg til sammendrag
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('Sammendrag:', margin, margin + 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`Antall varer: ${summary.totalItems}`, margin, margin + 37);
    
    if (settings.showStatus) {
        const statusText = getStatusText(type);
        doc.text(`${statusText}: ${summary.completedItems} av ${summary.totalItems}`, margin, margin + 44);
    }
    
    doc.text(`Total vekt: ${summary.totalWeight.toFixed(2)} kg`, margin, margin + 51);
    
    // Legg til en skillelinje
    doc.setDrawColor(200);
    doc.line(margin, margin + 56, pageWidth - margin, margin + 56);
    
    // Legg til tabell
    const headers = getTableHeaders(type);
    const data = formatTableData(items, type);
    
    // Kalkuler kolonnestørrelser basert på innhold
    const columnWidths = calculateColumnWidths(headers, data, contentWidth);
    
    // Start y-posisjon for tabellen
    let tableY = margin + 60;
    
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
        for (let j = 0; j < data[i].length; j++) {
            // Spesiell formatering for status-kolonne
            if (j === data[i].length - 1 && settings.showStatus) {
                const statusValue = data[i][j];
                if (statusValue === 'Ja') {
                    doc.setTextColor(0, 128, 0); // Grønn farge for plukket/mottatt
                } else if (statusValue.includes('Delvis')) {
                    doc.setTextColor(255, 140, 0); // Oransje farge for delvis plukket/mottatt
                } else {
                    doc.setTextColor(100); // Grå farge for ikke plukket/mottatt
                }
            } else {
                doc.setTextColor(0);
            }
            
            doc.text(data[i][j], xOffset + 2, tableY + 5.5);
            xOffset += columnWidths[j];
        }
        
        tableY += rowHeight;
    }
    
    // Tegn ramme rundt tabellen
    doc.setDrawColor(200);
    doc.rect(margin, margin + 60, contentWidth, tableY - (margin + 60), 'S');
    
    // Legg til vertikale skillelinjer i tabellen
    let lineX = margin;
    for (let i = 0; i < columnWidths.length - 1; i++) {
        lineX += columnWidths[i];
        doc.line(lineX, margin + 60, lineX, tableY);
    }
    
    // Legg til horisontale skillelinjer for hver rad
    for (let i = 0; i <= data.length; i++) {
        const lineY = margin + 60 + (i * rowHeight);
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
    doc.text('Generert med Lagerstyring PWA', margin, pageHeight - margin);
    
    // Returner PDF som blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
}

/**
 * Genererer et filnavn for PDF-eksport
 * @param {string} type - Type liste (plukk, mottak, retur)
 * @returns {string} Filnavn for PDF-eksporten
 */
export function generatePDFFilename(type) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    
    return `${capitalizeFirstLetter(type)}liste_${dateStr}_${timeStr}.pdf`;
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
        headers.push('Returnert');
    }
    
    return headers;
}

// Oppdatert funksjon for formatTableData i pdf-export.js
/**
 * Formaterer tabelldata fra varer
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste
 * @returns {Array} Formatert tabelldata
 */
function formatTableData(items, type) {
    return items.map(item => {
        const row = [
            item.id,
            item.description,
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
            } else if ((item.pickedCount || 0) > 0) {
                row.push(`Delvis (${item.pickedCount}/${item.quantity})`);
            } else {
                row.push('Nei');
            }
        } else if (type === 'mottak') {
            if (item.received) {
                row.push('Ja');
            } else if ((item.receivedCount || 0) > 0) {
                row.push(`Delvis (${item.receivedCount}/${item.quantity})`);
            } else {
                row.push('Nei');
            }
        } else if (type === 'retur') {
            // For retur er alt alltid "Ja"
            row.push('Ja');
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
    // Standard kolonnestørrelser som prosentandeler
    const defaultWidths = [0.15, 0.4, 0.15, 0.15, 0.15];
    
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