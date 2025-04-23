// app.js - Hovedapplikasjonen

// Import nødvendige moduler
import { initScanner, closeScanner } from './modules/scanner.js';
import { updatePickingUI, registerPickingHandlers } from './modules/picking.js';
import { updateReceivingUI, registerReceivingHandlers } from './modules/receiving.js';
import { updateReturnsUI, registerReturnsHandlers } from './modules/returns.js';
import { registerSettingsHandlers } from './modules/settings.js';
import { 
    loadBarcodeMappingFromStorage, 
    loadListsFromStorage, 
    loadSettings,
    loadItemWeights
} from './modules/storage.js';
import { showToast, hideToast } from './modules/utils.js';

// Global app state
export const appState = {
    isScanning: false,
    currentModule: null,
    barcodeMapping: {},
    pickListItems: [],
    pickedItems: [],
    lastPickedItem: null,
    receiveListItems: [],
    receivedItems: [],
    lastReceivedItem: null,
    returnListItems: [],
    scannerConnected: false,
    itemWeights: {},
    settings: {
        weightUnit: 'kg',
        defaultItemWeight: 1.0,
        theme: 'light'
    },
    // Bruker-informasjon
    user: null
};

/**
 * Sjekker om brukeren er logget inn, og om ikke, omdirigerer til login-siden
 */
function checkLoginStatus() {
    const currentUser = localStorage.getItem('snapscan_user');
    if (!currentUser) {
        // Omdirigerer til login-siden hvis brukeren ikke er logget inn
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        // Parse brukerdata og sett i app state
        appState.user = JSON.parse(currentUser);
        console.log('Bruker logget inn:', appState.user.name);
        
        // Oppdater brukergrensesnitt hvis vi er på dashboard
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');
        
        if (userNameElement && appState.user.name) {
            userNameElement.textContent = appState.user.name;
        }
        
        if (userAvatarElement && appState.user.name) {
            userAvatarElement.textContent = appState.user.name.substring(0, 1).toUpperCase();
        }
        
        return true;
    } catch (error) {
        console.error('Feil ved parsing av brukerdata:', error);
        localStorage.removeItem('snapscan_user');
        window.location.href = 'login.html';
        return false;
    }
}

/**
 * Initialiser applikasjonen
 */
async function initApp() {
    console.log('Initialiserer SnapScan applikasjon...');
    
    // Sjekk om vi er på en side som krever innlogging
    const requiresLogin = document.body.classList.contains('requires-login') || 
                         window.location.href.includes('dashboard.html');
                         
    if (requiresLogin) {
        // Sjekk om brukeren er logget inn
        if (!checkLoginStatus()) {
            return; // Avslutter initialiseringen hvis brukeren ikke er logget inn
        }
    }
    
    // Register service worker hvis støttet
    if ('serviceWorker' in navigator) {
        try {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrert:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registrering feilet:', error);
                });
        } catch (error) {
            console.error('Feil ved Service Worker registrering:', error);
        }
    }

    // Hvis dette er en side som krever barcodedata, last den
    if (document.getElementById('mainMenu') || 
        document.getElementById('pickingModule') || 
        document.getElementById('receivingModule') || 
        document.getElementById('returnsModule') || 
        document.getElementById('settingsModule')) {
        
        try {
            // Last strekkodeoversikt fra lagring
            await loadBarcodeMappingFromStorage();
            
            // Last vektdata fra lagring
            loadItemWeights();
            
            // Last innstillinger
            loadSettings();
            
            // Last lister fra lagring
            loadListsFromStorage();
            
            console.log('Applikasjonen er initialisert med data fra lagring');
        } catch (error) {
            console.error('Feil ved lasting av data fra lagring:', error);
        }
    }

    // Hvis vi er på dashboard-siden
    if (document.getElementById('mainMenu')) {
        registerDashboardHandlers();
    }
    
    // Hvis vi er på login eller register
    if (document.getElementById('loginForm')) {
        registerLoginHandlers();
    } else if (document.getElementById('registerForm')) {
        registerRegisterHandlers();
    }
    
    // Vis om vi er online
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    console.log('Applikasjonsinitialisering fullført');
}

/**
 * Oppdaterer UI basert på online-status
 */
function updateOnlineStatus() {
    if (navigator.onLine) {
        document.documentElement.classList.remove('offline');
        document.documentElement.classList.add('online');
    } else {
        document.documentElement.classList.remove('online');
        document.documentElement.classList.add('offline');
        
        showToast('Du er offline. Noen funksjoner vil ikke være tilgjengelige.', 'warning', 5000);
    }
}

/**
 * Registrer event handlers for login-siden
 */
function registerLoginHandlers() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !password) {
                showToast('Vennligst fyll ut alle feltene', 'error');
                return;
            }
            
            // Simulert innlogging (i en produksjonsapp ville dette gjøres mot en server)
            const users = JSON.parse(localStorage.getItem('snapscan_users') || '[]');
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (user && user.password === password) {
                // Ikke lagre passordet i localStorage
                const { password, ...userWithoutPassword } = user;
                
                // Lagre bruker i localStorage
                localStorage.setItem('snapscan_user', JSON.stringify(userWithoutPassword));
                
                // Omdirigere til dashboard
                window.location.href = 'dashboard.html';
            } else {
                showToast('Ugyldig e-post eller passord', 'error');
            }
        });
    }
}

/**
 * Registrer event handlers for registrering-siden
 */
