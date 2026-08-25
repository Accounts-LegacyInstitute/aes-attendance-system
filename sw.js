const CACHE_NAME = 'attendance-system-v1.0.0';
const OFFLINE_URL = 'https://accounts-legacyinstitute.github.io/aes-attendance-system/offline.html';
const CORE_ASSETS = [
    'https://accounts-legacyinstitute.github.io/aes-attendance-system/',
    'https://accounts-legacyinstitute.github.io/aes-attendance-system/offline.html',
    'https://accounts-legacyinstitute.github.io/aes-attendance-system/manifest.json',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-72x72.png?raw=true',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-96x96.png?raw=true',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-144x144.png?raw=true',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-192x192.png?raw=true',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-512x512.png?raw=true',
    'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-maskable-icon-512x512.png?raw=true'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Google API calls and external requests
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('script.google.com') ||
        url.hostname.includes('accounts.google.com') ||
        url.hostname.includes('res.cloudinary.com') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdn.jsdelivr.net')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Don't cache dynamic pages - only static assets
                if (event.request.mode === 'navigate') {
                    return response;
                }

                // Cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - try cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        // If it's a navigation request, show offline page
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }

                        return new Response('', { status: 408, statusText: 'Offline' });
                    });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from Attendance System',
        icon: 'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-192x192.png?raw=true',
        badge: 'https://github.com/Accounts-LegacyInstitute/aes-attendance-system/blob/main/attendance-system-icons/li-attendance-icon-96x96.png?raw=true',
        vibrate: [200, 100, 200],
        data: { url: 'https://accounts-legacyinstitute.github.io/aes-attendance-system/' }
    };

    event.waitUntil(
        self.registration.showNotification('The Legacy Institute Attendance', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://accounts-legacyinstitute.github.io/aes-attendance-system/')
    );
});