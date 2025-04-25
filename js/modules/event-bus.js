/**
 * event-bus.js - Implementerer et publish-subscribe mønster for kommunikasjon mellom moduler
 * 
 * Dette er kjernen i den nye meddelelses-arkitekturen som reduserer direkte avhengigheter
 * mellom moduler og gjør koden mer løst koblet. Moduler kan publisere (publish) hendelser
 * og abonnere (subscribe) på hendelser fra andre moduler uten å være direkte koblet til dem.
 */

/**
 * EventTypes - Enum over alle tilgjengelige hendelsestyper for å sikre konsistent bruk
 * og unngå skrivefeil.
 */
export const EventTypes = {
    // Skanner-relaterte hendelser
    BARCODE_SCANNED: 'barcode_scanned',           // En strekkode er skannet (rå)
    BARCODE_PROCESSED: 'barcode_processed',       // En strekkode er prosessert og mappet til et varenummer
    BARCODE_INVALID: 'barcode_invalid',           // En skannet strekkode er ugyldig
    SCANNER_STATUS_CHANGED: 'scanner_status_changed', // Status for skanneren har endret seg
    
    // Plukk-relaterte hendelser
    PICK_ITEM_ADDED: 'pick_item_added',           // En vare er lagt til i plukklisten
    PICK_ITEM_UPDATED: 'pick_item_updated',       // En vare i plukklisten er oppdatert
    PICK_ITEM_REMOVED: 'pick_item_removed',       // En vare er fjernet fra plukklisten
    PICK_LIST_UPDATED: 'pick_list_updated',       // Plukklisten er oppdatert (generell oppdatering)
    PICK_LIST_LOADED: 'pick_list_loaded',         // En plukkliste er lastet
    PICK_LIST_COMPLETED: 'pick_list_completed',   // Plukklisten er fullført

    // Mottak-relaterte hendelser
    RECEIVE_ITEM_ADDED: 'receive_item_added',     // En vare er lagt til i mottakslisten
    RECEIVE_ITEM_UPDATED: 'receive_item_updated', // En vare i mottakslisten er oppdatert
    RECEIVE_ITEM_REMOVED: 'receive_item_removed', // En vare er fjernet fra mottakslisten
    RECEIVE_LIST_UPDATED: 'receive_list_updated', // Mottakslisten er oppdatert (generell oppdatering)
    RECEIVE_LIST_LOADED: 'receive_list_loaded',   // En mottaksliste er lastet
    
    // Retur-relaterte hendelser  
    RETURN_ITEM_ADDED: 'return_item_added',       // En vare er lagt til i returlisten
    RETURN_ITEM_UPDATED: 'return_item_updated',   // En vare i returlisten er oppdatert
    RETURN_ITEM_REMOVED: 'return_item_removed',   // En vare er fjernet fra returlisten
    RETURN_LIST_UPDATED: 'return_list_updated',   // Returlisten er oppdatert (generell oppdatering)
    
    // UI-relaterte hendelser
    UI_MODULE_CHANGED: 'ui_module_changed',       // Bruker har byttet modul
    UI_MODAL_OPENED: 'ui_modal_opened',           // En modal er åpnet
    UI_MODAL_CLOSED: 'ui_modal_closed',           // En modal er lukket
    UI_TOAST_SHOW: 'ui_toast_show',               // Vis en toast-melding til brukeren
    
    // Nettverksrelaterte hendelser
    NETWORK_ONLINE: 'network_online',             // Applikasjonen har oppnådd nettverkstilkobling
    NETWORK_OFFLINE: 'network_offline',           // Applikasjonen har mistet nettverkstilkobling
    
    // Data-relaterte hendelser  
    DATA_UPDATED: 'data_updated',                 // Data er oppdatert (generell oppdatering)
    DATA_SAVED: 'data_saved',                     // Data er lagret til localStorage eller eksportert
    DATA_LOADED: 'data_loaded',                   // Data er lastet fra localStorage eller importert
    
    // App-relaterte hendelser  
    APP_INITIALIZED: 'app_initialized',           // Applikasjonen er initialisert
    APP_ERROR: 'app_error',                       // En feil har oppstått i applikasjonen
    APP_USER_LOGGED_IN: 'app_user_logged_in',     // Bruker har logget inn
    APP_USER_LOGGED_OUT: 'app_user_logged_out',   // Bruker har logget ut
};

/**
 * EventBus klasse - implementerer publish-subscribe mønsteret
 */
class EventBus {
    constructor() {
        this.subscribers = {};
        this.lastEvents = {};  // Lagrer siste hendelse av hver type for debugging
        
        // Enable debug logging
        this.debugMode = false;
    }
    
