// filepath: s:\Workspace\GitHub\warehousescanner\js\components\CameraScannerComponent.js
import { BaseComponent } from './BaseComponent.js';
import eventBus from '../modules/event-bus.js';

/**
 * CameraScannerComponent - Komponent for strekkodeskanning med kamera
 * @extends BaseComponent
 */
export class CameraScannerComponent extends BaseComponent {
    /**
     * Oppretter en ny kameraskanner-komponent
     * @param {Object} options - Konfigurasjon for komponenten
     * @param {string} options.id - ID for komponenten
     * @param {HTMLElement|string} options.container - Containerelement eller CSS-selector
     * @param {string} options.moduleId - ID for modulen komponenten tilhører
     * @param {Function} options.onScan - Callback for når en strekkode er skannet
     */
    constructor(options = {}) {
        // Standard-opsjoner
        const defaultOptions = {
            id: `camera-scanner-${Date.now()}`,
            container: null,
            templateId: 'cameraScannerComponentTemplate',
            moduleId: 'general',
            onScan: null,
            scanInterval: 100,
            facingMode: 'environment', // 'environment' (bakre) eller 'user' (fremre)
            scanningActive: false,
            autostart: false
        };
        
        super({ ...defaultOptions, ...options });
        
        // Scanner states
        this.videoStream = null;
        this.scannerRunning = false;
        this.lastScannedCode = null;
        this.lastScannedTime = 0;
        this.scanningActive = this.options.scanningActive;
        this.codeDetector = null;
        this.scanTimeout = null;
        
        // Initier komponenten
        this.init();
    }
    
    /**
     * Initialiser komponenten
     */
    init() {
        // Last template
        this.loadTemplate();
        
        // Konfigurer komponenten
        this.configureComponent();
        
        // Legg til i container om spesifisert
        if (this.options.container) {
            this.appendToContainer();
        }
        
        // Start skanner hvis autostart er aktivert
        if (this.options.autostart) {
            this.startScanner();
        }
    }
    
    /**
     * Last template og opprett komponent-element
     */
    loadTemplate() {
        // Finn template
        const template = document.getElementById(this.options.templateId);
        if (!template) {
            console.error(`Template not found: ${this.options.templateId}`);
            return;
        }
        
        // Klone template
        const clone = document.importNode(template.content, true);
        this.element = clone.querySelector('.camera-scanner-container');
        this.videoElement = clone.querySelector('video');
        this.canvasElement = clone.querySelector('canvas');
        this.overlayElement = clone.querySelector('.camera-overlay');
        this.scanArea = clone.querySelector('.scan-area');
        this.switchButton = clone.querySelector('.scanner-switch-btn');
        this.closeButton = clone.querySelector('.scanner-close-btn');
    }
    
    /**
     * Konfigurer komponenten basert på opsjoner
     */
    configureComponent() {
        if (!this.element) return;
        
        // Sett ID
        if (this.options.id) {
            this.element.id = this.options.id;
            this.videoElement.id = `${this.options.id}-video`;
            this.canvasElement.id = `${this.options.id}-canvas`;
        }
        
        // Initialiser BarcodeDetector hvis støttet av nettleseren
        this.initBarcodeDetector();
        
        // Legg til event listeners
        this.registerEventListeners();
    }
    
    /**
     * Initialiser BarcodeDetector hvis tilgjengelig
     */
    async initBarcodeDetector() {
        // Sjekk om BarcodeDetector API er støttet
        if ('BarcodeDetector' in window) {
            try {
                // Sjekk støttede formater
                const formats = await BarcodeDetector.getSupportedFormats();
                console.log('Støttede strekkodeformater:', formats);
                
                // Opprett detektor med alle støttede formater
                this.codeDetector = new BarcodeDetector({ formats });
            } catch (error) {
                console.error('Feil ved initialisering av BarcodeDetector:', error);
                this.codeDetector = null;
            }
        } else {
            console.warn('BarcodeDetector API er ikke støttet i denne nettleseren.');
            // Kan implementere fallback til bibliotek som QuaggaJS her
        }
    }
    
    /**
     * Registrer hendelseslyttere
     */
    registerEventListeners() {
        // Lytt etter klikk på bytt kamera-knappen
        if (this.switchButton) {
            this.switchButton.addEventListener('click', this.switchCamera.bind(this));
        }
        
        // Lytt etter klikk på lukk-knappen
        if (this.closeButton) {
            this.closeButton.addEventListener('click', this.closeScanner.bind(this));
        }
    }
    
    /**
     * Start kameraskanneren
     */
    async startScanner() {
        if (this.scannerRunning) return;
        
        try {
            // Vis skanner-container
            this.element.style.display = 'block';
            
            // Få tilgang til kamera
            const constraints = {
                video: {
                    facingMode: this.options.facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.videoStream;
            
            // Vent til video er lastet
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                this.scanningActive = true;
                this.scannerRunning = true;
                
                // Start skanning
                this.scanCode();
                
                // Utløs hendelse om at skanneren er aktiv
                eventBus.publish('camera:started', {
                    moduleId: this.options.moduleId
                });
            };
        } catch (error) {
            console.error('Feil ved tilgang til kamera:', error);
            this.showError('Kunne ikke få tilgang til kamera. Sørg for at kameratillatelser er aktivert.');
        }
    }
    
    /**
     * Stopp kameraskanneren
     */
    stopScanner() {
        this.scanningActive = false;
        this.scannerRunning = false;
        
        // Stopp eventuelle pågående skanninger
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
        }
        
        // Stopp videostrøm
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        // Fjern video-kilde
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        // Utløs hendelse om at skanneren er stoppet
        eventBus.publish('camera:stopped', {
            moduleId: this.options.moduleId
        });
    }
    
