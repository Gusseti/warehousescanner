// scanner.js - Håndterer skanning via Bluetooth og kamera

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let cameraStream = null;
let isScanning = false;
let currentCameraIndex = 0;
let availableCameras = [];

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
        cleanupCamera();
        stopCameraScanning();
        
        // Vent litt for å være sikker på at kameraet er stoppet
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hvis vi ikke har en liste over kameraer ennå, hent den
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
    
    // Sett opp event listeners for bytt-kamera-knapper hvis de finnes
    const switchCameraButtons = document.querySelectorAll('.scanner-switch-btn');
    switchCameraButtons.forEach(button => {
        button.addEventListener('click', switchCamera);
    });
}

/**
 * Starter kameraskanning
 * @param {string} cameraId - ID til kamera som skal brukes (valgfritt)
 * @returns {Promise} Løftebasert resultat av oppstartforsøket
 */
async function startCameraScanning(cameraId = null) {
    // Hvis allerede aktiv, stopp først
    if (isScanning) {
        stopCameraScanning();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("Starter kameraskanning...");
    
    try {
        // Rengjør først
        cleanupCamera();
        
        const initialized = await initCameraWithDebug();
        if (!initialized) {
            throw new Error("Kamera-API ikke tilgjengelig eller tillatelse mangler");
        }
        
        // Konfigurer kamerainnstillinger
        const constraints = { 
            video: true,  // Forenklet constraint for bedre kompatibilitet
            audio: false
        };
        
        console.log("Ber om tilgang til kamera med følgende constraints:", constraints);
        
        // Be om tilgang til kamera
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraStream = stream;
        
        // Logg informasjon om kamerastrømmen
        logCameraInfo(stream);
        
        // Forbered video-element
        if (!videoElement) {
            throw new Error("Video-element mangler");
        }
        
        // Vis kameracontainere
        const container = videoElement.closest('.camera-wrapper');
        if (container) {
            container.style.display = 'block';
        }
        
        const scannerContainer = container.closest('.camera-scanner-container');
        if (scannerContainer) {
            scannerContainer.style.display = 'block';
        }
        
        // Stopp eventuelle eksisterende videostrømmer
        if (videoElement.srcObject) {
            try {
                let oldStream = videoElement.srcObject;
                oldStream.getTracks().forEach(track => track.stop());
            } catch (e) {}
            videoElement.srcObject = null;
        }
        
        // VIKTIG: Sett stil FØR vi tilordner srcObject
        videoElement.style.display = 'block !important';
        videoElement.style.opacity = '1 !important';
        videoElement.style.visibility = 'visible !important';
        videoElement.style.zIndex = '1';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.style.backgroundColor = '#000';

        setTimeout(() => {
            videoElement.style.display = 'none';
            setTimeout(() => {
                videoElement.style.display = 'block';
            }, 10);
        }, 100);
        
        // Fjern alle tidligere hendelseshåndterere
        videoElement.onloadedmetadata = null;
        videoElement.onloadeddata = null;
        videoElement.oncanplay = null;
        videoElement.onerror = null;
        
        // Muted er nødvendig for autoplay
        videoElement.muted = true;
        videoElement.setAttribute('playsinline', '');
        videoElement.setAttribute('autoplay', '');
        
        // Koble til video-strømmen
        videoElement.srcObject = stream;
        
        // Vis scanner-overlay
        if (scannerOverlay) {
            scannerOverlay.style.display = 'flex';
        }
        
        // DIREKTE AVSPILLING: Prøv å spille av umiddelbart
        try {
            await videoElement.play();
            console.log("Video starter avspilling manuelt");
        } catch (e) {
            console.warn("Kunne ikke starte video manuelt:", e);
            // Vi fortsetter likevel
        }
        
        // Sett opp canvas
        if (canvasElement) {
            // Sett stil
            canvasElement.style.display = 'block';
            canvasElement.style.position = 'absolute';
            canvasElement.style.top = '0';
            canvasElement.style.left = '0';
            canvasElement.style.width = '100%';
            canvasElement.style.height = '100%';
            canvasElement.style.zIndex = '2';
            canvasElement.style.backgroundColor = 'transparent';
            
            // Sett opp canvas context med willReadFrequently
            const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
            
            // Sett canvas-størrelse - bruk standardverdier først
            canvasElement.width = 640;
            canvasElement.height = 480;
        }
        
        // Last Quagga hvis nødvendig
        if (typeof Quagga === 'undefined') {
            console.log("Laster Quagga dynamisk...");
            try {
                await loadQuaggaScript();
            } catch (e) {
                console.error("Kunne ikke laste Quagga:", e);
                throw new Error("Quagga kunne ikke lastes");
            }
        }
        
        // Konfigurer og start Quagga
        console.log("Starter Quagga med forenklet oppsett...");
        
        // Bruk en alternativ tilnærming for å starte Quagga
        // som ikke er avhengig av at video er fullstendig lastet
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: videoElement,   // Pass videoelementet direkte
                constraints: {          // Bruk minimale begrensninger
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                },
                area: {                 // Bruk et litt større område for skanning
                    top: "10%",    
                    right: "10%",
                    left: "10%",
                    bottom: "10%"
                },
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10,
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_93_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "codabar_reader",
                    "i2of5_reader"
                ],
                multiple: false
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error('Quagga initialisering feilet:', err);
                return;
            }
            
            console.log("Quagga initialisert vellykket!");
            
            // Start Quagga
            Quagga.start();
            isScanning = true;
            
            // Legg til event listener for resultater
            Quagga.onDetected(handleCameraScanResult);
            
            // Tegn deteksjonsresultater på canvas
            Quagga.onProcessed(handleProcessedResult);
            
            // Oppdater canvas-størrelse etter at Quagga er startet
            if (canvasElement && videoElement.videoWidth && videoElement.videoHeight) {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                console.log(`Canvas-størrelse oppdatert til ${canvasElement.width}x${canvasElement.height}`);
            }
            
            // Informer om statusendring
            if (scannerStatusCallback) {
                scannerStatusCallback(true, { type: 'camera' });
            }
            
            console.log("Kameraskanning er nå aktiv!");
        });
        
        return { success: true };
    } catch (error) {
        console.error('Kamera-tilkobling feilet:', error);
        
        // Gi tilbakemelding om feilen
        if (scannerStatusCallback) {
            scannerStatusCallback(false);
        }
        
        // Clean up ved feil
        cleanupCamera();
        
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
    
    // Rydd opp kameraressurser
    cleanupCamera();
    
    // Skjul video og overlay
    if (videoElement) {
        videoElement.style.display = 'none';
    }
    
    if (canvasElement) {
        canvasElement.style.display = 'none';
    }
    
    if (scannerOverlay) {
        scannerOverlay.style.display = 'none';
    }
    
    isScanning = false;
    
    // Informer om statusendring
    if (scannerStatusCallback) {
        scannerStatusCallback(false);
    }
    
    console.log("Kameraskanning stoppet");
}

/**
 * Håndterer resultater fra kameraskanning
 * @param {Object} result - Skanningsresultat-objekt fra Quagga
 */
function handleCameraScanResult(result) {
    if (result && result.codeResult && result.codeResult.code) {
        const barcode = result.codeResult.code;
        
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