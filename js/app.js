// filepath: s:\Workspace\GitHub\warehousescanner\js\app.js
/**
 * Hovedapplikasjonsfil for SnapScan Warehouse Scanner
 */
import { moduleRegistry } from './modules/module-registry.js';
import eventBus from './modules/event-bus.js';
import { PickingModule } from './modules/picking-module.js';
import { ReceivedModule } from './modules/receiving-module.js';
import { ReturnsModule } from './modules/returns-module.js';
import { SettingsModule } from './modules/settings-module.js';
import { ProfileModule } from './modules/profile-module.js';

// Eksporter appState for å brukes i andre moduler
export const appState = window.appState || {
    currentModule: null,
    pickListItems: [],
    pickedItems: [],
    lastPickedItem: null,
    receiveListItems: [],
    receivedItems: [],
    lastReceivedItem: null,
    returnListItems: [],
    lastReturnedItem: null,
    barcodeMapping: {},
    itemWeights: {},
    settings: {
        weightUnit: 'kg',
        defaultItemWeight: 1.0,
        theme: 'light'
    }
};

// Sikre at appState er tilgjengelig globalt
window.appState = appState;

// App-klasse - hovedkontroller for hele applikasjonen
class App {
    constructor() {
        this.isInitialized = false;
        this.defaultModule = 'picking'; // Standard modul som vises ved oppstart
        
        // Bind metoder til this-kontekst
        this.init = this.init.bind(this);
        this.registerModules = this.registerModules.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.showModule = this.showModule.bind(this);
        this.initTheme = this.initTheme.bind(this);
        this.setupUserProfile = this.setupUserProfile.bind(this);
    }
    
    /**
     * Initialiserer applikasjonen 
     */
    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing SnapScan application...');
        
        // Registrer moduler
        this.registerModules();
        
        // Sett opp hendelseslyttere
        this.setupEventListeners();
        
        // Initialiser moduler
        moduleRegistry.initializeModules();
        
        // Initialiser tema (lys/mørk)
        this.initTheme();
        
        // Sett opp brukerprofil
        this.setupUserProfile();
        
        // Vis standardmodulen
        this.showModule(this.defaultModule);
        
        // Applikasjonen er nå initialisert
        this.isInitialized = true;
        console.log('SnapScan application initialized successfully.');
        
        // Publiser app-initialisert-hendelse
        eventBus.publish('app:initialized', {
            defaultModule: this.defaultModule
        });
        
