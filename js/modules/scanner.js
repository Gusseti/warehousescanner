// scanner.js - Håndterer skanning via Bluetooth og kamera

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let cameraStream = null;
let isScanning = false;
let scannerIsPaused = false; // Nå definert
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
    // Implementering uendret
    // (Bluetooth-funksjonalitet beholdes som den er)
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
    
    if (barcode && onScanCallback) {
        onScanCallback(barcode);
    }
}

// ========== KAMERA SKANNER FUNKSJONALITET ==========

/**
 * Logger kamera-informasjon for debugging
 * @param {MediaStream} stream - Kamerastrøm
 */
function logCameraInfo(stream) {
    console.log("======= KAMERAINFORMASJON =======");
    console.log("Kamerastrøm aktiv:", stream.active);
    console.log("Video-spor:", stream.getVideoTracks().length);
    
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
        console.log("Spor-status:", videoTrack.enabled ? "Aktivert" : "Deaktivert");
        console.log("Spor-ID:", videoTrack.id);
        console.log("Sporets begrensninger:", videoTrack.getConstraints());
        console.log("Sporets innstillinger:", videoTrack.getSettings());
        
        // Vis alle track-capabilities
        try {
            console.log("Sporets capabilities:", videoTrack.getCapabilities());
        } catch (e) {
            console.log("Kunne ikke hente capabilities:", e);
        }
    }
    console.log("================================");
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
 * Sjekker om kamera er tilgjengelig og har tillatelse
 */
async function checkCameraPermission() {
    try {
        // Forsøk å få en enkel kamerastrøm for å sjekke tillatelse
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
        });
        
        // Stopp strømmen med en gang - vi gjør dette bare for å sjekke tillatelse
        stream.getTracks().forEach(track => track.stop());
        
        return true;
    } catch (error) {
        console.error("Kameratillatelse avslått eller ikke tilgjengelig:", error);
        return false;
    }
}

// Rengjør og tilbakestiller kamera-ressurser
function cleanupCamera() {
  // Stopp eventuelle aktive kamerastrømmer
  if (cameraStream) {
    try {
      cameraStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
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
    } catch (e) {
      console.error("Feil ved tilbakestilling av video-element:", e);
    }
  }
 
  // Stopp Quagga hvis det kjører
  if (typeof Quagga !== 'undefined' && isScanning) {
    try {
      Quagga.stop();
    } catch (e) {
      console.error("Feil ved stopp av Quagga:", e);
    }
  }
 
  isScanning = false;
}

/**
 * Initialiserer kamera-debugging
 */
async function initCameraWithDebug() {
    console.log("Starter kamera-initialisering med debugging...");
    
    // Sjekk om kamera-API er tilgjengelig
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia API ikke støttet av denne nettleseren");
        return false;
    }
    
    // Sjekk kameratillatelser
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
        console.error("Kameratillatelse mangler");
        return false;
    }
    
    // List opp tilgjengelige kameraer
    const cameras = await checkAvailableCameras();
    if (cameras.length === 0) {
        console.warn("Ingen kameraer funnet!");
    }
    
    return true;
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

// scanner.js - Forbedret initCameraScanner funksjon

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
    
    // Viktig: Lagre callbacks
    console.log("Registrerer skann-callback:", typeof callback);
    onScanCallback = callback;
    scannerStatusCallback = statusCallback;
    
    // List opp tilgjengelige kameraer
    checkAvailableCameras().then(cameras => {
        availableCameras = cameras;
        console.log(`Fant ${cameras.length} kameraer`);
    });
    
    // Sett opp event listeners for bytt-kamera-knapper hvis de finnes
    const switchCameraButtons = document.querySelectorAll('.scanner-switch-btn');
    switchCameraButtons.forEach(button => {
        button.addEventListener('click', switchCamera);
    });
    
    // Sikre at vi starter i riktig tilstand
    scannerIsPaused = false;
}

/**
 * Starter kameraskanning
 * @param {string} cameraId - ID til kamera som skal brukes (valgfritt)
 * @param {Object} options - Ekstra alternativer for kameraoppsett
 * @returns {Promise} Løftebasert resultat av oppstartforsøket
 */
