const CACHE_NAME = 'cast-volume-control-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicons/android-chrome-192x192.png',
    '/favicons/android-chrome-512x512.png',
    '/favicons/apple-touch-icon.png',
    '/favicons/favicon-16x16.png',
    '/favicons/favicon-32x32.png',
    '/favicons/favicon.ico',
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1',
    'https://buttons.github.io/buttons.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache.map(url => new Request(url, {mode: 'no-cors'})));
            })
            .catch((error) => {
                console.error('Cache installation failed:', error);
                return caches.open(CACHE_NAME).then(cache => {
                    const essentialUrls = ['/', '/index.html', '/manifest.json'];
                    return cache.addAll(essentialUrls);
                });
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('chrome-extension') || 
        event.request.url.includes('moz-extension') ||
        event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }

                return fetch(event.request.clone())
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('Fetch failed:', error);
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        throw error;
                    });
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const essentialUrls = ['/', '/index.html'];
        
        for (const url of essentialUrls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.error('Background sync failed for:', url, error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}