        // Gjør app-instansen tilgjengelig globalt (for debugging og eldre kode)
        window.app = this;
    }
    
    /**
     * Registrer alle applikasjonsmoduler
     */
    registerModules() {
        console.log('Registering application modules...');
        
        // Opprett og registrer modulinstanser
        moduleRegistry.registerModule('picking', new PickingModule());
        moduleRegistry.registerModule('receiving', new ReceivedModule());
        moduleRegistry.registerModule('returns', new ReturnsModule());
        moduleRegistry.registerModule('settings', new SettingsModule());
        moduleRegistry.registerModule('profile', new ProfileModule());
        
        console.log('Modules registered:', Object.keys(moduleRegistry.getAllModules()).join(', '));
    }
    
    /**
     * Sett opp hendelseslyttere for applikasjonen
     */
    setupEventListeners() {
        console.log('Setting up application event listeners...');
        
        // Lytt etter menyknappklikk
        document.querySelectorAll('.menu-item').forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                const moduleId = menuItem.getAttribute('data-module');
                if (moduleId) {
                    this.showModule(moduleId);
                }
            });
        });
        
        // Tilbakeknapp
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Hvis en modul er aktiv, gå tilbake til hovedmenyen
                if (moduleRegistry.getActiveModuleId() && document.getElementById('mainMenu').style.display === 'none') {
                    this.showMainMenu();
                } else {
                    // Hvis allerede på hovedmenyen, spør om brukeren vil avslutte
                    if (confirm('Er du sikker på at du vil avslutte?')) {
                        window.close(); // Vil ikke fungere i de fleste nettlesere
                        // Omdiriger til innloggingssiden som en alternativ "exit"
                        window.location.href = 'login.html';
                    }
                }
            });
        }
        
        // Lytt etter tema-toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const isDarkMode = e.target.checked;
                this.setTheme(isDarkMode ? 'dark' : 'light');
            });
        }
        
        // Lytt etter strekkoderegistrering fra eventBus
        eventBus.subscribe('barcode:scanned', (data) => {
            console.log('Global barcode scan event:', data);
            // Eventuelle globale handlinger for strekkodeskanning
        });
        
        // Lydtekst i innstillingene
        const themeToggleSettings = document.getElementById('themeToggleSettings');
        if (themeToggleSettings) {
            themeToggleSettings.addEventListener('change', (e) => {
                const isDarkMode = e.target.checked;
                this.setTheme(isDarkMode ? 'dark' : 'light');
                
                // Synkroniser med hovedbryteren
                if (themeToggle) {
                    themeToggle.checked = isDarkMode;
                }
            });
        }
        
        // Innstillingstabs
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                this.showSettingsTab(tabId);
            });
        });
        
        // Logg ut-knapp (allerede implementert i HTML-filen)
    }
    
    /**
     * Vis en bestemt modul 
     * @param {string} moduleId - ID til modulen som skal vises
     */
    showModule(moduleId) {
        console.log(`Attempting to show module: ${moduleId}`);
        
        // Skjul hovedmenyen først
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu) {
            mainMenu.style.display = 'none';
        }
        
        // Bruk modulregisteret til å aktivere modulen
        if (moduleRegistry.hasModule(moduleId)) {
            moduleRegistry.activateModule(moduleId);
        } else {
            console.error(`Module '${moduleId}' not found.`);
            
            // Fallback til hovedmenyen hvis modulen ikke finnes
            this.showMainMenu();
        }
    }
    
    /**
     * Vis hovedmenyen
     */
    showMainMenu() {
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu) {
            mainMenu.style.display = 'block';
        }
        
        // Skjul alle moduler
        document.querySelectorAll('.module-container').forEach(container => {
            container.style.display = 'none';
        });
        
        // Nullstill aktiv modul i registeret
        moduleRegistry.activeModuleId = null;
    }
    
    /**
     * Vis en innstillingsfane
     * @param {string} tabId - ID til fanen som skal vises
     */
    showSettingsTab(tabId) {
        // Skjul alle faner
        document.querySelectorAll('.settings-tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Fjern aktiv klasse fra alle faneknapper
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Vis valgt fane
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Sett aktiv klasse på valgt faneknapp
        const selectedBtn = document.querySelector(`.settings-tab-btn[data-tab="${tabId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
    }
    
    /**
     * Initialiser temaet (lys/mørk)
     */
    initTheme() {
        // Sjekk lagret tema-preferanse
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        
        // Oppdater bryteren i UI
        const themeToggle = document.getElementById('themeToggle');
        const themeToggleSettings = document.getElementById('themeToggleSettings');
        
        if (themeToggle) {
            themeToggle.checked = savedTheme === 'dark';
        }
        
        if (themeToggleSettings) {
            themeToggleSettings.checked = savedTheme === 'dark';
        }
    }
    
    /**
     * Sett tema (lys/mørk)
     * @param {string} theme - 'light' eller 'dark'
     */
    setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Lagre i localStorage
        localStorage.setItem('theme', theme);
        
        // Oppdater meta theme-color for mobile
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#2196f3');
        }
        
        // Publiser hendelse
        eventBus.publish('theme:changed', { theme });
    }
    
    /**
     * Konfigurer brukerprofilvisning
     */
    setupUserProfile() {
        // Hent brukerdata fra localStorage
        const currentUser = localStorage.getItem('snapscan_user');
        if (!currentUser) return;
        
        try {
            const user = JSON.parse(currentUser);
            
            // Oppdater avatarvisningen
            const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            
            // Sett avatar i header
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            
            if (userAvatar) userAvatar.textContent = initials;
            if (userName) userName.textContent = user.name || 'Bruker';
            
            // Sett avatar og navn i profilmodulen
            const profileAvatar = document.getElementById('profileAvatar');
            const profileName = document.getElementById('profileName');
            const profileCompany = document.getElementById('profileCompany');
            const profileFullName = document.getElementById('profileFullName');
            const profileEmail = document.getElementById('profileEmail');
            const profileCompanyDetail = document.getElementById('profileCompanyDetail');
            const profileRole = document.getElementById('profileRole');
            const profileCreated = document.getElementById('profileCreated');
            
            if (profileAvatar) profileAvatar.textContent = initials;
            if (profileName) profileName.textContent = user.name || 'Bruker';
            if (profileCompany) profileCompany.textContent = user.company || 'Firma';
            if (profileFullName) profileFullName.textContent = user.name || 'Bruker';
            if (profileEmail) profileEmail.textContent = user.email || 'Ikke angitt';
            if (profileCompanyDetail) profileCompanyDetail.textContent = user.company || 'Ikke angitt';
            if (profileRole) profileRole.textContent = user.role || 'Bruker';
            
            // Formater dato
            if (profileCreated && user.created) {
                const date = new Date(user.created);
                profileCreated.textContent = date.toLocaleDateString('no-NO');
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }
}

// Opprett og initialiser applikasjonen når DOM er lastet
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});