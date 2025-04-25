// UnknownBarcodeModalComponent.js - Component for handling unknown barcodes
import { ModalComponent } from './ModalComponent.js';
import { showToast } from '../modules/utils.js';
import { saveListsToStorage, saveBarcodeMapping, findSimilarBarcodes } from '../modules/storage.js';
import { updatePickingUI } from '../modules/picking.js';
import { updateReceivingUI } from '../modules/receiving.js';
import { updateReturnsUI } from '../modules/returns.js';
import eventBus from '../modules/event-bus.js';

// Applikasjonstilstand som vil bli tilgjengelig via window-objektet
const appState = window.appState || {};

/**
 * UnknownBarcodeModalComponent - Modal for handling unknown barcodes
 * @extends ModalComponent
 */
export class UnknownBarcodeModalComponent extends ModalComponent {
    /**
     * Create a new unknown barcode modal component
     * @param {Object} options - Configuration options
     * @param {string} options.barcode - The unknown barcode
     * @param {Function} options.onRegister - Callback for when the user wants to register the barcode
     * @param {Function} options.onIgnore - Callback for when the user wants to ignore the barcode
     * @param {string} options.moduleId - ID of the module that triggered the modal
     */
    constructor(options = {}) {
        // Standard options
        const defaultOptions = {
            id: `unknown-barcode-modal-${Date.now()}`,
            title: 'Ukjent strekkode',
            templateId: 'modalTemplate',
            contentTemplateId: 'unknownBarcodeModalComponentTemplate',
            barcode: '',
            onRegister: null,
            onIgnore: null,
            moduleId: 'general',
            buttons: [
                {
                    text: 'Ignorer',
                    type: 'secondary',
                    dismissOnClick: true
                },
                {
                    text: 'Registrer',
                    type: 'primary',
                    icon: 'plus',
                    dismissOnClick: false
                }
            ]
        };
        
        // Merge with user options
        const mergedOptions = { ...defaultOptions, ...options };
        
        // Create modal with standard layout
        super(mergedOptions);
        
        // Set up button callbacks
        this.setupButtons();
        
        // Load content from template
        this.loadContentTemplate();
    }
    
    /**
     * Load content template and update modal content
     */
    loadContentTemplate() {
        // Find template
        const template = document.getElementById(this.options.contentTemplateId);
        if (!template) {
            console.error(`Template not found: ${this.options.contentTemplateId}`);
            
            // Fallback: Create content manually
            this.createFallbackContent();
            return;
        }
        
        // Clone template
        const clone = document.importNode(template.content, true);
        
        // Set barcode
        const barcodeElement = clone.querySelector('.barcode-value');
        if (barcodeElement) {
            barcodeElement.textContent = this.options.barcode;
        }
        
        // Create any dynamic content
        this.populateContent(clone);
        
        // Update modal content
        this.setContent(clone);
    }
    
    /**
     * Create fallback content if template is not found
     */
    createFallbackContent() {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'unknown-barcode-content';
        
        const heading = document.createElement('p');
        heading.textContent = 'Den følgende strekkoden er ikke registrert i systemet:';
        contentDiv.appendChild(heading);
        
        const barcodeDiv = document.createElement('div');
        barcodeDiv.className = 'barcode-display';
        
        const barcodeValue = document.createElement('span');
        barcodeValue.className = 'barcode-value';
        barcodeValue.textContent = this.options.barcode;
        barcodeDiv.appendChild(barcodeValue);
        
        contentDiv.appendChild(barcodeDiv);
        
        const infoText = document.createElement('p');
        infoText.textContent = 'Ønsker du å registrere denne strekkoden i systemet?';
        contentDiv.appendChild(infoText);
        
        // Set content
        this.setContent(contentDiv);
    }
    
    /**
     * Populate any dynamic content in the modal
     * @param {DocumentFragment} contentElement - The cloned content element
     */
    populateContent(contentElement) {
        // Override in subclasses if needed
    }
    
    /**
     * Set up button callbacks
     */
    setupButtons() {
        // Ignore button is the first button (index 0)
        const ignoreButton = this.getButton(0);
        if (ignoreButton) {
            ignoreButton.button.addEventListener('click', () => {
                this.handleIgnore();
            });
        }
        
        // Register button is the second button (index 1)
        const registerButton = this.getButton(1);
        if (registerButton) {
            registerButton.button.addEventListener('click', () => {
                this.handleRegister();
            });
        }
    }
    
    /**
     * Handle click on Ignore button
     */
    handleIgnore() {
        // Call onIgnore callback if defined
        if (typeof this.options.onIgnore === 'function') {
            this.options.onIgnore({
                barcode: this.options.barcode,
                moduleId: this.options.moduleId
            });
        }
        
        // Trigger event
        eventBus.publish('barcode:ignored', {
            barcode: this.options.barcode,
            moduleId: this.options.moduleId
        });
    }
    
    /**
     * Handle click on Register button
     */
    handleRegister() {
        // Call onRegister callback if defined
        if (typeof this.options.onRegister === 'function') {
            this.options.onRegister({
                barcode: this.options.barcode,
                moduleId: this.options.moduleId
            });
        }
        
        // Trigger event
        eventBus.publish('barcode:register', {
            barcode: this.options.barcode,
            moduleId: this.options.moduleId
        });
        
        // Close the modal
        this.close();
    }
    
    /**
     * Set the barcode
     * @param {string} barcode - New barcode
     */
    setBarcode(barcode) {
        this.options.barcode = barcode;
        
        // Update display
        const barcodeElement = this.bodyElement.querySelector('.barcode-value');
        if (barcodeElement) {
            barcodeElement.textContent = barcode;
        }
        
        return this;
    }
}