// QuantityModalComponent.js - Komponent for å håndtere varemengder
import { ModalComponent } from './ModalComponent.js';
import { appState } from '../app.js';
import { saveListsToStorage } from '../modules/storage.js';
import { updateReceivingUI } from '../modules/receiving.js';
import { updatePickingUI } from '../modules/picking.js';
import { updateReturnsUI } from '../modules/returns.js';
import { showToast } from '../modules/utils.js';

/**
 * QuantityModalComponent - Spesialisert modal for å angi antall av en vare
 * @extends ModalComponent
 */
export class QuantityModalComponent extends ModalComponent {
    /**
     * Oppretter en ny antall-modal
     * @param {Object} options - Konfigurasjon for modalen
     * @param {Function} options.onConfirm - Callback for når antallet bekreftes
     * @param {string} options.itemId - Varenummer/strekkode
     * @param {number} options.defaultQuantity - Standard antall (default: 1)
     * @param {boolean} options.focusOnOpen - Om input-feltet skal få fokus ved åpning
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            id: `quantity-modal-${Date.now()}`,
            title: 'Angi antall',
            templateId: 'modalTemplate',
            contentTemplateId: 'quantityModalComponentTemplate',
            itemId: '',
            defaultQuantity: 1,
            minQuantity: 1,
            maxQuantity: 999,
            onConfirm: null,
            focusOnOpen: true,
            buttons: [
                {
                    text: 'Avbryt',
                    type: 'secondary',
                    dismissOnClick: true
                },
                {
                    text: 'Bekreft',
                    type: 'primary',
                    icon: 'check',
                    dismissOnClick: false
                }
            ]
        };
        
        // Slå sammen med brukerens opsjoner
        const mergedOptions = { ...defaultOptions, ...options };
        
        // Opprett modal med standard layout
        super(mergedOptions);
        
        // Sett opp callback for bekreft-knappen
        this.setupConfirmButton();
        
        // Last inn innhold fra template
        this.loadContentTemplate();
    }
    
    /**
     * Last innholdstemplate og oppdater modalinnhold
     */
    loadContentTemplate() {
        // Finn template
        const template = document.getElementById(this.options.contentTemplateId);
        if (!template) {
            console.error(`Template not found: ${this.options.contentTemplateId}`);
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        
        // Sett varenummer
        const itemIdElement = clone.querySelector('.modal-item-id');
        if (itemIdElement) {
            itemIdElement.textContent = this.options.itemId;
        }
        
        // Sett standard antall
        const quantityInput = clone.querySelector('#itemQuantity');
        if (quantityInput) {
            quantityInput.value = this.options.defaultQuantity;
            quantityInput.min = this.options.minQuantity;
            quantityInput.max = this.options.maxQuantity;
            
            // Legg til validering
            quantityInput.addEventListener('input', this.validateQuantity.bind(this));
            
            // Legg til Enter-tastetrykk
            quantityInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.confirmQuantity();
                }
            });
            
            // Lagre referanse
            this.quantityInput = quantityInput;
        }
        
        // Oppdater modalinnhold
        this.setContent(clone);
    }
    
    /**
     * Sett opp callback for bekreft-knappen
     */
    setupConfirmButton() {
        // Bekreft-knappen er den andre knappen (indeks 1)
        const confirmButton = this.getButton(1);
        if (confirmButton) {
            confirmButton.button.addEventListener('click', () => {
                this.confirmQuantity();
            });
        }
    }
    
    /**
     * Valider antall-input
     */
    validateQuantity() {
        if (!this.quantityInput) return;
        
        // Hent gjeldende verdi
        let value = parseInt(this.quantityInput.value);
        
        // Valider min/max
        if (isNaN(value) || value < this.options.minQuantity) {
            value = this.options.minQuantity;
        } else if (value > this.options.maxQuantity) {
            value = this.options.maxQuantity;
        }
        
        // Oppdater input-feltet
        this.quantityInput.value = value;
        
        // Oppdater bekreft-knappen
        const confirmButton = this.getButton(1);
        if (confirmButton) {
            confirmButton.setDisabled(isNaN(value));
        }
    }
    
    /**
     * Bekreft antall og kall onConfirm-callback
     */
    confirmQuantity() {
        if (!this.quantityInput) return;
        
        // Hent gjeldende verdi
        const quantity = parseInt(this.quantityInput.value);
        
        // Valider
        if (isNaN(quantity) || quantity < this.options.minQuantity || quantity > this.options.maxQuantity) {
            // Vis feilmelding
            this.showError('Vennligst angi et gyldig antall mellom ' + 
                           this.options.minQuantity + ' og ' + this.options.maxQuantity);
            return;
        }
        
        // Kall onConfirm-callback hvis definert
        if (typeof this.options.onConfirm === 'function') {
            this.options.onConfirm({
                itemId: this.options.itemId,
                quantity: quantity
            });
        }
        
        // Lukk modalen
        this.close();
    }
    
    /**
     * Sett varenummer
     * @param {string} itemId - Nytt varenummer
     */
    setItemId(itemId) {
        this.options.itemId = itemId;
        
        // Oppdater visning
        const itemIdElement = this.bodyElement.querySelector('.modal-item-id');
        if (itemIdElement) {
            itemIdElement.textContent = itemId;
        }
        
        return this;
    }
    
    /**
     * Sett standard antall
     * @param {number} quantity - Nytt standard antall
     */
    setDefaultQuantity(quantity) {
        this.options.defaultQuantity = quantity;
        
        // Oppdater input-felt
        if (this.quantityInput) {
            this.quantityInput.value = quantity;
        }
        
        return this;
    }
    
    /**
     * Vis feilmelding
     * @param {string} message - Feilmelding som skal vises
     */
    showError(message) {
        // Sjekk om det allerede finnes et feilmeldingselement
        let errorElement = this.bodyElement.querySelector('.error-message');
        
        if (!errorElement) {
            // Opprett nytt feilmeldingselement
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            
            // Legg til etter input-feltet
            const formGroup = this.quantityInput.closest('.form-group');
            if (formGroup && formGroup.parentNode) {
                formGroup.parentNode.insertBefore(errorElement, formGroup.nextSibling);
            } else {
                this.bodyElement.appendChild(errorElement);
            }
        }
        
        // Sett feilmelding
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Fjern feilmelding etter timeout
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    }
    
    /**
     * Override open-metoden for å legge til fokus
     */
    open() {
        super.open();
        
        // Sett fokus på input-feltet
        if (this.options.focusOnOpen && this.quantityInput) {
            setTimeout(() => {
                this.quantityInput.focus();
                this.quantityInput.select();
            }, 100);
        }
        
        return this;
    }
}