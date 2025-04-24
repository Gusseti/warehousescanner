// scanner.js - Forbedret versjon med synlige feilmeldinger for brukeren

// State variabler
let cameraStream = null;
let isScanning = false;
let currentCameraIndex = 0;
let availableCameras = [];
let lastScannedCode = '';
let scanCooldown = false;

import { appState } from '../app.js';
import { showToast } from './utils.js';
import * as bluetoothScanner from './bluetooth-scanner.js';

// DOM-elementer
let videoElement = null;
let canvasElement = null;
let scannerOverlay = null;
let scanButtonElements = {}; // Holder "Utfør skann"-knapper
let stickyContainers = {}; // Holder referanser til sticky-containere
let stickyPlaceholders = {}; // Holder referanser til sticky plasshodere

// Innstillinger
let manualScanMode = true; // Sett til true for å kreve manuell skanning
let lastDetectedCode = null; // Sist oppdagede strekkode (før bekreftelse)
let isSticky = false; // Er kamera i sticky-modus

let moduleCallbacks = {
    pick: null,
    receive: null,
    return: null
};

// Callback-funksjon for å håndtere skannede strekkoder
let onScanCallback = null;
let scannerStatusCallback = null;

/**
 * Registrerer en callback-funksjon for en spesifikk modul
 * @param {string} module - Modulnavn ('pick', 'receive', 'return')
 * @param {Function} callback - Funksjon som kalles når en strekkode er skannet
 */
function registerModuleCallback(module, callback) {
    if (typeof callback !== 'function') {
        console.error(`Ugyldig callback for modul ${module}`);
        return;
    }
    
    moduleCallbacks[module] = callback;
    console.log(`Registrert callback for modul ${module}: ${callback.name || 'anonym funksjon'}`);
}

// ========== KAMERA SKANNER FUNKSJONALITET ==========

/**
 * Initialiserer kameraskanneren
 * @param {HTMLElement} videoEl - Video-element for visning av kamerastrøm
 * @param {HTMLElement} canvasEl - Canvas-element for bildeanalyse
 * @param {HTMLElement} overlayEl - Element for skanner-overlay
 * @param {Function} callback - Funksjon som kalles når en strekkode er skannet
 * @param {Function} statusCallback - Funksjon som kalles ved endringer i skannerstatus
 * @param {string} module - Modulnavn for å registrere modulspesifikk callback
 */
function initCameraScanner(videoEl, canvasEl, overlayEl, callback, statusCallback, module) {
    console.log(`Initialiserer kameraskanner for modul: ${module}`);
    
    // Lagre DOM-elementer
    videoElement = videoEl;
    canvasElement = canvasEl;
    scannerOverlay = overlayEl;
    
    // Registrer modulspesifikk callback hvis modul er angitt
    if (module && callback) {
        registerModuleCallback(module, callback);
    }
    
    // Lagre status callback
    scannerStatusCallback = statusCallback;
    
    // Også sett bluetooth scanner status callback
    bluetoothScanner.setBluetoothStatusCallback(statusCallback);
    
    // List opp tilgjengelige kameraer
    checkAvailableCameras().then(cameras => {
        availableCameras = cameras;
        console.log(`Fant ${cameras.length} kameraer`);
    }).catch(error => {
        showToast(`Kunne ikke sjekke tilgjengelige kameraer: ${error.message}`, 'warning');
    });
    
    // Sett opp event listeners for bytt-kamera-knapper
    const switchCameraButtons = document.querySelectorAll('.scanner-switch-btn');
    switchCameraButtons.forEach(button => {
        button.addEventListener('click', switchCamera);
    });
    
    // Opprett skann-knapp for modulen hvis den ikke finnes
    createScanButton(module);
    
    // Oppsett for sticky-funksjonalitet
    setupStickyScanner(module);
}

/**
 * Setter opp sticky-funksjonalitet for kamera-containeren
 * @param {string} module - Modulnavn ('pick', 'receive', 'return')
 */
function setupStickyScanner(module) {
    if (!module) return;
    
    const modulePrefix = getModulePrefix(module);
    const containerId = `cameraScanner${modulePrefix}Container`;
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.warn(`Kunne ikke finne kamera-container for ${module}-modul`);
        return;
    }
    
    // Lagre referanse til container
    stickyContainers[module] = container;
    
    // Opprett en plassholder for å unngå "hopp" når container blir sticky
    const placeholder = document.createElement('div');
    placeholder.id = `cameraScanner${modulePrefix}Placeholder`;
    placeholder.className = 'camera-scanner-placeholder';
    placeholder.style.display = 'none';
    container.parentNode.insertBefore(placeholder, container.nextSibling);
    
    // Lagre referanse til plassholder
    stickyPlaceholders[module] = placeholder;
    
    // Legg til event listener for å oppdage scrolling
    window.addEventListener('scroll', () => {
        if (appState.currentModule !== getModuleFullName(module)) return;
        if (!isScanning) return;
        
        const containerRect = container.getBoundingClientRect();
        const shouldBeSticky = containerRect.top <= 0;
        
        if (shouldBeSticky && !isSticky) {
            // Gjør containeren sticky
            container.classList.add('sticky');
            placeholder.classList.add('active');
            isSticky = true;
        } else if (!shouldBeSticky && isSticky) {
            // Fjern sticky
            container.classList.remove('sticky');
            placeholder.classList.remove('active');
            isSticky = false;
        }
    });
}

/**
 * Konverterer et kort modulnavn til prefix for DOM-elementer
 * @param {string} module - Kort modulnavn ('pick', 'receive', 'return')
 * @returns {string} Prefix ('Pick', 'Receive', 'Return')
 */
function getModulePrefix(module) {
    switch (module) {
        case 'pick': return 'Pick';
        case 'receive': return 'Receive';
        case 'return': return 'Return';
        default: return module.charAt(0).toUpperCase() + module.slice(1);
    }
}

/**
 * Konverterer et kort modulnavn til fullt modulnavn
 * @param {string} module - Kort modulnavn ('pick', 'receive', 'return')
 * @returns {string} Fullt modulnavn ('picking', 'receiving', 'returns')
 */
function getModuleFullName(module) {
    switch (module) {
        case 'pick': return 'picking';
        case 'receive': return 'receiving';
        case 'return': return 'returns';
        default: return module;
    }
}

/**
 * Oppretter "Utfør skann"-knapp for en spesifikk modul
 * @param {string} module - Modulnavn ('pick', 'receive', 'return')
 */
function createScanButton(module) {
    if (!module) return;
    
    const modulePrefix = getModulePrefix(module);
    const containerId = `cameraScanner${modulePrefix}Container`;
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.warn(`Kunne ikke finne kamera-container for ${module}-modul`);
        return;
    }
    
    // Sjekk om knappen allerede finnes
    const existingButton = container.querySelector(`.scan-button[data-module="${module}"]`);
    if (existingButton) {
        scanButtonElements[module] = existingButton;
        return;
    }
    
    // Opprett knapp
    const button = document.createElement('button');
    button.className = 'scan-button disabled'; // Start med disabled tilstand
    button.dataset.module = module;
    button.textContent = 'Venter på strekkode...';
    button.title = 'Vent til en strekkode er oppdaget';
    button.disabled = true; // Gjør knappen deaktivert ved oppstart
    
    // Legg til clickhandler som kun fungerer når knappen er klar
    button.addEventListener('click', () => {
        // Sjekk om knappen er i ready-to-scan tilstand
        if (button.classList.contains('ready-to-scan')) {
            performManualScan(module);
        }
    });
    
    // Finn passende plasseringssted i containeren
    const closeButton = container.querySelector('.scanner-close-btn');
    
    if (closeButton && closeButton.parentNode) {
        // Legg knappen før lukke-knappen
        closeButton.parentNode.insertBefore(button, closeButton);
    } else {
        // Legg til på slutten av containeren hvis vi ikke finner lukke-knappen
        container.appendChild(button);
    }
    
    // Lagre referanse til knappen
    scanButtonElements[module] = button;
}

