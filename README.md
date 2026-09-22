# Hot Cache Hub

A cache-first hot-topic page deployed on GitHub Pages.

## How it works

- GitHub Actions refreshes public hotspot sources once every 24 hours.
- The generated `data/hotspots.json` is deployed as a static cache.
- If every upstream request fails, the workflow keeps the last restored cache instead of blanking the page.
- `workflow_dispatch` is enabled so you can refresh manually from the Actions tab.

Current sources:

- Hacker News official Firebase API
- DEV Community public API

## Local

```bash
npm run refresh
npm run build
```

Serve the `dist/` directory with any static HTTP server.

## Schedule

`.github/workflows/pages.yml` runs once per day at `00:17 UTC`. GitHub scheduled workflows can be delayed during busy periods, so this is approximately every 24 hours rather than a hard real-time timer.
