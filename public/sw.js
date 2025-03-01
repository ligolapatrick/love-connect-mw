self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open('static')
            .then((cache) => {
                cache.addAll([
                    '/',
                    '/login1.html',
                    '/login.html',
                    '/register.html',
                    '/styles.css',
                    '/images/matches.jpg',
                    '/images/logo.png',
                    '/manifest.json'
                    // You can add more files here or use a dynamic caching strategy
                ]);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating Service Worker ....', event);
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
            .catch(() => {
                return caches.match('/offline.html');
            })
    );
});
