// scanner.js - Håndterer skanning via Bluetooth og kamera

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let cameraStream = null;
let isScanning = false;
let currentCameraIndex = 0;
let availableCameras = [];

import { appState } from '../app.js';

// DOM-elementer
let videoElement = null;
let canvasElement = null;
let scannerOverlay = null;

// Callback-funksjon for å håndtere skannede strekkoder
let onScanCallback = null;
let scannerStatusCallback = null;

// ========== BLUETOOTH SKANNER FUNKSJONALITET ==========

/**
 * Kobler til en Bluetooth-skanner
 * @returns {Promise} Løftebasert resultat av tilkoblingsforsøket
 */
async function connectToBluetoothScanner() {
    if (!navigator.bluetooth) {
        throw new Error('Bluetooth støttes ikke i denne nettleseren. Vennligst bruk Chrome eller Edge.');
    }
    
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            // Filtrer etter enheter som støtter serieport-profil eller HID
            acceptAllDevices: true, 
            optionalServices: ['battery_service', '0000ffe0-0000-1000-8000-00805f9b34fb']
        });
        
        bluetoothDevice.addEventListener('gattserverdisconnected', onBluetoothDisconnected);
        
        const server = await bluetoothDevice.gatt.connect();
        isBluetoothConnected = true;
        
        // Dette er et eksempel - du må tilpasse tjeneste- og karakteristikk-UUIDs til din spesifikke skanner
        try {
            const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
            
            // Slå på notifikasjoner for å motta data
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', handleBluetoothScannerData);
            
            // Informer om statusendring
            if (scannerStatusCallback) {
                scannerStatusCallback(true, { deviceName: bluetoothDevice.name || 'Ukjent enhet', type: 'bluetooth' });
            }
            
            return {
                success: true,
                deviceName: bluetoothDevice.name || 'Ukjent enhet'
            };
        } catch (error) {
            console.error('Kunne ikke koble til skanner-tjeneste:', error);
            isBluetoothConnected = false;
            throw new Error('Kunne ikke koble til skanner-tjeneste. Sjekk at skanneren er på og støtter Bluetooth LE.');
        }
        
    } catch (error) {
        console.error('Bluetooth-tilkobling feilet:', error);
        throw new Error('Bluetooth-tilkobling avbrutt eller feilet.');
    }
}

/**
 * Håndterer frakobling av Bluetooth-skanner
 */
function onBluetoothDisconnected() {
    isBluetoothConnected = false;
    
    // Informer om statusendring
    if (scannerStatusCallback) {
        scannerStatusCallback(false);
    }
}

/**
 * Håndterer data mottatt fra Bluetooth-skanner
 * @param {Event} event - Event-objekt fra Bluetooth-karakteristikk
 */
function handleBluetoothScannerData(event) {
    const value = event.target.value;
    const textDecoder = new TextDecoder('utf-8');
    const barcode = textDecoder.decode(value).trim();
    
    if (barcode) {
        processScannedBarcode(barcode);
    }
}

// ========== KAMERA SKANNER FUNKSJONALITET ==========

/**
 * Initialiserer kameraskanneren
 * @param {HTMLElement} videoEl - Video-element for visning av kamerastrøm
 * @param {HTMLElement} canvasEl - Canvas-element for bildeanalyse
 * @param {HTMLElement} overlayEl - Element for skanner-overlay
 * @param {Function} callback - Funksjon som kalles når en strekkode er skannet
 * @param {Function} statusCallback - Funksjon som kalles ved endringer i skannerstatus
 */
function initCameraScanner(videoEl, canvasEl, overlayEl, callback, statusCallback) {
    // Lagre DOM-elementer
    videoElement = videoEl;
    canvasElement = canvasEl;
    scannerOverlay = overlayEl;
    onScanCallback = callback;
    scannerStatusCallback = statusCallback;
    
    // List opp tilgjengelige kameraer
    checkAvailableCameras().then(cameras => {
        availableCameras = cameras;
        console.log(`Fant ${cameras.length} kameraer`);
    });
    
    // Sett opp event listeners for bytt-kamera-knapper
    const switchCameraButtons = document.querySelectorAll('.scanner-switch-btn');
    switchCameraButtons.forEach(button => {
        button.addEventListener('click', switchCamera);
    });
}