/**
 * Utfører en manuell skanning for angitt modul
 * @param {string} module - Modulnavn ('pick', 'receive', 'return')
 */
function performManualScan(module) {
    if (!isScanning) {
        showToast('Skanneren er ikke aktiv', 'warning');
        return;
    }
    
    // Sjekk om lastDetectedCode finnes allerede
    if (lastDetectedCode) {
        // Hvis vi allerede har en detektert strekkode, bruk den
        console.log(`Utfører manuell skanning for ${module} med eksisterende kode: ${lastDetectedCode}`);
        
        // Lagre strekkoden før vi nullstiller den
        const currentDetectedCode = lastDetectedCode;
        
        // Nå kan vi nullstille lastDetectedCode
        lastDetectedCode = null;
        
        // VIKTIG: Ved manuell skanning i return modus, bruk korrekt callback 
        // istedenfor processScannedBarcode for å unngå automatisk prosessering
        if (module === 'return') {
            // For return-modulen, bruk spesifikk callback hvis den finnes
            const quantityEl = document.getElementById('returnQuantity');
            const quantity = quantityEl ? parseInt(quantityEl.value) || 1 : 1;
            
            if (typeof window.handleReturnScan === 'function') {
                window.handleReturnScan(currentDetectedCode, quantity);
            } else if (moduleCallbacks[module]) {
                moduleCallbacks[module](currentDetectedCode, quantity);
            } else {
                simulateManualScan(module, currentDetectedCode, quantity);
            }
        } else {
            // For pick og receive moduler, bruk standard prosessering
            processScannedBarcode(currentDetectedCode);
        }
        
        // Tilbakestill scan-button til normal tilstand
        const scanButton = scanButtonElements[module];
        if (scanButton) {
            scanButton.classList.remove('ready-to-scan');
            scanButton.textContent = 'Utfør skann';
        }
        
        // Fjern 'detected' klassen fra scan-area
        const scanArea = document.querySelector('.scan-area');
        if (scanArea) {
            scanArea.classList.remove('detected');
        }
        
        return;
    }
    
    // Hvis ingen strekkode er oppdaget, aktiver kontinuerlig skannemodus
    console.log("Starter kontinuerlig skanning for å finne gyldig strekkode");
    
    // Aktiver kontinuerlig skannemodus - fortsett å skanne til vi finner en gyldig kode
    const scanButton = scanButtonElements[module];
    if (scanButton) {
        // Bytt tekst og stil for å indikere at kontinuerlig skanning er aktiv
        scanButton.classList.add('scanning-active');
        scanButton.textContent = 'Skanner... Klikk for å avbryte';
        
        // Sett en variabel for å holde styr på om vi er i kontinuerlig skannemodus
        window.continuousScanning = true;
        
        // Vis en veiledningsmelding
        showBarcodeStatusMessage("Plasser strekkode i skanningsområdet");
        
        // Tilbakestill status etter en stund hvis ingen strekkode er funnet
        setTimeout(() => {
            // Sjekk om vi fortsatt er i kontinuerlig skannmodus
            if (window.continuousScanning) {
                showToast('Søker etter gyldig strekkode...', 'info');
            }
        }, 3000);
        
        // Legg til klikkhandler for å avbryte skanning
        scanButton.onclick = () => {
            window.continuousScanning = false;
            scanButton.classList.remove('scanning-active');
            scanButton.textContent = 'Utfør skann';
            showToast('Kontinuerlig skanning avbrutt', 'warning');
            hideBarcodeStatusMessage();
            
            // Gjenopprett original klikkhandler
            scanButton.onclick = () => {
                performManualScan(module);
            };
        };
    } else {
        showToast('Kunne ikke starte kontinuerlig skanning', 'error');
    }
}

/**
 * Starter kameraskanning
 * @param {string} cameraId - ID til kamera som skal brukes (valgfritt)
 * @param {Object} options - Ekstra alternativer for kameraoppsett
 * @returns {Promise} Løftebasert resultat av oppstartforsøket
 */
