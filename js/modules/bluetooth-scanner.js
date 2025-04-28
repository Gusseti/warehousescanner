/**
 * bluetooth-scanner.js
 * Forbedret modul for håndtering av Bluetooth-strekkodeskanner tilkoblinger
 * Støtter ulike Bluetooth-skannermodeller, med ekstra støtte for problematiske enheter
 */

let device = null;
let server = null;
let services = [];
let currentService = null;
let currentCharacteristic = null;
let isConnectedState = false;  // Endret fra isConnected til isConnectedState
let connectionType = 'BLE'; // Default til BLE
let dataCallback = null;
let connectionCallback = null;
let disconnectionCallback = null;
let errorCallback = null;
let logCallback = null;
let statusCallback = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimer = null;
let systemPairedDevice = false; // Ny flag for å indikere om enheten er paret via systeminnstillinger

// Standard tjeneste UUIDs organisert etter tilkoblingstype
const serviceUUIDs = {
    BLE: [
        // Primære BLE-tjenester
        "49535343-fe7d-4ae5-8fa9-9fafd205e455", // R8 Primær Tjeneste
        "49535343-8841-43f4-a8d4-ecbe34729bb3", // R8 Sekundær
        "0000ffe0-0000-1000-8000-00805f9b34fb", // Vanlig BLE-tjeneste
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
        "0000fff0-0000-1000-8000-00805f9b34fb", // Annen vanlig tjeneste
        // Tilleggstjenester som ofte finnes i strekkodeskannere
        "0000180a-0000-1000-8000-00805f9b34fb", // Device Information Service
        "0000180f-0000-1000-8000-00805f9b34fb", // Battery Service
        "00001800-0000-1000-8000-00805f9b34fb", // Generic Access Service
        "00001801-0000-1000-8000-00805f9b34fb", // Generic Attribute Service
        "03b80e5a-ede8-4b33-a751-6ce34ec4c700", // Alternativ skannertjeneste
        "7377772e-8a04-0000-0000-000034383734", // Annen skannertjeneste
        "0000fef5-0000-1000-8000-00805f9b34fb"  // OTA Service
    ],
    SPP: [
        // SPP (Serial Port Profile) - vanlig for Bluetooth Classic skannere
        "00001101-0000-1000-8000-00805f9b34fb"
    ],
    HID: [
        // HID (Human Interface Device) - for skannere som fungerer som tastatur
        "00001812-0000-1000-8000-00805f9b34fb",
        "00001124-0000-1000-8000-00805f9b34fb"
    ]
};

// Kjente karakteristikk-UUIDs som brukes av forskjellige skannere
const characteristicUUIDs = {
    BLE: [
        // Notifikasjonskarakteristikker
        "49535343-8841-43f4-a8d4-ecbe34729bb3", // R8 Notifikasjon
        "6e400003-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART RX (mottak)
        "0000ffe1-0000-1000-8000-00805f9b34fb", // Vanlig BLE karakteristikk
        "00002a00-0000-1000-8000-00805f9b34fb", // Device Name
        "00002a05-0000-1000-8000-00805f9b34fb", // Service Changed
        // Spesifikke modell-karakteristikker
        "0000fff1-0000-1000-8000-00805f9b34fb", // Kinesisk skanner notifikasjon
        "0000fff4-0000-1000-8000-00805f9b34fb", // Alternativ notifikasjon
        "00002ba5-0000-1000-8000-00805f9b34fb"  // Ytterligere notifikasjon
    ],
    // Kommandokarakteristikker
    COMMAND: [
        "49535343-1e4d-4bd9-ba61-23c647249616", // R8 Kommando
        "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART TX (sending)
        "0000ffe2-0000-1000-8000-00805f9b34fb", // Vanlig kommandokarakteristikk
        "0000fff2-0000-1000-8000-00805f9b34fb", // Kinesisk skanner kommando
        "0000fff3-0000-1000-8000-00805f9b34fb"  // Alternativ kommandokarakteristikk
    ]
};

/**
 * Sett callback-funktioner for ulike skannerhendelser
 * @param {Function} onData - Kalles når skanneren mottar data
 * @param {Function} onConnect - Kalles når skanneren kobles til
 * @param {Function} onDisconnect - Kalles når skanneren kobles fra
 */
export function setCallbacks(onData, onConnect, onDisconnect, onError) {
    dataCallback = onData;
    connectionCallback = onConnect;
    disconnectionCallback = onDisconnect;
    errorCallback = onError;
    
    console.log("Bluetooth-skanner callbacks registrert");
}

/**
 * Sett callback for statusoppdateringer
 * @param {Function} callback - Kalles ved statusendringer
 */
export function setBluetoothStatusCallback(callback) {
    statusCallback = callback;
    console.log("Bluetooth-skanner statuscallback registrert");
}

