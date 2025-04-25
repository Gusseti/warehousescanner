// filepath: s:\Workspace\GitHub\warehousescanner\js\controllers\ModalController.js
/**
 * ModalController - Kontrolleren som binder sammen modalmodellen og modalvisningen
 */
export class ModalController {
    /**
     * Opprett en ny modalkontroller
     * @param {Object} model - Datamodellen (ModalModel-instans)
     * @param {Object} view - Visningsklassen (ModalView-instans)
     */
    constructor(model, view) {
        this.model = model;
        this.view = view;
        
        // Initialiserer eventlyttere
        this._initEventListeners();
    }
    
    /**
     * Initialiser hendelseslyttere for å koble modell og visning
     * @private
     */
    _initEventListeners() {
        // Registrer hendelser for vektmodalen
        this.view.registerWeightModalEvents({
            onClose: () => this.closeWeightModal(),
            onCancel: () => this.closeWeightModal(),
            onSave: () => this.saveWeight()
        });
        
        // Registrer hendelser for antallsmodalen
        this.view.registerQuantityModalEvents({
            onClose: () => this.closeQuantityModal(),
            onCancel: () => this.closeQuantityModal(),
            onSave: () => this.saveQuantity()
        });
        
        // Lytt til endringer i modellen for å oppdatere visningen
        this.model.on('onWeightChange', (weight) => {
            this.view.setWeightValue(weight);
        });
        
        this.model.on('onQuantityChange', (quantity) => {
            this.view.setQuantityValue(quantity);
        });
    }
    
    // ===== Vektmodal kontroller-metoder =====
    
    /**
     * Åpne vektmodalen for et spesifikt varenummer
     * @param {string} itemId - Varenummeret
     * @param {number} initialWeight - Initial vekt for varen (valgfritt)
     */
    openWeightModal(itemId, initialWeight) {
        this.model.setItemId(itemId);
        this.model.setWeight(initialWeight || 1);
        this.view.showWeightModal(itemId, this.model.getWeight());
    }
    
    /**
     * Lukk vektmodalen
     */
    closeWeightModal() {
        this.view.hideWeightModal();
    }
    
    /**
     * Lagre vekten fra modal og utløs en hendelse
     */
    saveWeight() {
        const weight = this.view.getWeightValue();
        this.model.setWeight(weight);
        
        // Opprett og utløs en tilpasset hendelse som andre moduler kan lytte på
        const weightSavedEvent = new CustomEvent('weight:saved', {
            detail: {
                itemId: this.model.getItemId(),
                weight: this.model.getWeight()
            }
        });
        document.dispatchEvent(weightSavedEvent);
        
        this.closeWeightModal();
    }
    
    // ===== Antallsmodal kontroller-metoder =====
    
    /**
     * Åpne antallsmodalen for et spesifikt varenummer
     * @param {string} itemId - Varenummeret
     * @param {number} initialQuantity - Initialt antall for varen (valgfritt)
     */
    openQuantityModal(itemId, initialQuantity) {
        this.model.setItemId(itemId);
        this.model.setQuantity(initialQuantity || 1);
        this.view.showQuantityModal(itemId, this.model.getQuantity());
    }
    
    /**
     * Lukk antallsmodalen
     */
    closeQuantityModal() {
        this.view.hideQuantityModal();
    }
    
    /**
     * Lagre antallet fra modal og utløs en hendelse
     */
    saveQuantity() {
        const quantity = this.view.getQuantityValue();
        this.model.setQuantity(quantity);
        
        // Opprett og utløs en tilpasset hendelse som andre moduler kan lytte på
        const quantitySavedEvent = new CustomEvent('quantity:saved', {
            detail: {
                itemId: this.model.getItemId(),
                quantity: this.model.getQuantity()
            }
        });
        document.dispatchEvent(quantitySavedEvent);
        
        this.closeQuantityModal();
    }
}