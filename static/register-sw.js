"use strict";

/**
 * Registers the static Ultraviolet service worker (./sw.js).
 * Service workers require https, or an allowed localhost hostname.
 */
const swAllowedHostnames = ["localhost", "127.0.0.1", "[::1]"];

async function registerSW() {
	if (location.protocol !== "https:" && !swAllowedHostnames.includes(location.hostname)) {
		throw new Error("Service workers require https or localhost.");
	}
	if (!navigator.serviceWorker) {
		throw new Error("This browser does not support service workers.");
	}
	await navigator.serviceWorker.register("sw.js");
}