async function startCameraScanning(cameraId = null, options = {}) {
    showToast('Starter kamera...', 'info');
    
    // Stopp eventuelle aktive skannere
    if (isScanning) {
        stopCameraScanning();
        await new Promise(resolve => setTimeout(resolve, 500)); // Økt fra 300 til 500ms for å sikre at alt er stoppet
    }
    
    try {
        // Last inn Quagga-biblioteket hvis det ikke er lastet inn
        if (typeof Quagga === 'undefined') {
            console.log('DEBUG-CAM021: Quagga ikke definert, laster biblioteket');
            try {
                await loadQuaggaScript();
                console.log('DEBUG-CAM022: Quagga-bibliotek lastet inn vellykket');
            } catch (quaggaLoadError) {
                console.error('DEBUG-CAM023: Kunne ikke laste Quagga:', quaggaLoadError);
                showToast('Kunne ikke laste strekkodebibliotek. Prøv å laste siden på nytt.', 'error');
                throw quaggaLoadError;
            }
        }
        
        // Finn aktuell scanner-container basert på gjeldende modul
        let modulePrefix = '';
        let moduleType = '';
        if (appState && appState.currentModule) {
            if (appState.currentModule === 'picking') {
                modulePrefix = 'Pick';
                moduleType = 'pick';
            }
            else if (appState.currentModule === 'receiving') {
                modulePrefix = 'Receive';
                moduleType = 'receive';
            }
            else if (appState.currentModule === 'returns') {
                modulePrefix = 'Return';
                moduleType = 'return';
            }
        }
        
        console.log(`DEBUG-CAM000: Starter skanning for modul: ${moduleType}`);
        
        // Sjekk om modultype er gyldig
        if (!moduleType) {
            showToast('Kan ikke starte kamera: Ukjent modultype', 'error');
            throw new Error('Ukjent modultype');
        }
        
        // Kontroller at callback-funksjonen er registrert
        if (moduleType && !moduleCallbacks[moduleType]) {
            console.warn(`DEBUG-CAM000B: Ingen callback registrert for ${moduleType}, forsøker å registrere fra global scope`);
            
            // Forsøk å registrere fra window-objektet
            const handlerName = `handle${modulePrefix}Scan`;
            if (typeof window[handlerName] === 'function') {
                console.log(`DEBUG-CAM000C: Registrerer window.${handlerName} som callback for ${moduleType}`);
                registerModuleCallback(moduleType, window[handlerName]);
            } else {
                console.error(`DEBUG-CAM000D: window.${handlerName} er ikke en funksjon, kan ikke registrere callback`);
            }
        }
        
        // Finn elementer
        const containerId = `cameraScanner${modulePrefix}Container`;
        const videoId = `video${modulePrefix}Scanner`;
        const canvasId = `canvas${modulePrefix}Scanner`;
        
        const container = document.getElementById(containerId);
        videoElement = document.getElementById(videoId);
        canvasElement = document.getElementById(canvasId);
        
        console.log(`DEBUG-CAM001: Modulprfix=${modulePrefix}, Container=${containerId}, Video=${videoId}, Canvas=${canvasId}`);
        console.log(`DEBUG-CAM002: Fant elementer: Container=${!!container}, Video=${!!videoElement}, Canvas=${!!canvasElement}`);
        
        // Vis feilmelding og avbryt hvis elementer mangler
        if (!container || !videoElement || !canvasElement) {
            const missingElements = [];
            if (!container) missingElements.push(`Container (${containerId})`);
            if (!videoElement) missingElements.push(`Video (${videoId})`);
            if (!canvasElement) missingElements.push(`Canvas (${canvasId})`);
            
            const errorMsg = `Kamera-elementer mangler: ${missingElements.join(', ')}`;
            showToast(errorMsg, 'error');
            throw new Error(errorMsg);
        }
        
        // Vis container
        container.style.display = 'block';
        
        // Stopp eventuelle eksisterende videostrømmer
        if (videoElement.srcObject) {
            try {
                videoElement.srcObject.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
                // Gi litt tid før vi starter på nytt
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {
                showToast(`Advarsel: ${e.message}`, 'warning');
            }
        }
        
        // Sett viktige attributter for iOS-kompatibilitet
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('muted', '');
        videoElement.muted = true;
        
        // Sjekk for iOS-enhet og legg til spesielle attributter
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            videoElement.setAttribute('webkit-playsinline', '');
        }
        
        // Konfigurer kamerainnstillinger
        const constraints = { 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        // Legg til kamera-ID hvis spesifisert
        if (cameraId) {
            constraints.video.deviceId = { exact: cameraId };
        } 
        // Legg til facingMode hvis spesifisert i options
        else if (options && options.facingMode) {
            constraints.video.facingMode = options.facingMode;
        }
        // Standard er environment (bak-kamera) hvis tilgjengelig
        else {
            constraints.video.facingMode = { ideal: "environment" };
        }
        
        console.log('DEBUG-CAM003: Starter mediaDevices.getUserMedia med constraints:', JSON.stringify(constraints));
        
        // Start kameraet
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraStream = stream;
            
            // Logg kamerainformasjon
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                console.log(`DEBUG-CAM004: Videotrack aktiv:`, videoTrack.label, videoTrack.readyState);
                showToast(`Kamera aktivert: ${videoTrack.label || 'Ukjent kamera'}`, 'success');
            }
            
            // Tilkoble video til strøm
            videoElement.srcObject = stream;
            
            // Registrer callbacks for å sikre at video starter
            let videoStartPromise = new Promise((resolve, reject) => {
                // Tidsbegrensning for å vente på video start
                const videoTimeout = setTimeout(() => {
                    console.log('DEBUG-CAM005: Video start timeout utløpt');
                    reject(new Error('Video start timeout'));
                }, 5000);
                
                // Lytt på flere events for å sikre at video starter
                const videoStarted = () => {
                    console.log('DEBUG-CAM006: Video har startet avspilling');
                    clearTimeout(videoTimeout);
                    resolve();
                };
                
                videoElement.oncanplay = videoStarted;
                videoElement.onplaying = videoStarted;
                
                // Forsøk å starte avspillingen manuelt
                videoElement.play().then(() => {
                    console.log('DEBUG-CAM007: Video play() vellykket');
                }).catch(e => {
                    console.error('DEBUG-CAM008: Video play() feilet:', e);
                });
            });
            
            try {
                await videoStartPromise;
                console.log('DEBUG-CAM009: Video er klar til bruk');
            } catch (error) {
                console.error('DEBUG-CAM010: Feil ved initialisering av video:', error);
                // Fortsett likevel - noen enheter rapporterer feil, men fungerer likevel
            }
            
            // Vent litt før Quagga initialiseres for å sikre at video er stabilisert
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('DEBUG-CAM012: Initialiserer Quagga med video:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            
            // Sjekk om video faktisk spiller
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                console.warn('DEBUG-CAM013: Video har ingen dimensjoner, men fortsetter likevel');
            }
            
            // Initialiser Quagga2 med forbedret konfigurasjon uten begrenset skanneområde
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: videoElement,
                    constraints: {
                        width: { min: 640 },
                        height:  { min: 480 }
                    },
                    area: null, // Fjernet begrensning for skanneområde, bruker hele bildet
                    singleChannel: false // viktig for Quagga2
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                decoder: {
                    readers: [
                        "ean_reader",
                        "ean_8_reader",
                        "code_128_reader",
                        "code_39_reader",
                        "code_93_reader",
                        "upc_reader",
                        "upc_e_reader"
                    ],
                    multiple: false,
                    // Øk frekvensen for mer presis deteksjon
                    frequency: 10,
                    debug: {
                        showCanvas: true,
                        showPatches: true,
                        showFoundPatches: true,
                        showSkeleton: true,
                        showLabels: true,
                        showPatchLabels: true,
                        showRemainingPatchLabels: true
                    }
                },
                locate: true
            }, function(err) {
                if (err) {
                    console.error('DEBUG-CAM014: Quagga init feilet:', err);
                    showToast(`Feil ved start av strekkodeleser: ${err.message || 'Ukjent feil'}`, 'error');
                    return;
                }
                
                console.log('DEBUG-CAM015: Quagga init vellykket, starter skanning');
                
                try {
                    // Registrer deteksjonshandler FØR start
                    Quagga.onDetected((result) => {
                        if (result && result.codeResult) {
                            handleCameraScanResult(result);
                        }
                    });
                    
                    // Legg også til en feilhåndterer for å fange opp problemer
                    Quagga.onProcessed((result) => {
                        if (result && result.codeResult) {
                            console.log('DEBUG-CAM016: Quagga prosessert resultat:', result.codeResult.code);
                        }
                    });
                    
                    // Start skanning
                    Quagga.start();
                    isScanning = true;
                    
                    console.log('DEBUG-CAM017: Quagga startet vellykket');
                    
                    // Oppdater status
                    if (scannerStatusCallback) {
                        scannerStatusCallback(true, { type: 'camera' });
                    }
                    
                    showToast('Kamera klar til skanning', 'success');
                } catch (e) {
                    console.error('DEBUG-CAM018: Quagga start feilet:', e);
                    showToast(`Kunne ikke starte strekkodeleser: ${e.message}`, 'error');
                    
                    // Vi stopper ikke kameraet her - lar video kjøre
                    // så brukeren i det minste kan se kameraet
                }
            });
            
            return { success: true };
        } catch (error) {
            // Vis detaljert feilmelding til brukeren
            const errorMsg = `Kunne ikke starte kamera: ${error.name || 'Ukjent feil'}`;
            const detailMsg = error.message || '';
            
            console.error('DEBUG-CAM019: getUserMedia feilet:', error);
            
            // Vis mer brukervennlige meldinger for vanlige feil
            if (error.name === 'NotAllowedError') {
                showToast('Kameratilgang nektet. Vennligst gi tillatelse til kamerabruk.', 'error');
            } else if (error.name === 'NotFoundError') {
                showToast('Kamera ikke funnet. Har enheten et kamera?', 'error');
            } else if (error.name === 'NotReadableError') {
                showToast('Kamera er i bruk av en annen app. Lukk andre apper som bruker kamera.', 'error');
            } else {
                showToast(`${errorMsg}: ${detailMsg}`, 'error');
            }
            
            if (scannerStatusCallback) {
                scannerStatusCallback(false);
            }
            throw error;
        }
    } catch (error) {
        showToast(`Kamera kunne ikke startes: ${error.message}`, 'error');
        console.error('DEBUG-CAM020: Generell feil i startCameraScanning:', error);
        throw error;
    }
}

/**
 * Stopper kameraskanning
 */
function stopCameraScanning() {
    if (!isScanning) {
        return;
    }
    
    // Stopp Quagga
    if (typeof Quagga !== 'undefined') {
        try {
            Quagga.stop();
        } catch (e) {
            showToast(`Advarsel ved stopping av skanner: ${e.message}`, 'warning');
        }
    }
    
    // Stopp kamerastrøm
    if (cameraStream) {
        try {
            cameraStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
        } catch (e) {
            showToast(`Advarsel ved stopping av kamera: ${e.message}`, 'warning');
        }
        cameraStream = null;
    }
    
    // Tilbakestill video-elementet
    if (videoElement) {
        try {
            videoElement.srcObject = null;
            videoElement.onloadedmetadata = null;
            videoElement.onloadeddata = null;
            videoElement.oncanplay = null;
        } catch (e) {
            // Ignorer feil her
        }
    }
    
    // Skjul kamera containere
    try {
        let modulePrefix = '';
        if (appState && appState.currentModule) {
            if (appState.currentModule === 'picking') modulePrefix = 'Pick';
            else if (appState.currentModule === 'receiving') modulePrefix = 'Receive';
            else if (appState.currentModule === 'returns') modulePrefix = 'Return';
        }
        
        const containerId = `cameraScanner${modulePrefix}Container`;
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'none';
        }
    } catch (e) {
        // Ignorer feil her
    }
    
    isScanning = false;
    
    // Informer om statusendring
    if (scannerStatusCallback) {
        scannerStatusCallback(false);
    }
}

