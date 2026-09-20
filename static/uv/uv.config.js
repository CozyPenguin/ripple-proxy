// Standalone Ultraviolet config for static hosting (jsDelivr / any CDN).
// Computes every path from the script's own URL, so it works no matter
// what directory depth the host serves it from.
//
// Contexts: as a page script, document.currentScript is this file. Inside
// the service worker (importScripts'd), self.location is the worker
// script (sw.js), which sits one directory up next to /service/.
let root;
if (typeof importScripts === "function") {
	root = new URL("./", self.location.href).pathname;
} else if (document.currentScript && document.currentScript.src) {
	root = new URL("../", document.currentScript.src).pathname;
} else {
	// eval'd manually without a script tag — fall back to <page>/uv/
	root = new URL("uv/", document.baseURI).pathname;
}

self.__uv$config = {
	prefix: root + "service/",
	encodeUrl: Ultraviolet.codec.xor.encode,
	decodeUrl: Ultraviolet.codec.xor.decode,
	handler: root + "uv/uv.handler.js",
	client: root + "uv/uv.client.js",
	bundle: root + "uv/uv.bundle.js",
	config: root + "uv/uv.config.js",
	sw: root + "uv/uv.sw.js",
};
