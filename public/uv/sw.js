// v1.2 — redirect:manual (capture Set-Cookie on every hop; fixes OAuth sign-in loops)
/*global UVServiceWorker,__uv$config*/
/*
 * Stock service worker script.
 * Users can provide their own sw.js if they need to extend the functionality of the service worker.
 * Ideally, this will be registered under the scope in uv.config.js so it will not need to be modified.
 * However, if a user changes the location of uv.bundle.js/uv.config.js or sw.js is not relative to them, they will need to modify this script locally.
 */
importScripts("uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw || "uv.sw.js");

const uv = new UVServiceWorker();

// debug ring buffer readable via "ripple-debug" postMessage
self.__dbg = self.__dbg || [];

async function handleRequest(event) {
	if (uv.route(event)) {
		const r = await uv.fetch(event);
		try { self.__dbg.push({ u: event.request.url.slice(-100), s: r.status, sc: !!(r.headers && r.headers.get('set-cookie')) }); if (self.__dbg.length > 250) self.__dbg.shift(); } catch {}
		return r;
	}

	return await fetch(event.request);
}

self.addEventListener("message", (event) => { if (event.data === "ripple-debug" && event.source) { event.source.postMessage({ type: "ripple-debug", log: self.__dbg || [] }); } });
self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
