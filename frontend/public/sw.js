const STATIC_CACHE = 'companio-static-v1';
const API_CACHE = 'companio-api-v1';
const SYNC_TAG = 'sync-attempts';

const STATIC_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function cacheFirstFallback(req) {
  const cachedResponse = await caches.match(req);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(req);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(req, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    return new Response('Network error', { status: 408 });
  }
}

async function networkFirstFallback(req) {
  try {
    const networkResponse = await fetch(req);
    const cache = await caches.open(API_CACHE);
    
    const headers = new Headers(networkResponse.headers);
    headers.append('x-cache-time', Date.now().toString());
    
    const responseToCache = new Response(networkResponse.clone().body, {
      status: networkResponse.status,
      statusText: networkResponse.statusText,
      headers: headers
    });
    
    cache.put(req, responseToCache);
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(req);
    if (cachedResponse) {
      const cacheTimeStr = cachedResponse.headers.get('x-cache-time');
      if (cacheTimeStr) {
        const cacheTime = parseInt(cacheTimeStr, 10);
        if (Date.now() - cacheTime < 300000) {
          return cachedResponse;
        }
      }
    }
    return new Response('API Network error', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'GET') {
      event.respondWith(networkFirstFallback(req));
    }
  } else {
    event.respondWith(cacheFirstFallback(req));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncAttempts());
  }
});

async function syncAttempts() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('companio-offline', 1);
    request.onsuccess = async (event) => {
      const db = event.target.result;
      const tx = db.transaction('attempt_queue', 'readwrite');
      const store = tx.objectStore('attempt_queue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const attempts = getAllRequest.result;
        for (const attempt of attempts) {
          try {
            const res = await fetch('/api/practice/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(attempt)
            });
            if (res.ok) {
              const delTx = db.transaction('attempt_queue', 'readwrite');
              delTx.objectStore('attempt_queue').delete(attempt.id);
            }
          } catch (e) {
            console.error('Failed to sync attempt during background sync:', e);
          }
        }
        resolve(true);
      };
      
      getAllRequest.onerror = () => reject('Failed to read attempts array');
    };
    request.onerror = () => reject('Failed to access offline IndexedDB');
  });
}
