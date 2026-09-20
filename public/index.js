"use strict";

const $ = (id) => document.getElementById(id);

const form = $("uv-form");
const addressInput = $("uv-address");
const engineSelect = $("uv-search-engine");
const errorText = $("uv-error");
const swDot = $("sw-dot");
const swText = $("sw-text");

const hero = $("hero");
const browserbar = $("browserbar");
const browser = $("browser");
const barForm = $("bar-form");
const barAddress = $("bar-address");
const frame = $("uv-frame");
const progress = document.querySelector("#progress span");

const PREFIX = __uv$config.prefix;
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

let ready = false;
let currentURL = "";

// Restore the engine the user picked last time.
try {
	const saved = localStorage.getItem("ripple-engine");
	if (saved) engineSelect.value = saved;
} catch {}

engineSelect.addEventListener("change", () => {
	try {
		localStorage.setItem("ripple-engine", engineSelect.value);
	} catch {}
});

/* ---------- boot: register the service worker and transport up front ---------- */

window.addEventListener("load", async () => {
	setStatus("", "Starting…");
	try {
		await registerSW();
		const wispUrl =
			(location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}
		ready = true;
		setStatus("ready", "Connected — proxy ready");
	} catch (err) {
		ready = false;
		setStatus("error", "Proxy unavailable: " + err.message);
		showError(String(err));
	}
});

function setStatus(cls, text) {
	swDot.className = "dot" + (cls ? " " + cls : "");
	swText.textContent = text;
}

function showError(msg) {
	errorText.hidden = false;
	errorText.textContent = msg;
}

/* ---------- navigation ---------- */

form.addEventListener("submit", (event) => {
	event.preventDefault();
	const url = search(addressInput.value, engineSelect.value);
	if (url) navigate(url);
});

barForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const url = search(barAddress.value, engineSelect.value);
	if (url) navigate(url);
});

document.querySelectorAll(".quicklinks button").forEach((btn) => {
	btn.addEventListener("click", () => navigate(btn.dataset.url));
});

$("btn-back").addEventListener("click", () => frame.contentWindow?.history.back());
$("btn-forward").addEventListener("click", () => frame.contentWindow?.history.forward());
$("btn-reload").addEventListener("click", () => frame.contentWindow?.location.reload());
$("btn-home").addEventListener("click", goHome);
$("btn-open").addEventListener("click", () => {
	if (currentURL) window.open(PREFIX + __uv$config.encodeUrl(currentURL), "_blank");
});

function navigate(url) {
	if (!ready) {
		showError("The proxy is still connecting — try again in a moment.");
		return;
	}
	errorText.hidden = true;
	currentURL = url;

	enterBrowserView();
	startProgress();
	barAddress.value = url;
	frame.src = PREFIX + __uv$config.encodeUrl(url);
}

function enterBrowserView() {
	document.body.classList.add("browsing");
	hero.classList.add("away");
	browserbar.hidden = false;
	browser.hidden = false;
	// Let the layout apply before animating in.
	requestAnimationFrame(() => {
		browserbar.classList.add("show");
		browser.classList.add("show");
	});
}

function goHome() {
	currentURL = "";
	try {
		frame.contentWindow?.location.replace("about:blank");
	} catch {}
	document.body.classList.remove("browsing");
	browserbar.classList.remove("show");
	browser.classList.remove("show");
	setTimeout(() => {
		if (!currentURL) {
			browserbar.hidden = true;
			browser.hidden = true;
		}
	}, 500);
	hero.classList.remove("away");
	addressInput.focus();
}

/* ---------- progress + address bar sync ---------- */

function startProgress() {
	progress.style.opacity = "1";
	progress.style.transform = "scaleX(0.35)";
}

function finishProgress() {
	progress.style.transform = "scaleX(1)";
	setTimeout(() => {
		progress.style.opacity = "0";
		progress.style.transform = "scaleX(0)";
	}, 350);
}

frame.addEventListener("load", () => {
	finishProgress();
	if (!currentURL) return;
	try {
		const loc = frame.contentWindow.location;
		if (loc.pathname.startsWith(PREFIX)) {
			const decoded = Ultraviolet.codec.xor.decode(
				loc.pathname.slice(PREFIX.length) + loc.search
			);
			if (decoded) {
				currentURL = decoded;
				barAddress.value = decoded;
			}
		}
	} catch {
		// about:blank or transient cross-origin state — keep the last value
	}
});
