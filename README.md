# Ripple — liquid-fast Ultraviolet proxy

A simple, self-hostable web proxy with a **liquid-smooth UI** and **fast proxy connections**.

- **Ultraviolet** v3 client (service-worker based URL rewriting — supports Google, YouTube, Discord, Reddit, Spotify…)
- **wisp** protocol with the **epoxy** transport — a persistent, multiplexed connection that stays fast
- Animated glass/liquid interface: drifting gradient blobs, springy transitions, glass omnibox
- Built-in browser view with back / forward / reload / home, address bar, progress line, and open-in-new-tab
- Search-engine picker (DuckDuckGo, Google, Bing, Brave), remembered between visits
- Quick-launch tiles for popular sites

## Quick start

```sh
npm install
npm start
```

Open <http://localhost:8080>, wait for the green **Connected** dot, and browse.
Service workers require **https or localhost** — for LAN testing use a port-forwarding
proxy or deploy behind TLS.

### Configuration

| Variable | Default  | Meaning          |
| -------- | -------- | ---------------- |
| `PORT`   | `8080`   | HTTP listen port |

## Static deployment (GitHub Pages / any static host)

The `static/` folder is a **fully standalone build** that needs no Node server at
all: the whole proxy runs in your browser via the service worker, and traffic
tunnels through a **wisp server** you choose in **Settings → Wisp server**
(`wss://` on https hosts, `ws://` on http/localhost — the wrong scheme will not
connect). On localhost it auto-uses the bundled server's `/wisp/` endpoint.

**Live deployment** (this repo has GitHub Pages enabled on `main`):

```
https://cozypenguin.github.io/ripple-proxy/static/index.html
```

Why not jsDelivr? `cdn.jsdelivr.net` serves `.html` as `text/plain` (deliberate
security policy), so a service-worker app can't run on it directly — jsDelivr
still works great for the raw JS/asset files. GitHub Pages, Netlify, Vercel or
Cloudflare Pages all host the folder as-is; all paths are computed from the
page's own URL, so any host and folder depth works.

The default remote wisp is a third-party community server and may go down —
swap it in Settings, or self-host this repo's own wisp server (`npm start`) and
point the deployment at it for a fully self-owned setup.

## Pure jsDelivr build (`static/cdn.svg`)

jsDelivr refuses to serve `.html` (it's sent as `text/plain`), but it serves
`.svg` normally — and a top-level SVG document is a real scripting context with
full HTML rendering via `foreignObject`. So the app lives in a single SVG file
that fetches `index.html` at runtime and boots the whole thing (UI, service
worker, proxied pages) **entirely on cdn.jsdelivr.net's own origin**:

```
https://cdn.jsdelivr.net/gh/CozyPenguin/ripple-proxy@v1.2/static/cdn.svg
```

The page also loads its app script from jsDelivr in `static/jsdelivr.html`
(the `sw.js`/`uv/` files must stay same-origin by browser rule).

Gotchas this build works around (see `static/cdn.svg` and `static/cdn-config.js`):

- jsDelivr (and some networks' CSP) block `eval`, which parts of the UV bundle
  need — so the page uses an eval-free inline copy of the XOR codec
  (`cdn-config.js`); the real bundle still loads inside the service worker,
  where CSP doesn't apply.
- SVG documents have no `document.body`, create SVG-namespaced elements, and
  `register()`'s promise can stall — all polyfilled/worked around inline.

**Updating:** jsDelivr caches `@main` for up to 12h. Tag a new version instead
(`git tag v1.2 && git push origin v1.2`) and use `@v1.2` — new tags are served
immediately. You can also purge a path via
`https://purge.jsdelivr.net/gh/CozyPenguin/ripple-proxy@main/static/<file>`.
`scripts/sync-ui.cjs` regenerates `public/` and `static/jsdelivr.html` from the
canonical `static/index.html` after UI edits.

## Use your own PC as the wisp server

```sh
npm run tunnel
```

Starts the local proxy server plus a Cloudflare quick tunnel (no account
needed; requires [cloudflared](https://developers.cloudflare.com/cloudflare/one/connections/connect-networks/downloads/)
— `winget install Cloudflare.cloudflared`), then publishes the resulting
`wss://…trycloudflare.com/wisp/` endpoint to `static/wisp-config.json` and pushes
it. The live deployment discovers it automatically and routes through your
machine until you press Ctrl+C (which reverts the live config to the fallback
community server). Quick-tunnel hostnames change on every run — the script
handles that for you; for a permanent endpoint, use a named Cloudflare Tunnel
with your own domain.

## Docker

```sh
docker build -t ripple .
docker run -p 8080:8080 ripple
```

## Deploying

Any Node 18+ host works. The wisp endpoint rides a WebSocket upgrade on `/wisp/`,
so the host must allow WebSocket connections — all common PaaS providers do.
Put the app behind TLS in production (e.g. Cloudflare, Caddy, or the platform's
built-in terminator); the client auto-upgrades `ws` → `wss`.

## Project layout

```
src/index.js        express + wisp server (serves UI, /epoxy/, /baremux/, /wisp/)
public/             the liquid UI (vanilla HTML/CSS/JS, no build step)
public/uv/          vendored Ultraviolet v3 client build + uv.config.js
public/baremux, public/epoxy  served from node_modules by the server
static/             standalone build for static CDNs (jsDelivr, GitHub Pages):
                    vendored uv/baremux/epoxy + self-locating uv.config.js;
                    tunnels through a configurable remote wisp server
```

## Updating the Ultraviolet client

`public/uv/` contains a vendored build. To refresh it:

```sh
git clone --depth 1 https://github.com/titaniumnetwork-dev/ultraviolet
cd ultraviolet && npm install && npm run build
cp dist/* ../uv-proxy/public/uv/
```

## Troubleshooting

- **"Proxy unavailable" / red dot** — the page isn't on https or localhost, so the
  service worker can't register.
- **Sites fail to load** — check that your host allows outbound TCP; the server only
  brokers connections, it does not cache or filter.
- **Stale UI after an update** — static files are served `no-store`, so a reload is enough.
- **`TypeError: headers is not iterable` inside proxied pages** — you bumped
  `@mercuryworkshop/epoxy-transport` to v3, which changed its transport interface and is
  incompatible with the bare-mux client bundled in Ultraviolet 3.2.x. Stay on the pinned
  `2.1.28`.

## Credits & licenses

Built on [Ultraviolet](https://github.com/titaniumnetwork-dev/ultraviolet) (MIT) by
TitaniumNetwork and [bare-mux](https://github.com/MercuryWorkshop/bare-mux) /
[epoxy](https://github.com/MercuryWorkshop/epoxy-transport) (AGPL-3.0) by Mercury
Workshop, speaking the [wisp](https://github.com/MercuryWorkshop/wisp) protocol.
The UI and server code in this repo are MIT.
