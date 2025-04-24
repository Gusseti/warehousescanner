// bluetooth-scanner.js - Håndterer bluetooth skanner funksjonalitet
import { showToast } from './utils.js';
import { processScannedBarcode } from './scanner.js';

// State variabler
let bluetoothDevice = null;
let isBluetoothConnected = false;
let scannerStatusCallback = null;

/**
 * Kobler til en Bluetooth-skanner
 * @returns {Promise} Løftebasert resultat av tilkoblingsforsøket
 */
export async function connectToBluetoothScanner() {
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

// Eksporter også funksjonen med navnet 'connect' for bakoverkompatibilitet
export const connect = connectToBluetoothScanner;

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

/**
 * Setter callback-funksjonen for å håndtere statusendringer
 * @param {Function} callback - Funksjon som kalles ved statusendringer
 */
export function setBluetoothStatusCallback(callback) {
    if (typeof callback === 'function') {
        scannerStatusCallback = callback;
    }
}

/**
 * Sjekker om bluetooth-skanneren er tilkoblet
 * @returns {boolean} True hvis bluetooth-skanneren er tilkoblet
 */
export function isConnected() {
    return isBluetoothConnected;
}

/**
 * Kobler fra bluetooth-skanneren hvis den er tilkoblet
 * @returns {Promise} Løftebasert resultat av frakoblingsforsøket
 */
export async function disconnectBluetoothScanner() {
    if (bluetoothDevice && bluetoothDevice.gatt && isBluetoothConnected) {
        try {
            await bluetoothDevice.gatt.disconnect();
            bluetoothDevice = null;
            isBluetoothConnected = false;
            showToast('Bluetooth-skanner koblet fra', 'info');
            
            // Informer om statusendring
            if (scannerStatusCallback) {
                scannerStatusCallback(false);
            }
            
            return { success: true };
        } catch (error) {
            showToast(`Kunne ikke koble fra Bluetooth-skanner: ${error.message}`, 'error');
            throw error;
        }
    }
    return { success: false, message: 'Ingen aktiv Bluetooth-tilkobling' };
}

// Eksporter også funksjonen med navnet 'disconnect' for bakoverkompatibilitet
export const disconnect = disconnectBluetoothScanner;