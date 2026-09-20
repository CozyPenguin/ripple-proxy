import { createServer } from "node:http";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { server as wispServer } from "@mercuryworkshop/wisp-js";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const app = express();
app.disable("x-powered-by");

// Cross-origin isolation so the transport workers run with full privileges.
app.use((req, res, next) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	next();
});

// Serve the UI first; public/uv/ holds the vendored Ultraviolet client build,
// whose uv.config.js overrides any stock one.
app.use(
	express.static(join(root, "public"), {
		setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
	})
);
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/static/", express.static(join(root, "static")));

app.use((req, res) => {
	res.status(404);
	res.sendFile(join(root, "public", "404.html"));
});

const server = createServer();

server.on("request", (req, res) => {
	app(req, res);
});

server.on("upgrade", (req, socket, head) => {
	const path = (req.url || "").replace(/\/+$/, "");
	if (path === "/wisp") {
		wispServer.routeRequest(req, socket, head);
		return;
	}
	socket.end();
});

const port = Number.parseInt(process.env.PORT || "", 10) || 8080;

server.listen({ port, host: "0.0.0.0" }, () => {
	console.log("Ripple proxy listening on:");
	console.log(`  http://localhost:${port}`);
	console.log(`  http://${hostname()}:${port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("Shutting down…");
	server.close();
	process.exit(0);
}
