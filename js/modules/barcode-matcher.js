// barcode-matcher.js - Felles modul for strekkodematching
import { appState } from '../app.js';

/**
 * Normaliserer et produkt-ID for sammenligning
 * @param {string} id - Produkt-ID som skal normaliseres
 * @returns {string} Normalisert ID
 */
export function normalizeProductId(id) {
    if (!id) return '';
    
    // Fjern mellomrom
    let normalized = id.trim();
    
    // Fjern mellomrom rundt bindestreker
    normalized = normalized.replace(/\s*-\s*/g, '-');
    
    // Konverter til små bokstaver for case-insensitiv sammenligning
    normalized = normalized.toLowerCase();
    
    return normalized;
}

/**
 * Finner beste match for et produkt-ID ved å sammenligne med barcodes.json
 * @param {string} rawId - Rå produkt-ID 
 * @returns {string|null} Beste match produkt-ID eller null hvis ingen match
 */
export function findBestProductIdMatch(rawId) {
    if (!rawId) return null;
    
    // Bygg opp mappings for effektiv sammenligning
    const { barcodesMap, normalizedBarcodesMap } = buildBarcodesMappings();
    
    // 1. Sjekk først for eksakt match
    if (barcodesMap[rawId]) {
        return rawId;
    }
    
    // 2. Normaliser ID-en og sjekk for normalisert match
    const normalizedId = normalizeProductId(rawId);
    if (normalizedBarcodesMap[normalizedId]) {
        return normalizedBarcodesMap[normalizedId].originalId;
    }
    
    // 3. Prøv uten bindestreker
    const noDashesId = rawId.replace(/-/g, '');
    if (normalizedBarcodesMap[noDashesId]) {
        return normalizedBarcodesMap[noDashesId].originalId;
    }
    
    // 4. Sjekk for prefiks match (f.eks. 000-XX mot 000-XX1234)
    for (const knownId in barcodesMap) {
        if (knownId.startsWith(rawId) || rawId.startsWith(knownId)) {
            return knownId;
        }
    }
    
    // 5. Spesialtilfelle for "LA" og "BP" prefiks
    if (rawId.startsWith('LA') || rawId.startsWith('BP')) {
        const prefix = rawId.substring(0, 2);
        const numPart = rawId.substring(2);
        
        // Sjekk om det finnes produkter som starter med samme prefix
        for (const knownId in barcodesMap) {
            if (knownId.startsWith(prefix)) {
                const knownNumPart = knownId.substring(2);
                // Hvis talldelene er like, eller en av dem er prefiks for den andre
                if (knownNumPart === numPart || 
                    knownNumPart.startsWith(numPart) || 
                    numPart.startsWith(knownNumPart)) {
                    return knownId;
                }
            }
        }
    }
    
    // Ingen match funnet, returner null for å indikere at produktet skal ignoreres
    return null;
}

/**
 * Henter produktdata fra barcodes.json
 * @param {string} productId - Produkt-ID
 * @returns {Object|null} Produktdata eller null hvis ikke funnet
 */
export function getProductDataFromBarcodes(productId) {
    if (!productId) return null;
    
    // Bygg opp mappings for effektiv sammenligning
    const { barcodesMap } = buildBarcodesMappings();
    
    // Direkte oppslag i barcodesMap først
    if (barcodesMap[productId]) {
        return barcodesMap[productId];
    }
    
    // Sjekk i barcodeMapping direkte
    for (const [barcode, data] of Object.entries(appState.barcodeMapping)) {
        const barcodeProductId = typeof data === 'object' ? data.id : data;
        
        if (barcodeProductId === productId) {
            return {
                id: productId,
                description: typeof data === 'object' ? data.description : null,
                weight: typeof data === 'object' ? data.weight : null
            };
        }
    }
    
    return null;
}

/**
 * Mapper en strekkode til et produkt-ID
 * @param {string} barcode - Strekkode eller produkt-ID
 * @returns {string|null} Tilsvarende produkt-ID, eller null hvis ikke funnet
 */
export function mapBarcodeToProductId(barcode) {
    if (!barcode) return null;
    
    // Sjekk direkte i barcodeMapping
    if (appState.barcodeMapping[barcode]) {
        const data = appState.barcodeMapping[barcode];
        return typeof data === 'object' ? data.id : data;
    }
    
    // Sjekk om strekkoden/ID-en allerede er et produkt-ID
    const productData = getProductDataFromBarcodes(barcode);
    if (productData) {
        return productData.id;
    }
    
    // Prøv å finne beste match
    return findBestProductIdMatch(barcode);
}

/**
 * Bygger opp mappinger for rask oppslag av produkt-IDer
 * @returns {Object} Objekter med mappinger for effektivt oppslag
 */
function buildBarcodesMappings() {
    // Maps for effektiv sammenligning
    const barcodesMap = {};
    const normalizedBarcodesMap = {};
    
    for (const [barcode, data] of Object.entries(appState.barcodeMapping)) {
        const productId = typeof data === 'object' ? data.id : data;
        if (productId) {
            // Lagre det originale produkt-ID for varenummer
            barcodesMap[productId] = {
                id: productId,
                description: typeof data === 'object' ? data.description : null,
                weight: typeof data === 'object' ? data.weight : null
            };
            
            // Lagre også normaliserte versjoner for bedre matching
            const normalizedId = normalizeProductId(productId);
            normalizedBarcodesMap[normalizedId] = {
                originalId: productId,
                description: typeof data === 'object' ? data.description : null,
                weight: typeof data === 'object' ? data.weight : null
            };
            
            // Lagre uten bindestreker
            const noDashesId = productId.replace(/-/g, '');
            normalizedBarcodesMap[noDashesId] = {
                originalId: productId,
                description: typeof data === 'object' ? data.description : null,
                weight: typeof data === 'object' ? data.weight : null
            };
        }
    }
    
    return { barcodesMap, normalizedBarcodesMap };
}

/**
 * Finner beskrivelse fra barcodes.json basert på varenummer
 * @param {string} itemId - Varenummer
 * @returns {string} - Beskrivelse eller "Ukjent vare"
 */
export function findDescriptionFromBarcodes(itemId) {
    if (!itemId) return "Ukjent vare";
    
    // Sjekk først om vi har en direkte match i getProductDataFromBarcodes
    const productData = getProductDataFromBarcodes(itemId);
    if (productData && productData.description) {
        return productData.description;
    }
    
    // Hvis det ikke finnes noen direkte match, returner standard beskrivelse
    return `Vare ${itemId}`;
}

/**
 * Finner vekt fra barcodes.json basert på varenummer
 * @param {string} itemId - Varenummer
 * @returns {number} - Vekt eller standard vekt
 */
export function findWeightFromBarcodes(itemId) {
    if (!itemId) return appState.settings.defaultItemWeight || 1.0;
    
    // Sjekk først om vi har en direkte match i getProductDataFromBarcodes
    const productData = getProductDataFromBarcodes(itemId);
    if (productData && productData.weight) {
        return productData.weight;
    }
    
    // Sjekk i item weights
    if (appState.itemWeights && appState.itemWeights[itemId]) {
        return appState.itemWeights[itemId];
    }
    
    // Returner standardvekt hvis ingenting annet er tilgjengelig
    return appState.settings.defaultItemWeight || 1.0;
}