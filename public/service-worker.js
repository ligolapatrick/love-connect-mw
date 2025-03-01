self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    // Perform install steps
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
    // Perform activation steps
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'images/icons/logo192.png',
    badge: 'images/icons/logo192.png'
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
