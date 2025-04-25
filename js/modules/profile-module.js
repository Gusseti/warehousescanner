// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\profile-module.js
import { BaseModule } from '../components/BaseModule.js';
import eventBus from '../modules/event-bus.js';
import { getModalManager } from './modal-manager.js';
import { getStorageManager } from './storage.js';

/**
 * ProfileModule - Håndterer brukerinnstillinger og profil
 * @extends BaseModule
 */
export class ProfileModule extends BaseModule {
    /**
     * Oppretter en ny profilmodul
     */
    constructor() {
        super({
            moduleId: 'profile',
            moduleName: 'Profil',
            moduleIcon: 'fas fa-user',
            hasImport: false,
            hasBluetooth: false,
            hasCamera: false,
            hasExport: false
        });
        
        this.storageManager = getStorageManager();
        this.userProfile = this.loadUserProfile();
    }
    
    /**
     * Cache DOM-elementer for raskere tilgang
     * @override
     * @private
     */
    _cacheElements() {
        // Helper function to safely get elements
        const safeGetElement = (id) => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with ID '${id}' not found in ProfileModule, creating a placeholder`);
                // Create placeholder element
                const placeholder = document.createElement('div');
                placeholder.id = id;
                // Create profileModule container if it doesn't exist
                const container = document.getElementById('profileModule') || (() => {
                    const el = document.createElement('div');
                    el.id = 'profileModule';
                    document.body.appendChild(el);
                    return el;
                })();
                container.appendChild(placeholder);
                return placeholder;
            }
            return element;
        };

        this.elementsCache = {
            // Containere
            container: safeGetElement('profileModule'),
            
            // Brukerinfo-elementer
            usernameDisplay: safeGetElement('profileUsername'),
            emailDisplay: safeGetElement('profileEmail'),
            
            // Innstillings-elementer
            themeSelector: safeGetElement('themeSelector'),
            languageSelector: safeGetElement('languageSelector'),
            
            // Knapper
            saveProfileBtn: safeGetElement('saveProfileBtn'),
            logoutBtn: safeGetElement('logoutBtn')
        };
    }
    
    /**
     * Registrer hendelseslyttere
     * @override
     * @private
     */
    _registerEventListeners() {
        const { 
            saveProfileBtn, 
            logoutBtn, 
            themeSelector, 
            languageSelector 
        } = this.elementsCache;
        
        // Add event listeners only if elements exist
        // Lagre profil
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', this.saveProfile.bind(this));
        }
        
        // Logg ut
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.logout.bind(this));
        }
        
        // Tema
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
        
        // Språk
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
        
        // Lytt til endringer i brukerdata
        eventBus.subscribe('user:login', this.handleUserLogin.bind(this));
        eventBus.subscribe('user:logout', this.handleUserLogout.bind(this));
    }
    
    /**
     * Last inn brukerens profil fra lagring
     * @private
     * @returns {Object} Brukerprofildata
     */
    loadUserProfile() {
        return this.storageManager.getItem('userProfile') || {
            theme: 'light',
            language: 'no',
            notifications: true,
            lastLogin: null
        };
    }
    
    /**
     * Lagre brukerens profil til lagring
     * @private
     */
    saveProfile() {
        const { themeSelector, languageSelector } = this.elementsCache;
        
        this.userProfile.theme = themeSelector.value;
        this.userProfile.language = languageSelector.value;
        
        this.storageManager.setItem('userProfile', this.userProfile);
        this.showNotification('Profilinnstillinger lagret', 'success');
        
        // Oppdater UI basert på nye innstillinger
        this.applySettings();
    }
    
    /**
     * Angir tema for applikasjonen
     * @param {string} theme - Temanavn ('light', 'dark')
     */
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.userProfile.theme = theme;
    }
    
    /**
     * Angir språk for applikasjonen
     * @param {string} language - Språkkode ('no', 'en')
     */
    setLanguage(language) {
        // Implementer språkbytting her
        this.userProfile.language = language;
        eventBus.publish('app:languageChanged', language);
    }
    
    /**
     * Anvend alle lagrede innstillinger
     */
    applySettings() {
        this.setTheme(this.userProfile.theme);
        this.setLanguage(this.userProfile.language);
    }
    
    /**
     * Håndter brukerinnlogging
     * @param {Object} userData - Brukerdata fra innlogging
     */
    handleUserLogin(userData) {
        const { usernameDisplay, emailDisplay } = this.elementsCache;
        
        if (userData) {
            usernameDisplay.textContent = userData.username || 'N/A';
            emailDisplay.textContent = userData.email || 'N/A';
            
            this.userProfile.lastLogin = new Date().toISOString();
            this.storageManager.setItem('userProfile', this.userProfile);
            
            // Anvend lagrede innstillinger
            this.applySettings();
        }
    }
    
    /**
     * Håndter brukerutlogging
     */
    handleUserLogout() {
        const { usernameDisplay, emailDisplay } = this.elementsCache;
        
        usernameDisplay.textContent = 'Ikke innlogget';
        emailDisplay.textContent = '';
    }
    
    /**
     * Logg ut bruker
     */
    logout() {
        if (confirm('Er du sikker på at du vil logge ut?')) {
            this.storageManager.removeItem('currentUser');
            eventBus.publish('user:logout');
            window.location.href = 'login.html';
        }
    }
    
    /**
     * Vis notifikasjon til brukeren
     * @param {string} message - Meldingstekst
     * @param {string} type - Notifikasjonstype ('success', 'error', 'warning', 'info')
     */
    showNotification(message, type = 'info') {
        eventBus.publish('notification:show', { message, type });
    }
    
    /**
     * Initialiser visning av modulen
     * @override
     */
    initialize() {
        super.initialize();
        this.applySettings();
        
        // Sett innstillingsverdier basert på lagret profil
        const { themeSelector, languageSelector } = this.elementsCache;
        
        if (themeSelector) themeSelector.value = this.userProfile.theme;
        if (languageSelector) languageSelector.value = this.userProfile.language;
        
        // Hent evt. innlogget brukerdata
        const currentUser = this.storageManager.getItem('currentUser');
        if (currentUser) {
            this.handleUserLogin(currentUser);
        }
    }
}