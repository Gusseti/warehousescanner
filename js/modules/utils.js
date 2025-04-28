// utils.js - Generelle hjelpefunksjoner

/**
 * Viser toast-melding
 * @param {string} message - Meldingstekst
 * @param {string} type - Meldingstype (info, error, success, warning)
 * @param {number} duration - Varighet i millisekunder
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.style.display = 'block';
    
    setTimeout(() => {
        toastEl.style.display = 'none';
    }, duration);
}

/**
 * Beregner totalvekt for en liste med varer
 * @param {Array} items - Liste med varer
 * @param {string} type - Type liste (pick, receive, return)
 * @returns {number} Total vekt
 */
export function calculateTotalWeight(items, type) {
    if (!items || items.length === 0) return 0;
    
    return items.reduce((total, item) => {
        const count = type === 'pick' ? 
            (item.pickedCount || 0) : 
            type === 'receive' ? 
                (item.receivedCount || 0) : 
                (item.quantity || 0);
                
        return total + (count * (item.weight || 0));
    }, 0);
}

/**
 * Formatterer dato til lesbar streng
 * @param {Date|string} date - Dato eller dato-streng
 * @param {string} format - Formatstreng (f.eks. 'YYYY_MM_DD_HH' eller null for standard format)
 * @returns {string} Formattert dato
 */
export function formatDate(date, format = null) {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Sjekk om dateObj er gyldig dato
    if (isNaN(dateObj.getTime())) return '';
    
    // Hvis format er spesifisert, bruker vi det
    if (format) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }
    
    // Ellers bruker vi standard formatering
    return dateObj.toLocaleString('nb-NO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Genererer en unik ID
 * @returns {string} Unik ID
 */
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Debounce-funksjon for hendelser som utløses hyppig
 * @param {Function} func - Funksjonen som skal utføres
 * @param {number} wait - Ventetid i millisekunder
 * @returns {Function} Debouncet funksjon
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle-funksjon for hendelser som utløses hyppig
 * @param {Function} func - Funksjonen som skal utføres
 * @param {number} limit - Minimumstid mellom utførelser i millisekunder
 * @returns {Function} Throttlet funksjon
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Sjekker om nettleseren støtter en bestemt funksjonalitet
 * @param {string} feature - Funksjonalitet som skal sjekkes
 * @returns {boolean} Om funksjonen støttes
 */
export function isFeatureSupported(feature) {
    switch (feature) {
        case 'bluetooth':
            return 'bluetooth' in navigator;
        case 'camera':
            return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
        case 'pdf':
            return typeof window.pdfjsLib !== 'undefined';
        case 'serviceWorker':
            return 'serviceWorker' in navigator;
        case 'localStorageAvailable':
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch(e) {
                return false;
            }
        default:
            return false;
    }
}

/**
 * Escaper HTML for å unngå XSS
 * @param {string} html - Tekst som potensielt inneholder HTML
 * @returns {string} Escapert tekst
 */
export function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Får bakgrunnen til å blinke med spesifisert farge for å indikere suksess/feil
 * @param {string} color - Farge som skal brukes ('red', 'green', 'orange')
 * @param {number} duration - Varighet i millisekunder
 */
export function blinkBackground(color = 'green', duration = 500) {
    const body = document.body;
    const originalBackgroundColor = body.style.backgroundColor;
    
    // Velg riktig farge basert på parameter
    let blinkColor;
    switch (color.toLowerCase()) {
        case 'red':
            blinkColor = 'rgba(255, 0, 0, 0.3)';
            break;
        case 'green':
            blinkColor = 'rgba(0, 255, 0, 0.3)';
            break;
        case 'orange':
        case 'yellow':
            blinkColor = 'rgba(255, 165, 0, 0.3)';
            break;
        default:
            blinkColor = 'rgba(0, 255, 0, 0.3)';
    }
    
    // Endre bakgrunnsfarge
    body.style.backgroundColor = blinkColor;
    
    // Tilbakestill etter angitt varighet
    setTimeout(() => {
        body.style.backgroundColor = originalBackgroundColor;
    }, duration);
}

/**
 * Spiller av en lydsignal for å indikere feil/suksess
 * @param {string} type - Type lyd ('error', 'success')
 */
export function playErrorSound(type = 'error') {
    // Opprett en enkel tone med Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Koble sammen nodene
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Sett opp lydtype
        if (type === 'error') {
            // Feilsignal: Kort høy tone etterfulgt av en lavere
            oscillator.type = 'square';
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            oscillator.start();
            
            setTimeout(() => {
                oscillator.frequency.value = 400;
                setTimeout(() => {
                    oscillator.stop();
                }, 200);
            }, 200);
        } else {
            // Suksesssignal: Oppadgående tone
            oscillator.type = 'sine';
            oscillator.frequency.value = 400;
            gainNode.gain.value = 0.1;
            oscillator.start();
            
            // Gradvis øk frekvensen for en "pling"-lyd
            oscillator.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.2);
            setTimeout(() => {
                oscillator.stop();
            }, 300);
        }
    } catch (error) {
        console.error('Kunne ikke spille av lyd:', error);
    }
}

