// scanner.js - Håndterer skanning via Bluetooth og kamera

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let cameraStream = null;
let isScanning = false;

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
    
    if (barcode && onScanCallback) {
        onScanCallback(barcode);
    }
}

// ========== KAMERA SKANNER FUNKSJONALITET ==========

/**
 * Initialiserer kameraskanning
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
    
    // Importer Quagga.js hvis det ikke er lastet inn
    if (typeof Quagga === 'undefined') {
        loadQuaggaScript()
            .then(() => {
                console.log('Quagga.js lastet inn');
            })
            .catch(error => {
                console.error('Kunne ikke laste inn Quagga.js:', error);
                throw new Error('Kunne ikke laste inn strekkodebibliotek. Sjekk nettverkstilkoblingen.');
            });
    }
}

/**
 * Laster inn Quagga.js-biblioteket dynamisk
 * @returns {Promise} Løftebasert resultat av skriptlasting
 */
function loadQuaggaScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Starter kameraskanning
 * @returns {Promise} Løftebasert resultat av oppstartforsøket
 */
async function startCameraScanning() {
    if (isScanning) return;
    
    try {
        // Be om tilgang til kamera
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        cameraStream = stream;
        
        // Vis video-stream
        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.style.display = 'block';
            
            if (scannerOverlay) {
                scannerOverlay.style.display = 'block';
            }
        }
        
        // Vent på at video er lastet
        await new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
        
        // Initialiser Quagga
        if (typeof Quagga !== 'undefined') {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: videoElement,
                    constraints: {
                        width: 1280,
                        height: 720,
                        facingMode: "environment"
                    }
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true
                },
                numOfWorkers: navigator.hardwareConcurrency || 4,
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
                    ]
                },
                locate: true
            }, function(err) {
                if (err) {
                    console.error('Quagga initialisering feilet:', err);
                    stopCameraScanning();
                    throw new Error('Kunne ikke starte kameraskanning. Prøv igjen.');
                }
                
                // Start Quagga
                Quagga.start();
                isScanning = true;
                
                // Legg til event listener for resultater
                Quagga.onDetected(handleCameraScanResult);
                
                // Tegn deteksjonsresultater på canvas
                Quagga.onProcessed(handleProcessedResult);
                
                // Informer om statusendring
                if (scannerStatusCallback) {
                    scannerStatusCallback(true, { type: 'camera' });
                }
            });
        } else {
            throw new Error('Strekkodebibliotek ikke lastet. Prøv å laste siden på nytt.');
        }
        
        return { success: true };
    } catch (error) {
        console.error('Kamera-tilkobling feilet:', error);
        throw new Error('Kunne ikke få tilgang til kamera. Sjekk kameratillatelser i nettleseren.');
    }
}

/**
 * Stopper kameraskanning
 */
function stopCameraScanning() {
    if (!isScanning) return;
    
    // Stopp Quagga
    if (typeof Quagga !== 'undefined') {
        Quagga.stop();
    }
    
    // Stopp kamerastrøm
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    // Skjul video og overlay
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.style.display = 'none';
    }
    
    if (scannerOverlay) {
        scannerOverlay.style.display = 'none';
    }
    
    isScanning = false;
    
    // Informer om statusendring
    if (scannerStatusCallback) {
        scannerStatusCallback(false);
    }
}

/**
 * Håndterer resultater fra kameraskanning
 * @param {Object} result - Skanningsresultat-objekt fra Quagga
 */
function handleCameraScanResult(result) {
    if (result && result.codeResult && result.codeResult.code) {
        const barcode = result.codeResult.code;
        
        // Spill lyd for å indikere at strekkode er funnet
        playBeepSound();
        
        // Send resultatet til callback
        if (onScanCallback) {
            onScanCallback(barcode);
        }
        
        // Stopp skanning midlertidig for å unngå gjentatte skanninger av samme kode
        // Starter igjen etter 2 sekunder
        Quagga.stop();
        setTimeout(() => {
            if (isScanning) {
                Quagga.start();
            }
        }, 2000);
    }
}

/**
 * Spiller en lyd for å indikere vellykket skanning
 */
function playBeepSound() {
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
}

/**
 * Håndterer prosesserte bilder fra Quagga
 * @param {Object} result - Prosesseringsresultat fra Quagga
 */
function handleProcessedResult(result) {
    if (!canvasElement || !result) return;
    
    const ctx = canvasElement.getContext('2d');
    
    // Tøm canvas
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Tegn deteksjonsområde hvis funnet
    if (result.boxes) {
        result.boxes.filter(box => box !== result.box).forEach(box => {
            ctx.strokeStyle = 'green';
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
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(result.box[0][0], result.box[0][1]);
        result.box.forEach((p, i) => {
            if (i !== 0) ctx.lineTo(p[0], p[1]);
        });
        ctx.lineTo(result.box[0][0], result.box[0][1]);
        ctx.stroke();
    }
}

// Eksporter funksjoner
export {
    connectToBluetoothScanner,
    initCameraScanner,
    startCameraScanning,
    stopCameraScanning,
    isBluetoothConnected,
    isScanning
};