// Navn på cache
const CACHE_NAME = 'lager-pwa-v4';

// Filer som skal caches
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './css/dropdown-search.css', // Ny CSS-fil
  './js/app.js',
  './manifest.json',
  './js/modules/ui.js',
  './js/modules/picking.js',
  './js/modules/receiving.js',
  './js/modules/returns.js',
  './js/modules/scanner.js',
  './js/modules/storage.js',
  './js/modules/utils.js',
  './js/modules/weights.js',
  './js/modules/settings.js',
  './js/modules/import-export.js',
  './js/modules/pdf-export.js',
  './js/modules/dropdown-search.js', // Ny JS-fil
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff2'
];

// Installer service worker
self.addEventListener('install', event => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Åpnet cache');
        // Cache each URL individually to prevent one failure from stopping all caching
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.error(`Failed to cache: ${url}`, error);
            });
          })
        );
      })
  );
});

// Hent innhold, prøv cache først, deretter nettverk
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - returner respons
        if (response) {
          return response;
        }

        // Klone forespørselen fordi den er en stream og kan bare brukes én gang
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then(response => {
            // Sjekk at vi har en gyldig respons
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Klone responsen fordi den er en stream og kan bare brukes én gang
            const responseToCache = response.clone();

            // Åpne cache og lagre responsen
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Fallback hvis nettverk er utilgjengelig
            // For API-forespørsler kan vi returnere en standard offline-respons
            if (event.request.url.includes('/api/')) {
              return new Response(JSON.stringify({ error: 'Du er offline' }), {
                headers: {'Content-Type': 'application/json'}
              });
            }
          });
      })
    );
});

// Aktiver service worker og rydd opp i gamle cacher
self.addEventListener('activate', event => {
  console.log('Service worker activating...');
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Hvis navnet på cachen ikke er i whitelist, slett det
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Håndter synkronisering når nettverkstilkoblingen gjenopprettes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Funksjon for å synkronisere data med server
async function syncData() {
  try {
    // Hent lagrede data som skal synkroniseres
    const dataToSync = await getStoredDataForSync();
    
    if (dataToSync && dataToSync.length > 0) {
      // Implementer logikk for å sende data til server
      console.log('Synkroniserer data med server...', dataToSync);
      
      // Etter vellykket synkronisering, merk data som synkronisert
      await markDataAsSynced(dataToSync);
    }
  } catch (error) {
    console.error('Synkronisering feilet:', error);
  }
}

// Hent data som skal synkroniseres
async function getStoredDataForSync() {
  // Dette er bare et eksempel - implementer din egen logikk for å hente data som skal synkroniseres
  return [];
}

// Merk data som synkronisert
async function markDataAsSynced(data) {
  // Dette er bare et eksempel - implementer din egen logikk for å markere data som synkronisert
  console.log('Data markert som synkronisert:', data);
}