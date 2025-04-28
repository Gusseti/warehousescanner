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

// Sikre at elementer blir forsøkt hentet selv om DOM endres
let scannerElementsInitialized = false;

/**
 * Initialiserer UI-håndtering
 */
export function initUi() {
    console.log('Initialiserer UI...');
    
    // Hent DOM-elementer
    mainMenuEl = document.getElementById('mainMenu');
    backButtonEl = document.getElementById('backButton');
    menuItemsEl = document.querySelectorAll('.menu-item');
    moduleContainersEl = document.querySelectorAll('.module-container');
    
    // Initialiser scanner-elementer
    initScannerElements();
    
    // Legg til event listeners på hovedmeny-elementer
    menuItemsEl.forEach(item => {
        item.addEventListener('click', function() {
            const module = this.getAttribute('data-module');
            showModule(module);
        });
    });
    
    // Legg til event listener på tilbakeknapp
    if (backButtonEl) {
        backButtonEl.addEventListener('click', function() {
            showMainMenu();
        });
    } else {
        console.warn('Tilbakeknapp ikke funnet ved initialisering');
    }
    
    // Sikre at scanner-indikator-elementene alltid oppdateres når DOM er lastet fullstendig
    window.addEventListener('DOMContentLoaded', function() {
        console.log('DOMContentLoaded: Oppdaterer scanner-elementer');
        initScannerElements();
    });
    
    // Observer for å håndtere dynamisk DOM-endringer
    const observer = new MutationObserver(function(mutations) {
        // Sjekk om vi trenger å oppdatere scanner-elementer
        if (!scannerElementsInitialized) {
            initScannerElements();
        }
    });
    
    // Start observing
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

/**
 * Initialiserer scanner-elementer
 * @returns {boolean} Om initialiseringen var vellykket
 */
function initScannerElements() {
    scannerIndicatorEl = document.getElementById('scannerIndicator');
    scannerStatusEl = document.getElementById('scannerStatus');
    
    if (scannerIndicatorEl && scannerStatusEl) {
        console.log('Scanner-elementer funnet og initialisert');
        scannerElementsInitialized = true;
        return true;
    } else {
        console.log('Scanner-elementer ikke funnet, vil forsøke igjen senere');
        scannerElementsInitialized = false;
        return false;
    }
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
    console.log(`updateScannerStatus kalt: connected=${connected}, type=${details.type || 'ukjent'}`);
    
    // Kontroller at DOM-elementene eksisterer før vi forsøker å manipulere dem
    if (!scannerIndicatorEl || !scannerStatusEl) {
        console.warn('SCANNER-STATUS-WARNING: Forsøker å oppdatere scanner-status, men DOM-elementer er ikke initialisert');
        
        // Forsøk å initialisere elementene
        const initialized = initScannerElements();
        
        // Hvis de fortsatt ikke finnes, planlegg en ny oppdatering om 500ms
        if (!initialized) {
            console.log('SCANNER-STATUS-INFO: Planlegger ny oppdatering om 500ms');
            setTimeout(() => {
                updateScannerStatus(connected, details);
            }, 500);
            return;
        }
    }
    
    try {
        if (connected) {
            scannerIndicatorEl.classList.add('connected');
            
            // Vis informasjon om skanneren
            if (details.type === 'bluetooth') {
                scannerStatusEl.textContent = `Skanner: Tilkoblet (${details.deviceName || 'Bluetooth'})`;
                console.log(`Scanner-status oppdatert til: Bluetooth (${details.deviceName || 'Ukjent enhet'})`);
            } else if (details.type === 'camera') {
                scannerStatusEl.textContent = 'Skanner: Kamera aktivt';
                console.log('Scanner-status oppdatert til: Kamera aktivt');
            } else {
                scannerStatusEl.textContent = 'Skanner: Tilkoblet';
                console.log('Scanner-status oppdatert til: Tilkoblet');
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
            console.log('Scanner-status oppdatert til: Ikke tilkoblet');
        }
    } catch (error) {
        console.error('SCANNER-STATUS-ERROR: Feil ved oppdatering av scanner-status:', error);
    }
}