    /**
     * Skrur debug-modus på/av
     * @param {boolean} enabled - Om debug-modus skal være på
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * Publiser en hendelse av angitt type med tilhørende data
     * @param {string} eventType - Type hendelse, bør være en av verdiene i EventTypes
     * @param {Object} data - Data for hendelsen
     */
    publish(eventType, data = {}) {
        if (!eventType) {
            console.error('EventBus: Manglende eventType i publish');
            return;
        }
        
        if (this.debugMode) {
            console.log(`EventBus: Publiserer hendelse ${eventType}`, data);
        }
        
        // Lagre for debugging
        this.lastEvents[eventType] = {
            data: data,
            timestamp: new Date()
        };
        
        // Hvis ingen abonnerer på denne hendelsestypen, returner
        if (!this.subscribers[eventType]) {
            return;
        }
        
        // Send hendelsen til alle abonnenter
        this.subscribers[eventType].forEach(subscriber => {
            try {
                subscriber(data);
            } catch (error) {
                console.error(`EventBus: Feil i subscriber for ${eventType}:`, error);
            }
        });
    }
    
    /**
     * Abonnér på en hendelse av angitt type
     * @param {string} eventType - Type hendelse å abonnere på
     * @param {Function} callback - Funksjon som kalles når hendelsen publiseres
     * @returns {Object} Abonnement-objekt med unsubscribe-metode
     */
    subscribe(eventType, callback) {
        if (!eventType) {
            console.error('EventBus: Manglende eventType i subscribe');
            return { unsubscribe: () => {} };
        }
        
        if (typeof callback !== 'function') {
            console.error('EventBus: callback må være en funksjon');
            return { unsubscribe: () => {} };
        }
        
        // Opprett liste for denne hendelsestypen hvis den ikke finnes
        if (!this.subscribers[eventType]) {
            this.subscribers[eventType] = [];
        }
        
        // Legg til callback i listen over abonnenter
        this.subscribers[eventType].push(callback);
        
        if (this.debugMode) {
            console.log(`EventBus: Ny abonnent på ${eventType}, totalt: ${this.subscribers[eventType].length}`);
        }
        
        // Returner et objekt som kan brukes til å avslutte abonnementet
        return {
            unsubscribe: () => this.unsubscribe(eventType, callback)
        };
    }
    
    /**
     * Avslutt et abonnement
     * @param {string} eventType - Type hendelse å avslutte abonnement for
     * @param {Function} callback - Callback-funksjonen som ble brukt i subscribe
     */
    unsubscribe(eventType, callback) {
        if (!eventType || !this.subscribers[eventType]) {
            return;
        }
        
        // Finn indeksen til callback i listen over abonnenter
        const index = this.subscribers[eventType].indexOf(callback);
        
        // Hvis callback finnes i listen, fjern den
        if (index !== -1) {
            this.subscribers[eventType].splice(index, 1);
            
            if (this.debugMode) {
                console.log(`EventBus: Abonnent fjernet fra ${eventType}, gjenstår: ${this.subscribers[eventType].length}`);
            }
            
            // Hvis ingen abonnenter gjenstår for denne hendelsestypen, fjern listen
            if (this.subscribers[eventType].length === 0) {
                delete this.subscribers[eventType];
            }
        }
    }
    
    /**
     * Fjern alle abonnementer for en hendelsestype
     * @param {string} eventType - Type hendelse å fjerne alle abonnementer for
     */
    clearSubscribers(eventType) {
        if (eventType) {
            delete this.subscribers[eventType];
            if (this.debugMode) {
                console.log(`EventBus: Alle abonnenter fjernet for ${eventType}`);
            }
        } else {
            this.subscribers = {};
            if (this.debugMode) {
                console.log('EventBus: Alle abonnenter fjernet for alle hendelsestyper');
            }
        }
    }
    
    /**
     * Returner informasjon om aktivitet på EventBus
     * @returns {Object} - Statistikk og debug-informasjon
     */
    getDebugInfo() {
        const subscriberCounts = {};
        let totalSubscribers = 0;
        
        // Tell antall abonnenter per hendelsestype
        Object.keys(this.subscribers).forEach(eventType => {
            subscriberCounts[eventType] = this.subscribers[eventType].length;
            totalSubscribers += this.subscribers[eventType].length;
        });
        
        return {
            totalSubscribers,
            subscriberCounts,
            lastEvents: this.lastEvents,
            eventTypes: Object.keys(this.subscribers)
        };
    }
}

// Opprett og eksporter en singleton-instans av EventBus
const eventBus = new EventBus();

// Debug-modus kan aktiveres ved behov
// eventBus.setDebugMode(true);

export default eventBus;