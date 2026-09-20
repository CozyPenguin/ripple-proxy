// jsDelivr SVG build config. The page deliberately does NOT load
// uv/uv.bundle.js: parts of it rely on eval(), which some CDNs'/browsers'
// Content-Security-Policy blocks, and the page only needs the XOR codec and
// paths. The real bundle still loads inside the service worker (workers
// aren't affected), where it matters.
//
// The codec below is byte-for-byte the same algorithm as Ultraviolet's
// codec.xor (XOR every second char code with 2, then encodeURIComponent).
self.Ultraviolet = {
	codec: {
		xor: {
			encode(str) {
				if (!str) return str;
				let out = "";
				const len = str.length;
				for (let i = 0; i < len; i++) {
					const ch = str[i];
					out += i % 2 ? String.fromCharCode(ch.charCodeAt(0) ^ 2) : ch;
				}
				return encodeURIComponent(out);
			},
			decode(str) {
				if (!str) return str;
				str = decodeURIComponent(str);
				let out = "";
				const len = str.length;
				for (let i = 0; i < len; i++) {
					const ch = str[i];
					out += i % 2 ? String.fromCharCode(ch.charCodeAt(0) ^ 2) : ch;
				}
				return out;
			},
		},
	},
};

// Self-locate: as a page script, document.currentScript is this file, which
// sits in static/uv/ — one level below the app root.
let root;
if (document.currentScript && document.currentScript.src) {
	root = new URL("../", document.currentScript.src).pathname;
} else {
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
