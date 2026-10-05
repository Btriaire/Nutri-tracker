// Service worker Nutri-Tracker : hors ligne minimal.
// - Pages : reseau d'abord (6 s max), sinon la derniere version gardee, sinon le journal, sinon /offline.
// - Fichiers statiques Next (/_next/static, immuables), images, polices : cache d'abord.
// - API : jamais en cache (donnees toujours fraiches) ; la saisie hors ligne passe par la file locale de l'appli.
const CACHE_NAME = 'nutritracker-v2';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/log'];
const NAV_TIMEOUT_MS = 6000;

async function putIfUsable(cache, url, response) {
  // Une redirection (ex. vers /login) ne doit jamais remplacer une vraie page.
  if (response && response.ok && !response.redirected && response.type === 'basic') {
    await cache.put(url, response);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(async url => {
      try { await putIfUsable(cache, url, await fetch(url, { credentials: 'same-origin', cache: 'no-store' })); } catch { /* hors ligne a l'installation */ }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
  });
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);
  const network = fetch(request);
  // Mise en cache en arriere-plan, meme si la reponse arrive apres le delai.
  network.then(r => putIfUsable(cache, url.pathname, r.clone())).catch(() => {});
  try {
    return await withTimeout(network, NAV_TIMEOUT_MS);
  } catch {
    return (await cache.match(url.pathname))
      || (url.pathname.startsWith('/log') ? await cache.match('/log') : undefined)
      || (await cache.match(OFFLINE_URL))
      || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || ['image', 'font', 'style', 'script'].includes(request.destination)) {
    event.respondWith(handleStatic(request));
  }
  // Le reste (donnees de navigation Next, etc.) passe directement au reseau.
});
