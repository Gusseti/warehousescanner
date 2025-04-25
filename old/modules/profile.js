// profile.js - Funksjonalitet for brukerprofilmodulen
import { appState } from '../app.js';
import { showToast } from './utils.js';

// DOM-elementer for brukerprofilvisning
let profileAvatarEl;
let profileNameEl;
let profileCompanyEl;
let profileFullNameEl;
let profileEmailEl;
let profileCompanyDetailEl;
let profileRoleEl;
let profileCreatedEl;
let profilePickCountEl;
let profileReceiveCountEl;
let profileReturnCountEl;

/**
 * Initialiserer profilmodulen
 */
export function initProfile() {
    console.log("Initialiserer profilmodul");
    
    // Hent DOM-elementer
    profileAvatarEl = document.getElementById('profileAvatar');
    profileNameEl = document.getElementById('profileName');
    profileCompanyEl = document.getElementById('profileCompany');
    profileFullNameEl = document.getElementById('profileFullName');
    profileEmailEl = document.getElementById('profileEmail');
    profileCompanyDetailEl = document.getElementById('profileCompanyDetail');
    profileRoleEl = document.getElementById('profileRole');
    profileCreatedEl = document.getElementById('profileCreated');
    profilePickCountEl = document.getElementById('profilePickCount');
    profileReceiveCountEl = document.getElementById('profileReceiveCount');
    profileReturnCountEl = document.getElementById('profileReturnCount');
    
    // Oppdater profilsiden med brukerdata
    updateProfileUI();
    
    console.log("Profilmodul initialisert");
}

/**
 * Oppdaterer UI for profilvisningen
 */
export function updateProfileUI() {
    // Sikre at vi har en bruker
    if (!appState.user) {
        console.error('Ingen bruker funnet når profilsiden oppdateres');
        return;
    }
    
    const user = appState.user;
    
    // Oppdater avataren med første bokstav i navnet
    if (profileAvatarEl && user.name) {
        profileAvatarEl.textContent = user.name.substring(0, 1).toUpperCase();
    }
    
    // Oppdater navnet
    if (profileNameEl && user.name) {
        profileNameEl.textContent = user.name;
    }
    
    // Oppdater firmanavn i toppseksjonen
    if (profileCompanyEl && user.company) {
        profileCompanyEl.textContent = user.company;
    }
    
    // Oppdater brukerinformasjon i tabellen
    if (profileFullNameEl && user.name) {
        profileFullNameEl.textContent = user.name;
    }
    
    if (profileEmailEl && user.email) {
        profileEmailEl.textContent = user.email;
    }
    
    if (profileCompanyDetailEl && user.company) {
        profileCompanyDetailEl.textContent = user.company;
    }
    
    if (profileRoleEl && user.role) {
        // Oversett roller til norsk
        const roleTranslations = {
            'admin': 'Administrator',
            'user': 'Bruker',
            'guest': 'Gjest'
        };
        profileRoleEl.textContent = roleTranslations[user.role.toLowerCase()] || user.role;
    }
    
    // Formatter datoen
    if (profileCreatedEl && user.created) {
        try {
            const date = new Date(user.created);
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            profileCreatedEl.textContent = date.toLocaleDateString('nb-NO', options);
        } catch (e) {
            profileCreatedEl.textContent = user.created || 'Ukjent';
        }
    }
    
    // Oppdater statistikk for aktivitet
    // Dette bør hentes fra brukerens aktivitetslogg i en produksjonsapp
    const userData = window.currentUserData?.data || {};
    
    if (profilePickCountEl) {
        const pickCount = countItems(userData.pickings || []);
        profilePickCountEl.textContent = pickCount;
    }
    
    if (profileReceiveCountEl) {
        const receiveCount = countItems(userData.receivings || []);
        profileReceiveCountEl.textContent = receiveCount;
    }
    
    if (profileReturnCountEl) {
        const returnCount = countItems(userData.returns || []);
        profileReturnCountEl.textContent = returnCount;
    }
}

/**
 * Teller totalt antall varer i en liste
 * @param {Array} list - Liste med varer
 * @returns {number} - Totalt antall varer
 */
function countItems(list) {
    try {
        // For lister med vareposter, teller vi opp antallet
        if (Array.isArray(list)) {
            return list.reduce((total, item) => total + (item.quantity || 1), 0);
        }
    } catch (e) {
        console.error('Feil ved opptelling av varer:', e);
    }
    return 0;
}

/**
 * Henter utvidet brukerinformasjon fra server/lokalt lager
 * @returns {Promise<Object>} - Brukerinformasjon
 */
export async function loadUserDetails() {
    // Sjekk om vi har en bruker i appState
    if (!appState.user || !appState.user.id) {
        console.error('Ingen bruker å laste detaljer for');
        return null;
    }
    
    try {
        // I en produksjonsapp ville dette vært et API-kall
        // For øyeblikket bruker vi users.json direkte (se app.js)
        const response = await fetch('users.json');
        if (!response.ok) {
            throw new Error('Kunne ikke laste brukere fra users.json');
        }
        
        const data = await response.json();
        if (!data.users || !Array.isArray(data.users)) {
            throw new Error('Ugyldig brukerdata-format');
        }
        
        // Finn gjeldende bruker i users.json
        const userDetails = data.users.find(u => u.id == appState.user.id);
        
        if (userDetails) {
            // Oppdater appState med flere detaljer, men la være å overskrive id
            const { password, ...safeUserDetails } = userDetails;
            
            // Oppdater brukerdata i appState
            appState.user = {
                ...appState.user,
                ...safeUserDetails
            };
            
            // Oppdater brukerdata i localStorage (uten passord)
            localStorage.setItem('snapscan_user', JSON.stringify(appState.user));
            
            // Oppdater UI basert på ny brukerdata
            updateProfileUI();
            
            return appState.user;
        } else {
            console.warn(`Bruker med ID=${appState.user.id} ikke funnet i users.json`);
        }
    } catch (error) {
        console.error('Feil ved lasting av brukerdetaljer:', error);
        showToast('Kunne ikke laste brukerdetaljer. Prøv igjen senere.', 'error');
    }
    
    return null;
}