/**
 * Happy Warmi Spa - Service Worker (Versión Optimizada PWA)
 * Arquitectura de caché relativa para despliegue local y en subcarpetas de GitHub Pages
 * Soporte Offline integral, precaché de assets estáticos, mariposas y caché dinámico.
 */

const CACHE_NAME = 'happy-warmi-spa-v2.2.0';
const DYNAMIC_CACHE_NAME = 'happy-warmi-dynamic-v2.2.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './supabase-client.js',
  './admin.html',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './imagenes_spa/mariposa-dorada-zen.svg',
  './imagenes_spa/mariposa-lila-armonia.svg',
  './imagenes_spa/mariposa-loto-wellness.svg',
  './imagenes_spa/mariposa-monarca-spa.svg',
  './imagenes_spa/mariposa-botanica-zen.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (!requestUrl.protocol.startsWith('http')) {
    return;
  }

  // Navegación HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(event.request);
        })
    );
    return;
  }

  // Assets del mismo origen (CSS, JS, iconos, imágenes SVG, manifest)
  if (requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        });
      })
    );
    return;
  }

  // Assets externos (Google Fonts, Unsplash Images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => cachedResponse);
    })
  );
});