/**
 * Bytter mellom tilgjengelige kameraer
 */
async function switchCamera() {
    showToast('Bytter kamera...', 'info');
    
    if (isScanning) {
        // Stopp nåværende skanning
        stopCameraScanning();
        
        // Vent litt for å være sikker på at kameraet er stoppet
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // For iOS-enheter
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            // Hvis vi allerede bruker environment, bytt til user, og omvendt
            const currentFacingMode = currentCameraIndex === 0 ? "user" : "environment";
            const newFacingMode = currentFacingMode === "user" ? "environment" : "user";
            
            // Oppdater gjeldende kameraindeks
            currentCameraIndex = currentCameraIndex === 0 ? 1 : 0;
            
            // Start skanning med spesifikk facingMode for iOS
            try {
                await startCameraScanning(null, { facingMode: { exact: newFacingMode } });
                showToast(`Byttet til ${newFacingMode === 'user' ? 'front' : 'bak'}-kamera`, 'success');
            } catch (error) {
                showToast(`Kunne ikke bytte kamera: ${error.message}`, 'error');
                
                // Fallback til standard kamera hvis det spesifikke kameraet ikke kunne brukes
                await startCameraScanning();
            }
            return;
        }
        
        // For andre enheter, bruk den originale logikken
        if (availableCameras.length === 0) {
            availableCameras = await checkAvailableCameras();
        }
        
        // Gå til neste kamera i listen
        if (availableCameras.length > 1) {
            currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
            
            const camera = availableCameras[currentCameraIndex];
            showToast(`Bytter til kamera: ${camera.label || 'Kamera ' + (currentCameraIndex + 1)}`, 'info');
            
            // Start skanning med nytt kamera
            startCameraScanning(camera.deviceId);
        } else {
            showToast('Bare ett kamera tilgjengelig.', 'warning');
            startCameraScanning();
        }
    } else {
        showToast('Skanning er ikke aktiv, starter kamera først.', 'info');
        startCameraScanning();
    }
}

/**
 * Håndterer resultater fra kameraskanning
 * @param {Object} result - Skanningsresultat-objekt fra Quagga
 */
function handleCameraScanResult(result) {
    if (scanCooldown) return; // Ignorer skann i cooldown-perioden
    
    if (result && result.codeResult && result.codeResult.code) {
        // Sikre at barkoden alltid er en string, ikke et objekt
        const barcode = String(result.codeResult.code);
        
        console.log(`DEBUG-SCAN001: Rå strekkode fra skanner:`, result.codeResult.code, 
                   `(type: ${typeof result.codeResult.code})`);
        console.log(`DEBUG-SCAN002: Konvertert strekkode:`, barcode, 
                   `(type: ${typeof barcode})`);
        
        // Sjekk om dette er samme strekkode som nettopp ble skannet
        if (barcode === lastScannedCode) {
            return; // Ignorer dupliserte skann
        }
        
        // Sjekk om strekkoden er i skanningsområdet (box)
        if (!result.box) {
            console.log(`DEBUG-SCAN004: Strekkode oppdaget, men utenfor skanningsområdet`);
            return; // Ignorer strekkoder som er oppdaget utenfor skanningsområdet
        }
        
        // Skrøyt ut hvis strekkoden ser ut som [object Object]
        if (barcode === "[object Object]") {
            console.error(`DEBUG-SCAN003: Strekkoden konverteres feil til [object Object]!`);
            showToast('Feil ved lesing av strekkode. Prøv igjen.', 'error');
            return;
        }
        
        // Sjekk om strekkoden finnes i barcodeMapping (brukes for å finne varenummer)
        const isValidMappedBarcode = appState.barcodeMapping && 
                                    (barcode in appState.barcodeMapping);
        
        // Valider at dette er en strekkode
        if (validateBarcode(barcode)) {
            // Marker strekkoden på canvas
            if (canvasElement && result.box) {
                const ctx = canvasElement.getContext('2d');
                drawDetectedBox(ctx, result.box);
            }
            
            // Hent eventuelt varenummer fra barcodeMapping
            let itemId = barcode;
            let productInfo = "";
            
            if (isValidMappedBarcode) {
                const mappedValue = appState.barcodeMapping[barcode];
                
                // Sjekk om mappedValue er et objekt eller en streng
                if (typeof mappedValue === 'object' && mappedValue !== null) {
                    // Hvis det er et objekt, hent ut id-propertyen
                    itemId = mappedValue.id || barcode;
                    const description = mappedValue.description ? ` (${mappedValue.description})` : '';
                    productInfo = ` (Varenr: ${itemId}${description})`;
                    console.log(`DEBUG-SCAN007: Strekkode ${barcode} mappet til varenummer ${itemId} via objekt`);
                } else {
                    // Hvis det er en streng, bruk verdien direkte
                    itemId = mappedValue;
                    productInfo = ` (Varenr: ${itemId})`;
                    console.log(`DEBUG-SCAN007: Strekkode ${barcode} mappet til varenummer ${itemId}`);
                }
            } else {
                // Ingen mapping funnet, bruk strekkoden direkte
                productInfo = ` (Ingen varenummer funnet)`;
                console.log(`DEBUG-SCAN008: Strekkode ${barcode} ikke funnet i mapping`);
            }
            
            // VIKTIG ENDRING: Oppdater variablene som sporer gjenkjente strekkoder
            // uansett om strekkoden er i mapping eller ikke
            lastDetectedCode = barcode;
            lastScannedCode = barcode;
            
            // Vis status direkte i kameravisningen
            showBarcodeStatusMessage(`Strekkode gjenkjent: ${barcode}${productInfo}`, true);
            
            // Vis til brukeren at en strekkode er oppdaget
            const detectedToastMsg = `Strekkode oppdaget: ${barcode}`;
            showToast(detectedToastMsg, 'info', 2000);
            
            // Spill lyd for å indikere at strekkode er funnet
            playDetectionSound();
            
            // Hvis vi er i kontinuerlig skannemodus, prosesser strekkoden automatisk
            if (window.continuousScanning) {
                console.log(`DEBUG-SCAN006: Auto-prosesserer strekkode ${barcode} i kontinuerlig modus`);
                
                processScannedBarcode(barcode);
                
                // Tilbakestill kontinuerlig skannemodus
                window.continuousScanning = false;
                
                // Tilbakestill scan-button til normal tilstand
                const moduleType = getModuleType(appState.currentModule);
                const scanButton = scanButtonElements[moduleType];
                if (scanButton) {
                    scanButton.classList.remove('scanning-active');
                    scanButton.textContent = 'Utfør skann';
                    
                    // Gjenopprett original klikkhandler
                    scanButton.onclick = () => {
                        performManualScan(moduleType);
                    };
                }
                
                // Sett cooldown for å unngå gjentatte skanninger
                scanCooldown = true;
                
                // Start skanning igjen etter cooldown
                setTimeout(() => {
                    scanCooldown = false;
                }, 2000); // 2 sekund cooldown mellom auto-skanninger
                
                return;
            }
            
            // VIKTIG ENDRING: Vis BARE gyldige strekkoder i knappen, ingenting annet
            if (manualScanMode) {
                const moduleType = getModuleType(appState.currentModule);
                const scanButton = scanButtonElements[moduleType];
                
                // Sjekk om strekkoden finnes i barcodeMapping
                const isInMapping = appState.barcodeMapping && (barcode in appState.barcodeMapping);
                
                if (scanButton) {
                    if (isInMapping) {
                        // Gjør knappen mer fremtredende og vis både strekkode og varenummer
                        scanButton.classList.add('ready-to-scan');
                        scanButton.classList.remove('disabled'); // Fjern disabled-klassen
                        scanButton.disabled = false; // Aktiver knappen
                        
                        // VIKTIG FIX: Begrens lengden på produktinfo i knappen
                        let truncatedProductInfo = productInfo;
                        if (truncatedProductInfo.length > 30) {
                            truncatedProductInfo = truncatedProductInfo.substring(0, 27) + '...';
                        }
                        
                        scanButton.textContent = `Bekreft "${barcode}"${truncatedProductInfo}`;
                        
                        // Vis en blinkende grønn kant rundt skann-området
                        if (canvasElement) {
                            const scanArea = document.querySelector('.scan-area');
                            if (scanArea) {
                                scanArea.classList.add('detected');
                            }
                        }
                    } else {
                        // Strekkoden finnes ikke i mapping - IKKE vis strekkoden på knappen
                        scanButton.classList.remove('ready-to-scan');
                        scanButton.classList.add('disabled');
                        scanButton.disabled = true;
                        scanButton.textContent = 'Venter på gyldig strekkode...';
                        
                        // Vis feilmelding i status (ikke i knappen)
                        showBarcodeStatusMessage(`Ukjent strekkode: ${barcode}. Ikke i system.`, false);
                        
                        // Spill feil-lyd
                        playErrorSound();
                    }
                }
                
                // Ikke prosesser videre med ugyldige strekkoder - vent på en gyldig
                if (!isInMapping) {
                    return;
                }
            }
            
            // IKKE prosesser automatisk hvis vi er i manuell modus (vesentlig endring)
            if (manualScanMode) {
                // Vi lar brukeren klikke på knappen for å bekrefte skanningen
                // så vi prosesserer ikke strekkoden automatisk her
                return;
            }
            
            // Hvis automatisk modus, fortsett med skanning som før
            processScannedBarcode(barcode);
            
            // Sett cooldown for å unngå gjentatte skanninger
            scanCooldown = true;
            
            // Start skanning igjen etter cooldown
            setTimeout(() => {
                scanCooldown = false;
                
                // Tilbakestill scan-button og scan-area hvis vi er i manuell modus
                const moduleType = getModuleType(appState.currentModule);
                const scanButton = scanButtonElements[moduleType];
                if (scanButton) {
                    scanButton.classList.remove('ready-to-scan');
                    scanButton.textContent = 'Utfør skann';
                }
                
                const scanArea = document.querySelector('.scan-area');
                if (scanArea) {
                    scanArea.classList.remove('detected');
                }
                
                // Fjern statusmeldingen
                hideBarcodeStatusMessage();
                
            }, 1000); // 1 sekund cooldown mellom skanninger
        } else {
            // Viser melding om at strekkoden ikke ble gjenkjent/validert, men kun ved intervaller
            if (!window.invalidBarcodeDebounce) {
                showBarcodeStatusMessage("Strekkode ikke gjenkjent. Prøv igjen.", false);
                window.invalidBarcodeDebounce = true;
                setTimeout(() => {
                    window.invalidBarcodeDebounce = false;
                }, 2000);
            }
        }
    }
}

