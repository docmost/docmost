const VERSION = 'v4'; // Update this to trigger re-install

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(
            (async () => {
                let data = { title: "", text: "", url: "" };
                try {
                    const formData = await event.request.formData();
                    for (const [key, value] of formData.entries()) {
                        if (key in data && typeof value === "string") data[key] = value;
                    }
                } catch (e) {
                    // If parsing fails, still redirect to UI (which can show "no content").
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
