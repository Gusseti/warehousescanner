// settings.js - Funksjonalitet for innstillinger-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveSettings, saveItemWeights, saveBarcodeMapping, clearAllStoredData, resetToDefaultBarcodes } from './storage.js';
import { updateAllWeights } from './weights.js';
import { isFeatureSupported } from './utils.js';

// DOM elementer - Innstillinger
let weightUnitEl;
let defaultItemWeightEl;
let importBarcodeFileEl;
let importBarcodeBtnEl;
let barcodeFileInfoEl;
let clearBarcodeDataEl;
let resetBarcodeDataEl; // Ny knapp for å tilbakestille til innebygde strekkoder
let clearAllDataEl;
let featuresSupportInfoEl;
let themeToggleEl; // Dark mode toggle knapp

/**
 * Initialiserer innstillinger-modulen
 */
export function initSettings() {
    // Hent DOM-elementer
    weightUnitEl = document.getElementById('weightUnit');
    defaultItemWeightEl = document.getElementById('defaultItemWeight');
    importBarcodeFileEl = document.getElementById('importBarcodeFile');
    importBarcodeBtnEl = document.getElementById('importBarcodeBtn');
    barcodeFileInfoEl = document.getElementById('barcodeFileInfo');
    clearBarcodeDataEl = document.getElementById('clearBarcodeData');
    resetBarcodeDataEl = document.getElementById('resetBarcodeData'); // Ny referanse
    clearAllDataEl = document.getElementById('clearAllData');
    featuresSupportInfoEl = document.getElementById('featuresSupportInfo');
    themeToggleEl = document.getElementById('themeToggle');
    
    // Oppdater UI med lagrede innstillinger
    updateSettingsUI();
    
    // Legg til event listeners
    setupSettingsEventListeners();
    
    // Initialiser dark mode
    initDarkMode();
    
    // Initialiser tab-funksjonalitet
    initSettingsTabs();
}

/**
 * Setter opp event listeners for innstillinger-modulen
 */
function setupSettingsEventListeners() {
    weightUnitEl.addEventListener('change', function() {
        appState.settings.weightUnit = this.value;
        saveSettings();
        updateAllWeights();
        showToast(`Vektenhet endret til ${this.value}`, 'success');
    });
    
    defaultItemWeightEl.addEventListener('change', function() {
        appState.settings.defaultItemWeight = parseFloat(this.value) || 1.0;
        saveSettings();
        showToast(`Standard varevekt endret til ${appState.settings.defaultItemWeight} ${appState.settings.weightUnit}`, 'success');
    });
    
    importBarcodeBtnEl.addEventListener('click', function() {
        importBarcodeFileEl.click();
    });
    
    importBarcodeFileEl.addEventListener('change', handleBarcodeFileImport);
    
    clearBarcodeDataEl.addEventListener('click', function() {
        if (confirm('Er du sikker på at du vil slette all strekkodedata? De innebygde strekkodene vil beholdes.')) {
            resetToDefaultBarcodes();
            showToast('Brukerdefinerte strekkoder er slettet', 'warning');
        }
    });
    
    // Event listener for ny knapp, dersom den finnes
    if (resetBarcodeDataEl) {
        resetBarcodeDataEl.addEventListener('click', function() {
            resetToDefaultBarcodes();
            showToast('Strekkoder tilbakestilt til kun innebygde strekkoder', 'success');
        });
    }
    
    clearAllDataEl.addEventListener('click', function() {
        if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres. Innebygde strekkoder vil beholdes.')) {
            if (clearAllStoredData()) {
                showToast('Alle data er slettet. Laster siden på nytt...', 'warning');
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                showToast('Kunne ikke slette alle data', 'error');
            }
        }
    });
    
    // Dark Mode Toggle
    if (themeToggleEl) {
        themeToggleEl.addEventListener('change', function() {
            toggleDarkMode(this.checked);
        });
    }
    
    // Last applikasjonen på nytt-knapp
    const forceRefreshBtn = document.getElementById('forceRefreshBtn');
    if (forceRefreshBtn) {
        forceRefreshBtn.addEventListener('click', function() {
            // Vis en bekreftelsesmelding
            if (confirm('Dette vil laste applikasjonen på nytt og tømme cache. Vil du fortsette?')) {
                try {
                    showToast('Tømmer cache og laster applikasjonen på nytt...', 'info');
                    
                    // Tøm Service Worker cache hvis tilgjengelig
                    if ('caches' in window) {
                        caches.keys().then(cacheNames => {
                            return Promise.all(
                                cacheNames.map(cacheName => {
                                    return caches.delete(cacheName);
                                })
                            );
                        });
                    }
                    
                    // Avregistrer service worker
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then(registrations => {
                            for (let registration of registrations) {
                                registration.unregister();
                            }
                        });
                    }
                    
                    // Vent litt så toast-meldingen vises
                    setTimeout(() => {
                        // Bruk spesielle flagg for å tvinge full reload uten cache
                        window.location.href = window.location.href.split('?')[0] + 
                            '?forcereload=' + Date.now();
                    }, 1000);
                    
                } catch (error) {
                    console.error('Feil ved oppdatering:', error);
                    // Hvis det skjer en feil, prøv å laste siden på nytt uansett
                    window.location.reload(true);
                }
            }
        });
    }
}

/**
 * Oppdaterer UI for innstillinger-modulen
 */
