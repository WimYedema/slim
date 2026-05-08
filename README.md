# Slim -- Lean PO Planning

> **[!] Experimental** -- Slim is a personal playground / proof of concept. It is not ready for production use. APIs, data formats, and localStorage keys may change without notice. Use it to explore the ideas, not to run your actual planning.

Slim is a planning tool for product owners, covering the opportunity lifecycle from first spark to fulfilled promise. It models **Opportunities** (value axis) and **Deliverables** (work axis) connected by a many-to-many link graph.

**[Try it live ->](https://wimyedema.github.io/slim/)**

## What it does

- **5-stage pipeline** -- Explore -> Sketch -> Validate -> Decompose -> Deliver, with consent-based gating
- **Signal grid** -- 3 perspectives (desirability / feasibility / viability) x 4 analysis stages, scored as positive / uncertain / negative
- **Deliverable matrix** -- T-shirt sized work items linked to opportunities
- **Meeting prep** -- per-person agendas with change detection and inline scoring
- **Briefing view** -- board-wide news feed with 5 importance tiers
- **P2P sharing** -- encrypted board publishing via Nostr relays, contributor scoring mode
- **Fully local** -- all data in localStorage, deployed as a single static HTML file

## Quick start

```sh
npm install
npm run dev        # start dev server at localhost:5173
```

## Build

```sh
npm run build      # production build -> dist/index.html (single file)
npm run check      # svelte-check + tsc
npm run lint       # biome check
npm run test       # vitest
```

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript (strict) |
| UI | Svelte 5 (runes) |
| Build | Vite + vite-plugin-singlefile |
| Lint | Biome |
| Test | Vitest |
| P2P | nostr-tools |

## Documentation

| Document | Description |
|---|---|
| [PRODUCT-GUIDE](docs/PRODUCT-GUIDE.md) | Non-technical product introduction |
| [PRODUCT](docs/PRODUCT.md) | Product concept and theory |
| [USER-JOURNEYS](docs/USER-JOURNEYS.md) | Feature walkthrough |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Architecture decisions |
| [UX-PRINCIPLES](docs/UX-PRINCIPLES.md) | Design governance |
| [UX-REVIEW](docs/UX-REVIEW.md) | Persona-based UX review |
| [SAMPLE-SCENARIO](docs/SAMPLE-SCENARIO.md) | Demo data scenario |

## License

[MIT](LICENSE)