async function startCameraScanning(cameraId = null, options = {}) {
    console.log("Starter kameraskanning med minimalt oppsett...");
    
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
        
        // Finn elementer direkte uten å bruke closest()
        const containerId = `cameraScanner${modulePrefix}Container`;
        const videoId = `video${modulePrefix}Scanner`;
        const canvasId = `canvas${modulePrefix}Scanner`;
        
        const container = document.getElementById(containerId);
        videoElement = document.getElementById(videoId);
        canvasElement = document.getElementById(canvasId);
        
        console.log("Elementer funnet:", { 
            container: container ? true : false, 
            videoElement: videoElement ? true : false, 
            canvasElement: canvasElement ? true : false 
        });
        
        // Vis feilmelding og avbryt hvis elementer mangler
        if (!container || !videoElement || !canvasElement) {
            console.error("Kritiske elementer mangler:", { 
                containerId, 
                videoId, 
                canvasId,
                modulePrefix, 
                currentModule: appState ? appState.currentModule : 'unknown' 
            });
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
        
        // Sett direkte stiler på video-elementet
        videoElement.style.cssText = `
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
            position: absolute !important; 
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 1 !important;
            background-color: #000 !important;
            object-fit: cover !important;
        `;
        
        // Sett nødvendige attributter
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('playsinline', '');
        videoElement.muted = true;
        
        // Sjekk for iOS-enhet
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            console.log("iOS-enhet oppdaget, bruker spesielle innstillinger");
            videoElement.setAttribute('webkit-playsinline', ''); // For eldre iOS
        }
        
        // Konfigurer kamerainnstillinger med hensyn til iOS
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
        
        // Start kameraet
        console.log("Ber om kameratilgang med constraints:", JSON.stringify(constraints));
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraStream = stream;
        
        // Logg kamerainformasjon
        logCameraInfo(stream);
        
        // Tilkoble video til strøm
        videoElement.srcObject = stream;
        
        // Forsøk å starte avspillingen manuelt
        try {
            await videoElement.play();
            console.log("Video avspilling startet");
        } catch (e) {
            console.warn("Kunne ikke starte video manuelt:", e);
        }
        
        // Spesifikk håndtering for iOS-enheter
        let keepAliveInterval;
        if (isIOS) {
            // Periodisk sjekk for å sikre at video fortsatt spiller på iOS
            keepAliveInterval = setInterval(function() {
                if (videoElement && videoElement.paused && cameraStream && cameraStream.active) {
                    console.log("iOS video pauset - prøver å starte på nytt");
                    videoElement.play().catch(e => console.log("Kunne ikke starte video igjen:", e));
                }
            }, 1000);
            
            // Håndter orientering for iOS
            window.addEventListener('orientationchange', function() {
                // Gi litt tid til at orienteringsendringen skal fullføres
                setTimeout(function() {
                    if (videoElement && videoElement.style) {
                        // Trigger reflow
                        videoElement.style.display = 'none';
                        // Force reflow
                        void videoElement.offsetHeight;
                        videoElement.style.display = 'block';
                    }
                }, 500);
            });
        }
        
        // Sett opp canvas
        canvasElement.width = 640;
        canvasElement.height = 480;
        canvasElement.style.position = 'absolute';
        canvasElement.style.top = '0';
        canvasElement.style.left = '0';
        canvasElement.style.width = '100%';
        canvasElement.style.height = '100%';
        canvasElement.style.zIndex = '2';
        canvasElement.style.backgroundColor = 'transparent';
        
        // Last Quagga hvis nødvendig
        if (typeof Quagga === 'undefined') {
            console.log("Laster Quagga...");
            await loadQuaggaScript();
        }
        
        // Initialiser Quagga
        console.log("Initialiserer Quagga...");
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoElement,
                constraints: { width: 640, height: 480 },
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
            numOfWorkers: isIOS ? 1 : 2, // Reduser workers på iOS for bedre ytelse
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader"]
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error("Quagga initialisering feilet:", err);
                // Rydd opp
                if (keepAliveInterval) clearInterval(keepAliveInterval);
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
 * Validerer at en strekkode er gyldig og ikke bare et tilfeldig tall
 * @param {string} barcode - Strekkode som skal valideres
 * @returns {boolean} Om strekkoden er gyldig
 */
function validateBarcode(barcode) {
    // Fjern eventuelle blanke tegn
    barcode = barcode.trim();
    
    // Sjekk lengden - de fleste strekkoder er minst 8 tegn
    if (barcode.length < 8) {
        return false;
    }
    
    // Sjekk om strekkoden inneholder bare tall
    // EAN-13, UPC og de fleste vanlige strekkodeformater er numeriske
    const isNumeric = /^\d+$/.test(barcode);
    
    // For numeriske strekkoder, sjekk vanlige formater
    if (isNumeric) {
        // Kjente strekkodeformater
        if (barcode.length === 8) return true;  // EAN-8
        if (barcode.length === 12) return true; // UPC-A
        if (barcode.length === 13) return true; // EAN-13
        if (barcode.length === 14) return true; // GTIN-14
        
        // Hvis det er et annet antall siffer, sjekk sjekksiffer for EAN-13
        // Dette er en enkel validering som ikke garanterer at det er en strekkode,
        // men gjør det mindre sannsynlig at tilfeldige tall blir tolket som strekkoder
        if (barcode.length === 13) {
            try {
                // EAN-13 sjekksum validering
                let sum = 0;
                for (let i = 0; i < 12; i++) {
                    sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
                }
                const checkDigit = (10 - (sum % 10)) % 10;
                return parseInt(barcode[12]) === checkDigit;
            } catch (e) {
                console.error("Feil ved validering av strekkode:", e);
                return false;
            }
        }
    }
    
    // For alfanumeriske strekkoder (Code 39, Code 128, etc.)
    // Sjekk etter mønstre som er typiske for disse formatene
    if (/^[A-Z0-9\-\.$/+%]+$/.test(barcode)) {
        return true;
    }
    
    // Sjekk om strekkoden matcher formatet til dine egne strekkoder
    // For eksempel: hvis dine interne strekkoder starter med et bestemt prefix
    if (appState && appState.barcodeMapping && barcode in appState.barcodeMapping) {
        return true;
    }
    
    // Sjekk om strekkoden matcher formatet for noen kjente varer
    // For eksempel: hvis varenumrene har et bestemt format
    if (/^\d{3}-[A-Z0-9]+-?[A-Z0-9]*$/.test(barcode)) {
        return true;
    }
    
    // Hvis strekkoden ikke passerer noen av disse testene, anta at det er en feil skanning
    return false;
}

/**
 * Spiller en lyd for å indikere vellykket skanning
 */
function playBeepSound() {
    try {
        // Kort beep-lyd generert med oscillator
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1000;
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, 200);
    } catch (error) {
        console.error("Kunne ikke spille lyd:", error);
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
 * Viser "skannet" animasjon over kameravisningen
 */
function showScanSuccessAnimation() {
    // Sjekk om vi har overlay-elementet
    if (!scannerOverlay) return;
    
    // Legg til suksess-indikator
    const successIndicator = document.createElement('div');
    successIndicator.className = 'scan-success-indicator';
    successIndicator.innerHTML = '<i class="fas fa-check"></i>';
    successIndicator.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(76, 175, 80, 0.8);
        color: white;
        font-size: 2rem;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        animation: pulse-success 1s ease-out;
    `;
    
    // Legg til i overlay
    scannerOverlay.appendChild(successIndicator);
    
    // Fjern indikatoren etter animasjonen
    setTimeout(() => {
        if (successIndicator.parentNode) {
            successIndicator.parentNode.removeChild(successIndicator);
        }
    }, 1000);
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
            playBeepSound();
            
            // Marker strekkoden på canvas
            if (canvasElement && result.box) {
                const ctx = canvasElement.getContext('2d');
                drawSuccessBox(ctx, result.box);
            }
            
            // Send resultatet til callback
            if (onScanCallback) {
                onScanCallback(barcode);
            }
            
            // Vis suksessanimering - fjerner den automatisk etter 1.5 sekunder
            if (scannerOverlay) {
                const successIndicator = document.createElement('div');
                successIndicator.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: rgba(76, 175, 80, 0.8);
                    color: white;
                    font-size: 2rem;
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                `;
                successIndicator.innerHTML = '<i class="fas fa-check"></i>';
                scannerOverlay.appendChild(successIndicator);
                
                // Fjern indikatoren etter kort tid
                setTimeout(() => {
                    if (successIndicator.parentNode) {
                        successIndicator.parentNode.removeChild(successIndicator);
                    }
                }, 1500);
            }
            
            // Stopp Quagga i 1.5 sekunder, så starter den igjen
            if (typeof Quagga !== 'undefined') {
                Quagga.stop();
                
                setTimeout(() => {
                    if (cameraStream && cameraStream.active) {
                        Quagga.start();
                        console.log("Skanner restartet etter pause");
                    }
                }, 1500);
            }
        } else {
            console.log("Ugyldig strekkode ignorert:", barcode);
        }
    }
}

// Eksporter funksjoner
export {
    connectToBluetoothScanner,
    initCameraScanner,
    startCameraScanning,
    stopCameraScanning,
    switchCamera,
    isBluetoothConnected,
    isScanning
};