/**
 * Håndterer prosesserte bilder fra Quagga
 * @param {Object} result - Prosesseringsresultat fra Quagga
 */
function handleProcessedResult(result) {
    if (!canvasElement || !result) return;
    
    try {
        const ctx = canvasElement.getContext('2d');
        
        // Tøm canvas
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Tegn deteksjonsområde hvis funnet
        if (result.boxes) {
            result.boxes.filter(box => box !== result.box).forEach(box => {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(box[0][0], box[0][1]);
                box.forEach((p, i) => {
                    if (i !== 0) ctx.lineTo(p[0], p[1]);
                });
                ctx.lineTo(box[0][0], box[0][1]);
                ctx.stroke();
            });
        }
        
        // Tegn den mest sannsynlige strekkoden med rød
        if (result.box) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(result.box[0][0], result.box[0][1]);
            result.box.forEach((p, i) => {
                if (i !== 0) ctx.lineTo(p[0], p[1]);
            });
            ctx.lineTo(result.box[0][0], result.box[0][1]);
            ctx.stroke();
        }
        
        // Hvis vi har en strekkoderesultat, vis det
        if (result.codeResult && result.codeResult.code) {
            // Tegn bakgrunn for tekstboksen
            const text = result.codeResult.code;
            ctx.font = '16px Arial';
            const textWidth = ctx.measureText(text).width;
            
            // Posisjon for teksten (under strekkodeboksen)
            const textX = result.box ? (result.box[0][0] + result.box[2][0]) / 2 - textWidth / 2 : 10;
            const textY = result.box ? result.box[2][1] + 30 : 30;
            
            // Tegn bakgrunn for teksten
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(textX - 5, textY - 16, textWidth + 10, 22);
            
            // Tegn teksten
            ctx.fillStyle = 'white';
            ctx.fillText(text, textX, textY);
        }
    } catch (error) {
        // Feil ved tegning ignoreres, for å ikke forstyrre skanningen
    }
}

/**
 * Spiller en lyd for å gi tilbakemelding ved vellykket skanning
 */
export function playSuccessSound() {
    try {
        // Forsøk å bruke AudioContext for mest pålitelig lyd på tvers av enheter
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1800; // Høyere frekvens for å skille seg ut
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, 150);
    } catch (error) {
        // Fallback til å vibrere enheten hvis tilgjengelig
        try {
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        } catch (e) {
            // Ignorer feil her
        }
    }
}

/**
 * Tegner en suksess-boks rundt en identifisert strekkode
 * @param {CanvasRenderingContext2D} ctx - Canvas-kontekst
 * @param {Array} box - Koordinater for strekkoden
 */
