// filepath: s:\Workspace\GitHub\warehousescanner\js\views\ModalView.js
/**
 * ModalView - Håndterer visningsdelen av modaler (UI)
 */
export class ModalView {
    /**
     * Opprett en ny modalvisning
     */
    constructor() {
        // Hent referanser til DOM-elementer for vektmodal
        this.weightModal = document.getElementById('weightModal');
        this.weightModalItemId = document.getElementById('weightModalItemId');
        this.itemWeightInput = document.getElementById('itemWeight');
        this.closeWeightModalBtn = document.getElementById('closeWeightModal');
        this.cancelWeightBtn = document.getElementById('cancelWeightBtn');
        this.saveWeightBtn = document.getElementById('saveWeightBtn');
        
        // Hent referanser til DOM-elementer for antallsmodal
        this.quantityModal = document.getElementById('quantityModal');
        this.quantityModalItemId = document.getElementById('quantityModalItemId');
        this.itemQuantityInput = document.getElementById('itemQuantity');
        this.closeQuantityModalBtn = document.getElementById('closeQuantityModal');
        this.cancelQuantityBtn = document.getElementById('cancelQuantityBtn');
        this.saveQuantityBtn = document.getElementById('saveQuantityBtn');
    }
    
    // ===== Vektmodal-metoder =====
    
    /**
     * Vis vektmodalen med gitt varenummer og initialvekt
     * @param {string} itemId - Varenummeret
     * @param {number} initialWeight - Startvekt (standard: 1)
     */
    showWeightModal(itemId, initialWeight = 1) {
        this.weightModalItemId.textContent = itemId;
        this.itemWeightInput.value = initialWeight;
        this.weightModal.style.display = 'block';
        
        // Fokuser på inputfeltet
        setTimeout(() => this.itemWeightInput.focus(), 100);
    }
    
    /**
     * Skjul vektmodalen
     */
    hideWeightModal() {
        this.weightModal.style.display = 'none';
    }
    
    /**
     * Hent vektverdien fra inputfeltet
     * @returns {string} Vektverdien fra inputfeltet
     */
    getWeightValue() {
        return this.itemWeightInput.value;
    }
    
    /**
     * Sett vektverdien i inputfeltet
     * @param {number} weight - Vekten som skal settes
     */
    setWeightValue(weight) {
        this.itemWeightInput.value = weight;
    }
    
    // ===== Antallsmodal-metoder =====
    
    /**
     * Vis antallsmodalen med gitt varenummer og initialantall
     * @param {string} itemId - Varenummeret
     * @param {number} initialQuantity - Startantall (standard: 1)
     */
    showQuantityModal(itemId, initialQuantity = 1) {
        this.quantityModalItemId.textContent = itemId;
        this.itemQuantityInput.value = initialQuantity;
        this.quantityModal.style.display = 'block';
        
        // Fokuser på inputfeltet
        setTimeout(() => this.itemQuantityInput.focus(), 100);
    }
    
    /**
     * Skjul antallsmodalen
     */
    hideQuantityModal() {
        this.quantityModal.style.display = 'none';
    }
    
    /**
     * Hent antallsverdien fra inputfeltet
     * @returns {string} Antallsverdien fra inputfeltet
     */
    getQuantityValue() {
        return this.itemQuantityInput.value;
    }
    
    /**
     * Sett antallsverdien i inputfeltet
     * @param {number} quantity - Antallet som skal settes
     */
    setQuantityValue(quantity) {
        this.itemQuantityInput.value = quantity;
    }
    
    // ===== Event-registreringsmetoder =====
    
    /**
     * Registrer hendelser for vektmodalen
     * @param {Object} handlers - Objekt med hendelseshåndterere
     * @param {Function} handlers.onClose - Hendelseshåndterer for lukkeknappen
     * @param {Function} handlers.onCancel - Hendelseshåndterer for avbrytknappen
     * @param {Function} handlers.onSave - Hendelseshåndterer for lagreknappen
     */
    registerWeightModalEvents(handlers) {
        if (handlers.onClose && this.closeWeightModalBtn) {
            this.closeWeightModalBtn.addEventListener('click', handlers.onClose);
        }
        
        if (handlers.onCancel && this.cancelWeightBtn) {
            this.cancelWeightBtn.addEventListener('click', handlers.onCancel);
        }
        
        if (handlers.onSave && this.saveWeightBtn) {
            this.saveWeightBtn.addEventListener('click', handlers.onSave);
        }
    }
    
    /**
     * Registrer hendelser for antallsmodalen
     * @param {Object} handlers - Objekt med hendelseshåndterere
     * @param {Function} handlers.onClose - Hendelseshåndterer for lukkeknappen
     * @param {Function} handlers.onCancel - Hendelseshåndterer for avbrytknappen
     * @param {Function} handlers.onSave - Hendelseshåndterer for lagreknappen
     */
    registerQuantityModalEvents(handlers) {
        if (handlers.onClose && this.closeQuantityModalBtn) {
            this.closeQuantityModalBtn.addEventListener('click', handlers.onClose);
        }
        
        if (handlers.onCancel && this.cancelQuantityBtn) {
            this.cancelQuantityBtn.addEventListener('click', handlers.onCancel);
        }
        
        if (handlers.onSave && this.saveQuantityBtn) {
            this.saveQuantityBtn.addEventListener('click', handlers.onSave);
        }
    }
}