// Ripple "PC as server" tool: starts the local proxy server + a Cloudflare
// quick tunnel, publishes the tunnel's wss endpoint into static/wisp-config.json
// (which the deployed static app fetches at runtime), and pushes it so the
// live deployment always points at this machine while it's running.
//
// Usage:  node scripts/tunnel.cjs
// Stop with Ctrl+C — children are shut down. NOTE: a quick-tunnel URL changes
// every run; the script pushes the new one automatically.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const root = path.join(__dirname, "..");
const cfgPath = path.join(root, "static", "wisp-config.json");
const CLOUDFLARED =
	process.env.CLOUDFLARED_PATH || "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";

const children = [];
let pushed = false;

function run(cmd, args, opts = {}) {
	const child = spawn(cmd, args, { cwd: root, shell: false, ...opts });
	children.push(child);
	return child;
}

function log(line) {
	process.stdout.write("[tunnel] " + line + "\n");
}

async function firstMatch(child, pattern, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("timed out waiting for " + pattern)),
			timeoutMs
		);
		const onChunk = (chunk) => {
			const m = String(chunk).match(pattern);
			if (m) {
				clearTimeout(timer);
				child.stdout.off("data", onChunk);
				child.stderr.off("data", onChunk);
				resolve(m[0]);
			}
		};
		child.stdout.on("data", onChunk);
		child.stderr.on("data", onChunk);
	});
}

function git(args) {
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, { cwd: root });
		let out = "";
		child.stdout.on("data", (d) => (out += d));
		child.stderr.on("data", (d) => (out += d));
		child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
	});
}

async function main() {
	// 1. local proxy server
	const server = run(process.execPath, [path.join(root, "src", "index.js")], {
		env: { ...process.env, PORT: process.env.PORT || "8080" },
	});
	server.stdout.on("data", (d) => process.stdout.write("[server] " + d));
	server.stderr.on("data", (d) => process.stdout.write("[server] " + d));
	await firstMatch(server, /listening on/i, 20000);
	log("local server up");

	// 2. cloudflared quick tunnel
	const tunnel = run(CLOUDFLARED, ["tunnel", "--url", "http://localhost:" + (process.env.PORT || "8080"), "--no-autoupdate"]);
	const url = await firstMatch(tunnel, /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i, 60000);
	log("tunnel: " + url);

	// 3. publish the wss endpoint
	const wisp = "wss://" + url.replace(/^https:\/\//i, "") + "/wisp/";
	const cfg = {
		wisp,
		updated: new Date().toISOString(),
		note: "Auto-updated by scripts/tunnel.cjs when the local tunnel restarts.",
	};
	fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, "\t") + "\n");
	log("wrote " + path.relative(root, cfgPath) + " -> " + wisp);

	// 4. push so the live deployment picks it up
	await git(["add", "static/wisp-config.json"]);
	await git(["-c", "user.name=ripple-tunnel", "-c", "user.email=ripple@localhost", "commit", "-m", "tunnel: " + wisp]);
	await git(["push", "origin", "main"]);
	pushed = true;
	log("pushed — live deployment now uses this machine as the wisp server");
	log("frontend: https://cozypenguin.github.io/ripple-proxy/static/index.html");
	log("Keep this window open. Ctrl+C to stop.");
}

main().catch((err) => {
	log("FAILED: " + err.message);
	shutdown(1);
});

const rl = readline.createInterface({ input: process.stdin });
rl.on("SIGINT", () => shutdown(0));

function shutdown(code) {
	for (const c of children) {
		try {
			c.kill();
		} catch {}
	}
	if (!pushed) {
		// restore the config to the fallback server so the live site keeps working
		try {
			fs.writeFileSync(
				cfgPath,
				JSON.stringify(
					{
						wisp: "wss://ela.next-education-learning.sbs/wisp/",
						updated: new Date().toISOString(),
						note: "Fallback community server (tunnel not running).",
					},
					null,
					"\t"
				) + "\n"
			);
			(async () => {
				try {
					await git(["add", "static/wisp-config.json"]);
					await git(["-c", "user.name=ripple-tunnel", "-c", "user.email=ripple@localhost", "commit", "-m", "tunnel stopped: revert to fallback wisp"]);
					await git(["push", "origin", "main"]);
					log("reverted live config to fallback server");
				} catch {}
				process.exit(code);
			})();
			return;
		} catch {}
	}
	process.exit(code);
}
