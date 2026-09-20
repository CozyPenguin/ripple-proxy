"use strict";

const $ = (id) => document.getElementById(id);

const form = $("uv-form");
const addressInput = $("uv-address");
const engineSelect = $("uv-search-engine");
const engineMirror = $("engine-mirror");
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

const PREFIX = __uv$config.prefix;
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

let ready = false;
let frameURL = ""; // raw URL currently loaded in the iframe
let nextTabId = 1;

/* ---------- tabs ---------- */

const tabs = []; // { id, url (raw), title, history: [] }
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
}

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
		setStatus("ready", "Connected");
		updateAbout();
		setTimeout(() => (status.style.opacity = "0"), 2500);
	} catch (err) {
		ready = false;
		setStatus("error", "Proxy unavailable: " + err.message);
		showError(String(err));
		updateAbout();
	}
});

function setStatus(cls, text) {
	swDot.className = "dot" + (cls ? " " + cls : "");
	swText.textContent = text;
	status.title = text;
}

function updateAbout() {
	$("about-status").innerHTML = ready
		? "Status: <b>connected</b> — the proxy is ready."
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

bindModal("btn-settings", "settings-modal", "settings-close");
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
