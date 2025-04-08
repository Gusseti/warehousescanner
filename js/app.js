// app.js - Hovedkodefil for Lagerstyringsappen
import { initUi, showMainMenu, showModule } from './modules/ui.js';
import { loadSettings, saveSettings, loadItemWeights, loadBarcodeMappingFromStorage } from './modules/storage.js';
import { initPicking } from './modules/picking.js';
import { initReceiving } from './modules/receiving.js';
import { initReturns } from './modules/returns.js';
import { initSettings } from './modules/settings.js';
import { showToast } from './modules/utils.js';

// Applikasjonens state
export let appState = {
    // Modulevisning
    currentModule: null,
    
    // Datamodell for plukking
    pickListItems: [],
    pickedItems: [],
    lastPickedItem: null,
    
    // Datamodell for mottak
    receiveListItems: [],
    receivedItems: [],
    lastReceivedItem: null,
    
    // Datamodell for retur
    returnListItems: [],
    
    // Strekkodeoversikt
    barcodeMapping: {}, 
    
    // Innstillinger
    settings: {
        weightUnit: 'kg',
        defaultItemWeight: 1.0
    },
    
    // Vektdata for varer
    itemWeights: {}
};

// Initialiser applikasjonen når dokumentet er lastet
document.addEventListener('DOMContentLoaded', initializeApp);

// Registrer service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registrert:', registration);
            })
            .catch(error => {
                console.log('Service Worker registrering feilet:', error);
            });
    });
}

/**
 * Initialiser applikasjonen
 */
function initializeApp() {
    try {
        console.log('Initialiserer applikasjon...');
        
        // Last inn lagrede data
        loadBarcodeMappingFromStorage();
        loadSettings();
        loadItemWeights();
        
        // Initialiser UI-håndtering
        initUi();
        
        // Initialiser moduler
        initPicking();
        initReceiving();
        initReturns();
        initSettings();
        
        // Hent lagret modul og vis den, eller vis hovedmeny
        const storedModule = localStorage.getItem('currentModule');
        if (storedModule) {
            showModule(storedModule);
        } else {
            showMainMenu();
        }
        
        console.log('Applikasjon initialisert');
    } catch (error) {
        console.error('Feil ved initialisering av applikasjon:', error);
        showToast('Det oppstod en feil ved oppstart av applikasjonen. Prøv å laste siden på nytt.', 'error');
    }
}

// Eksporter funksjoner for bruk i andre moduler
export {
    initializeApp
};