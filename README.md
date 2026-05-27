# Ghost in the Bit

> Field notebook and browser-based investigation workbench for practicing scraping, abuse, and fraud detection.

Live site: **[ghostinthebit.com](https://ghostinthebit.com)**

This repository powers two things:

1. **The blog** — short, practical writeups of offensive security work, anti-scraping research, and investigation patterns.
2. **The Phantom Feed platform** — a scenario-driven SQL workbench that runs entirely in the browser. Pick a synthetic HTTP log dataset, write SQL, find the bad actor.

---

## What's here

```
/                                 Landing page, about, blog index
├── .nojekyll                     Tells GitHub Pages to skip Jekyll processing
├── CNAME                         ghostinthebit.com
├── index.html                    Landing page
├── about.html                    About page
├── blog/
│   ├── index.html                Blog post list
│   └── *.html                    Individual blog posts
├── platform/
│   ├── console.html              The investigation workbench (one page for every scenario)
│   ├── lib/                      ES modules: sqlite-engine, editor, results, history, scenarios, site-nav, console-app
│   └── styles/                   core.css (design system) + console.css (workbench)
├── scenarios/
│   ├── registry.json             List of available scenarios
│   ├── 01-logged-out-scrape/     Logged-out web scrape (beginner, ~45 min)
│   ├── 02-logged-in-mobile-scrape/   Authenticated API abuse (intermediate, ~60 min)
│   ├── 03-insider-exfil/         Multi-table insider exfiltration (intermediate, ~75 min)
│   └── 04-living-investigation/  30-day cat-and-mouse capstone (hard, ~120 min)
└── images/                       Diagrams and screenshots
```

## Scenarios

Each scenario has the same structure:

- `data.db.gz` — gzipped SQLite database. The platform fetches and decompresses it in the browser, then drives an in-memory sql.js instance against it.
- `scenario.json` — manifest with hints, sample queries, schema notes, and difficulty metadata.
- `instructions.html` — the scenario brief shown on the platform.

### 01 — Logged-out web scrape (beginner)

A distributed scraper walking a public profile endpoint across hundreds of residential-proxy IPs. The bad actor is isolable but only if you stack the right signals: empty cookie state, residential-proxy ASN concentration, single URI template walked sequentially, and a TLS fingerprint that collides with legitimate Chrome traffic on purpose.

### 02 — Logged-in mobile API abuse (intermediate)

A malicious partner integration enumerating partner-scoped endpoints across thousands of user accounts from a small datacenter IP pool. Forces investigators past simple per-IP filtering and into multi-signal attribution. The JA4 fingerprint is the giveaway, but you have to know what to compare it against.

### 03 — Insider data exfiltration (intermediate)

Sixty days of authenticated traffic across five related tables: employees, endpoints, data classification, access logs, query audit. One employee's behavior diverges from their own multi-week baseline. Two other employees look superficially suspicious but have documented business reasons for their changes. Tests per-employee baselining, multi-table joins, and false-positive reasoning.

### 04 — The Living Investigation (hard, capstone)

Thirty days of an evolving attack. Defenders deploy a sequence of countermeasures and the attacker pivots around each one. Investigators reconstruct the full timeline from the logs alone: which defenses fired when, which adaptations the attacker made in response, and which moves cost the attacker the most.

## The platform

`platform/console.html` is the investigation workbench. It runs entirely client-side:

- **sql.js** (WebAssembly SQLite) loaded from cdnjs
- **Ace editor** for SQL with autocompletion, table-aware schema completion, and keyboard shortcuts
- **Tabbed query buffers** with browser-local persistence
- **History panel** with re-run, rename, and pin
- **Schema panel** showing live table introspection
- **Results panel** with CSV export and inline error rendering

No data leaves the browser. No analytics on the platform itself (the marketing pages have privacy-friendly analytics; the workbench does not).

## Blog

Posts live in `/blog/`.

## Newsletter

Signup forms appear on the landing page, about page, and every blog post. Subscriptions are handled by Buttondown (free tier under 100 subscribers). One newsletter goes out per month with new posts and scenario announcements.

## Synthetic data and generators

The scenarios in this repo ship with pre-generated SQLite datasets. The Python tools that generated them live in a separate repository so the generator source does not sit next to the investigation interface:

**[github.com/GhostsintheBit/phantomfeed-generators](https://github.com/GhostsintheBit/phantomfeed-generators)**

Anyone who wants to inspect how the data is built, extend the generators, or build their own scenarios from the same building blocks can find everything there.

## Local development

```bash
git clone https://github.com/GhostsintheBit/ghostsinthebit.github.io
cd ghostsinthebit.github.io
python3 -m http.server 8000
# visit http://localhost:8000
```

GitHub Pages serves this site directly with no build step. The `.nojekyll` file at the repo root tells Pages to skip Jekyll processing so files with unusual names (and any future ones starting with `_`) are served as-is.

## Deploying

This repo deploys to GitHub Pages on push to `main`. The CNAME file points the apex domain `ghostinthebit.com` at the Pages-hosted content.

## License

Code in this repo is offered under the MIT license. The blog posts and scenario writeups are (c) Ghost in the Bit and may not be republished without permission.

## Feedback

Found a bug? Have feedback on a scenario or a writeup? Open an issue or email — contact info is in the site footer.
