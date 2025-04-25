// filepath: s:\Workspace\GitHub\warehousescanner\js\models\ModalModel.js
/**
 * ModalModel - Håndterer data og tilstand for modaler
 */
export class ModalModel {
    /**
     * Opprett en ny modalmodell
     */
    constructor() {
        // Modaltilstandsdata
        this.currentItemId = null;
        this.weightValue = 1;
        this.quantityValue = 1;
        
        // Eventuelle tilbakekall når data endres
        this.callbacks = {
            onWeightChange: [],
            onQuantityChange: [],
            onItemIdChange: []
        };
    }
    
    /**
     * Sett varenummer for gjeldende modal
     * @param {string} itemId - Varenummeret
     * @returns {ModalModel} denne modellen (for kjeding)
     */
    setItemId(itemId) {
        this.currentItemId = itemId;
        this._triggerCallbacks('onItemIdChange', itemId);
        return this;
    }
    
    /**
     * Sett vekt for gjeldende vare
     * @param {number|string} weight - Vekten som skal settes
     * @returns {ModalModel} denne modellen (for kjeding)
     */
    setWeight(weight) {
        this.weightValue = parseFloat(weight) || 1;
        this._triggerCallbacks('onWeightChange', this.weightValue);
        return this;
    }
    
    /**
     * Sett antall for gjeldende vare
     * @param {number|string} quantity - Antallet som skal settes
     * @returns {ModalModel} denne modellen (for kjeding)
     */
    setQuantity(quantity) {
        this.quantityValue = parseInt(quantity) || 1;
        this._triggerCallbacks('onQuantityChange', this.quantityValue);
        return this;
    }
    
    /**
     * Hent gjeldende varenummer
     * @returns {string} Varenummeret
     */
    getItemId() {
        return this.currentItemId;
    }
    
    /**
     * Hent gjeldende vekt
     * @returns {number} Vekten
     */
    getWeight() {
        return this.weightValue;
    }
    
    /**
     * Hent gjeldende antall
     * @returns {number} Antallet
     */
    getQuantity() {
        return this.quantityValue;
    }
    
    /**
     * Tilbakestill modellen til standardverdier
     * @returns {ModalModel} denne modellen (for kjeding)
     */
    reset() {
        this.currentItemId = null;
        this.weightValue = 1;
        this.quantityValue = 1;
        return this;
    }
    
    /**
     * Registrer en callback-funksjon som utløses når data endres
     * @param {string} eventName - Navnet på hendelsen (onWeightChange, onQuantityChange, onItemIdChange)
     * @param {Function} callback - Callback-funksjonen som skal kalles
     */
    on(eventName, callback) {
        if (this.callbacks[eventName] && typeof callback === 'function') {
            this.callbacks[eventName].push(callback);
        }
    }
    
    /**
     * Fjern en callback-funksjon
     * @param {string} eventName - Navnet på hendelsen
     * @param {Function} callback - Callback-funksjonen som skal fjernes
     */
    off(eventName, callback) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName] = this.callbacks[eventName].filter(cb => cb !== callback);
        }
    }
    
    /**
     * Utløs alle callback-funksjoner for en bestemt hendelse
     * @private
     * @param {string} eventName - Navnet på hendelsen
     * @param {*} data - Data som skal sendes til callback-funksjonen
     */
    _triggerCallbacks(eventName, data) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(callback => callback(data));
        }
    }
}