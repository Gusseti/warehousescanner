// app.js - Refaktorert hovedapplikasjonsfil med modulær struktur
import { initUi, showMainMenu, showModule, updateScannerStatus } from './modules/ui.js';
import { loadSettings, saveSettings, loadItemWeights, loadBarcodeMappingFromStorage, loadListsFromStorage } from './modules/storage.js';
import { initWeights, updateAllWeights } from './modules/weights.js';
import { showToast } from './modules/utils.js';
import { initCameraScanner, connectToBluetoothScanner } from './modules/scanner.js';
import { 
    createPickingRenderer, 
    createReceivingRenderer, 
    createReturnsRenderer 
} from './modules/list-renderer.js';

// Applikasjonstilstand med standardverdier
export let appState = {
    // Modulvisning
    currentModule: null,
    
    // Plukk-modell
    pickListItems: [],
    pickedItems: [],
    lastPickedItem: null,
    
    // Mottaksmodell
    receiveListItems: [],
    receivedItems: [],
    lastReceivedItem: null,
    
    // Returmodell
    returnListItems: [],
    
    // Strekkode-mapping
    barcodeMapping: {}, 
    
    // Innstillinger med standardverdier
    settings: {
        weightUnit: 'kg',
        defaultItemWeight: 1.0
    },
    
    // Varevekter
    itemWeights: {}
};

// Moduler for rendering
const renderers = {
    pick: null,
    receive: null,
    return: null
};

// Initialiserer applikasjonen når DOM er lastet
document.addEventListener('DOMContentLoaded', initializeApp);

// Registrerer serviceworker med forbedret feilhåndtering
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registrert:', registration);
            })
            .catch(error => {
                console.log('Service Worker registrering feilet:', error);
                // Fortsett app-initialisering uansett - serviceworker er ikke kritisk
            });
    });
} else {
    console.log('Service Worker API støttes ikke i denne nettleseren');
}

/**
 * Initialiserer applikasjonen med gjenprøving og feilhåndtering
 */
async function initializeApp() {
    try {
        console.log('Initialiserer applikasjon...');
        
        // Legg til global feilhåndterer for uventede feil
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('Global feilhåndterer fanget:', { message, source, lineno, colno, error });
            showToast('En uventet feil oppstod. Se konsollen for detaljer.', 'error');
            return false; // La standard feilhåndterer også kjøre
        };
        
        // Last lagrede data med feilhåndtering
        await loadStoredData();
        
        // Initialiser UI og moduler
        await initModules();
        
        // Initialiser renderers
        initializeRenderers();
        
        // Hent lagret modul og vis den, eller vis hovedmenyen
        const storedModule = localStorage.getItem('currentModule');
        if (storedModule) {
            showModule(storedModule);
        } else {
            showMainMenu();
        }
        
        console.log('Applikasjon initialisert');
        
        // Legg til oppdateringsknapp-handler for feilsøkingsmodus
        setupForceRefreshButton();
    } catch (error) {
        console.error('Feil under applikasjonsinitialisering:', error);
        showToast('Det oppstod en feil ved oppstart av applikasjonen. Vi vil prøve igjen.', 'error');
        
        // Legg til gjenprøvingslogikk
        setTimeout(() => {
            console.log('Prøver applikasjonsinitialisering på nytt...');
            window.location.reload();
        }, 3000); // Prøv igjen etter 3 sekunder
    }
}

/**
 * Laster alle lagrede data med feilhåndtering
 */
async function loadStoredData() {
    try {
        // Last strekkode-mapping
        await safeOperation(loadBarcodeMappingFromStorage, 'strekkode-mapping');
        
        // Last innstillinger
        await safeOperation(loadSettings, 'innstillinger');
        
        // Last varevekter
        await safeOperation(loadItemWeights, 'varevekter');
        
        // Last lister
        await safeOperation(loadListsFromStorage, 'lister');
        
        console.log('Alle lagrede data lastet');
    } catch (error) {
        console.error('Feil ved lasting av lagrede data:', error);
        throw new Error('Kunne ikke laste lagrede data: ' + error.message);
    }
}

/**
 * Initialiserer alle moduler med feilhåndtering
 */
async function initModules() {
    try {
        // Initialiser UI-håndtering først
        await safeOperation(initUi, 'UI');
        
        // Initialiser viktige moduler
        await safeOperation(() => initWeights(updateAllUIRenderers), 'weight-modul');
        
        // Initialiser skanner-moduler
        initializeScanners();
        
        console.log('Alle moduler initialisert');
    } catch (error) {
        console.error('Feil ved initialisering av moduler:', error);
        throw new Error('Kunne ikke initialisere moduler: ' + error.message);
    }
}

/**
 * Initialiserer renderers for alle moduler
 */
