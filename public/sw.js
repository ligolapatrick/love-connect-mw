self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    // Perform install steps
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
                    // Add more static resources as needed
                ]);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
    // Perform activation steps
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'images/icons/logo.png',
    badge: 'images/icons/logo.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
