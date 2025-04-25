// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\settings-module.js
import { ModuleComponent } from '../components/ModuleComponent.js';
import { ButtonComponent } from '../components/ButtonComponent.js';
import eventBus from '../modules/event-bus.js';
import { appState } from '../app.js';
import { saveSettings } from './storage.js';
import { showToast } from './utils.js';

/**
 * SettingsModule - Innstillingsmodul for applikasjonen
 * @extends ModuleComponent
 */
export class SettingsModule extends ModuleComponent {
    constructor(options = {}) {
        super({
            moduleId: 'settings',
            title: 'Innstillinger',
            icon: 'cog',
            ...options
        });
        
        // Modulspesifikke data
        this.settings = {
            scannerType: 'camera', // 'camera', 'bluetooth', 'manual'
            autoQuantity: true,
            darkMode: false,
            language: 'no',
            developerMode: false
        };
        
        // Bind metoder til this-kontekst
        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleResetSettings = this.handleResetSettings.bind(this);
        this.handleClearStorageClick = this.handleClearStorageClick.bind(this);
        this.handleDarkModeToggle = this.handleDarkModeToggle.bind(this);
        this.loadData = this.loadData.bind(this);
        this.saveData = this.saveData.bind(this);
        this.updateUI = this.updateUI.bind(this);
    }
    
    /**
     * Initialiser UI-komponenter
     */
    initComponents() {
        // Opprett HTML for innstillingsskjema
        const settingsForm = document.createElement('form');
        settingsForm.id = 'settings-form';
        settingsForm.addEventListener('submit', this.handleFormSubmit);
        
        settingsForm.innerHTML = `
            <div class="settings-section">
                <h3>Generelle innstillinger</h3>
                
                <div class="form-group">
                    <label for="scanner-type">Strekkodeskanner:</label>
                    <select id="scanner-type" name="scannerType">
                        <option value="camera">Kamera</option>
                        <option value="bluetooth">Bluetooth</option>
                        <option value="manual">Manuell inntasting</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="autoQuantity" id="auto-quantity">
                        Automatisk sett antall til 1
                    </label>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="darkMode" id="dark-mode">
                        Mørk modus
                    </label>
                </div>
                
                <div class="form-group">
                    <label for="language">Språk:</label>
                    <select id="language" name="language">
                        <option value="no">Norsk</option>
                        <option value="en">Engelsk</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-section">
                <h3>Avanserte innstillinger</h3>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="developerMode" id="developer-mode">
                        Utviklermodus
                    </label>
                </div>
            </div>
            
            <div class="button-container">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Lagre innstillinger
                </button>
            </div>
        `;
        
        this.appendChild(settingsForm);
        
        // Opprett knapper for administrasjon
        const adminSection = document.createElement('div');
        adminSection.className = 'settings-section admin-section';
        adminSection.innerHTML = '<h3>Administrasjon</h3>';
        
        const resetButton = new ButtonComponent({
            id: 'reset-settings-btn',
            text: 'Tilbakestill innstillinger',
            icon: 'undo',
            type: 'warning',
            onClick: this.handleResetSettings
        });
        
        const clearStorageButton = new ButtonComponent({
            id: 'clear-storage-btn',
            text: 'Tøm all data',
            icon: 'trash',
            type: 'danger',
            onClick: this.handleClearStorageClick
        });
        
        // Opprett en div for knappene
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        
        // Legg til knappene i knappebeholderen
        resetButton.appendToContainer(buttonContainer);
        clearStorageButton.appendToContainer(buttonContainer);
        
        // Legg til knappebeholderen i admin-seksjonen
        adminSection.appendChild(buttonContainer);
        
        // Legg til admin-seksjonen i modulen
        this.appendChild(adminSection);
        
        // Legg til komponenter i modulen
        this.addComponent('resetButton', resetButton);
        this.addComponent('clearStorageButton', clearStorageButton);
    }
    
    /**
     * Last data fra lagring
     */
    loadData() {
        // Last innstillinger fra appState
        if (appState.settings) {
            this.settings = { ...this.settings, ...appState.settings };
        }
        
        // Oppdater UI
        this.updateUI();
    }
    
