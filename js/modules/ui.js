// ui.js - UI-håndtering, navigasjon og DOM-interaksjon
import { appState } from '../app.js';
import { updatePickingUI } from './picking.js';
import { updateReceivingUI } from './receiving.js';
import { updateReturnsUI } from './returns.js';

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
}

/**
 * Viser en spesifikk modul
 * @param {string} module - Modulnavn (picking, receiving, returns, settings)
 */
export function showModule(module) {
    appState.currentModule = module;
    
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
        scannerIndicatorEl.classList.remove('connected');
        scannerStatusEl.textContent = 'Skanner: Ikke tilkoblet';
    }
}