// ui.js - UI-håndtering, navigasjon og DOM-interaksjon
import { appState } from '../app.js';
import { updatePickingUI } from './picking.js';
import { updateReceivingUI } from './receiving.js';
import { updateReturnsUI } from './returns.js';
import { stopCameraScanning } from './scanner.js';

// DOM-elementer - Hovedmeny
let mainMenuEl;
let backButtonEl;
let menuItemsEl;

// DOM-elementer - Skanner
let scannerIndicatorEl;
let scannerStatusEl;

// DOM-elementer - Modul containere
let moduleContainersEl;

/**
 * Initialiserer UI-håndtering
 */
export function initUi() {
    // Hent DOM-elementer
    mainMenuEl = document.getElementById('mainMenu');
    backButtonEl = document.getElementById('backButton');
    menuItemsEl = document.querySelectorAll('.menu-item');
    scannerIndicatorEl = document.getElementById('scannerIndicator');
    scannerStatusEl = document.getElementById('scannerStatus');
    moduleContainersEl = document.querySelectorAll('.module-container');
    
    // Legg til event listeners på hovedmeny-elementer
    menuItemsEl.forEach(item => {
        item.addEventListener('click', function() {
            const module = this.getAttribute('data-module');
            showModule(module);
        });
    });
    
    // Legg til event listener på tilbakeknapp
    backButtonEl.addEventListener('click', function() {
        showMainMenu();
    });
}

/**
 * Viser hovedmenyen
 */
export function showMainMenu() {
    // Stopp aktiv kameraskanning før modulbytte
    stopCameraScanning();
    
    appState.currentModule = null;
    backButtonEl.style.display = 'none';
    
    // Skjul alle moduler
    moduleContainersEl.forEach(container => {
        container.style.display = 'none';
    });
    
    // Vis hovedmenyen
    mainMenuEl.style.display = 'flex';
    
    // Fjern fra localStorage
    localStorage.removeItem('currentModule');
    
    console.log('Byttet til hovedmeny');
}

/**
 * Viser en spesifikk modul
 * @param {string} module - Modulnavn (picking, receiving, returns, settings)
 */
export function showModule(module) {
    // Stopp aktiv kameraskanning før modulbytte
    stopCameraScanning();
    
    // Skjul kameraskannere for alle moduler
    document.querySelectorAll('.camera-scanner-container').forEach(container => {
        container.style.display = 'none';
    });
    
    appState.currentModule = module;
    
    // Logg modulendring for debugging
    console.log('Byttet til modul:', module);
    
    // Skjul hovedmenyen
    mainMenuEl.style.display = 'none';
    
    // Skjul alle moduler
    moduleContainersEl.forEach(container => {
        container.style.display = 'none';
    });
    
    // Vis den valgte modulen
    const moduleEl = document.getElementById(module + 'Module');
    if (moduleEl) {
        moduleEl.style.display = 'flex';
    } else {
        console.error('Finner ikke modul:', module + 'Module');
    }
    
    // Vis tilbakeknappen
    backButtonEl.style.display = 'block';
    
    // Oppdater UI for den aktuelle modulen
    if (module === 'picking') {
        updatePickingUI();
    } else if (module === 'receiving') {
        updateReceivingUI();
    } else if (module === 'returns') {
        updateReturnsUI();
    }
    
    // Lagre valgt modul i localStorage
    localStorage.setItem('currentModule', module);
}

/**
 * Oppdaterer skanner-statusindikator
 * @param {boolean} connected - Om skanneren er tilkoblet
 * @param {Object} details - Ytterligere detaljer om skanneren
 */
export function updateScannerStatus(connected, details = {}) {
    // Kontroller at DOM-elementene eksisterer før vi forsøker å manipulere dem
    if (!scannerIndicatorEl || !scannerStatusEl) {
        console.warn('SCANNER-STATUS-WARNING: Forsøker å oppdatere scanner-status, men DOM-elementer er ikke initialisert');
        // Forsøk å hente elementene på nytt, i tilfelle de ikke var tilgjengelige under init
        scannerIndicatorEl = document.getElementById('scannerIndicator');
        scannerStatusEl = document.getElementById('scannerStatus');
        
        // Hvis de fortsatt ikke finnes, avbryt funksjonen
        if (!scannerIndicatorEl || !scannerStatusEl) {
            console.error('SCANNER-STATUS-ERROR: Kan ikke oppdatere scanner-status, DOM-elementer mangler');
            return;
        }
    }
    
    if (connected) {
        scannerIndicatorEl.classList.add('connected');
        
        // Vis informasjon om skanneren
        if (details.type === 'bluetooth') {
            scannerStatusEl.textContent = `Skanner: Tilkoblet (${details.deviceName || 'Bluetooth'})`;
        } else if (details.type === 'camera') {
            scannerStatusEl.textContent = 'Skanner: Kamera aktivt';
        } else {
            scannerStatusEl.textContent = 'Skanner: Tilkoblet';
        }
    } else {
        // Legg til sikkerhet i tilfelle classList ikke er tilgjengelig
        if (scannerIndicatorEl.classList) {
            scannerIndicatorEl.classList.remove('connected');
        } else {
            // Fallback for eldre nettlesere eller uventede situasjoner
            scannerIndicatorEl.className = scannerIndicatorEl.className.replace(/\bconnected\b/, '');
        }
        scannerStatusEl.textContent = 'Skanner: Ikke tilkoblet';
    }
}