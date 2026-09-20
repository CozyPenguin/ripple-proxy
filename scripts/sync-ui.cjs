// Regenerates derived UI files from static/index.html + static/index.js:
//   - public/index.html   (same body, Node-server head)
//   - public/index.js     (copy of static/index.js)
//   - public/style.css    (copy of static/style.css)
//   - static/jsdelivr.html (same body, assets from cdn.jsdelivr.net)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

const CDN = "https://cdn.jsdelivr.net/gh/CozyPenguin/ripple-proxy@v1.1/static";
const page = read("static/index.html");

// ---- public/index.html : same body, Node-server head ----
let pub = page
	.replace(
		/<link rel="stylesheet" href="style.css" \/>/,
		'<link rel="stylesheet" href="style.css" />'
	)
	.replace(
		/\t\t<script src="baremux\/index.js"><\/script>\n\t\t<!-- eval-free config shim \(codec \+ paths\); the real bundle lives in the service worker -->\n\t\t<script src="cdn-config.js"><\/script>/,
		'\t\t<script src="/baremux/index.js"></script>\n\t\t<script src="/uv/uv.bundle.js"></script>\n\t\t<script src="/uv/uv.config.js"></script>'
	)
	.replace("<title>Ripple</title>", "<title>Ripple</title>");
write("public/index.html", pub);
write("public/index.js", read("static/index.js"));
write("public/style.css", read("static/style.css"));

// ---- static/jsdelivr.html : same body, jsDelivr asset URLs ----
let jd = page
	.replace(
		'<link rel="stylesheet" href="style.css" />',
		`<link rel="stylesheet" href="${CDN}/style.css" />`
	)
	.replace(
		/\t\t<script src="baremux\/index.js"><\/script>\n\t\t<!-- eval-free config shim \(codec \+ paths\); the real bundle lives in the service worker -->\n\t\t<script src="cdn-config.js"><\/script>/,
		`\t\t<script src="${CDN}/baremux/index.js"></script>\n\t\t<script src="${CDN}/cdn-config.js"></script>`
	)
	.replace(/src="icons\//g, `src="${CDN}/icons/`)
	.replace(
		"<title>Ripple</title>",
		"<title>Ripple — jsDelivr build</title>"
	);
write("static/jsdelivr.html", jd);

console.log("synced: public/index.html, public/index.js, public/style.css, static/jsdelivr.html");
