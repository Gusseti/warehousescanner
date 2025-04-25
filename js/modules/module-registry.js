// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\module-registry.js
/**
 * ModuleRegistry - Registrerer og håndterer alle moduler i applikasjonen
 */
import eventBus from './event-bus.js';

// Singleton-klasse for modulhåndtering
class ModuleRegistry {
    constructor() {
        // Modulbibliotek - hvor alle moduler registreres
        this.modules = {};
        
        // Aktiv modul
        this.activeModuleId = null;
        
        // Initialisering som er fullført
        this.initialized = false;
    }
    
    /**
     * Registrer en modul
     * @param {string} moduleId - Unik ID for modulen
     * @param {Object} moduleInstance - Modulinstans (BaseModule-subklasse)
     */
    registerModule(moduleId, moduleInstance) {
        if (this.modules[moduleId]) {
            console.warn(`Module with ID '${moduleId}' is already registered.`);
            return false;
        }
        
        this.modules[moduleId] = moduleInstance;
        console.log(`Module '${moduleId}' registered successfully.`);
        
        return true;
    }
    
    /**
     * Hent en registrert modul
     * @param {string} moduleId - ID-en til modulen som skal hentes
     * @returns {Object|null} Modulinstansen eller null hvis den ikke finnes
     */
    getModule(moduleId) {
        return this.modules[moduleId] || null;
    }
    
    /**
     * Sjekk om en modul er registrert
     * @param {string} moduleId - ID-en til modulen som skal sjekkes
     * @returns {boolean} True hvis modulen er registrert
     */
    hasModule(moduleId) {
        return !!this.modules[moduleId];
    }
    
    /**
     * Initialiser alle registrerte moduler
     */
    initializeModules() {
        if (this.initialized) return;
        
        console.log('Initializing all modules...');
        
        Object.entries(this.modules).forEach(([moduleId, moduleInstance]) => {
            if (typeof moduleInstance.initialize === 'function') {
                moduleInstance.initialize();
            }
        });
        
        this.initialized = true;
        console.log('All modules initialized.');
        
        // Publiser en hendelse når alle moduler er initialisert
        eventBus.publish('modules:initialized', {
            moduleCount: Object.keys(this.modules).length
        });
    }
    
    /**
     * Aktiver en modul og deaktiver andre
     * @param {string} moduleId - ID-en til modulen som skal aktiveres
     * @returns {boolean} True hvis aktiveringen var vellykket
     */
    activateModule(moduleId) {
        if (!this.hasModule(moduleId)) {
            console.warn(`Cannot activate module '${moduleId}': Module not found.`);
            return false;
        }
        
        // Oppdater aktiv modul
        const prevModuleId = this.activeModuleId;
        this.activeModuleId = moduleId;
        
        // Vis aktiv modul og skjul alle andre
        Object.entries(this.modules).forEach(([id, moduleInstance]) => {
            const container = document.getElementById(`${id}Module`);
            if (container) {
                container.style.display = id === moduleId ? 'block' : 'none';
            }
        });
        
        // Oppdater UI for aktiv modul
        const activeModule = this.getModule(moduleId);
        if (activeModule && typeof activeModule.updateUI === 'function') {
            activeModule.updateUI();
        }
        
        console.log(`Activated module: ${moduleId}`);
        
        // Publiser hendelse om modulbytte
        eventBus.publish('module:activated', {
            previousModuleId: prevModuleId,
            currentModuleId: moduleId
        });
        
        return true;
    }
    
    /**
     * Hent alle registrerte moduler
     * @returns {Object} Et objekt med alle registrerte moduler
     */
    getAllModules() {
        return { ...this.modules };
    }
    
    /**
     * Hent ID-en til den aktive modulen
     * @returns {string|null} ID-en til den aktive modulen
     */
    getActiveModuleId() {
        return this.activeModuleId;
    }
    
    /**
     * Hent aktiv modul
     * @returns {Object|null} Den aktive modulinstansen
     */
    getActiveModule() {
        return this.activeModuleId ? this.modules[this.activeModuleId] : null;
    }
}

// Eksporter en singleton-instans
export const moduleRegistry = new ModuleRegistry();