/**
 * Spiller av en enkel suksesslyd
 */
export function playSuccessSound() {
    playErrorSound('success');
}

/**
 * Scrolle til en matchende rad i en tabell som inneholder en bestemt varekode
 * @param {string} itemId - Varenummer som skal finnes i tabellen
 * @param {string} tableId - ID til tabellen som skal søkes i
 * @param {boolean} highlight - Om raden skal fremheves
 * @returns {boolean} Om scrolling var vellykket
 */
export function scrollToTableRow(itemId, tableId, highlight = true) {
    if (!itemId || !tableId) return false;
    
    const table = document.getElementById(tableId);
    if (!table) return false;
    
    // Finn alle rader i tabellen
    const rows = table.querySelectorAll('tbody tr');
    if (!rows || rows.length === 0) return false;
    
    // Fjern eventuelle tidligere fremhevinger
    rows.forEach(row => {
        row.classList.remove('highlighted-row');
        row.classList.remove('blink-animation');
    });
    
    // Let gjennom radene etter varenummeret
    let found = false;
    for (const row of rows) {
        // Sjekk attributter først - data-item-id eller data-id
        const rowItemId = row.getAttribute('data-item-id') || row.getAttribute('data-id');
        
        // Deretter sjekk tekstinnhold i celler
        let cellMatch = false;
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
            // Sjekk om cellen inneholder varenummeret som tekst
            if (cell.textContent.trim() === itemId) {
                cellMatch = true;
                break;
            }
        }
        
        // Hvis vi fant en match, scroll til denne raden
        if (rowItemId === itemId || cellMatch) {
            // Scroll til raden med en liten offset for å sikre at den er synlig
            const container = table.closest('.table-container') || table.parentElement;
            
            if (container) {
                // Beregn posisjonen med litt offset
                const rowTop = row.offsetTop - container.offsetTop;
                const containerHeight = container.clientHeight;
                const scrollPosition = rowTop - (containerHeight / 4); // Plasser raden 1/4 ned i containeren
                
                container.scrollTo({
                    top: scrollPosition,
                    behavior: 'smooth'
                });
            } else {
                // Fallback til scrollIntoView hvis vi ikke har en container
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
            
            // Fremhev raden hvis angitt
            if (highlight) {
                row.classList.add('highlighted-row');
                row.classList.add('blink-animation');
                
                // Fjern fremheving etter en viss tid
                setTimeout(() => {
                    row.classList.remove('blink-animation');
                    // Beholder highlighted-row for å vise hvilken rad som ble skannet
                }, 2000);
            }
            
            found = true;
            break;
        }
    }
    
    return found;
}

/**
 * Viser en statusmelding i toppen av skjermen
 * @param {string} message - Meldingen som skal vises
 * @param {string} type - Type melding (success, error, warning, info)
 * @param {number} duration - Hvor lenge meldingen skal vises (i millisekunder)
 */
export function showStatusMessage(message, type = 'info', duration = 3000) {
    // Finn eller opprett statuscontainer
    let statusContainer = document.getElementById('scannerStatusMessage');
    
    if (!statusContainer) {
        // Opprett container hvis den ikke finnes
        statusContainer = document.createElement('div');
        statusContainer.id = 'scannerStatusMessage';
        statusContainer.className = 'scanner-status-message';
        document.body.appendChild(statusContainer);
        
        // Legg til styling hvis det ikke allerede er i CSS
        const style = document.createElement('style');
        style.textContent = `
            .scanner-status-message {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                padding: 12px;
                text-align: center;
                font-weight: bold;
                z-index: 10000;
                transform: translateY(-100%);
                transition: transform 0.3s ease-in-out;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                opacity: 0.95;
            }
            .scanner-status-message.visible {
                transform: translateY(0);
            }
            .scanner-status-message.success {
                background-color: #4CAF50;
                color: white;
            }
            .scanner-status-message.error {
                background-color: #F44336;
                color: white;
            }
            .scanner-status-message.warning {
                background-color: #FF9800;
                color: white;
            }
            .scanner-status-message.info {
                background-color: #2196F3;
                color: white;
            }
            .highlighted-row {
                background-color: rgba(255, 255, 0, 0.2) !important;
            }
            .blink-animation {
                animation: highlight-blink 1s ease-in-out 3;
            }
            @keyframes highlight-blink {
                0% { background-color: rgba(255, 255, 0, 0.2); }
                50% { background-color: rgba(255, 255, 0, 0.5); }
                100% { background-color: rgba(255, 255, 0, 0.2); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Sett meldingen og typen
    statusContainer.textContent = message;
    statusContainer.className = `scanner-status-message ${type}`;
    
    // Vis meldingen
    setTimeout(() => {
        statusContainer.classList.add('visible');
    }, 10);
    
    // Skjul meldingen etter angitt tid
    if (duration > 0) {
        setTimeout(() => {
            statusContainer.classList.remove('visible');
        }, duration);
    }
}