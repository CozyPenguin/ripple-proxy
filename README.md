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
