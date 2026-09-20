"use strict";

const $ = (id) => document.getElementById(id);

// Everything lives next to this file, whatever the host path depth is.
const ROOT = new URL("./", location).pathname;

const form = $("uv-form");
const addressInput = $("uv-address");
const engineSelect = $("uv-search-engine");
const engineMirror = $("engine-mirror");
const wispInput = $("wisp-url");
const loadIconInput = $("load-icon-url");
const errorText = $("uv-error");
const swDot = $("sw-dot");
const swText = $("sw-text");
const status = $("status");

const tabList = $("tab-list");
const home = $("home");
const viewport = $("viewport");
const barForm = $("bar-form");
const barAddress = $("bar-address");
const frame = $("uv-frame");
const progress = document.querySelector("#progress span");
const bootVeil = $("boot-veil");
const frameVeil = $("frame-veil");
const themeSwatches = $("theme-swatches");

const PREFIX = __uv$config.prefix;
const connection = new BareMux.BareMuxConnection(ROOT + "baremux/worker.js");

let ready = false;
let frameURL = ""; // raw URL currently loaded in the iframe
let nextTabId = 1;

/* ---------- themes ---------- */

const THEMES = [
	{ id: "midnight", color: "#f5f5f5", label: "Midnight" },
	{ id: "paper", color: "#1a1a1a", label: "Paper" },
	{ id: "ocean", color: "#7dd3fc", label: "Ocean" },
	{ id: "forest", color: "#86efac", label: "Forest" },
	{ id: "sunset", color: "#fb923c", label: "Sunset" },
	{ id: "grape", color: "#c4b5fd", label: "Grape" },
];

function applyTheme(id) {
	const theme = THEMES.find((t) => t.id === id) || THEMES[0];
	document.documentElement.setAttribute("data-theme", theme.id);
	for (const sw of themeSwatches.children) {
		sw.classList.toggle("active", sw.dataset.theme === theme.id);
	}
	try {
		localStorage.setItem("ripple-theme", theme.id);
	} catch {}
}

try {
	applyTheme(localStorage.getItem("ripple-theme") || "midnight");
} catch {
	applyTheme("midnight");
}

for (const theme of THEMES) {
	const sw = document.createElement("button");
	sw.className = "swatch";
	sw.dataset.theme = theme.id;
	sw.title = theme.label;
	sw.setAttribute("aria-label", theme.label + " theme");
	sw.style.background = theme.color;
	sw.addEventListener("click", () => applyTheme(theme.id));
	themeSwatches.appendChild(sw);
}

/* ---------- custom loading icon ---------- */

function applyLoadIcon(url) {
	for (const img of document.querySelectorAll(".load-img")) {
		if (url) {
			img.src = url;
			img.hidden = false;
			img.onerror = () => {
				img.hidden = true;
			};
		} else {
			img.removeAttribute("src");
			img.hidden = true;
		}
	}
	for (const ripple of document.querySelectorAll(".load-ripple")) {
		ripple.style.display = url ? "none" : "";
	}
}

try {
	applyLoadIcon(localStorage.getItem("ripple-load-icon") || "");
	loadIconInput.value = localStorage.getItem("ripple-load-icon") || "";
} catch {}

/* ---------- wisp server ---------- */

const DEFAULT_PUBLIC_WISP = "wss://ela.next-education-learning.sbs/wisp/";