function updateSettingsUI() {
    // Sett vektenhet
    if (weightUnitEl) {
        weightUnitEl.value = appState.settings.weightUnit;
    }
    
    // Sett standard varevekt
    if (defaultItemWeightEl) {
        defaultItemWeightEl.value = appState.settings.defaultItemWeight;
    }
    
    // Sett dark mode toggle hvis dark mode er aktiv
    if (themeToggleEl && appState.settings.darkMode) {
        themeToggleEl.checked = true;
    }
    
    // Vis strekkodeinfo
    if (barcodeFileInfoEl) {
        const totalCount = Object.keys(appState.barcodeMapping).length;
        
        // Beregn antall brukerdefinerte strekkoder (de som ikke er innebygde)
        const defaultBarcodes = {
            "5707438581051": "000-BH3242",
            "5707439043602": "WORKTS13",
            "5707439043619": "WORKTS14"
        };
        
        const defaultCount = Object.keys(defaultBarcodes).length;
        const userCount = totalCount - defaultCount;
        
        if (userCount > 0) {
            barcodeFileInfoEl.textContent = `Lastet inn: ${totalCount} strekkoder (${defaultCount} innebygde + ${userCount} brukerdefinerte)`;
        } else {
            barcodeFileInfoEl.textContent = `Lastet inn: ${defaultCount} innebygde strekkoder`;
        }
    }
    
    // Vis funksjonsstøtte-info
    if (featuresSupportInfoEl) {
        const features = {
            'Bluetooth': isFeatureSupported('bluetooth'),
            'Kamera': isFeatureSupported('camera'),
            'PDF': isFeatureSupported('pdf'),
            'Service Worker': isFeatureSupported('serviceWorker'),
            'Lokal lagring': isFeatureSupported('localStorageAvailable'),
            'Dark Mode': true
        };
        
        let featureHtml = '<h3>Funksjonsstøtte</h3><ul>';
        for (const [feature, supported] of Object.entries(features)) {
            featureHtml += `<li>${feature}: <span class="${supported ? 'text-success' : 'text-danger'}">${supported ? 'Støttet' : 'Ikke støttet'}</span></li>`;
        }
        featureHtml += '</ul>';
        
        featuresSupportInfoEl.innerHTML = featureHtml;
    }
}

/**
 * Håndterer import av strekkode-fil
 * @param {Event} event - Fil-input event
 */
function handleBarcodeFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            if (file.name.endsWith('.json')) {
                const data = JSON.parse(content);
                
                if (typeof data === 'object' && !Array.isArray(data)) {
                    // Kombiner med eksisterende mappinger
                    appState.barcodeMapping = { ...appState.barcodeMapping, ...data };
                    
                    // Lagre til localStorage
                    saveBarcodeMapping();
                    
                    // Oppdater UI
                    updateSettingsUI();
                    
                    showToast(`Importert ${Object.keys(data).length} strekkoder!`, 'success');
                } else {
                    showToast('Ugyldig strekkodeformat. Forventet objekt med strekkode-til-varenummer-mapping.', 'error');
                }
            } else {
                showToast('Feil filformat. Kun JSON-filer støttes for strekkodeoversikt.', 'error');
            }
        } catch (error) {
            console.error('Feil ved import av strekkodeoversikt:', error);
            showToast('Feil ved import av strekkodeoversikt.', 'error');
        }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

/**
 * Initialiserer dark mode basert på lagrede innstillinger eller systempreferanser
 */
function initDarkMode() {
    // Sjekk om vi har en lagret innstilling eller bruk systempreferanser
    if (appState.settings.darkMode === undefined) {
        // Sjekk om systemet foretrekker mørkt tema
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        appState.settings.darkMode = prefersDarkMode;
        saveSettings();
    }
    
    // Aktiver dark mode hvis innstillingen er på
    if (appState.settings.darkMode) {
        document.body.classList.add('dark-mode');
        if (themeToggleEl) themeToggleEl.checked = true;
        updateThemeColor('#121212'); // Oppdater theme-color meta tag
    }
    
    // Lytter for systemendringer
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (appState.settings.darkMode === undefined) {
            toggleDarkMode(e.matches);
        }
    });
}

/**
 * Slår dark mode av/på
 * @param {boolean} enable - Om dark mode skal slås på
 */
export function toggleDarkMode(enable) {
    // Oppdater body class
    if (enable) {
        document.body.classList.add('dark-mode');
        updateThemeColor('#121212');
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeColor('#2196f3');
    }
    
    // Lagre innstillingen
    appState.settings.darkMode = enable;
    saveSettings();
    
    // Vis en melding til brukeren
    showToast(`Mørkt tema ${enable ? 'aktivert' : 'deaktivert'}`, 'success');
}

/**
 * Oppdaterer theme-color meta tag for browser UI
 * @param {string} color - CSS fargeverdi
 */
function updateThemeColor(color) {
    // Oppdater meta tag for theme-color (for mobil nettleser-UI)
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color);
    }
}

/**
 * Initialiserer tab-funksjonalitet i innstillinger-modulen
 */
function initSettingsTabs() {
    // Finn alle tab-knapper
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabContents = document.querySelectorAll('.settings-tab-content');
    
    // Hvis det ikke finnes noen tabs, avslutt tidlig
    if (tabButtons.length === 0 || tabContents.length === 0) {
        console.warn('Ingen tabs funnet i innstillinger-modulen');
        return;
    }
    
    // Legg til klikk-handler for hver tab-knapp
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Fjern .active fra alle knapper
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Legg til .active på den klikkede knappen
            this.classList.add('active');
            
            // Hent ID for tab-innholdet som skal vises
            const tabId = this.getAttribute('data-tab');
            
            // Skjul alle tab-innhold
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Vis det valgte tab-innholdet
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.classList.add('active');
            } else {
                console.error(`Tab-innhold med ID ${tabId} ikke funnet`);
            }
        });
    });
    
    // Aktiver første tab som standard hvis ingen er aktive
    if (!document.querySelector('.settings-tab-btn.active')) {
        tabButtons[0].click();
    }
}