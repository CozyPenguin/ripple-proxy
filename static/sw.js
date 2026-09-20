// v1.2 — redirect:manual (capture Set-Cookie on every hop; fixes OAuth sign-in loops)
// Service worker for the static deployment. Lives at the app root so its
// scope covers both /sw.js, the app, and the /service/ proxied prefix.
importScripts("uv/uv.bundle.js");
importScripts("uv/uv.config.js?v=5");
importScripts("uv/uv.sw.js");

const uv = new UVServiceWorker();

// debug ring buffer: last 250 proxied responses (URL tail, status, cookies,
// redirect target) — readable from the page via a "ripple-debug" message.
self.__dbg = self.__dbg || [];

async function handleRequest(event) {
	if (uv.route(event)) {
		const r = await uv.fetch(event);
		try {
			self.__dbg.push({
				u: event.request.url.slice(-100),
				s: r.status,
				sc: !!(r.headers && r.headers.get("set-cookie")),
				loc: r.headers ? (r.headers.get("location") || "").slice(-70) : "",
			});
			if (self.__dbg.length > 250) self.__dbg.shift();
		} catch {}
		return r;
	}
	return await fetch(event.request);
}

self.addEventListener("message", (event) => {
	if (event.data === "ripple-debug" && event.source) {
		event.source.postMessage({ type: "ripple-debug", log: self.__dbg || [] });
	}
});

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
