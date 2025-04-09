// app.js - Improved main application file with enhanced error handling
import { initUi, showMainMenu, showModule } from './modules/ui.js';
import { loadSettings, saveSettings, loadItemWeights, loadBarcodeMappingFromStorage, loadListsFromStorage } from './modules/storage.js';
import { initPicking } from './modules/picking.js';
import { initReceiving } from './modules/receiving.js';
import { initReturns } from './modules/returns.js';
import { initSettings } from './modules/settings.js';
import { showToast } from './modules/utils.js';
import { initWeights } from './modules/weights.js';

// App state with default values for safety
export let appState = {
    // Module view
    currentModule: null,
    
    // Pick model
    pickListItems: [],
    pickedItems: [],
    lastPickedItem: null,
    
    // Receive model
    receiveListItems: [],
    receivedItems: [],
    lastReceivedItem: null,
    
    // Return model
    returnListItems: [],
    
    // Barcode mapping
    barcodeMapping: {}, 
    
    // Settings with fallback defaults
    settings: {
        weightUnit: 'kg',
        defaultItemWeight: 1.0
    },
    
    // Item weights
    itemWeights: {}
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Register service worker with improved error handling
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
                // Continue app initialization anyway - service worker is not critical
            });
    });
} else {
    console.log('Service Worker API not supported in this browser');
}

/**
 * Initialize the application with retry logic and error handling
 */
async function initializeApp() {
    try {
        console.log('Initializing application...');
        
        // Add global error handler for unexpected errors
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('Global error handler caught:', { message, source, lineno, colno, error });
            showToast('En uventet feil oppstod. Se konsollen for detaljer.', 'error');
            return false; // Let the default handler run as well
        };
        
        // Load stored data with error handling
        await loadStoredData();
        
        // Initialize UI and modules
        await initModules();
        
        // Retrieve stored module and display it, or show main menu
        const storedModule = localStorage.getItem('currentModule');
        if (storedModule) {
            showModule(storedModule);
        } else {
            showMainMenu();
        }
        
        console.log('Application initialized successfully');
        
        // Add refresh button handler for debug mode
        const forceRefreshBtn = document.getElementById('forceRefreshBtn');
        if (forceRefreshBtn) {
            forceRefreshBtn.addEventListener('click', forceRefresh);
        }
    } catch (error) {
        console.error('Error during application initialization:', error);
        showToast('Det oppstod en feil ved oppstart av applikasjonen. Vi vil prøve igjen.', 'error');
        
        // Add retry logic
        setTimeout(() => {
            console.log('Retrying application initialization...');
            window.location.reload();
        }, 3000); // Retry after 3 seconds
    }
}

/**
 * Load all stored data with error handling
 */
async function loadStoredData() {
    try {
        // Load barcode mapping
        await safeOperation(loadBarcodeMappingFromStorage, 'barcode mapping');
        
        // Load settings
        await safeOperation(loadSettings, 'settings');
        
        // Load item weights
        await safeOperation(loadItemWeights, 'item weights');
        
        // Load lists
        await safeOperation(loadListsFromStorage, 'lists');
        
        console.log('All stored data loaded successfully');
    } catch (error) {
        console.error('Error loading stored data:', error);
        throw new Error('Failed to load stored data: ' + error.message);
    }
}

/**
 * Initialize all modules with error handling
 */
async function initModules() {
    try {
        // Initialize UI handling first
        await safeOperation(initUi, 'UI');
        
        // Initialize functional modules
        await safeOperation(initPicking, 'picking module');
        await safeOperation(initReceiving, 'receiving module');
        await safeOperation(initReturns, 'returns module');
        await safeOperation(initSettings, 'settings module');
        await safeOperation(initWeights, 'weights module');
        
        console.log('All modules initialized successfully');
    } catch (error) {
        console.error('Error initializing modules:', error);
        throw new Error('Failed to initialize modules: ' + error.message);
    }
}

/**
 * Safe operation wrapper with error handling
 * @param {Function} operation - Operation to perform
 * @param {string} name - Name of the operation for logging
 * @returns {Promise} Result of the operation
 */
async function safeOperation(operation, name) {
    try {
        const result = operation();
        // If the operation returns a promise, await it
        if (result && typeof result.then === 'function') {
            return await result;
        }
        return result;
    } catch (error) {
        console.error(`Error in ${name} operation:`, error);
        // Continue execution, just log the error
        return null;
    }
}

/**
 * Force refresh the application
 */
function forceRefresh() {
    // Show loading status
    const refreshBtn = document.getElementById('forceRefreshBtn');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 5px; animation: spin 1s linear infinite;"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg> Laster...';
    }
    
    // Unregister service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (let registration of registrations) {
                registration.unregister();
                console.log('Service Worker unregistered');
            }
        });
    }
    
    // Clear caches
    if ('caches' in window) {
        caches.keys().then(function(names) {
            for (let name of names) {
                caches.delete(name);
                console.log('Cache deleted:', name);
            }
        });
    }
    
    // Wait a bit for caches and service workers to be deleted
    setTimeout(function() {
        // Force a full refresh with timestamp to bypass browser cache
        window.location.href = window.location.href.split('?')[0] + '?refresh=' + new Date().getTime();
    }, 1500);
}

// Export functions for use in other modules
export {
    initializeApp,
    safeOperation
};