function initializeRenderers() {
    // Opprett renderers for hver modul
    renderers.pick = createPickingRenderer('pickList', item => {
        console.log('Plukk-vare klikket:', item);
        // Implementer klikk-handling her om nødvendig
    });
    
    renderers.receive = createReceivingRenderer('receiveList', item => {
        console.log('Mottaks-vare klikket:', item);
        // Implementer klikk-handling her om nødvendig
    });
    
    renderers.return = createReturnsRenderer('returnList', item => {
        console.log('Retur-vare klikket:', item);
        // Implementer klikk-handling her om nødvendig
    });
}

/**
 * Oppdaterer alle UI-renderers
 */
function updateAllUIRenderers() {
    // Oppdater alle renderers
    if (renderers.pick) renderers.pick.render();
    if (renderers.receive) renderers.receive.render();
    if (renderers.return) renderers.return.render();
}

/**
 * Initialiserer kamera og bluetooth skannere
 */
function initializeScanners() {
    // Finn alle kamera-elementer
    const cameraModules = [
        {
            video: document.getElementById('videoPickScanner'),
            canvas: document.getElementById('canvasPickScanner'),
            overlay: document.getElementById('scannerPickOverlay'),
            module: 'pick'
        },
        {
            video: document.getElementById('videoReceiveScanner'),
            canvas: document.getElementById('canvasReceiveScanner'),
            overlay: document.getElementById('scannerReceiveOverlay'),
            module: 'receive'
        },
        {
            video: document.getElementById('videoReturnScanner'),
            canvas: document.getElementById('canvasReturnScanner'),
            overlay: document.getElementById('scannerReturnOverlay'),
            module: 'return'
        }
    ];
    
    // Initialiser hver kameraskanner
    cameraModules.forEach(module => {
        if (module.video && module.canvas && module.overlay) {
            initCameraScanner(
                module.video,
                module.canvas,
                module.overlay,
                window[`handle${capitalizeFirstLetter(module.module)}Scan`],
                updateScannerStatus,
                module.module
            );
        }
    });
    
    // Sett opp event handlers for bluetooth-skanner-knapper
    setupBluetoothButtons();
}

/**
 * Setter opp knapper for bluetooth-tilkobling
 */
function setupBluetoothButtons() {
    const bluetoothButtons = [
        { id: 'connectScannerPick', module: 'pick' },
        { id: 'connectScannerReceive', module: 'receive' },
        { id: 'connectScannerReturn', module: 'return' }
    ];
    
    bluetoothButtons.forEach(button => {
        const element = document.getElementById(button.id);
        if (element) {
            element.addEventListener('click', async () => {
                try {
                    showToast('Kobler til Bluetooth-skanner...', 'info');
                    await connectToBluetoothScanner();
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        }
    });
}

/**
 * Sikker operasjon-wrapper med feilhåndtering
 * @param {Function} operation - Operasjon som skal utføres
 * @param {string} name - Navn på operasjonen for logging
 * @returns {Promise} Resultat av operasjonen
 */
async function safeOperation(operation, name) {
    try {
        const result = operation();
        // Hvis operasjonen returnerer et promise, vent på det
        if (result && typeof result.then === 'function') {
            return await result;
        }
        return result;
    } catch (error) {
        console.error(`Feil i ${name}-operasjon:`, error);
        // Fortsett utførelse, bare logg feilen
        return null;
    }
}

/**
 * Setter opp Force Refresh-knappen
 */
function setupForceRefreshButton() {
    const forceRefreshBtn = document.getElementById('forceRefreshBtn');
    if (forceRefreshBtn) {
        forceRefreshBtn.addEventListener('click', forceRefresh);
    }
}

/**
 * Tvinger en full oppdatering av applikasjonen
 */
function forceRefresh() {
    // Vis lastestatus
    const refreshBtn = document.getElementById('forceRefreshBtn');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 5px; animation: spin 1s linear infinite;"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg> Laster...';
    }
    
    // Avregistrer service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (let registration of registrations) {
                registration.unregister();
                console.log('Service Worker avregistrert');
            }
        });
    }
    
    // Tøm caches
    if ('caches' in window) {
        caches.keys().then(function(names) {
            for (let name of names) {
                caches.delete(name);
                console.log('Cache slettet:', name);
            }
        });
    }
    
    // Vent litt for at caches og service workers skal slettes
    setTimeout(function() {
        // Tving en full oppdatering med tidsstempel for å omgå nettleserens cache
        window.location.href = window.location.href.split('?')[0] + '?refresh=' + new Date().getTime();
    }, 1500);
}

/**
 * Hjelpefunksjon for å gjøre første bokstav stor
 * @param {string} str - Strengen som skal endres
 * @returns {string} Strengen med stor første bokstav
 */
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Eksporter nyttige funksjoner
export {
    initializeApp,
    updateAllUIRenderers,
    renderers,
    capitalizeFirstLetter
};