/**
 * Starter kameraskanning
 * @param {string} cameraId - ID til kamera som skal brukes (valgfritt)
 * @param {Object} options - Ekstra alternativer for kameraoppsett
 * @returns {Promise} Løftebasert resultat av oppstartforsøket
 */
async function startCameraScanning(cameraId = null, options = {}) {
    console.log("Starter kameraskanning...");
    
    // Stopp eventuelle aktive skannere
    if (isScanning) {
        stopCameraScanning();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    try {
        // Finn aktuell scanner-container basert på gjeldende modul
        let modulePrefix = '';
        if (appState && appState.currentModule) {
            if (appState.currentModule === 'picking') modulePrefix = 'Pick';
            else if (appState.currentModule === 'receiving') modulePrefix = 'Receive';
            else if (appState.currentModule === 'returns') modulePrefix = 'Return';
        }
        
        // Finn elementer
        const containerId = `cameraScanner${modulePrefix}Container`;
        const videoId = `video${modulePrefix}Scanner`;
        const canvasId = `canvas${modulePrefix}Scanner`;
        
        const container = document.getElementById(containerId);
        videoElement = document.getElementById(videoId);
        canvasElement = document.getElementById(canvasId);
        
        console.log("Scanner elementer:", { container, videoElement, canvasElement });
        
        // Vis feilmelding og avbryt hvis elementer mangler
        if (!container || !videoElement || !canvasElement) {
            console.error("Kritiske elementer mangler:", { containerId, videoId, canvasId });
            throw new Error("Kamera-elementer ikke funnet");
        }
        
        // Vis container
        container.style.display = 'block';
        
        // Stopp eventuelle eksisterende videostrømmer
        if (videoElement.srcObject) {
            try {
                videoElement.srcObject.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.warn("Feil ved stopping av tidligere videostrøm:", e);
            }
            videoElement.srcObject = null;
        }
        
        // Sett viktige attributter for iOS-kompatibilitet
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('muted', '');
        videoElement.muted = true;
        
        // Sjekk for iOS-enhet
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            console.log("iOS-enhet oppdaget, bruker spesielle innstillinger");
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
            console.log("Bruker spesifisert facingMode:", options.facingMode);
        }
        // Standard er environment (bak-kamera) hvis tilgjengelig
        else {
            constraints.video.facingMode = { ideal: "environment" };
        }
        
        // Start kameraet med retries for bedre pålitelighet
        let retryCount = 0;
        const maxRetries = 3;
        let stream = null;
        
        while (retryCount < maxRetries && !stream) {
            try {
                console.log(`Forsøk ${retryCount + 1}/${maxRetries} for å få kameratilgang med constraints:`, 
                    JSON.stringify(constraints));
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (error) {
                console.warn(`Forsøk ${retryCount + 1} feilet:`, error);
                retryCount++;
                
                // Prøv med en annen konfigurasjon ved feil
                if (retryCount < maxRetries) {
                    if (constraints.video.facingMode) {
                        // Bytt fra environment til user eller omvendt
                        const currentMode = 
                            constraints.video.facingMode.ideal || 
                            constraints.video.facingMode.exact || 
                            "environment";
                            
                        constraints.video.facingMode = { 
                            ideal: currentMode === "environment" ? "user" : "environment" 
                        };
                        console.log("Bytter kameraretning og prøver igjen");
                    } else {
                        // Fjern ekstra begrensninger
                        constraints.video = { facingMode: { ideal: "environment" }};
                        console.log("Forenkler kamerabegrensninger og prøver igjen");
                    }
                    
                    // Kort pause før nytt forsøk
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        
        if (!stream) {
            throw new Error("Kunne ikke få tilgang til kamera etter flere forsøk");
        }
        
        cameraStream = stream;
        console.log("Kameratilgang oppnådd:", stream);
        
        // Tilkoble video til strøm
        videoElement.srcObject = stream;
        
        // Vis kamerabilde
        videoElement.style.display = 'block';
        videoElement.style.visibility = 'visible';
        videoElement.style.opacity = '1';
        
        // Vent på at videoen er klar og start avspilling
        const videoReady = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timeout waiting for video to load"));
            }, 5000);
            
            videoElement.onloadedmetadata = () => {
                clearTimeout(timeout);
                videoElement.play()
                    .then(() => {
                        console.log("Video avspilling startet");
                        resolve();
                    })
                    .catch(err => {
                        console.warn("Kunne ikke starte video automatisk:", err);
                        // På iOS må vi kanskje vente på brukerinteraksjon
                        if (isIOS) {
                            resolve(); // Fortsett likevel
                        } else {
                            reject(err);
                        }
                    });
            };
            
            videoElement.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error(`Video error: ${err}`));
            };
        });
        
        try {
            await videoReady;
        } catch (err) {
            console.warn("Video ikke klar, men fortsetter likevel:", err);
        }
        
        // Last Quagga hvis nødvendig
        if (typeof Quagga === 'undefined') {
            console.log("Laster Quagga...");
            await loadQuaggaScript();
        }
        
        // Initialiser Quagga med optimaliserte innstillinger
        console.log("Initialiserer Quagga...");
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoElement,
                constraints: {
                    width: { min: 640 },
                    height: { min: 480 },
                    aspectRatio: { min: 1, max: 2 },
                    facingMode: "environment"
                },
                area: { 
                    top: "20%",    
                    right: "20%",
                    left: "20%",
                    bottom: "20%"
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: isIOS ? 1 : navigator.hardwareConcurrency > 4 ? 4 : 2,
            frequency: 10,
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
                multiple: false
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error("Quagga initialisering feilet:", err);
                return;
            }
            
            console.log("Quagga initialisert vellykket");
            Quagga.start();
            isScanning = true;
            
            // Sett opp event handlers
            Quagga.onDetected(handleCameraScanResult);
            
            // På iOS, bruk kun onDetected for bedre ytelse
            if (!isIOS) {
                Quagga.onProcessed(handleProcessedResult);
            }
            
            // Oppdater status
            if (scannerStatusCallback) {
                scannerStatusCallback(true, { type: 'camera' });
            }
            
            console.log("Kameraskanning er aktiv");
        });
        
        return { success: true };
    } catch (error) {
        console.error("Kamera start feilet:", error);
        if (scannerStatusCallback) {
            scannerStatusCallback(false);
        }
        throw error;
    }
}

