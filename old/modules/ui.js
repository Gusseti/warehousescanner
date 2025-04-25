// ui.js - UI-håndtering, navigasjon og DOM-interaksjon
import { appState } from '../app.js';
import { updatePickingUI } from './picking.js';
import { updateReceivingUI } from './receiving.js';
import { updateReturnsUI } from './returns.js';
import { stopCameraScanning } from './scanner.js';
// Importer UI-komponenter
import { ButtonComponent } from '../components/ButtonComponent.js';
import { BaseComponent } from '../components/BaseComponent.js';

// DOM-elementer - Hovedmeny
let mainMenuEl;
let menuItemsEl;

// DOM-elementer - Modul containere
let moduleContainersEl;

// Komponent-referanser
let backButton;
let menuItems = []; // Array av menykomponenter
let scannerIndicator; // Scanner-indikator komponent
let moduleContainers = []; // Array av modulcontainer-komponenter

/**
 * Initialiserer UI-håndtering
 */
export function initUi() {
    // Hent DOM-elementer
    mainMenuEl = document.getElementById('mainMenu');
    moduleContainersEl = document.querySelectorAll('.module-container');
    
    // Initialiser komponentene
    initComponents();
    
    // Observer for å håndtere dynamisk DOM-endringer
    const observer = new MutationObserver(function(mutations) {
        if (!document.getElementById('scannerIndicator')) {
            updateScannerUIReferences();
        }
    });
    
    // Start observing
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

/**
 * Oppdaterer referanser til scanner UI-elementer
 */
function updateScannerUIReferences() {
    const scannerIndicatorEl = document.getElementById('scannerIndicator');
    const scannerStatusEl = document.getElementById('scannerStatus');
    
    if (scannerIndicatorEl && !scannerIndicator) {
        scannerIndicator = new BaseComponent({
            element: scannerIndicatorEl,
            properties: {
                statusElement: scannerStatusEl
            }
        });
    }
}

/**
 * Initialiserer UI-komponenter
 */
function initComponents() {
    // Opprett tilbakeknapp
    const backButtonContainer = document.getElementById('backButtonContainer');
    if (backButtonContainer) {
        backButton = new ButtonComponent({
            text: 'Tilbake',
            type: 'secondary',
            icon: 'back-icon',
            id: 'backButton',
            onClick: () => showMainMenu()
        });
        
        backButtonContainer.innerHTML = '';
        backButtonContainer.appendChild(backButton.element);
        backButton.hide(); // Skjul knappen ved oppstart
    }
    
    // Opprett menykomponenter
    const menuItemElements = document.querySelectorAll('.menu-item');
    menuItemElements.forEach(item => {
        const module = item.getAttribute('data-module');
        const menuItem = new ButtonComponent({
            element: item, // Bruk eksisterende element
            onClick: () => showModule(module)
        });
        menuItems.push(menuItem);
    });
    
    // Opprett modul container komponenter
    moduleContainersEl.forEach(container => {
        const moduleContainer = new BaseComponent({
            element: container,
            properties: {
                moduleId: container.id
            }
        });
        moduleContainers.push(moduleContainer);
    });
    
    // Initialiser scanner-indikator komponent
    updateScannerUIReferences();
}

/**
 * Viser hovedmenyen
 */
export function showMainMenu() {
    // Stopp aktiv kameraskanning før modulbytte
    stopCameraScanning();
    
    appState.currentModule = null;
    
    // Skjul tilbakeknappen
    if (backButton) {
        backButton.hide();
    }
    
    // Skjul alle moduler ved å bruke komponentene
    moduleContainers.forEach(container => {
        container.hide();
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
    
    // Skjul alle moduler ved å bruke komponentene
    moduleContainers.forEach(container => {
        container.hide();
    });
    
    // Vis den valgte modulen
    const targetModuleId = module + 'Module';
    const moduleComponent = moduleContainers.find(container => 
        container.properties.moduleId === targetModuleId
    );
    
    if (moduleComponent) {
        moduleComponent.show();
    } else {
        console.error('Finner ikke modul:', targetModuleId);
    }
    
    // Vis tilbakeknappen
    if (backButton) {
        backButton.show();
    }
    
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
    // Kontroller at scanner-indikatoren eksisterer
    if (!scannerIndicator) {
        updateScannerUIReferences();
        
        // Hvis den fortsatt ikke finnes, avbryt funksjonen
        if (!scannerIndicator) {
            console.error('SCANNER-STATUS-ERROR: Kan ikke oppdatere scanner-status, komponenten mangler');
            return;
        }
    }
    
    const statusElement = scannerIndicator.properties.statusElement;
    
    if (connected) {
        // Bruk komponentmetoder for konsistent håndtering
        scannerIndicator.element.classList.add('connected');
        
        // Vis informasjon om skanneren
        if (details.type === 'bluetooth') {
            statusElement.textContent = `Skanner: Tilkoblet (${details.deviceName || 'Bluetooth'})`;
        } else if (details.type === 'camera') {
            statusElement.textContent = 'Skanner: Kamera aktivt';
        } else {
            statusElement.textContent = 'Skanner: Tilkoblet';
        }
    } else {
        // Bruk komponentmetoder for konsistent håndtering
        scannerIndicator.element.classList.remove('connected');
        statusElement.textContent = 'Skanner: Ikke tilkoblet';
    }
}