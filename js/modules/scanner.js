// scanner.js - Forbedret versjon med synlige feilmeldinger for brukeren

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let cameraStream = null;
let isScanning = false;
let currentCameraIndex = 0;
let availableCameras = [];

import { appState } from '../app.js';
import { showToast } from './utils.js';

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
        showToast('Bluetooth støttes ikke i denne nettleseren. Vennligst bruk Chrome eller Edge.', 'error');
        throw new Error('Bluetooth støttes ikke i denne nettleseren.');
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
            showToast(`Kunne ikke koble til skanner-tjeneste: ${error.message}`, 'error');
            isBluetoothConnected = false;
            throw new Error('Kunne ikke koble til skanner-tjeneste. Sjekk at skanneren er på og støtter Bluetooth LE.');
        }
        
    } catch (error) {
        showToast(`Bluetooth-tilkobling feilet: ${error.message}`, 'error');
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
    
    showToast('Bluetooth-skanner frakoblet', 'warning');
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
    }).catch(error => {
        showToast(`Kunne ikke sjekke tilgjengelige kameraer: ${error.message}`, 'warning');
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
    showToast('Starter kamera...', 'info');
    
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
            } catch (e) {
                showToast(`Advarsel: ${e.message}`, 'warning');
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
        
        // Start kameraet
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            cameraStream = stream;
            
            // Logg kamerainformasjon
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                showToast(`Kamera aktivert: ${videoTrack.label || 'Ukjent kamera'}`, 'success');
            }
            
            // Tilkoble video til strøm
            videoElement.srcObject = stream;
            
            // Forsøk å starte avspillingen manuelt
            try {
                await videoElement.play();
            } catch (e) {
                showToast(`Kunne ikke starte video: ${e.message}. Prøv å klikke på skjermen.`, 'warning');
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
                showToast('Laster strekkodeleser...', 'info');
                await loadQuaggaScript();
            }
            
            // Erstatt den nåværende Quagga.init-koden med denne
            Quagga.init({
                inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector("#" + videoId), // Bruk querySelector i stedet for direkte referanse
                constraints: {
                    width: 640,
                    height: 480
                }
                },
                locator: {
                patchSize: "medium",
                halfSample: true
                },
                numOfWorkers: 2,
                decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader"]
                },
                locate: true
            }, function(err) {
                if (err) {
                console.error("Quagga init error:", err);
                showToast("Kunne ikke starte strekkodeleser", "error");
                return;
                }
                
                try {
                Quagga.start();
                isScanning = true;
                Quagga.onDetected(handleCameraScanResult);
                } catch (error) {
                console.error("Quagga start error:", error);
                showToast("Feil ved oppstart av strekkodeleser", "error");
                }
            });
            
            return { success: true };
        } catch (error) {
            // Vis detaljert feilmelding til brukeren
            const errorMsg = `Kunne ikke starte kamera: ${error.name || 'Ukjent feil'}`;
            const detailMsg = error.message || '';
            
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
            
            console.error("Kamera start feilet:", error);
            
            if (scannerStatusCallback) {
                scannerStatusCallback(false);
            }
            throw error;
        }
    } catch (error) {
        showToast(`Kamera kunne ikke startes: ${error.message}`, 'error');
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
    if (result && result.codeResult && result.codeResult.code) {
        const barcode = result.codeResult.code;
        
        // Valider at dette er en strekkode og ikke bare et tall
        if (validateBarcode(barcode)) {
            // Spill lyd for å indikere at strekkode er funnet
            playSuccessSound();
            
            // Marker strekkoden på canvas
            if (canvasElement && result.box) {
                const ctx = canvasElement.getContext('2d');
                drawSuccessBox(ctx, result.box);
            }
            
            // Vis strekkoden til brukeren
            showToast(`Strekkode skannet: ${barcode}`, 'success');
            
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
 * Laster dynamisk inn Quagga.js hvis det ikke allerede er lastet
 * @returns {Promise} Løftebasert resultat av skriptlasting
 */
function loadQuaggaScript() {
    return new Promise((resolve, reject) => {
        if (typeof Quagga !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
        
        script.onload = () => {
            resolve();
        };
        
        script.onerror = (err) => {
            showToast('Kunne ikke laste strekkodebibliotek. Sjekk internettforbindelsen.', 'error');
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
            showToast(`Skannet strekkode (${barcode}) har ugyldig format.`, 'warning');
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
 * Håndterer skanning for alle moduler
 * @param {string} barcode - Skannet strekkode
 * @param {string} type - Type modul (pick, receive, return)
 */
function handleScan(barcode, type) {
    if (!barcode) return;
    
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
    }
    
    // Bruk den callback-funksjonen som ble registrert ved initialisering
    if (typeof onScanCallback === 'function') {
        // For return, send med antall
        if (type === 'return') {
            const quantityEl = document.getElementById('returnQuantity');
            const quantity = quantityEl ? parseInt(quantityEl.value) || 1 : 1;
            onScanCallback(itemId, quantity);
        } else {
            onScanCallback(itemId);
        }
    } else {
        showToast('Ingen skanner-callback funksjon registrert', 'error');
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
    connectToBluetoothScanner,
    initCameraScanner,
    startCameraScanning,
    stopCameraScanning,
    switchCamera,
    isBluetoothConnected,
    isScanning,
    processScannedBarcode
};