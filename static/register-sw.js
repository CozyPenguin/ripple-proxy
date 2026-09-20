"use strict";

/**
 * Registers the Ultraviolet service worker (./sw.js) and waits for it to
 * activate. register()'s own promise can stall in some document types
 * (observed in top-level SVG documents), so activation is confirmed by
 * polling instead of trusting it.
 */
const swAllowedHostnames = ["localhost", "127.0.0.1", "[::1]"];

async function registerSW() {
	if (location.protocol !== "https:" && !swAllowedHostnames.includes(location.hostname)) {
		throw new Error("Service workers require https or localhost.");
	}
	if (!navigator.serviceWorker) {
		throw new Error("This browser does not support service workers.");
	}
	const reg = await navigator.serviceWorker.register("sw.js");
	const start = Date.now();
	for (;;) {
		if (reg.active) return reg;
		const current =
			reg.installing || reg.waiting || (await navigator.serviceWorker.getRegistration())?.active;
		if (reg.active) return reg;
		if (Date.now() - start > 30000) {
			throw new Error("Service worker did not activate in time.");
		}
		await new Promise((r) => setTimeout(r, 300));
	}
}