/**
 * Stopper kameraskanning
 */
function stopCameraScanning() {
    console.log("Stopper kameraskanning...");
    
    if (!isScanning) {
        console.log("Skanning er ikke aktiv");
        return;
    }
    
    // Stopp Quagga
    if (typeof Quagga !== 'undefined') {
        try {
            Quagga.stop();
            console.log("Quagga stoppet");
        } catch (e) {
            console.error('Feil ved stopp av Quagga:', e);
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
            console.log("Kamerastrøm stoppet");
        } catch (e) {
            console.error("Feil ved stopp av kamerastrøm:", e);
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
            videoElement.style.display = 'none'; // Skjul video
        } catch (e) {
            console.error("Feil ved tilbakestilling av video-element:", e);
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
        console.error("Feil ved skjuling av container:", e);
    }
    
    isScanning = false;
    
    // Informer om statusendring
    if (scannerStatusCallback) {
        scannerStatusCallback(false);
    }
    
    console.log("Kameraskanning stoppet");
}

/**
 * Bytter mellom tilgjengelige kameraer
 */
async function switchCamera() {
    if (isScanning) {
        console.log("Bytter kamera...");
        
        // Stopp nåværende skanning
        stopCameraScanning();
        
        // Vent litt for å være sikker på at kameraet er stoppet
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // For iOS-enheter
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            console.log("iOS-enhet oppdaget, bruker direkte facingMode bytting...");
            
            // Hvis vi allerede bruker environment, bytt til user, og omvendt
            const currentFacingMode = currentCameraIndex === 0 ? "user" : "environment";
            const newFacingMode = currentFacingMode === "user" ? "environment" : "user";
            
            console.log(`Bytter fra ${currentFacingMode} til ${newFacingMode}`);
            
            // Oppdater gjeldende kameraindeks
            currentCameraIndex = currentCameraIndex === 0 ? 1 : 0;
            
            // Start skanning med spesifikk facingMode for iOS
            try {
                await startCameraScanning(null, { facingMode: { exact: newFacingMode } });
            } catch (error) {
                console.error(`Kunne ikke bytte til ${newFacingMode} kamera:`, error);
                
                // Fallback til standard kamera hvis det spesifikke kameraet ikke kunne brukes
                console.log("Prøver fallback til standard kamera...");
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
            console.log(`Bytter til kamera ${currentCameraIndex + 1}: ${availableCameras[currentCameraIndex].label || 'Ukjent kamera'}`);
            
            // Start skanning med nytt kamera
            startCameraScanning(availableCameras[currentCameraIndex].deviceId);
        } else {
            console.log("Bare ett kamera tilgjengelig, fortsetter med samme kamera");
            startCameraScanning();
        }
    } else {
        console.log("Skanning er ikke aktiv, starter kamera først");
        startCameraScanning();
    }
}

/**
 * Håndterer resultater fra kameraskanning
 * @param {Object} result - Skanningsresultat-objekt fra Quagga
 */
function handleCameraScanResult(result) {
    if (result && result.codeResult && result.codeResult.code) {
        const barcode = result.codeResult.code;
        
        // Valider at dette er en strekkode og ikke bare et tall
        if (validateBarcode(barcode)) {
            console.log("Strekkode funnet:", barcode);
            
            // Spill lyd for å indikere at strekkode er funnet
            playSuccessSound();
            
            // Marker strekkoden på canvas
            if (canvasElement && result.box) {
                const ctx = canvasElement.getContext('2d');
                drawSuccessBox(ctx, result.box);
            }
            
            // Send resultatet til sentral prosessering
            processScannedBarcode(barcode);
            
            // Stopp skanning midlertidig for å unngå gjentatte skanninger av samme kode
            // Starter igjen etter 2 sekunder
            if (typeof Quagga !== 'undefined') {
                Quagga.stop();
            }
            isScanning = false;
            
            setTimeout(() => {
                if (cameraStream && cameraStream.active) {
                    if (typeof Quagga !== 'undefined') {
                        Quagga.start();
                    }
                    isScanning = true;
                }
            }, 2000);
        } else {
            console.log("Ugyldig strekkode ignorert:", barcode);
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
        console.error("Feil ved tegning på canvas:", error);
    }
}

/**
 * Spiller en lyd for å gi tilbakemelding ved vellykket skanning
 */
function playSuccessSound() {
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
        console.error("Kunne ikke spille lyd:", error);
        
        // Fallback til å vibrere enheten hvis tilgjengelig
        try {
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        } catch (e) {
            console.log("Kunne ikke vibrere:", e);
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
        console.error("Feil ved tegning av suksess-boks:", error);
    }
}

/**
 * Laster dynamisk inn Quagga.js hvis det ikke allerede er lastet
 * @returns {Promise} Løftebasert resultat av skriptlasting
 */
function loadQuaggaScript() {
    return new Promise((resolve, reject) => {
        if (typeof Quagga !== 'undefined') {
            console.log("Quagga allerede lastet");
            resolve();
            return;
        }
        
        console.log("Laster Quagga-script dynamisk...");
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
        
        script.onload = () => {
            console.log("Quagga-script lastet");
            resolve();
        };
        
        script.onerror = (err) => {
            console.error("Kunne ikke laste Quagga-script:", err);
            reject(new Error("Kunne ikke laste Quagga-script"));
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
        
        console.log("Tilgjengelige kameraer:", videoDevices.length);
        videoDevices.forEach((device, index) => {
            console.log(`Kamera ${index + 1}: ${device.label || 'Ukjent kamera'} (ID: ${device.deviceId})`);
        });
        
        return videoDevices;
    } catch (error) {
        console.error("Feil ved enumerering av enheter:", error);
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
    
    // Sjekk om strekkoden er i vår kjente strekkodeoversikt
    if (appState.barcodeMapping && barcode in appState.barcodeMapping) {
        return true;
    }
    
    // Sjekk for kjente strekkodeformater
    const isEAN13 = /^\d{13}$/.test(barcode);
    const isEAN8 = /^\d{8}$/.test(barcode);
    const isUPCA = /^\d{12}$/.test(barcode);
    const isCode128 = /^[A-Z0-9\-\.$/+%]{6,}$/.test(barcode);
    
    // Sjekk for interne produktkoder
    const isInternalCode = /^\d{3}-[A-Z][A-Z0-9]+-?[A-Z0-9]*$/.test(barcode) || // 000-XX-000 format
                          /^[A-Z]{2}\d{5}$/.test(barcode) ||                    // XX00000 format
                          /^BP\d{5}$/.test(barcode) ||                          // BP00000 format
                          /^[A-Z][A-Z0-9]{4,}$/.test(barcode);                 // Andre alfanumeriske koder
    
    // Validér EAN-13 sjekksiffer hvis strekkoden er i det formatet
    if (isEAN13) {
        try {
            // EAN-13 sjekksum validering
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
            }
            const checkDigit = (10 - (sum % 10)) % 10;
            return parseInt(barcode[12]) === checkDigit;
        } catch (e) {
            console.error("Feil ved validering av EAN-13 strekkode:", e);
            return false;
        }
    }
    
    // Hvis strekkoden har et kjent format, anta at den er gyldig
    return isEAN8 || isUPCA || isCode128 || isInternalCode;
}

/**
 * Sentralisert funksjon for håndtering av skannede strekkoder
 * @param {string} barcode - Skannede strekkode
 */
function processScannedBarcode(barcode) {
    // Sjekk hvilken modul som er aktiv
    if (!appState.currentModule) {
        showToast('Ingen aktiv modul. Velg plukk, mottak eller retur først.', 'warning');
        return;
    }
    
    // Valider og håndter strekkoden basert på aktiv modul
    if (appState.currentModule === 'picking') {
        handleScan(barcode, 'pick');
    } else if (appState.currentModule === 'receiving') {
        handleScan(barcode, 'receive');
    } else if (appState.currentModule === 'returns') {
        handleScan(barcode, 'return');
    }
}

/**
 * Håndterer skanning for alle moduler med forbedret strekkodevalidering
 * @param {string} barcode - Skannet strekkode
 * @param {string} type - Type modul (pick, receive, return)
 */
function handleScan(barcode, type) {
    if (!barcode) return;
    
    // Valider strekkoden før videre prosessering
    if (!validateBarcode(barcode)) {
        console.log(`Ugyldig strekkode ignorert: ${barcode}`);
        showToast(`Ukjent strekkodeformat: ${barcode}`, 'warning');
        return;
    }
    
    console.log(`Håndterer strekkode i ${type}-modulen: ${barcode}`);
    
    // Tøm input etter skanning
    const manualScanInput = document.getElementById(`${type}ManualScan`);
    if (manualScanInput) {
        manualScanInput.value = '';
    }
    
    // Sjekk om strekkoden finnes i barcode mapping
    let itemId = barcode;
    if (appState.barcodeMapping[barcode]) {
        itemId = appState.barcodeMapping[barcode];
        console.log(`Strekkode ${barcode} mappet til varenummer ${itemId}`);
    }
    
    // Send til korrekt håndtering basert på type
    if (type === 'pick') {
        handlePickScan(itemId);
    } else if (type === 'receive') {
        handleReceiveScan(itemId);
    } else if (type === 'return') {
        // For retur, bruk standard antall 1 hvis ikke annet er spesifisert
        const quantityEl = document.getElementById('returnQuantity');
        const quantity = quantityEl ? parseInt(quantityEl.value) || 1 : 1;
        handleReturnScan(itemId, quantity);
    }
    
    // Spill lyd for å gi tilbakemelding om vellykket skanning
    playSuccessSound();
}

// Eksporter funksjoner
export {
    connectToBluetoothScanner,
    initCameraScanner,
    startCameraScanning,
    stopCameraScanning,
    switchCamera,
    isBluetoothConnected,
    isScanning,
    processScannedBarcode
};