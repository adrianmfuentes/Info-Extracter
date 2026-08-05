# IP Info Extracter

A lightweight, single-page web app for looking up geolocation, ISP, and fraud/risk intelligence for any IPv4 or IPv6 address. No build step, no backend — just static HTML, CSS, and vanilla JavaScript.

Live demo: [adrianmfuentes.github.io/Info-Extracter](https://adrianmfuentes.github.io/Info-Extracter)

## Features

- **IP lookup** — enter any IPv4/IPv6 address, or click "My IP" to detect your own
- **Location data** — country (with flag), state, city, postal code, coordinates, timezone, and local time, with a link to view the location on OpenStreetMap
- **ISP data** — ASN, organization, and ISP name
- **Risk assessment** — a 0–100 risk score with an animated gauge, plus flags for VPN, proxy, Tor, datacenter, and mobile connections
- **Compare multiple IPs** — enter up to 6 IPs separated by commas to see them side by side, each with location, ISP, and risk badge
- **Export results** — download the current lookup (or comparison) as JSON or CSV
- **Recent searches with notes** — the last 8 lookups are saved locally as quick-access chips; click the tag icon on any chip to attach a short note (e.g. "office", "suspicious")
- **Light/dark theme** — toggle manually, with the OS preference used as the default
- **Shareable URLs** — looking up an IP (or a comparison) updates the URL query string (`?ip=...` or `?ips=...`) so results can be linked directly
- **Keyboard shortcuts** — press `/` to focus the search input, `Esc` to blur it
- **Copy to clipboard** — one-click copy of the looked-up IP address

## Getting started

This is a static site with no dependencies or build tooling required.

```bash
git clone https://github.com/adrianmfuentes/Info-Extracter.git
cd Info-Extracter
```

Then open `index.html` directly in a browser, or serve the folder locally, e.g.:

```bash
npx serve .
# or
python -m http.server 8000
```

## Deployment

The `master` branch auto-deploys to GitHub Pages via the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push.

## How it works

All data is fetched client-side from the free [ipquery.io](https://ipquery.io) API (`https://api.ipquery.io/`). There is no server component — `app.js` validates the input IP, calls the API, and renders the response into the location, ISP, and risk cards. A strict `Content-Security-Policy` in `index.html` restricts script/style origins and limits network requests to the ipquery.io API.

## Project structure

```
.
├── index.html    # Markup and layout
├── style.css     # Theming, layout, and animations
├── app.js        # Lookup logic, rendering, theme, and recent-searches state
├── favicon.svg   # Site icon
└── .github/workflows/deploy.yml  # GitHub Pages deployment
```

## Tech stack

Vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no dependencies.

## License

No license has been specified for this project yet.