function registerRegisterHandlers() {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const registerBtn = document.getElementById('registerBtn');
    
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            if (!name || !email || !password || !confirmPassword) {
                showToast('Vennligst fyll ut alle feltene', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showToast('Passordene stemmer ikke overens', 'error');
                return;
            }
            
            if (password.length < 6) {
                showToast('Passordet må være minst 6 tegn', 'error');
                return;
            }
            
            // Sjekk om e-postadressen allerede er i bruk
            const users = JSON.parse(localStorage.getItem('snapscan_users') || '[]');
            if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
                showToast('E-postadressen er allerede i bruk', 'error');
                return;
            }
            
            // Legg til ny bruker
            const newUser = {
                id: 'user_' + Date.now(),
                name,
                email,
                password,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            localStorage.setItem('snapscan_users', JSON.stringify(users));
            
            // Ikke lagre passordet i localStorage for den innloggede brukeren
            const { password: pass, ...userWithoutPassword } = newUser;
            localStorage.setItem('snapscan_user', JSON.stringify(userWithoutPassword));
            
            // Initialiser tom brukerdata
            const userStorageKey = `snapscan_data_${newUser.id}`;
            const userData = {
                barcodes: {},
                pickings: [],
                receivings: [],
                returns: [],
                settings: {
                    weightUnit: 'kg',
                    defaultItemWeight: 1,
                    theme: 'light'
                }
            };
            localStorage.setItem(userStorageKey, JSON.stringify(userData));
            
            // Omdirigere til dashboard
            window.location.href = 'dashboard.html';
        });
    }
}

/**
 * Registrerer event handlers for dashboard-siden
 */
function registerDashboardHandlers() {
    // Registrer handlers for moduler
    registerPickingHandlers();
    registerReceivingHandlers();
    registerReturnsHandlers();
    registerSettingsHandlers();
    
    // Registrer handlinger for hovedmenyen
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-module');
            showModule(moduleId);
        });
    });
    
    // Tilbakeknapp-funksjonalitet
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (appState.currentModule) {
                // Gå tilbake til hovedmenyen
                showModule(null);
            } else {
                // Hvis vi allerede er i hovedmenyen, ikke gjør noe
                // Alternativt kan vi navigere tilbake til forrige side i historien
                // history.back();
            }
        });
    }
    
    // Mørk/lys modus toggle i header
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            const isDarkMode = this.checked;
            toggleDarkMode(isDarkMode);
        });
    }
    
    // Vis hovedmenyen som standard
    showModule(null);
    
    // Sjekk om en modul er angitt i URL
    const urlParams = new URLSearchParams(window.location.search);
    const moduleParam = urlParams.get('module');
    if (moduleParam) {
        showModule(moduleParam);
    }
    
    // Logg ut-knapp
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('snapscan_user');
            window.location.href = 'login.html';
        });
    }
}

/**
 * Viser en spesifikk modul og skjuler alle andre.
 * @param {string|null} moduleId - ID på modulen som skal vises, eller null for hovedmenyen
 */
function showModule(moduleId) {
    console.log(`Viser modul: ${moduleId || 'hovedmeny'}`);
    
    // Skjul alle moduler
    document.querySelectorAll('.module-container').forEach(module => {
        module.style.display = 'none';
    });
    
    // Skjul eller vis hovedmenyen
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) {
        mainMenu.style.display = moduleId ? 'none' : 'block';
    }
    
    // Hvis moduleId er null, viser vi hovedmenyen
    if (!moduleId) {
        appState.currentModule = null;
        document.body.classList.remove('module-open');
        return;
    }
    
    // Vis den valgte modulen
    const moduleElement = document.getElementById(`${moduleId}Module`);
    if (moduleElement) {
        moduleElement.style.display = 'block';
        appState.currentModule = moduleId;
        document.body.classList.add('module-open');
        
        // Oppdater URL med modulen som parameter
        const url = new URL(window.location);
        url.searchParams.set('module', moduleId);
        window.history.pushState({}, '', url);
        
        // Kaller aktuell oppdateringsfunksjon
        switch (moduleId) {
            case 'picking':
                updatePickingUI();
                break;
            case 'receiving':
                updateReceivingUI();
                break;
            case 'returns':
                updateReturnsUI();
                break;
        }
    } else {
        console.error(`Fant ikke modul: ${moduleId}`);
    }
}

/**
 * Bytter mellom mørk og lys modus
 * @param {boolean} enableDark - Sett til true for mørk modus, false for lys modus
 */
function toggleDarkMode(enableDark) {
    if (enableDark) {
        document.body.classList.add('dark-mode');
        appState.settings.theme = 'dark';
    } else {
        document.body.classList.remove('dark-mode');
        appState.settings.theme = 'light';
    }
    
    // Synkroniser andre tema-toggles
    const themeToggleSettings = document.getElementById('themeToggleSettings');
    if (themeToggleSettings) {
        themeToggleSettings.checked = enableDark;
    }
    
    // Lagre innstillingen
    if (window.currentUserData) {
        window.currentUserData.data.settings = { ...appState.settings };
        localStorage.setItem(window.currentUserData.storageKey, JSON.stringify(window.currentUserData.data));
    } else {
        localStorage.setItem('settings', JSON.stringify(appState.settings));
    }
}

// Initialiser appen når DOM er lastet
document.addEventListener('DOMContentLoaded', initApp);

// Gjør internaliser appen tilgjengelig globalt
window.app = {
    showModule,
    toggleDarkMode
};