/**
 * Sett callback for loggmeldinger
 * @param {Function} callback - Kalles for loggmeldinger
 */
export function setLogCallback(callback) {
    logCallback = callback;
    console.log("Bluetooth-skanner loggcallback registrert");
}

/**
 * Logger en melding, både til konsoll og via callback hvis satt
 * @param {string} message - Meldingen som skal logges
 * @param {string} level - Loggnivå ('info', 'warning', 'error')
 */
function log(message, level = 'info') {
    console.log(`[BT-SCANNER] [${level.toUpperCase()}] ${message}`);
    
    if (logCallback) {
        try {
            logCallback({
                message,
                level,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error("Feil ved kall av loggcallback:", e);
        }
    }
}

/**
 * Rapporter en feil, både til konsoll og via callback hvis satt
 * @param {string} message - Feilmeldingen
 */
function reportError(message) {
    const errorMsg = `FEIL: ${message}`;
    log(errorMsg, 'error');
    
    if (errorCallback) {
        try {
            errorCallback({
                message: message,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error("Feil ved kall av feilcallback:", e);
        }
    }
}

/**
 * Sjekker om Bluetooth er støttet og aktivert på enheten
 * @returns {Promise<boolean>} Om Bluetooth er tilgjengelig
 */
export async function checkBluetoothAvailability() {
    if (!navigator.bluetooth) {
        log("Web Bluetooth API er ikke tilgjengelig i denne nettleseren", 'warning');
        return false;
    }
    
    try {
        // På noen enheter kan dette kaste en feil hvis Bluetooth er deaktivert
        await navigator.bluetooth.getAvailability();
        return true;
    } catch (error) {
        log(`Bluetooth tilgjengelighetssjekk feilet: ${error.message}`, 'warning');
        return false;
    }
}

/**
 * Kobler til Bluetooth-skanner via Web Bluetooth API
 * @param {Object} options - Tilkoblingsalternativer
 * @param {boolean} options.attemptSystemPaired - Prøv å finne systemparede enheter
 * @returns {Promise<boolean>} Om tilkoblingen var vellykket
 */
export async function connectBLE(options = {}) {
    connectionType = 'BLE';
    const { attemptSystemPaired = true } = options;
    systemPairedDevice = false; // Reset flag
    
    // Hvis Web Bluetooth ikke støttes
    if (!navigator.bluetooth) {
        reportError("Bluetooth støttes ikke i denne nettleseren. Bruk Chrome, Edge eller en annen nettleser som støtter Web Bluetooth.");
        return false;
    }
    
    try {
        log("Starter Bluetooth-skannertilkobling...");
        
        // Hvis vi allerede er tilkoblet, koble fra først
        if (isConnectedState) {  // Endret fra isConnected til isConnectedState
            log("Allerede tilkoblet, kobler fra først");
            await disconnect();
        }
        
        // Liste opp alle tjenesteUUIDs for alle tilkoblingstyper
        const allServiceUUIDs = [
            ...serviceUUIDs.BLE,
            ...serviceUUIDs.SPP,
            ...serviceUUIDs.HID
        ];
        
        // Prøv først å finne enheter som allerede er paret med systemet hvis ønsket
        let devices = [];
        if (attemptSystemPaired && navigator.bluetooth.getDevices) {
            try {
                log("Søker etter enheter som allerede er paret via systemets Bluetooth-innstillinger...");
                devices = await navigator.bluetooth.getDevices();
                log(`Fant ${devices.length} enheter som allerede er paret`);
                
                // Filter devices to only include those that might be scanners
                const potentialScanners = devices.filter(d => {
                    // Check if device name contains keywords often found in scanner names
                    const name = (d.name || "").toLowerCase();
                    return name.includes("scan") || 
                           name.includes("barcode") || 
                           name.includes("reader") ||
                           name.includes("zebra") ||
                           name.includes("socket") ||
                           name.includes("handheld") ||
                           name.includes("honeywell") ||
                           name.includes("datalogic") ||
                           name.includes("motorola") ||
                           name.includes("symbol") ||
                           name.includes("newland");
                });
                
                log(`Fant ${potentialScanners.length} potensielle skannere blant parede enheter`);
                
                // Prøv å koble til hver potensiell skanner
                for (const scanner of potentialScanners) {
                    log(`Prøver å koble til systemparede enhet: ${scanner.name || "Ukjent enhet"}`);
                    try {
                        device = scanner;
                        systemPairedDevice = true;
                        
                        // Legg til hendelseshåndterer for frakobling
                        device.addEventListener('gattserverdisconnected', handleDisconnect);
                        
                        // Koble til GATT-server
                        log("Kobler til GATT-server for systemparede enhet...");
                        server = await device.gatt.connect();
                        log("Tilkoblet GATT-server for systemparede enhet");
                        
                        // Prøv å utforske tjenester for denne enheten
                        const connected = await exploreServicesAndConnect();
                        
                        if (connected) {
                            log(`Vellykket tilkobling til systemparede enhet: ${device.name || "Ukjent enhet"}`);
                            return true;
                        } else {
                            log(`Kunne ikke finne kompatible tjenester på systemparede enhet: ${device.name || "Ukjent enhet"}`);
                            // Koble fra og prøv neste
                            if (device && device.gatt.connected) {
                                try {
                                    device.gatt.disconnect();
                                } catch (e) {
                                    // Ignorer feil ved frakobling
                                }
                            }
                        }
                    } catch (error) {
                        log(`Feil ved tilkobling til systemparede enhet ${scanner.name || "Ukjent enhet"}: ${error.message}`, 'warning');
                        // Prøv neste enhet
                    }
                }
                
                log("Ingen systemparede enheter kunne kobles til med passende tjenester, prøver manuell enhetsvelger...");
            } catch (error) {
                log(`Feil ved henting av systemparede enheter: ${error.message}`, 'warning');
                log("Fortsetter med manuell enhetsvelger...");
            }
        }
        
        // Hvis ingen systemparede enheter kunne kobles til, fortsett med vanlig requestDevice
        log("Søker etter tilgjengelige skannere via manuell velger...");
        
        // Bruk Web Bluetooth API for å finne enheter
        device = await navigator.bluetooth.requestDevice({
            // Tillat alle enheter uten filter for å la brukeren velge fra alle tilgjengelige bluetooth-enheter
            acceptAllDevices: true,
            // Tillat alle tjenester vi ønsker å kommunisere med
            optionalServices: allServiceUUIDs
        });
        
        if (!device) {
            throw new Error("Ingen enhet valgt");
        }
        
        log(`Valgt enhet: ${device.name || "Ukjent enhet"}`);
        systemPairedDevice = false;
        
        // Legg til hendelseshåndterer for frakobling
        device.addEventListener('gattserverdisconnected', handleDisconnect);
        
        // Koble til GATT-server
        log("Kobler til GATT-server...");
        server = await device.gatt.connect();
        log("Tilkoblet GATT-server");
        
        // Utforsk tjenester og koble til
        return await exploreServicesAndConnect();
    } catch (error) {
        reportError(`Bluetooth-tilkobling feilet: ${error.message}`);
        
        // Koble fra hvis vi feiler etter tilkobling
        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
        
        // Nullstill tilstand
        device = null;
        server = null;
        currentService = null;
        currentCharacteristic = null;
        isConnectedState = false;  // Endret fra isConnected til isConnectedState
        systemPairedDevice = false;
        
        // Oppdater status
        if (statusCallback) {
            statusCallback(false);
        }
        
        return false;
    }
}

/**
 * Utforsker tjenester på en tilkoblet enhet og prøver å etablere kommunikasjon
 * @returns {Promise<boolean>} Om tilkoblingen var vellykket
 */
async function exploreServicesAndConnect() {
    if (!server) return false;
    
    try {
        // Forsøk å oppdage tjenester
        log("Oppdager tjenester...");
        
        try {
            // Prøv å få alle tilgjengelige tjenester - dette fungerer ikke alltid i alle nettlesere
            services = await server.getPrimaryServices();
            log(`Fant ${services.length} tjenester`);
            
            // Undersøk alle de oppdagede tjenestene
            for (const service of services) {
                log(`Undersøker tjeneste: ${service.uuid}`);
                currentService = service;
                
                try {
                    // Hent karakteristikker for denne tjenesten
                    const characteristics = await service.getCharacteristics();
                    log(`Service ${service.uuid} har ${characteristics.length} karakteristikker`);
                    
                    // Finn en karakteristikk vi kan bruke for data
                    for (const characteristic of characteristics) {
                        log(`Karakteristikk: ${characteristic.uuid}`);
                        
                        // Logger egenskapene til denne karakteristikken
                        const props = [];
                        if (characteristic.properties.broadcast) props.push("broadcast");
                        if (characteristic.properties.read) props.push("read");
                        if (characteristic.properties.writeWithoutResponse) props.push("writeWithoutResponse");
                        if (characteristic.properties.write) props.push("write");
                        if (characteristic.properties.notify) props.push("notify");
                        if (characteristic.properties.indicate) props.push("indicate");
                        
                        log(`Karakteristikk-egenskaper: ${props.join(", ")}`);
                        
                        // Hvis denne karakteristikken støtter notifikasjoner, bruk den for data
                        if (characteristic.properties.notify || characteristic.properties.indicate) {
                            currentCharacteristic = characteristic;
                            log(`Valgt karakteristikk for data: ${characteristic.uuid}`);
                            
                            try {
                                // Start notifikasjoner
                                log("Starter notifikasjoner på valgt karakteristikk...");
                                await currentCharacteristic.startNotifications();
                                currentCharacteristic.addEventListener('characteristicvaluechanged', handleData);
                                log("Notifikasjoner startet, skanner er nå klar");
                                
                                isConnectedState = true;  // Endret fra isConnected til isConnectedState
                                
                                // Informer om tilkobling
                                if (connectionCallback) {
                                    connectionCallback({
                                        device: device.name || "Ukjent skanner",
                                        status: "connected",
                                        systemPaired: systemPairedDevice
                                    });
                                }
                                
                                // Oppdater status
                                if (statusCallback) {
                                    statusCallback(true, { 
                                        type: 'bluetooth', 
                                        systemPaired: systemPairedDevice 
                                    });
                                }
                                
                                // Nullstill reconnect-tellere ved vellykket tilkobling
                                reconnectAttempts = 0;
                                
                                return true;
                            } catch (notifyError) {
                                log(`Kunne ikke starte notifikasjoner på karakteristikk ${characteristic.uuid}: ${notifyError.message}`, 'warning');
                                // Fortsett å søke etter andre karakteristikker som støtter notifikasjon
                            }
                        }
                    }
                } catch (charError) {
                    log(`Feil ved henting av karakteristikker for tjeneste ${service.uuid}: ${charError.message}`, 'warning');
                    // Fortsett til neste tjeneste
                }
            }
            
            // Hvis vi når hit, fant vi ingen passende karakteristikk for notifikasjoner
            log("Fant ingen passende karakteristikk for datamottak", 'warning');
            
            // Prøv alternativ metode - se etter tjenester basert på kjente UUIDs
            log("Prøver alternativ søkemetode for kjente tjenester...");
            
            let foundCompatibleService = false;
            
            for (const uuid of serviceUUIDs.BLE) {
                try {
                    log(`Søker etter kjent tjeneste ${uuid}...`);
                    currentService = await server.getPrimaryService(uuid);
                    log(`Fant tjeneste ${uuid}`);
                    
                    // Sjekk karakteristikker i denne tjenesten
                    const characteristics = await currentService.getCharacteristics();
                    log(`Tjeneste ${uuid} har ${characteristics.length} karakteristikker`);
                    
                    // Prøv først kjente notifikasjonskarakteristikker
                    for (const notifyUuid of characteristicUUIDs.BLE) {
                        try {
                            currentCharacteristic = await currentService.getCharacteristic(notifyUuid);
                            log(`Fant kjent notifikasjonskarakteristikk ${notifyUuid}`);
                            
                            // Sjekk om denne karakteristikken støtter notifikasjoner
                            if (currentCharacteristic.properties.notify || currentCharacteristic.properties.indicate) {
                                log(`Starter notifikasjoner på karakteristikk ${notifyUuid}...`);
                                await currentCharacteristic.startNotifications();
                                currentCharacteristic.addEventListener('characteristicvaluechanged', handleData);
                                log("Notifikasjoner startet, skanner er nå klar");
                                
                                isConnectedState = true;  // Endret fra isConnected til isConnectedState
                                foundCompatibleService = true;
                                
                                // Informer om tilkobling
                                if (connectionCallback) {
                                    connectionCallback({
                                        device: device.name || "Ukjent skanner",
                                        status: "connected",
                                        systemPaired: systemPairedDevice
                                    });
                                }
                                
                                // Oppdater status
                                if (statusCallback) {
                                    statusCallback(true, { 
                                        type: 'bluetooth',
                                        systemPaired: systemPairedDevice
                                    });
                                }
                                
                                // Nullstill reconnect-tellere ved vellykket tilkobling
                                reconnectAttempts = 0;
                                
                                return true;
                            } else {
                                log(`Karakteristikk ${notifyUuid} støtter ikke notifikasjoner, prøver neste`, 'warning');
                            }
                        } catch (e) {
                            // Denne kjente karakteristikken finnes ikke i denne tjenesten, prøv neste
                        }
                    }
                    
                    // Hvis vi ikke fant en kjent notifikasjonskarakteristikk,
                    // prøv å finne en hvilken som helst karakteristikk som støtter notifikasjoner
                    if (!foundCompatibleService) {
                        for (const characteristic of characteristics) {
                            log(`Sjekker karakteristikk ${characteristic.uuid} for notifikasjonsstøtte`);
                            
                            if (characteristic.properties.notify || characteristic.properties.indicate) {
                                currentCharacteristic = characteristic;
                                log(`Starter notifikasjoner på karakteristikk ${characteristic.uuid}...`);
                                
                                try {
                                    await currentCharacteristic.startNotifications();
                                    currentCharacteristic.addEventListener('characteristicvaluechanged', handleData);
                                    log("Notifikasjoner startet, skanner er nå klar");
                                    
                                    isConnectedState = true;  // Endret fra isConnected til isConnectedState
                                    foundCompatibleService = true;
                                    
                                    // Informer om tilkobling
                                    if (connectionCallback) {
                                        connectionCallback({
                                            device: device.name || "Ukjent skanner",
                                            status: "connected",
                                            systemPaired: systemPairedDevice
                                        });
                                    }
                                    
                                    // Oppdater status
                                    if (statusCallback) {
                                        statusCallback(true, { 
                                            type: 'bluetooth',
                                            systemPaired: systemPairedDevice
                                        });
                                    }
                                    
                                    return true;
                                } catch (notifyError) {
                                    log(`Kunne ikke starte notifikasjoner på karakteristikk ${characteristic.uuid}: ${notifyError.message}`, 'warning');
                                    // Fortsett til neste karakteristikk
                                }
                            }
                        }
                    }
                } catch (serviceError) {
                    // Denne tjenesten ble ikke funnet, prøv neste
                    log(`Tjeneste ${uuid} ikke funnet: ${serviceError.message}`, 'warning');
                }
            }
            
            // Hvis vi når hit, fant vi ingen kompatibel tjeneste eller karakteristikk
            throw new Error("Ingen kompatible Bluetooth-tjenester funnet i BLE-modus");
        } catch (error) {
            log(`Feil ved oppdagelse av tjenester: ${error.message}`, 'warning');
            
            // For enheter som ikke støtter getPrimaryServices, prøv å få tjenester individuelt
            log("Forsøker direkte tilkobling til kjente tjenester...", 'info');
            
            for (const uuid of serviceUUIDs.BLE) {
                try {
                    log(`Prøver direkte tilkobling til tjeneste ${uuid}...`);
                    currentService = await server.getPrimaryService(uuid);
                    
                    // Tjenesten ble funnet, prøv å finne karakteristikker
                    log(`Fant tjeneste ${uuid}, leter etter karakteristikker...`);
                    
                    try {
                        const characteristics = await currentService.getCharacteristics();
                        log(`Fant ${characteristics.length} karakteristikker for tjeneste ${uuid}`);
                        
                        // Finn en karakteristikk med notify-støtte
                        for (const characteristic of characteristics) {
                            if (characteristic.properties.notify || characteristic.properties.indicate) {
                                currentCharacteristic = characteristic;
                                log(`Valgt karakteristikk for notifikasjoner: ${characteristic.uuid}`);
                                
                                // Start notifikasjoner
                                try {
                                    await currentCharacteristic.startNotifications();
                                    currentCharacteristic.addEventListener('characteristicvaluechanged', handleData);
                                    log("Notifikasjoner startet, skanner er nå klar");
                                    
                                    isConnectedState = true;  // Endret fra isConnected til isConnectedState
                                    
                                    // Informer om tilkobling
                                    if (connectionCallback) {
                                        connectionCallback({
                                            device: device.name || "Ukjent skanner",
                                            status: "connected",
                                            systemPaired: systemPairedDevice
                                        });
                                    }
                                    
                                    // Oppdater status
                                    if (statusCallback) {
                                        statusCallback(true, { 
                                            type: 'bluetooth',
                                            systemPaired: systemPairedDevice
                                        });
                                    }
                                    
                                    return true;
                                } catch (notifyError) {
                                    log(`Kunne ikke starte notifikasjoner: ${notifyError.message}`, 'warning');
                                    // Fortsett til neste karakteristikk
                                }
                            }
                        }
                    } catch (charError) {
                        log(`Feil ved henting av karakteristikker: ${charError.message}`, 'warning');
                        // Fortsett til neste tjeneste
                    }
                } catch (serviceError) {
                    // Kunne ikke finne denne tjenesten, prøv neste
                    log(`Tjeneste ${uuid} ikke funnet: ${serviceError.message}`, 'warning');
                }
            }
            
            // Hvis vi fortsatt ikke har funnet en tjeneste, prøv en siste fallback-metode: 
            // Koble til en read-karakteristikk og polle den for endringer
            log("Prøver fallback-metode: Polling av read-karakteristikker...", 'info');
            
            // Implementer polling-metode for skannere som ikke støtter notify
            let pollSuccess = await setupPollingFallback();
            if (pollSuccess) {
                return true;
            }
            
            // Hvis vi kommer hit, har alle forsøk på å finne en passende tjeneste og karakteristikk feilet
            return false;
        }
    } catch (error) {
        log(`Utforsking av tjenester feilet: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Fallback-metode som bruker polling for skannere som ikke støtter notifikasjoner
 */
async function setupPollingFallback() {
    log("Setter opp polling fallback...");
    
    if (!server) return false;
    
    try {
        // Søk gjennom alle tjenester
        for (const uuid of serviceUUIDs.BLE) {
            try {
                const service = await server.getPrimaryService(uuid);
                log(`Prøver fallback på tjeneste: ${uuid}`);
                
                const characteristics = await service.getCharacteristics();
                
                // Se etter karakteristikker som støtter lesing
                for (const characteristic of characteristics) {
                    if (characteristic.properties.read) {
                        log(`Fant lesbar karakteristikk: ${characteristic.uuid}`);
                        currentCharacteristic = characteristic;
                        currentService = service;
                        
                        // Sett opp polling
                        log("Setter opp polling av lesbar karakteristikk...");
                        
                        // Start polling
                        window.btPollingInterval = setInterval(async () => {
                            try {
                                if (isConnectedState && currentCharacteristic) {  // Endret fra isConnected til isConnectedState
                                    const value = await currentCharacteristic.readValue();
                                    log("Polling: Leser verdi...");
                                    
                                    // Sjekk om vi har data
                                    if (value && value.byteLength > 0) {
                                        log(`Polling: Leste ${value.byteLength} bytes`);
                                        // Håndterer data manuelt
                                        handlePolledData(value);
                                    }
                                }
                            } catch (e) {
                                // Ignorerer feil ved polling
                            }
                        }, 300); // Poll hvert 300ms
                        
                        isConnectedState = true;  // Endret fra isConnected til isConnectedState
                        
                        // Informer om tilkobling
                        if (connectionCallback) {
                            connectionCallback({
                                device: device.name || "Ukjent skanner",
                                status: "connected (polling mode)"
                            });
                        }
                        
                        // Oppdater status
                        if (statusCallback) {
                            statusCallback(true, { type: 'bluetooth', mode: 'polling' });
                        }
                        
                        return true;
                    }
                }
            } catch (e) {
                // Ignore service errors and try the next service
            }
        }
        
        return false;
    } catch (error) {
        log(`Polling fallback feilet: ${error.message}`, 'warning');
        return false;
    }
}

/**
 * Håndterer data fra polling-metoden
 */
function handlePolledData(value) {
    if (!value) return;
    
    try {
        // Opprett et objekt som ligner på event.target.value fra notifikasjoner
        const syntheticEvent = {
            target: {
                value: value
            }
        };
        
        // Bruk samme datahåndtering som for notifikasjoner
        handleData(syntheticEvent);
    } catch (error) {
        log(`Feil ved håndtering av pollet data: ${error.message}`, 'error');
    }
}

/**
 * Kobler fra Bluetooth-skanneren
 */
export async function disconnect() {
    if (!device || !isConnectedState) {  // Endret fra isConnected til isConnectedState
        log("Ingen tilkoblet enhet å koble fra");
        return;
    }
    
    log("Kobler fra Bluetooth-skanner...");
    
    try {
        // Stopp polling hvis aktiv
        if (window.btPollingInterval) {
            clearInterval(window.btPollingInterval);
            window.btPollingInterval = null;
            log("Polling stoppet");
        }
        
        // Stopp notifikasjoner hvis aktive
        if (currentCharacteristic && 
            (currentCharacteristic.properties.notify || currentCharacteristic.properties.indicate)) {
            try {
                await currentCharacteristic.stopNotifications();
                currentCharacteristic.removeEventListener('characteristicvaluechanged', handleData);
                log("Notifikasjoner stoppet");
            } catch (e) {
                log(`Advarsel ved stopping av notifikasjoner: ${e.message}`, 'warning');
            }
        }
        
        // Koble fra GATT
        if (device && device.gatt.connected) {
            await device.gatt.disconnect();
            log("GATT frakoblet");
        }
    } catch (error) {
        log(`Feil ved frakobling: ${error.message}`, 'warning');
    } finally {
        // Nullstill tilstand
        currentService = null;
        currentCharacteristic = null;
        services = [];
        isConnectedState = false;  // Endret fra isConnected til isConnectedState
        
        // Informer om frakobling
        handleDisconnect();
    }
}

/**
 * Håndterer frakobling av Bluetooth-enheten
 */
function handleDisconnect() {
    log("Enhet frakoblet");
    
    // Stopp polling hvis aktiv
    if (window.btPollingInterval) {
        clearInterval(window.btPollingInterval);
        window.btPollingInterval = null;
    }
    
    isConnectedState = false;  // Endret fra isConnected til isConnectedState
    
    if (disconnectionCallback) {
        disconnectionCallback({
            device: device ? device.name : "Ukjent skanner",
            status: "disconnected"
        });
    }
    
    // Oppdater status
    if (statusCallback) {
        statusCallback(false);
    }
    
    // Hvis dette er en systemparede enhet, forsøk automatisk gjenoppkobling
    if (systemPairedDevice && device && reconnectAttempts < maxReconnectAttempts) {
        log(`Forsøker automatisk gjenoppkobling til systemparede enhet (forsøk ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
        reconnectAttempts++;
        
        // Forsink gjenoppkobling litt for å la enheten få tid til å stabilisere seg
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
        
        reconnectTimer = setTimeout(async () => {
            try {
                log("Starter gjenoppkobling...");
                
                if (device) {
                    // Koble til GATT-server igjen
                    server = await device.gatt.connect();
                    log("Tilkoblet GATT-server på nytt");
                    
                    // Utforsk tjenester og koble til på nytt
                    const reconnected = await exploreServicesAndConnect();
                    
                    if (reconnected) {
                        log("Vellykket gjenoppkobling til systemparede enhet");
                        reconnectAttempts = 0; // Nullstill telleren ved vellykket tilkobling
                    } else {
                        log("Kunne ikke gjenopprette tilkobling til systemparede enhet", 'warning');
                    }
                }
            } catch (error) {
                log(`Gjenoppkobling feilet: ${error.message}`, 'warning');
                
                // Hvis vi fortsatt har gjenværende forsøk, prøv igjen
                if (reconnectAttempts < maxReconnectAttempts) {
                    handleDisconnect(); // Dette vil utløse et nytt forsøk
                } else {
                    log("Maks antall gjenoppkoblingsforsøk nådd, gir opp", 'warning');
                    reconnectAttempts = 0; // Nullstill telleren for fremtidige forsøk
                }
            }
        }, 1500); // Vent 1.5 sekunder før gjenoppkobling
    }
}

/**
 * Prøv å sette skannemodusen
 * @param {string} mode - Ønsket skannemodus (trigger, detection, continuous)
 * @returns {Promise<boolean>} Om operasjonen var vellykket
 */
export async function setScanMode(mode) {
    if (!isConnectedState || !currentService) {  // Endret fra isConnected til isConnectedState
        log("Kan ikke sette skannemodus: Ikke tilkoblet", 'warning');
        return false;
    }
    
    log(`Forsøker å sette skannemodus til: ${mode}`);
    
    // Standard kommandoer for ulike skannere
    const commands = {
        'trigger': new Uint8Array([0x1B, 0x31]),      // ESC + 1
        'detection': new Uint8Array([0x1B, 0x32]),    // ESC + 2
        'continuous': new Uint8Array([0x1B, 0x33])    // ESC + 3
    };
    
    // Sjekk om modusen er støttet
    if (!commands[mode]) {
        log(`Ukjent skannemodus: ${mode}`, 'warning');
        return false;
    }
    
    try {
        // Finn en skrivbar karakteristikk i gjeldende tjeneste
        let commandChar = null;
        let characteristics;
        
        try {
            // Hent alle karakteristikker
            characteristics = await currentService.getCharacteristics();
            
            // Prøv først kjente kommandokarakteristikker
            for (const cmdUuid of characteristicUUIDs.COMMAND) {
                try {
                    const char = await currentService.getCharacteristic(cmdUuid);
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        commandChar = char;
                        log(`Fant kjent kommandokarakteristikk: ${cmdUuid}`);
                        break;
                    }
                } catch (e) {
                    // Denne karakteristikken finnes ikke, prøv neste
                }
            }
            
            // Hvis ingen kjent kommandokarakteristikk ble funnet,
            // prøv å finne en hvilken som helst karakteristikk som støtter skriving
            if (!commandChar) {
                log("Ingen kjent kommandokarakteristikk funnet, søker etter andre skrivbare karakteristikker...");
                
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        commandChar = char;
                        log(`Fant skrivbar karakteristikk: ${char.uuid}`);
                        break;
                    }
                }
            }
        } catch (error) {
            log(`Feil ved søk etter skrivbar karakteristikk: ${error.message}`, 'warning');
        }
        
        // Hvis vi fant en skrivbar karakteristikk, prøv å sende kommandoen
        if (commandChar) {
            log(`Sender skannemodus-kommando til karakteristikk: ${commandChar.uuid}`);
            
            if (commandChar.properties.writeWithoutResponse) {
                await commandChar.writeValueWithoutResponse(commands[mode]);
                log("Kommando sendt med writeWithoutResponse");
            } else {
                await commandChar.writeValue(commands[mode]);
                log("Kommando sendt med writeValue");
            }
            
            log(`Skannemodus satt til: ${mode}`);
            return true;
        } else {
            log("Ingen skrivbar karakteristikk funnet. Skanneren støtter kanskje ikke fjernkonfigurering.", 'warning');
            
            // Noen skannere krever fysisk konfigurasjon, så vi returnerer suksess selv om vi ikke kunne sende kommandoen
            log("Antar at skanneren allerede er i riktig modus.");
            return true;
        }
    } catch (error) {
        log(`Kunne ikke sette skannemodus: ${error.message}`, 'error');
        
        // For skannere som ikke støtter modusendring, returner true likevel for å ikke stoppe funksjonaliteten
        log("Fortsetter med eksisterende skannemodus");
        return true;
    }
}

/**
 * Håndterer data som mottas fra Bluetooth-skanneren
 * @param {Event} event - Hendelse med data fra skanneren
 */
function handleData(event) {
    if (!event || !event.target || !event.target.value) {
        log("Mottok tom datahendelse", 'warning');
        return;
    }
    
    const value = event.target.value;
    let barcode = '';
    
    log(`Mottok ${value.byteLength} bytes data fra skanner`);
    
    // Logg raw bytes for debugging
    try {
        const bytes = new Uint8Array(value.buffer);
        const hexData = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const asciiData = Array.from(bytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        
        log(`Rådata (hex): ${hexData}`);
        log(`Rådata (ASCII): ${asciiData}`);
        
        // Prøv ulike tolkningsmetoder
        try {
            // Metode 1: UTF-8 dekoding (mest vanlig)
            const decoder = new TextDecoder('utf-8');
            barcode = decoder.decode(value).trim();
            
            // Hvis strekkoden er tom, prøv alternative metoder
            if (!barcode || barcode.length === 0) {
                // Metode 2: Direkte ASCII-konvertering
                barcode = '';
                for (let i = 0; i < bytes.length; i++) {
                    // Ignorer spesialtegn, som CR, LF etc.
                    if (bytes[i] >= 32 && bytes[i] <= 126) {
                        barcode += String.fromCharCode(bytes[i]);
                    }
                }
                
                // Hvis fortsatt tom, prøv å konvertere hele bufferen på en gang
                if (!barcode || barcode.length === 0) {
                    barcode = String.fromCharCode.apply(null, bytes);
                }
                
                // Hvis fortsatt tom, prøv å hente ut numerisk sekvens
                if (!barcode || barcode.length === 0) {
                    const numMatch = asciiData.match(/\d+/);
                    if (numMatch) {
                        barcode = numMatch[0];
                        log(`Ekstrahert numerisk strekkode: ${barcode}`);
                    }
                }
            }
            
            // Fjern overflødige tegn
            barcode = barcode.trim().replace(/[\r\n]/g, '');
            
            log(`Tolket strekkode: ${barcode}`);
            
            // Callback med strekkoden hvis den ikke er tom
            if (barcode && barcode.length > 0 && dataCallback) {
                dataCallback({
                    data: barcode,
                    timestamp: new Date().toISOString(),
                    rawBytes: Array.from(bytes),
                    source: device ? device.name : "Ukjent skanner"
                });
            } else if (!barcode || barcode.length === 0) {
                log("Kunne ikke tolke gyldig strekkode fra data", 'warning');
            } else if (!dataCallback) {
                log("Ingen dataCallback registrert for å håndtere strekkoden", 'warning');
            }
        } catch (decodingError) {
            log(`Feil ved dekoding av data: ${decodingError.message}`, 'error');
            
            // Fallback: Prøv å returnere hex-representasjonen hvis alt annet feiler
            if (dataCallback) {
                dataCallback({
                    data: `HEX:${hexData}`,
                    timestamp: new Date().toISOString(),
                    rawBytes: Array.from(bytes),
                    source: device ? device.name : "Ukjent skanner"
                });
            }
        }
    } catch (error) {
        log(`Feil ved håndtering av skannerdata: ${error.message}`, 'error');
    }
}

/**
 * Sjekker om enheten er tilkoblet
 * @returns {boolean} Om enheten er tilkoblet
 */
export function getConnectionState() {  // Endret funksjonsnavn fra isConnected til getConnectionState
    return isConnectedState;
}

/**
 * Henter informasjon om den tilkoblede enheten
 * @returns {Object|null} Enhetsinformasjon eller null hvis ikke tilkoblet
 */
export function getDeviceInfo() {
    if (!device || !isConnectedState) {  // Endret fra isConnected til isConnectedState
        return null;
    }
    
    return {
        name: device.name || "Ukjent enhet",
        id: device.id || "Ukjent ID",
        connected: isConnectedState,  // Endret fra isConnected til isConnectedState
        connectionType,
        systemPaired: systemPairedDevice
    };
}

// Eksporter tilkoblingstyper
export const ConnectionTypes = {
    BLE: 'BLE',
    SPP: 'SPP',
    HID: 'HID'
};

// Export connection status
export function getStatus() {
    return {
        connected: isConnectedState,  // Endret fra isConnected til isConnectedState
        device: device ? device.name : null,
        connectionType,
        systemPaired: systemPairedDevice
    };
}

// Legg til en eksportert connect-funksjon som kaller connectBLE
/**
 * Kobler til Bluetooth-skanner
 * @param {Object} options - Tilkoblingsalternativer
 * @returns {Promise<boolean>} Om tilkoblingen var vellykket
 */
export async function connect(options = {}) {
    return await connectBLE(options);
}