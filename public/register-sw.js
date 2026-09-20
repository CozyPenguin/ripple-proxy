"use strict";

/**
 * Registers the Ultraviolet service worker. Service workers require https,
 * or one of the hostnames allowed to run them over plain http.
 */
const swAllowedHostnames = ["localhost", "127.0.0.1", "[::1]"];

async function registerSW() {
	if (location.protocol !== "https:" && !swAllowedHostnames.includes(location.hostname)) {
		throw new Error("Service workers require https or localhost.");
	}
	if (!navigator.serviceWorker) {
		throw new Error("This browser does not support service workers.");
	}
	await navigator.serviceWorker.register("/uv/sw.js", { updateViaCache: "none" });
}
