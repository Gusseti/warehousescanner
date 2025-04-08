// settings.js - Funksjonalitet for innstillinger-modulen
import { appState } from '../app.js';
import { showToast } from './utils.js';
import { saveSettings, saveItemWeights, saveBarcodeMapping, clearAllStoredData } from './storage.js';
import { updateAllWeights } from './weights.js';
import { isFeatureSupported } from './utils.js';

// DOM elementer - Innstillinger
let weightUnitEl;
let defaultItemWeightEl;
let importBarcodeFileEl;
let importBarcodeBtnEl;
let barcodeFileInfoEl;
let clearBarcodeDataEl;
let clearAllDataEl;
let featuresSupportInfoEl;

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
    clearAllDataEl = document.getElementById('clearAllData');
    featuresSupportInfoEl = document.getElementById('featuresSupportInfo');
    
    // Oppdater UI med lagrede innstillinger
    updateSettingsUI();
    
    // Legg til event listeners
    setupSettingsEventListeners();
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
        if (confirm('Er du sikker på at du vil slette all strekkodedata?')) {
            appState.barcodeMapping = {};
            saveBarcodeMapping();
            barcodeFileInfoEl.textContent = 'Ingen strekkoder lastet inn';
            showToast('Strekkodedata er slettet', 'warning');
        }
    });
    
    clearAllDataEl.addEventListener('click', function() {
        if (confirm('Er du sikker på at du vil slette alle data? Dette kan ikke angres.')) {
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
    
    // Vis strekkodeinfo
    if (barcodeFileInfoEl) {
        const count = Object.keys(appState.barcodeMapping).length;
        barcodeFileInfoEl.textContent = count > 0 ? 
            `Lastet inn: ${count} strekkoder` : 
            'Ingen strekkoder lastet inn';
    }
    
    // Vis funksjonsstøtte-info
    if (featuresSupportInfoEl) {
        const features = {
            'Bluetooth': isFeatureSupported('bluetooth'),
            'Kamera': isFeatureSupported('camera'),
            'PDF': isFeatureSupported('pdf'),
            'Service Worker': isFeatureSupported('serviceWorker'),
            'Lokal lagring': isFeatureSupported('localStorageAvailable')
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
                    const count = Object.keys(appState.barcodeMapping).length;
                    barcodeFileInfoEl.textContent = `Lastet inn: ${file.name} (${count} strekkoder)`;
                    
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