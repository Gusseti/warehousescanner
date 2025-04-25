// filepath: s:\Workspace\GitHub\warehousescanner\js\modules\modal-manager.js
/**
 * Modal Manager - Kobler sammen MVC-komponentene og eksponerer et API for modalene
 */
import { ModalModel } from '../models/ModalModel.js';
import { ModalView } from '../views/ModalView.js';
import { ModalController } from '../controllers/ModalController.js';

/**
 * Initialiserer modalhåndteringsmodulen.
 * Dette er entry point for modal-funksjonaliteten i applikasjonen.
 * @returns {Object} Et API for å bruke modalene
 */
export function initModalManager() {
    // Opprett MVC-komponentene
    const modalModel = new ModalModel();
    const modalView = new ModalView();
    const modalController = new ModalController(modalModel, modalView);
    
    // Eksporter et enkelt API for bruk i andre moduler
    return {
        /**
         * Åpne vektmodalen for et spesifikt varenummer
         * @param {string} itemId - Varenummeret
         * @param {number} initialWeight - Initial vekt (valgfritt)
         */
        openWeightModal: (itemId, initialWeight) => {
            modalController.openWeightModal(itemId, initialWeight);
        },
        
        /**
         * Åpne antallsmodalen for et spesifikt varenummer
         * @param {string} itemId - Varenummeret
         * @param {number} initialQuantity - Initialt antall (valgfritt)
         */
        openQuantityModal: (itemId, initialQuantity) => {
            modalController.openQuantityModal(itemId, initialQuantity);
        }
    };
}

// Singleton-instans av modalmanageren
let modalManagerInstance = null;

/**
 * Hent den delte modalmanageren, eller opprett en ny hvis den ikke finnes
 * @returns {Object} Modal manager API
 */
export function getModalManager() {
    if (!modalManagerInstance) {
        modalManagerInstance = initModalManager();
    }
    return modalManagerInstance;
}