    /**
     * Lukk skanneren (stopp og skjul)
     */
    closeScanner() {
        this.stopScanner();
        this.element.style.display = 'none';
        
        // Utløs hendelse om at skanneren er lukket
        eventBus.publish('camera:closed', {
            moduleId: this.options.moduleId
        });
    }
    
    /**
     * Bytt mellom fremre og bakre kamera
     */
    async switchCamera() {
        // Stopp gjeldende skanner
        this.stopScanner();
        
        // Bytt kameraretning
        this.options.facingMode = this.options.facingMode === 'environment' ? 'user' : 'environment';
        
        // Start skanneren med nytt kamera
        await this.startScanner();
    }
    
    /**
     * Skann etter strekkoder i videostrømmen
     */
    async scanCode() {
        if (!this.scanningActive || !this.videoElement || !this.videoElement.videoWidth) {
            this.scanTimeout = setTimeout(() => this.scanCode(), this.options.scanInterval);
            return;
        }
        
        try {
            // Bruk BarcodeDetector API hvis tilgjengelig
            if (this.codeDetector) {
                const barcodes = await this.codeDetector.detect(this.videoElement);
                
                if (barcodes.length > 0) {
                    // Bruk den første oppdagede strekkoden
                    const barcode = barcodes[0];
                    this.handleDetectedCode(barcode.rawValue);
                }
            } else {
                // Fallback: Ta bilde og analyser med canvas
                this.scanWithCanvas();
            }
        } catch (error) {
            console.error('Feil ved skanning av strekkode:', error);
        }
        
        // Fortsett skanning
        this.scanTimeout = setTimeout(() => this.scanCode(), this.options.scanInterval);
    }
    
    /**
     * Fallback-metode for strekkodeskanning med canvas
     */
    scanWithCanvas() {
        const ctx = this.canvasElement.getContext('2d');
        const width = this.videoElement.videoWidth;
        const height = this.videoElement.videoHeight;
        
        // Juster canvasstørrelsen til å samsvare med videoen
        if (this.canvasElement.width !== width || this.canvasElement.height !== height) {
            this.canvasElement.width = width;
            this.canvasElement.height = height;
        }
        
        // Tegn video til canvas
        ctx.drawImage(this.videoElement, 0, 0, width, height);
        
        // Her ville vi normalt brukt et bibliotek som QuaggaJS for å analysere bildet
        // Dette er bare en placeholder - i en virkelig implementasjon ville vi brukt et faktisk bibliotek
        console.log('Canvas-basert skanning krever et eksternt bibliotek');
    }
    
    /**
     * Håndter en oppdaget strekkode
     * @param {string} code - Den oppdagede strekkoden
     */
    handleDetectedCode(code) {
        // Unngå gjentatte skanninger av samme kode
        const now = Date.now();
        if (code === this.lastScannedCode && now - this.lastScannedTime < 2000) {
            return;
        }
        
        // Oppdater siste skannede kode og tidspunkt
        this.lastScannedCode = code;
        this.lastScannedTime = now;
        
        // Gi visuell tilbakemelding
        this.giveFeedback();
        
        // Kall onScan-callback hvis definert
        if (typeof this.options.onScan === 'function') {
            this.options.onScan(code, 'camera');
        }
        
        // Utløs hendelse for at en strekkode er skannet
        eventBus.publish('barcode:scanned', {
            barcode: code,
            source: 'camera',
            moduleId: this.options.moduleId,
            timestamp: now
        });
    }
    
    /**
     * Gi visuell tilbakemelding til brukeren
     */
    giveFeedback() {
        // Blink skanningsområdet for å indikere vellykket skanning
        if (this.scanArea) {
            this.scanArea.classList.add('scan-success');
            setTimeout(() => {
                this.scanArea.classList.remove('scan-success');
            }, 300);
        }
        
        // Spill av lyd hvis konfigurert
        // (Ikke implementert ennå)
    }
    
    /**
     * Vis feilmelding til bruker
     * @param {string} message - Feilmeldingen som skal vises
     */
    showError(message) {
        // Kan implementeres for å vise feilmeldinger i UI
        console.error('Skannerfeil:', message);
        
        // Utløs hendelse for UI-oppdatering
        eventBus.publish('ui:showStatus', {
            message,
            type: 'error',
            moduleId: this.options.moduleId
        });
    }
    
    /**
     * Legg komponenten til i en container
     * @param {HTMLElement|string} [container] - Container-element eller CSS-selector
     */
    appendToContainer(container) {
        const targetContainer = container || this.options.container;
        if (!targetContainer || !this.element) return;
        
        let containerElement;
        if (typeof targetContainer === 'string') {
            containerElement = document.querySelector(targetContainer);
        } else {
            containerElement = targetContainer;
        }
        
        if (containerElement) {
            containerElement.appendChild(this.element);
        }
    }
    
    /**
     * Fjern komponenten fra DOM og rydd opp ressurser
     */
    remove() {
        // Stopp skanneren først
        this.stopScanner();
        
        // Fjern fra DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}