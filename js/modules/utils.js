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
 * @returns {string} Formattert dato
 */
export function formatDate(date) {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Sjekk om dateObj er gyldig dato
    if (isNaN(dateObj.getTime())) return '';
    
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