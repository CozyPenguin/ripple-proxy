// v1.2 — redirect:manual (capture Set-Cookie on every hop; fixes OAuth sign-in loops)
// Service worker for the static deployment. Lives at the app root so its
// scope covers both /sw.js, the app, and the /service/ proxied prefix.
importScripts("uv/uv.bundle.js");
importScripts("uv/uv.config.js?v=5");
importScripts("uv/uv.sw.js");

const uv = new UVServiceWorker();

async function handleRequest(event) {
	if (uv.route(event)) {
		return await uv.fetch(event);
	}
	return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