function isLocalHost() {
	return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

// On localhost, use the bundled server. Elsewhere, prefer the wisp endpoint
// published in wisp-config.json (kept current by scripts/tunnel.cjs when the
// owner's machine is running its Cloudflare tunnel), falling back to the
// default community server.
function defaultWisp() {
	if (isLocalHost()) {
		return (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
	}
	return DEFAULT_PUBLIC_WISP;
}

function getStoredWisp() {
	try {
		return localStorage.getItem("ripple-wisp") || "";
	} catch {
		return "";
	}
}

async function discoverWisp() {
	if (isLocalHost()) return defaultWisp();
	try {
		const res = await fetch(ROOT + "wisp-config.json?cb=" + Date.now(), { cache: "no-store" });
		const cfg = await res.json();
		if (cfg && typeof cfg.wisp === "string" && /^wss:\/\//.test(cfg.wisp)) {
			return cfg.wisp;
		}
	} catch {}
	return DEFAULT_PUBLIC_WISP;
}

function getWisp() {
	return getStoredWisp() || defaultWisp();
}

// A wisp server may be saved in localStorage but dead (it happens — community
// servers come and go). Probe candidates in order and use the first one whose
// WebSocket actually opens; otherwise fall back to the first candidate so the
// error the user sees matches their explicit choice.
async function probeWisp(url, timeoutMs = 6000) {
	return new Promise((resolve) => {
		let settled = false;
		const done = (v) => {
			if (!settled) {
				settled = true;
				resolve(v);
			}
		};
		try {
			const ws = new WebSocket(url);
			const t = setTimeout(() => {
				try {
					ws.close();
				} catch {}
				done(false);
			}, timeoutMs);
			ws.onopen = () => {
				clearTimeout(t);
				try {
					ws.close();
				} catch {}
				done(true);
			};
			ws.onerror = () => {
				clearTimeout(t);
				done(false);
			};
			ws.onclose = () => {
				clearTimeout(t);
				done(false);
			};
		} catch {
			done(false);
		}
	});
}

async function resolveWisp() {
	const candidates = [];
	const stored = getStoredWisp();
	if (stored) candidates.push(stored);
	const discovered = await discoverWisp();
	if (!candidates.includes(discovered)) candidates.push(discovered);
	if (!candidates.includes(DEFAULT_PUBLIC_WISP)) candidates.push(DEFAULT_PUBLIC_WISP);

	for (const candidate of candidates) {
		if (await probeWisp(candidate)) return candidate;
	}
	return candidates[0];
}

/* ---------- tabs ---------- */

const tabs = []; // { id, url (raw), title }
let activeId = null;

function activeTab() {
	return tabs.find((t) => t.id === activeId);
}

function newTab(focus = true) {
	const tab = { id: nextTabId++, url: "", title: "New tab" };
	tabs.push(tab);
	renderTabs();
	activateTab(tab.id);
	if (focus) addressInput.focus();
	return tab;
}

function closeTab(id) {
	const idx = tabs.findIndex((t) => t.id === id);
	if (idx === -1) return;
	tabs.splice(idx, 1);
	if (tabs.length === 0) {
		newTab();
		return;
	}
	if (id === activeId) {
		activateTab(tabs[Math.max(0, idx - 1)].id);
	} else {
		renderTabs();
	}
}

function activateTab(id) {
	activeId = id;
	const tab = activeTab();
	renderTabs();
	if (!tab || !tab.url) {
		showHome();
	} else {
		showBrowser();
		barAddress.value = tab.url;
		if (frameURL !== tab.url) loadIntoFrame(tab.url);
	}
}

function renderTabs() {
	tabList.textContent = "";
	for (const tab of tabs) {
		const el = document.createElement("div");
		el.className = "tab" + (tab.id === activeId ? " active" : "");
		el.setAttribute("role", "tab");
		el.setAttribute("title", tab.url || "New tab");

		const diamond = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		diamond.setAttribute("viewBox", "0 0 24 24");
		diamond.setAttribute("width", "13");
		diamond.setAttribute("height", "13");
		diamond.innerHTML =
			'<path d="M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z" fill="currentColor"/>';
		el.appendChild(diamond);

		const title = document.createElement("span");
		title.className = "tab-title";
		title.textContent = tab.title || "New tab";
		el.appendChild(title);

		const close = document.createElement("button");
		close.className = "tab-close";
		close.setAttribute("aria-label", "Close tab");
		close.innerHTML =
			'<svg viewBox="0 0 24 24" width="11" height="11"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
		close.addEventListener("click", (e) => {
			e.stopPropagation();
			closeTab(tab.id);
		});
		el.appendChild(close);

		el.addEventListener("click", () => activateTab(tab.id));
		tabList.appendChild(el);
	}
}

function showHome() {
	document.body.classList.remove("browsing");
	home.classList.remove("away");
	setTimeout(() => {
		if (!activeTab()?.url) viewport.hidden = true;
	}, 350);
	addressInput.focus();
}

function showBrowser() {
	viewport.hidden = false;
	home.classList.add("away");
	document.body.classList.add("browsing");
}

function loadIntoFrame(url) {
	frameURL = url;
	startProgress();
	frame.src = PREFIX + __uv$config.encodeUrl(url);
	// only veil if the page is slow — avoids flashing on fast loads
	showFrameVeil.t = setTimeout(() => {
		if (frameURL === url) frameVeil.hidden = false;
	}, 500);
}

/* ---------- boot: register the service worker and transport up front ---------- */

window.addEventListener("load", async () => {
	setStatus("", "Starting…");
	try {
		await registerSW();
		// Probe stored > discovered (owner's tunnel) > default; use the first
		// server that actually accepts a connection.
		const wispUrl = await resolveWisp();
		if ((await connection.getTransport()) !== ROOT + "epoxy/index.mjs") {
			await connection.setTransport(ROOT + "epoxy/index.mjs", [{ wisp: wispUrl }]);
		}
		ready = true;
		setStatus("ready", "Connected");
		updateAbout();
		hideBootVeil();
		setTimeout(() => (status.style.opacity = "0"), 2500);
	} catch (err) {
		ready = false;
		setStatus("error", "Proxy unavailable: " + err.message);
		showError(String(err));
		updateAbout();
		hideBootVeil();
	}
});

// never leave the user staring at the boot veil
setTimeout(hideBootVeil, 7000);

function hideBootVeil() {
	if (bootVeil) bootVeil.hidden = true;
}

function showFrameVeil() {
	clearTimeout(showFrameVeil.t);
	frameVeil.hidden = false;
}

function hideFrameVeil() {
	clearTimeout(showFrameVeil.t);
	frameVeil.hidden = true;
}

function setStatus(cls, text) {
	swDot.className = "dot" + (cls ? " " + cls : "");
	swText.textContent = text;
	status.title = text;
}

function updateAbout() {
	$("about-status").innerHTML = ready
		? "Status: <b>connected</b> via " + getWisp()
		: "Status: <b>not connected</b> — " + swText.textContent;
}

function showError(msg) {
	errorText.hidden = false;
	errorText.textContent = msg;
}

/* ---------- search engine ---------- */

try {
	const saved = localStorage.getItem("ripple-engine");
	if (saved) {
		engineSelect.value = saved;
		engineMirror.value = saved;
	}
	wispInput.value = getWisp();
} catch {}

function setEngine(value) {
	engineSelect.value = value;
	engineMirror.value = value;
	try {
		localStorage.setItem("ripple-engine", value);
	} catch {}
}

engineSelect.addEventListener("change", () => setEngine(engineSelect.value));
engineMirror.addEventListener("change", () => setEngine(engineMirror.value));

/* ---------- settings (wisp server can be swapped without a reload) ---------- */

$("settings-save").addEventListener("click", async () => {
	const next = wispInput.value.trim();
	const icon = loadIconInput.value.trim();
	$("settings-modal").hidden = true;

	// loading icon: accept http(s) or data:image URIs only
	if (icon && !/^(https?:\/\/|data:image\/)/i.test(icon)) {
		showError("Loading icon must be an http(s) or data:image URL.");
	} else {
		errorText.hidden = true;
		try {
			if (icon) localStorage.setItem("ripple-load-icon", icon);
			else localStorage.removeItem("ripple-load-icon");
		} catch {}
		applyLoadIcon(icon);
	}

	if (!next) {
		try {
			localStorage.removeItem("ripple-wisp");
		} catch {}
		return;
	}
	setStatus("", "Testing " + next + "…");
	status.style.opacity = "1";
	if (await probeWisp(next)) {
		try {
			localStorage.setItem("ripple-wisp", next);
		} catch {}
		if (ready) {
			await connection.setTransport(ROOT + "epoxy/index.mjs", [{ wisp: next }]);
			setStatus("ready", "Connected");
			setTimeout(() => (status.style.opacity = "0"), 2000);
		}
	} else {
		// keep the old setting; the dead URL was not saved
		setStatus(ready ? "ready" : "error", "That server did not respond — not saved");
		setTimeout(updateAbout, 2500);
	}
});

$("load-icon-default").addEventListener("click", () => {
	loadIconInput.value = "";
	try {
		localStorage.removeItem("ripple-load-icon");
	} catch {}
	applyLoadIcon("");
});

/* ---------- navigation ---------- */

function navigate(url) {
	const tab = activeTab() || newTab(false);
	tab.url = url;
	tab.title = hostnameOf(url);
	renderTabs();
	showBrowser();
	barAddress.value = url;
	loadIntoFrame(url);
}

function hostnameOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

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

$("btn-new-tab").addEventListener("click", () => newTab());

$("btn-back").addEventListener("click", () => frame.contentWindow?.history.back());
$("btn-forward").addEventListener("click", () => frame.contentWindow?.history.forward());
$("btn-reload").addEventListener("click", () => {
	if (frameURL) frame.contentWindow?.location.reload();
});
$("btn-open").addEventListener("click", () => {
	if (frameURL) window.open(PREFIX + __uv$config.encodeUrl(frameURL), "_blank");
});

/* ---------- modals ---------- */

function bindModal(openBtn, modal, closeBtn) {
	$(openBtn).addEventListener("click", () => ( $(modal).hidden = false ));
	$(closeBtn).addEventListener("click", () => ( $(modal).hidden = true ));
	$(modal).addEventListener("click", (e) => {
		if (e.target === $(modal)) $(modal).hidden = true;
	});
}

bindModal("btn-settings", "settings-modal", "settings-save");
bindModal("btn-about", "about-modal", "about-close");

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
	hideFrameVeil();
	const tab = activeTab();
	if (!tab || !frameURL) return;
	tab.url = frameURL;
	try {
		const loc = frame.contentWindow.location;
		if (loc.pathname.startsWith(PREFIX)) {
			const decoded = Ultraviolet.codec.xor.decode(
				loc.pathname.slice(PREFIX.length) + loc.search
			);
			if (decoded) {
				frameURL = decoded;
				tab.url = decoded;
				barAddress.value = decoded;
			}
		}
		tab.title = frame.contentDocument.title || hostnameOf(tab.url);
	} catch {
		tab.title = hostnameOf(tab.url);
	}
	renderTabs();
});

/* ---------- start ---------- */

newTab();