    /**
     * Lagre data til lagring
     */
    saveData() {
        // Oppdater appState med innstillinger
        appState.settings = { ...this.settings };
        
        // Lagre til localStorage
        saveSettings();
        
        // Utløs hendelse for innstillingsendring
        eventBus.publish('settings:changed', this.settings);
    }
    
    /**
     * Oppdater UI
     */
    updateUI() {
        // Oppdater skjemafelter med lagrede innstillinger
        const form = this.querySelector('#settings-form');
        if (!form) return;
        
        // Oppdater select og checkbox felter
        form.querySelector('#scanner-type').value = this.settings.scannerType;
        form.querySelector('#auto-quantity').checked = this.settings.autoQuantity;
        form.querySelector('#dark-mode').checked = this.settings.darkMode;
        form.querySelector('#language').value = this.settings.language;
        form.querySelector('#developer-mode').checked = this.settings.developerMode;
    }
    
    /**
     * Håndter skjema-innsending
     * @param {Event} event - Skjemahendelsen
     */
    handleFormSubmit(event) {
        event.preventDefault();
        
        // Hent form-elementer
        const form = event.target;
        const formData = new FormData(form);
        
        // Oppdater innstillinger
        this.settings.scannerType = formData.get('scannerType');
        this.settings.language = formData.get('language');
        
        // Håndter checkboxer (FormData.get() returnerer null hvis ikke avkrysset)
        this.settings.autoQuantity = formData.get('autoQuantity') === 'on';
        this.settings.darkMode = formData.get('darkMode') === 'on';
        this.settings.developerMode = formData.get('developerMode') === 'on';
        
        // Lagre innstillinger
        this.saveData();
        
        // Vis bekreftelse
        showToast('Innstillinger lagret');
        
        // Håndter spesielle innstillinger
        if (this.settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
    
    /**
     * Håndter tilbakestilling av innstillinger
     */
    handleResetSettings() {
        if (confirm('Er du sikker på at du vil tilbakestille alle innstillinger til standard?')) {
            // Tilbakestill til standardinnstillinger
            this.settings = {
                scannerType: 'camera',
                autoQuantity: true,
                darkMode: false,
                language: 'no',
                developerMode: false
            };
            
            // Lagre innstillinger
            this.saveData();
            
            // Oppdater UI
            this.updateUI();
            
            // Fjern mørk modus hvis den var på
            document.body.classList.remove('dark-mode');
            
            // Vis bekreftelse
            showToast('Innstillinger tilbakestilt til standard');
        }
    }
    
    /**
     * Håndter sletting av all data
     */
    handleClearStorageClick() {
        if (confirm('ADVARSEL: Dette vil slette all data (varer, ordrer, historikk). Er du sikker?')) {
            if (confirm('Er du HELT sikker? Denne handlingen kan ikke angres.')) {
                // Tøm localStorage og appState
                localStorage.clear();
                
                // Tilbakestill appState
                Object.keys(appState).forEach(key => {
                    if (Array.isArray(appState[key])) {
                        appState[key] = [];
                    } else if (typeof appState[key] === 'object' && appState[key] !== null) {
                        appState[key] = {};
                    }
                });
                
                // Tilbakestill innstillinger
                this.settings = {
                    scannerType: 'camera',
                    autoQuantity: true,
                    darkMode: false,
                    language: 'no',
                    developerMode: false
                };
                appState.settings = { ...this.settings };
                
                // Oppdater UI
                this.updateUI();
                
                // Utløs hendelse for dataendring
                eventBus.publish('data:cleared');
                
                // Vis bekreftelse
                showToast('All data er slettet', 'warning');
                
                // Reload appen etter kort forsinkelse
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        }
    }
    
    /**
     * Håndter toggle av mørk modus
     * @param {boolean} enabled - Om mørk modus skal aktiveres
     */
    handleDarkModeToggle(enabled) {
        this.settings.darkMode = enabled;
        
        if (enabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Oppdater checkbox
        const darkModeCheckbox = this.querySelector('#dark-mode');
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = enabled;
        }
        
        // Lagre innstillinger
        this.saveData();
    }
}