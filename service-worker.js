// Navn på cache
const CACHE_NAME = 'lager-pwa-v1';

// Filer som skal caches
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff2'
];

// Installer service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Åpnet cache');
        return cache.addAll(urlsToCache);
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
          });
      })
    );
});

// Aktiver service worker og rydd opp i gamle cacher
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Hvis navnet på cachen ikke er i whitelist, slett det
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Håndter synkronisering når nettverkstilkoblingen gjenopprettes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-picklist') {
    event.waitUntil(syncPickList());
  }
});

// Funksjon for å synkronisere data med server
// Dette er en stub som må implementeres hvis du ønsker server-synkronisering
async function syncPickList() {
  // Dette ville vanligvis hente data fra IndexedDB og sende til server
  console.log('Synkroniserer data med server...');
}