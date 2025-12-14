const VERSION = 'v4'; // Update this to trigger re-install

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(
            (async () => {
                const formData = await event.request.formData();
                const data = {};
                for (const [key, value] of formData.entries()) {
                    data[key] = value;
                }

                // Store in Cache API
                const cache = await caches.open('share-target');
                await cache.put(
                    'shared-content',
                    new Response(JSON.stringify(data), {
                        headers: { 'Content-Type': 'application/json' },
                    })
                );

                // Redirect to the client-side route
                return Response.redirect('/share-target', 303);
            })()
        );
    }
});