function drawSuccessBox(ctx, box) {
    try {
        if (!ctx || !box || box.length < 4) return;
        
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Tegn fylt grønn boks med gjennomskinnelighet
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.beginPath();
        ctx.moveTo(box[0][0], box[0][1]);
        for (let i = 1; i < box.length; i++) {
            ctx.lineTo(box[i][0], box[i][1]);
        }
        ctx.closePath();
        ctx.fill();
        
        // Tegn kant
        ctx.strokeStyle = 'rgb(76, 175, 80)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(box[0][0], box[0][1]);
        for (let i = 1; i < box.length; i++) {
            ctx.lineTo(box[i][0], box[i][1]);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Tegn "checkmark"
        const centerX = (box[0][0] + box[2][0]) / 2;
        const centerY = (box[0][1] + box[2][1]) / 2;
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(centerX - 20, centerY);
        ctx.lineTo(centerX - 5, centerY + 15);
        ctx.lineTo(centerX + 20, centerY - 15);
        ctx.stroke();
    } catch (error) {
        // Ignorer feil ved tegning av suksess-boks
    }
}

/**
 * Tegner en deteksjons-boks rundt en identifisert strekkode (før bekreftelse)
 * @param {CanvasRenderingContext2D} ctx - Canvas-kontekst
 * @param {Array} box - Koordinater for strekkoden
 */
function drawDetectedBox(ctx, box) {
    try {
        if (!ctx || !box || box.length < 4) return;
        
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Tegn fylt oransje boks med gjennomskinnelighet (ubekreftet)
        ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(box[0][0], box[0][1]);
        for (let i = 1; i < box.length; i++) {
            ctx.lineTo(box[i][0], box[i][1]);
        }
        ctx.closePath();
        ctx.fill();
        
        // Tegn kant
        ctx.strokeStyle = 'rgb(255, 165, 0)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(box[0][0], box[0][1]);
        for (let i = 1; i < box.length; i++) {
            ctx.lineTo(box[i][0], box[i][1]);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Tegn strekkode-symbol
        const centerX = (box[0][0] + box[2][0]) / 2;
        const centerY = (box[0][1] + box[2][1]) / 2;
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        // Tegn barcode-symbol
        const barWidth = 4;
        const barHeight = 15;
        const startX = centerX - 15;
        
        for (let i = 0; i < 8; i++) {
            const x = startX + i * barWidth;
            const height = (i % 3 === 0) ? barHeight : barHeight * 0.7;
            ctx.beginPath();
            ctx.moveTo(x, centerY - height/2);
            ctx.lineTo(x, centerY + height/2);
            ctx.stroke();
        }
    } catch (error) {
        // Ignorer feil ved tegning av deteksjons-boks
        console.error("Feil ved tegning av deteksjons-boks:", error);
    }
}

/**
 * Laster dynamisk inn Quagga.js hvis det ikke allerede er lastet
 * @returns {Promise} Løftebasert resultat av skriptlasting
 */
function loadQuaggaScript() {
    return new Promise((resolve, reject) => {
        if (typeof Quagga !== 'undefined') {
            console.log('DEBUG-QUAGGA001: Quagga er allerede lastet');
            resolve();
            return;
        }
        
        console.log('DEBUG-QUAGGA002: Forsøker å laste Quagga-biblioteket');
        showToast('Laster strekkodebibliotek...', 'info');
        
        // Forsøk å rydde eksisterende skriptreferanser
        const existingScripts = document.querySelectorAll('script[src*="quagga"]');
        existingScripts.forEach(script => script.remove());
        
        // Merk: Bruker Quagga2 som er en forbedret versjon
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.3/dist/quagga.min.js';
        script.crossOrigin = 'anonymous';
        
        // Sett en timeout for å håndtere hengelåsing
        const timeoutId = setTimeout(() => {
            console.error('DEBUG-QUAGGA003: Tidsavbrudd ved lasting av Quagga');
            showToast('Tidsavbrudd ved lasting av strekkodebibliotek, prøver backup-kilde...', 'warning');
            
            // Prøv en alternativ kilde hvis første kilde feiler
            const backupScript = document.createElement('script');
            backupScript.src = 'https://unpkg.com/@ericblade/quagga2@1.8.3/dist/quagga.min.js';
            backupScript.crossOrigin = 'anonymous';
            
            backupScript.onload = () => {
                console.log('DEBUG-QUAGGA004: Backup-kilde for Quagga lastet vellykket');
                clearTimeout(backupTimeoutId);
                resolve();
            };
            
            backupScript.onerror = (err) => {
                console.error('DEBUG-QUAGGA005: Kunne ikke laste Quagga fra backup-kilde', err);
                showToast('Kunne ikke laste strekkodebibliotek. Prøv å laste siden på nytt.', 'error');
                reject(new Error("Kunne ikke laste Quagga2-script fra backup-kilde"));
            };
            
            document.head.appendChild(backupScript);
            
            // Sett en backup timeout
            const backupTimeoutId = setTimeout(() => {
                reject(new Error("Tidsavbrudd ved lasting av Quagga2 fra backup-kilde"));
            }, 10000);
        }, 10000);
        
        script.onload = () => {
            console.log('DEBUG-QUAGGA006: Quagga lastet vellykket');
            clearTimeout(timeoutId);
            
            // Verifiser at Quagga faktisk er definert etter lasting
            if (typeof Quagga === 'undefined') {
                console.error('DEBUG-QUAGGA007: Quagga er ikke definert etter vellykket skriptinnlasting');
                showToast('Feil ved initialisering av strekkodebibliotek', 'error');
                reject(new Error("Quagga er ikke definert etter skriptlasting"));
                return;
            }
            
            resolve();
        };
        
        script.onerror = (err) => {
            console.error('DEBUG-QUAGGA008: Feil ved lasting av Quagga', err);
            clearTimeout(timeoutId);
            // Ikke avvis ennå, la timeout-handler prøve backup-kilden
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Sjekker og viser tilgjengelige kameraer
 */
async function checkAvailableCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
            showToast('Ingen kameraer funnet på enheten.', 'warning');
        }
        
        return videoDevices;
    } catch (error) {
        showToast(`Feil ved sjekk av kameraer: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Validerer at en strekkode er gyldig med forbedret logikk
 * @param {string} barcode - Strekkode som skal valideres
 * @returns {boolean} Om strekkoden er gyldig
 */
function validateBarcode(barcode) {
    // Fjern eventuelle blanke tegn og kontroller for nullverdier
    if (!barcode) return false;
    
    barcode = barcode.trim();
    
    // Hvis strekkoden er tom etter trim, er den ikke gyldig
    if (barcode === '') return false;
    
    // Enkel validering: har strekkoden en minimumlengde?
    // De fleste strekkoder er minst 8 tegn, men noen interne koder kan være kortere
    if (barcode.length < 3) {
        return false;
    }
    
    console.log(`DEBUG-VALIDATE: Sjekker strekkode ${barcode}`);
    
    // FORBEDRING: Fjern eventuelle ledetegn som ofte legges til av skannere
    const cleanedBarcode = barcode.replace(/^\w+:/i, ''); // Fjerner prefiks som "EAN:" eller "UPC:"
    
    // VIKTIG: Sjekk om strekkoden finnes direkte i barcodeMapping
    if (appState.barcodeMapping) {
        // Sjekk om strekkoden finnes direkte som nøkkel i objektet
        if (barcode in appState.barcodeMapping) {
            console.log(`DEBUG-VALIDATE: Strekkode ${barcode} finnes direkte i barcodeMapping`);
            return true;
        }
        
        // Sjekk med renset strekkode om nødvendig
        if (barcode !== cleanedBarcode && cleanedBarcode in appState.barcodeMapping) {
            console.log(`DEBUG-VALIDATE: Renset strekkode ${cleanedBarcode} finnes i barcodeMapping`);
            return true;
        }
        
        // NYE FORBEDREDE SJEKKER FOR EAN-13 KODER
        
        // EAN-13 validering med kontrollsum-sjekk
        if (/^\d{13}$/.test(barcode)) {
            console.log(`DEBUG-VALIDATE: Sjekker EAN-13 strekkode: ${barcode}`);
            
            // Sjekk kontrollsum for EAN-13
            const checkDigit = parseInt(barcode[12]);
            let sum = 0;
            
            for (let i = 0; i < 12; i++) {
                const digit = parseInt(barcode[i]);
                sum += (i % 2 === 0) ? digit : digit * 3;
            }
            
            const calculatedCheckDigit = (10 - (sum % 10)) % 10;
            const isValidChecksum = (calculatedCheckDigit === checkDigit);
            
            if (isValidChecksum) {
                console.log(`DEBUG-VALIDATE: EAN-13 strekkode ${barcode} har gyldig kontrollsum`);
                
                // Sjekk direkte mot alle strekkoder for å finne numeriske matcher
                const allBarcodes = Object.keys(appState.barcodeMapping);
                
                // Sjekk for direkte prefiks-match (første 12 siffer)
                const prefix = barcode.substring(0, 12);
                const prefixMatches = allBarcodes.filter(key => key.startsWith(prefix));
                
                if (prefixMatches.length > 0) {
                    console.log(`DEBUG-VALIDATE: EAN-13 strekkode ${barcode} matcher prefiks med: ${prefixMatches[0]}`);
                    return true;
                }
                
                // Sjekk om barcode finnes delvis i noen nøkler (håndterer tilfeller med forskjellige formater)
                for (const key of allBarcodes) {
                    if (key.includes(barcode) || barcode.includes(key)) {
                        console.log(`DEBUG-VALIDATE: EAN-13 strekkode ${barcode} har delvis match med ${key}`);
                        return true;
                    }
                }
                
                // For produktkoder, godkjenn alle EAN-13 med gyldig kontrollsum
                // Endre dette hvis du vil stramme inn valideringen
                return true;
            }
        }
        
        // Sjekk om det er en EAN-13 uten ledende null
        if (/^\d{12}$/.test(barcode)) {
            // Forsøk å legge til ledende null
            const ean13 = '0' + barcode;
            if (ean13 in appState.barcodeMapping) {
                console.log(`DEBUG-VALIDATE: EAN-13 strekkode ${ean13} (med ledende null) finnes i mapping`);
                return true;
            }
        }
        
        // For strekkoder med bare tall, tillat forskjellige lengder hvis det er en delvis match
        if (/^\d+$/.test(barcode) && barcode.length >= 4) { // Redusert minimumslengde til 4 siffer
            const allBarcodes = Object.keys(appState.barcodeMapping);
            
            // Sjekk om strekkoden er en del av en annen strekkode i mappingen
            for (const key of allBarcodes) {
                if (/^\d+$/.test(key)) { // Sjekk bare mot numeriske strekkoder
                    if (key.includes(barcode) || barcode.includes(key)) {
                        console.log(`DEBUG-VALIDATE: Strekkode ${barcode} er en delvis match med ${key}`);
                        return true;
                    }
                }
            }
            
            // NY FORBEDRING: For numeriske strekkoder på minst 8 siffer, godta dem som gyldige
            // selv om de ikke er i mapping (sannsynligvis en gyldig produktkode)
            if (barcode.length >= 8) {
                console.log(`DEBUG-VALIDATE: Aksepterer numerisk strekkode ${barcode} (lengde=${barcode.length}) som gyldig format`);
                return true;
            }
        }
    }
    
    // Standard validering av strekkodeformater
    const isEAN13 = /^\d{13}$/.test(barcode);
    const isEAN8 = /^\d{8}$/.test(barcode);
    const isUPCA = /^\d{12}$/.test(barcode);
    const isCode128 = /^[A-Z0-9\-\.$/+%]{6,}$/.test(barcode);
    
    // FORBEDRING: Legg til aksept for rene numeriske koder med minst 8 siffer
    const isNumeric8Plus = /^\d{8,}$/.test(barcode);
    
    // Sjekk for interne produktkoder
    const isInternalCode = /^\d{3}-[A-Z][A-Z0-9]+-?[A-Z0-9]*$/.test(barcode) || 
                           /^[A-Z]{2}\d{5}$/.test(barcode) ||
                           /^BP\d{5}$/.test(barcode) ||
                           /^[A-Z][A-Z0-9]{4,}$/.test(barcode);
    
    // Endelig resultat - inkluder isNumeric8Plus
    return isEAN13 || isEAN8 || isUPCA || isCode128 || isInternalCode || isNumeric8Plus;
}

/**
 * Sentralisert funksjon for håndtering av skannede strekkoder
 * @param {string} barcode - Skannede strekkode
 */
export function processScannedBarcode(barcode) {
    console.log("PROSESS-DEBUG-P100: processScannedBarcode starter med", barcode);
    
    // Sjekk om barcode er et objekt og konverter til streng
    if (typeof barcode === 'object' && barcode !== null) {
        console.log("PROSESS-DEBUG-P100B: barcode er et objekt:", barcode);
        if (barcode.id) {
            console.log(`PROSESS-DEBUG-P100C: Bruker objekt.id (${barcode.id}) som barcode`);
            barcode = barcode.id;
        } else {
            console.error("PROSESS-FEIL-P000: Kunne ikke konvertere objekt til gyldig strekkode");
            showToast("Feil strekkodeformat mottatt. Kontakt systemadministrator.", "error");
            return;
        }
    }
    
    // Sjekk hvilken modul som er aktiv
    if (!appState.currentModule) {
        console.error("PROSESS-FEIL-P001: Ingen aktiv modul");
        showToast('Ingen aktiv modul. Velg plukk, mottak eller retur først.', 'warning');
        return;
    }
    
    console.log(`PROSESS-DEBUG-P101: Aktiv modul er ${appState.currentModule}`);
    
    // VIKTIG: Bruk modulspesifikk callback om tilgjengelig
    const moduleType = getModuleType(appState.currentModule);
    const moduleCallback = moduleCallbacks[moduleType];
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    let productInfo = "";
    let isValidMappedBarcode = false;
    
    if (appState.barcodeMapping && appState.barcodeMapping[barcode]) {
        isValidMappedBarcode = true;
        const mappedValue = appState.barcodeMapping[barcode];
        
        // Sjekk om mappedValue er et objekt eller en streng
        if (typeof mappedValue === 'object' && mappedValue !== null) {
            // Hvis det er et objekt, hent ut id-propertyen
            itemId = mappedValue.id || barcode;
            const description = mappedValue.description ? ` (${mappedValue.description})` : '';
            productInfo = ` (Varenr: ${itemId}${description})`;
            console.log(`PROSESS-DEBUG-P103: Strekkode ${barcode} mappet til varenummer ${itemId} via objekt`);
        } else {
            // Hvis det er en streng, bruk verdien direkte
            itemId = mappedValue;
            productInfo = ` (Varenr: ${itemId})`;
            console.log(`PROSESS-DEBUG-P103: Strekkode ${barcode} mappet til varenummer ${itemId}`);
        }
        
        // Prosesser modulcallback kun hvis strekkoden finnes i mapping
        if (moduleCallback) {
            console.log(`PROSESS-DEBUG-P102: Bruker modulspesifikk callback for ${moduleType}`);
            
            try {
                moduleCallback(itemId);
                console.log(`PROSESS-DEBUG-P104: Modulspesifikk callback utført vellykket`);
                return;
            } catch (error) {
                console.error(`PROSESS-FEIL-P002: Feil i modulspesifikk callback:`, error);
                alert(`Feil ved skanningshåndtering: ${error.message}`);
            }
        }
        
        // Fallback til standard handleScan
        console.log(`PROSESS-DEBUG-P105: Fallback til standard handleScan for ${moduleType}`);
        handleScan(barcode, moduleType);
    } else {
        // ENDRING: Ikke tillat å legge til ukjente strekkoder
        console.log(`PROSESS-DEBUG-P103C: Strekkode ${barcode} finnes ikke i barcodeMapping`);
        showToast(`Strekkode ${barcode} er ikke registrert i systemet. Kan ikke brukes.`, 'error');
        
        // Marker skanningen som mislykket med rød bakgrunn og feilmelding
        blinkBackground('red');
        playErrorSound();
        showBarcodeStatusMessage(`Ukjent strekkode: ${barcode}. Ikke registrert i systemet.`, false);
        
        // Nullstill lastDetectedCode og gjør knappen klar for ny skanning
        lastDetectedCode = null;
        lastScannedCode = null;
        
        // Tilbakestill scan-button til normal tilstand
        const scanButton = scanButtonElements[moduleType];
        if (scanButton) {
            scanButton.classList.remove('ready-to-scan');
            scanButton.textContent = 'Utfør skann';
        }
        
        // Fjern 'detected' klassen fra scan-area
        const scanArea = document.querySelector('.scan-area');
        if (scanArea) {
            scanArea.classList.remove('detected');
        }
    }
}

/**
 * Konverterer modulnavn til modultype
 * @param {string} moduleName - Modulnavn fra appState
 * @returns {string} Modultype for callback
 */
function getModuleType(moduleName) {
    switch (moduleName) {
        case 'picking': return 'pick';
        case 'receiving': return 'receive';
        case 'returns': return 'return';
        default: return moduleName;
    }
}

// scanner.js - handleScan funksjon komplett reparert

// scanner.js - handleScan funksjon med utvidet feillogging og feilkoder

/**
 * Håndterer skanning for alle moduler med forbedret strekkodevalidering
 * @param {string} barcode - Skannet strekkode
 * @param {string} type - Type modul (pick, receive, return)
 */
function handleScan(barcode, type) {
    if (!barcode) return;
    
    console.log(`DEBUG-SC100: Håndterer skanning: ${barcode} type: ${type}`);
    
    // Valider strekkoden før videre prosessering
    if (!validateBarcode(barcode)) {
        showToast(`Ugyldig strekkode: ${barcode}`, 'warning');
        return;
    }
    
    // Tøm input etter skanning
    const manualScanInput = document.getElementById(`${type}ManualScan`);
    if (manualScanInput) {
        manualScanInput.value = '';
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping && appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`DEBUG-SC102: Strekkode ${barcode} mappet til varenummer ${itemId}`);
    } else {
        console.log(`DEBUG-SC103: Strekkode ${barcode} ikke funnet i mapping, bruker som varenummer`);
    }
    
    // Sjekk modulspesifikke callbacks først - VIKTIG NY LOGIKK
    const moduleCallback = moduleCallbacks[type];
    if (moduleCallback) {
        console.log(`DEBUG-SC120: Kaller modulspesifikk callback for ${type} med ${itemId}`);
        try {
            moduleCallback(itemId);
            console.log(`DEBUG-SC121: Modulspesifikk callback for ${type} returnerte uten feil`);
            return; // Viktig: Returner her for å unngå videre prosessering
        } catch (error) {
            console.error(`FEILKODE-SC020: Feil i modulspesifikk callback for ${type}:`, error);
        }
    } else {
        console.warn(`ADVARSEL-SC120: Ingen modulspesifikk callback registrert for ${type}`);
    }
    
    // Fallback til standard håndtering hvis modulspesifikk callback feiler eller mangler
    try {
        switch (type) {
            case 'pick':
                if (typeof window.handlePickScan === 'function') {
                    console.log(`DEBUG-SC130: Fallback til window.handlePickScan med ${itemId}`);
                    window.handlePickScan(itemId);
                } else {
                    console.error(`FEILKODE-SC030: window.handlePickScan mangler`);
                    simulateManualScan(type, itemId);
                }
                break;
                
            case 'receive':
                if (typeof window.handleReceiveScan === 'function') {
                    console.log(`DEBUG-SC131: Fallback til window.handleReceiveScan med ${itemId}`);
                    window.handleReceiveScan(itemId);
                } else {
                    console.error(`FEILKODE-SC031: window.handleReceiveScan mangler`);
                    simulateManualScan(type, itemId);
                }
                break;
                
            case 'return':
                const quantityEl = document.getElementById('returnQuantity');
                const quantity = quantityEl ? parseInt(quantityEl.value) || 1 : 1;
                
                if (typeof window.handleReturnScan === 'function') {
                    console.log(`DEBUG-SC132: Fallback til window.handleReturnScan med ${itemId}`);
                    window.handleReturnScan(itemId, quantity);
                } else {
                    console.error(`FEILKODE-SC032: window.handleReturnScan mangler`);
                    simulateManualScan(type, itemId, quantity);
                }
                break;
                
            default:
                console.error(`FEILKODE-SC040: Ukjent modul: ${type}`);
                showToast(`Ukjent modul: ${type}`, 'error');
        }
    } catch (error) {
        console.error(`FEILKODE-SC050: Generell skanningshåndteringsfeil:`, error);
        showToast(`Feil ved håndtering av skann: ${error.message}`, 'error');
    }
}

/**
 * Simulerer manuell skanning
 * @param {string} type - Type modul
 * @param {string} itemId - Varenummer
 * @param {number} quantity - Antall (for retur)
 */
function simulateManualScan(type, itemId, quantity = 1) {
    console.log(`DEBUG-SC140: Simulerer manuell skanning for ${type}: ${itemId}`);
    
    const inputId = `${type}ManualScan`;
    const buttonId = `${type}ManualScanBtn`;
    const quantityId = `${type}Quantity`;
    
    const inputElement = document.getElementById(inputId);
    const buttonElement = document.getElementById(buttonId);
    
    if (inputElement && buttonElement) {
        // Sett verdi i inputfeltet
        inputElement.value = itemId;
        
        // Sett antall for retur
        if (type === 'return' && quantity > 1) {
            const quantityElement = document.getElementById(quantityId);
            if (quantityElement) {
                quantityElement.value = quantity;
            }
        }
        
        // Klikk på skann-knappen
        buttonElement.click();
    } else {
        console.error(`FEILKODE-SC060: Kunne ikke finne elementer for manuell skanning: input=${!!inputElement}, button=${!!buttonElement}`);
        showToast(`Kunne ikke registrere vare. Manglende UI-elementer.`, 'error');
    }
}

/**
 * Spiller en lyd for å gi tilbakemelding ved feil
 */
function playErrorSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 220; // Lavere frekvens for feilmeldinger
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        // Spill en "ned" lyd for å indikere feil
        oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.2);
        
        setTimeout(() => {
            oscillator.stop();
        }, 300);
    } catch (error) {
        // Fallback til å vibrere enheten hvis tilgjengelig
        try {
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Mønster for feil
            }
        } catch (e) {
            // Ignorer feil her
        }
    }
}

/**
 * Får bakgrunnen til å blinke i en bestemt farge
 * @param {string} color - Farge å blinke (f.eks. 'red', 'green')
 */
export function blinkBackground(color) {
    // Legg til et overlay-element hvis det ikke allerede finnes
    let overlay = document.getElementById('blinkOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'blinkOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.zIndex = '9999';
        overlay.style.pointerEvents = 'none'; // Ikke blokker klikk
        overlay.style.transition = 'background-color 0.3s';
        document.body.appendChild(overlay);
    }
    
    // Sett farge med litt gjennomsiktighet
    overlay.style.backgroundColor = color === 'red' ? 'rgba(255, 0, 0, 0.3)' : 
                                   color === 'green' ? 'rgba(0, 255, 0, 0.3)' : 
                                   color === 'orange' ? 'rgba(255, 165, 0, 0.3)' : 
                                   'rgba(0, 0, 0, 0.2)';
    
    // Fjern etter kort tid
    setTimeout(() => {
        overlay.style.backgroundColor = 'transparent';
    }, 500);
}

/**
 * Viser en statusmelding direkte i kameravisningen
 * @param {string} message - Meldingen som skal vises
 * @param {boolean} isSuccess - Om dette er en suksessmelding (grønn) eller feilmelding (rød)
 */
function showBarcodeStatusMessage(message, isSuccess = false) {
    // Finn eller opprett statusboks
    let statusEl = document.querySelector('.barcode-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'barcode-status';
        
        // Legg til i kameravisningen
        const container = document.querySelector('.camera-wrapper');
        if (container) {
            container.appendChild(statusEl);
        }
    }
    
    // Sett melding og stil
    statusEl.textContent = message;
    statusEl.style.backgroundColor = isSuccess ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    
    // Vis meldingen
    statusEl.classList.add('visible');
    
    // Fjern meldingen etter en stund
    setTimeout(() => {
        if (statusEl) statusEl.classList.remove('visible');
    }, 3000);
}

/**
 * Skjuler statusmeldingen
 */
function hideBarcodeStatusMessage() {
    const statusEl = document.querySelector('.barcode-status');
    if (statusEl) {
        statusEl.classList.remove('visible');
    }
}

/**
 * Spiller en lyd for å gi tilbakemelding ved vellykket deteksjon av strekkode
 */
function playDetectionSound() {
    try {
        // Forsøk å bruke AudioContext for mest pålitelig lyd på tvers av enheter
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 880; // A5 - en kort, klar tone
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        // Spill en kort, oppadgående tone
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
        
        setTimeout(() => {
            oscillator.stop();
        }, 150);
    } catch (error) {
        // Fallback til å vibrere enheten hvis tilgjengelig
        try {
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        } catch (e) {
            // Ignorer feil her
        }
    }
}

// Gjør debug-informasjon tilgjengelig globalt
window.scannerDebug = {
    isScanning,
    availableCameras,
    currentCameraIndex,
    cameraStream,
    validateBarcode
};

// Eksporter funksjoner
export {
    initCameraScanner,
    startCameraScanning,
    stopCameraScanning,
    switchCamera,
    bluetoothScanner,
    isScanning,
    playErrorSound
};