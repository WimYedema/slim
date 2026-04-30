# Slim -- Copilot Instructions

## Project Overview

Lean planning tool for product owners, covering the workflow *before* the sprint board. Models two entity types -- **Opportunities** (value axis) and **Deliverables** (work axis) -- connected by a many-to-many link graph. Fully local -- all data in localStorage, deployed as a single static HTML file.

See [PRODUCT.md](PRODUCT.md) for product concept and rationale, [ARCHITECTURE.md](ARCHITECTURE.md) for architecture decisions, [USER-JOURNEYS.md](USER-JOURNEYS.md) for feature walkthrough, [PRODUCT-GUIDE.md](PRODUCT-GUIDE.md) for non-technical intro, [UX-REVIEW.md](UX-REVIEW.md) for persona-based review, [UX-PRINCIPLES.md](UX-PRINCIPLES.md) for design governance, [SAMPLE-SCENARIO.md](SAMPLE-SCENARIO.md) for demo data.

## Data Model

### Two axes, many-to-many links

**Opportunities** flow through a 4-stage pipeline: Explore, Sketch, Validate, Decompose.
**Deliverables** are work items linked to opportunities via `OpportunityDeliverableLink` records (coverage: full or partial).

### Signal grid (the core data structure)

Each opportunity has a 4x3 matrix: stages (explore/sketch/validate/decompose) x perspectives (desirability/feasibility/viability). Each cell carries:
- `score`: none | uncertain | positive | negative (consent-based, not numeric)
- `verdict`: one-liner explaining the score
- `evidence`: URL/reference
- `owner`: who provided the signal

### Consent-based gating

Stage advancement requires all three perspectives scored (no `none`) and no objections (no `negative`). `uncertain` counts as consent.

### Key types (all in `src/lib/types.ts`)

| Type | Purpose |
|---|---|
| `Opportunity` | Title, stage, signals, origin, horizon, people, commitments, exit state |
| `Deliverable` | Title, size (T-shirt), certainty (1-5), externalUrl, contributors, consumers |
| `OpportunityDeliverableLink` | Many-to-many with coverage (full/partial) |
| `CellSignal` | Score + verdict + evidence + owner for one grid cell |
| `PersonLink` | Expert/approver/stakeholder with perspective assignments |
| `Commitment` | Promise with deadline and milestone |
| `Stage` | 'explore' | 'sketch' | 'validate' | 'decompose' |
| `Perspective` | 'desirability' | 'feasibility' | 'viability' |
| `OriginType` | 'demand' | 'supply' | 'incident' | 'debt' |
| `ExitState` | 'killed' | 'parked' | 'merged' |
| `AgingLevel` | 'fresh' | 'aging' | 'stale' (computed from days in stage) |

## Tech Stack

| Layer | Tool |
|---|---|
| Language | TypeScript (strict mode) |
| UI framework | Svelte 5 (runes: `$state`, `$derived`, `$effect`) |
| Build | Vite |
| Lint + Format | Biome |
| Unit tests | Vitest |
| Single-file output | vite-plugin-singlefile |

One runtime dependency: `nostr-tools` (P2P relay communication). No server, no database.

## Code Style

- Svelte 5 runes only -- no legacy `$:` reactive statements, no `writable()`/`readable()` stores
- Prefer `$state`, `$derived`, `$effect` for all reactivity
- Use TypeScript strict mode -- no `any`, no `@ts-ignore`
- Prefer `interface` over `type` for object shapes
- Use named exports, no default exports (exception: Svelte components)
- File naming: `kebab-case.ts` for lib files, `PascalCase.svelte` for components

## Architecture

- `src/App.svelte` -- Root component, all state (`$state`), undo stack, persistence, keyboard handling
- `src/components/` -- Svelte components (UI layer)
- `src/lib/` -- Pure TypeScript modules (types, storage, meeting logic, queries)
- Entry point: `index.html` -> `src/main.ts` -> `App.svelte`
- All state lives as `$state` in `App.svelte` -- no external state library, no context API, no stores
- Components receive state via props and emit changes via callback props or by mutating bound props
- Persistence: localStorage (`slim-board`, `slim-meetings`, `slim-sync`), auto-saved in `$effect`

### Module responsibilities

| Module | Purpose | Key exports |
|---|---|---|
| `types.ts` | Data types, constants, factory functions; re-exports query functions from `queries.ts` | `Opportunity`, `Deliverable`, `CellSignal`, `createOpportunity`, `createDeliverable`, `STAGES`, `PERSPECTIVES` |
| `queries.ts` | Pure query/computation functions (26 functions) | `stageConsent`, `daysInStage`, `agingLevel`, `commitmentUrgency`, `linksForOpportunity`, `linksForDeliverable`, `perspectiveWeight`, `ternaryPosition` |
| `store.ts` | localStorage wrappers with schema backfill | `saveBoard`, `loadBoard`, `clearBoard`, `saveMeetingData`, `loadMeetingData`, `BoardData` |
| `meeting.ts` | Meeting agenda computation, person aggregation, snapshot-based change detection | `collectPeople`, `buildMeetingAgenda`, `personUrgency`, `completeMeeting`, `MeetingAgenda`, `MeetingData` |
| `briefing.ts` | Board-wide change detection, importance tier classification, grouping | `snapshotBoard`, `diffBoard`, `deduplicateItems`, `groupItems`, `BoardSnapshot`, `BriefingItem` |
| `crypto.ts` | Room-level encryption using Web Crypto API (HKDF-SHA256 -> AES-256-GCM) | `deriveRoomKey`, `computeDTag`, `encrypt`, `decrypt` |
| `sync.ts` | Nostr relay pub/sub for P2P board sharing and score submission | `generateSyncKeys`, `publishBoard`, `queryBoard`, `publishScores`, `queryScores`, `applyScores` |
| `merge.ts` | ID-based board merge with `updatedAt` conflict resolution | `mergeBoards`, `formatMergeStats`, `MergeResult` |
| `csv.ts` | CSV import/export for opportunities | `opportunitiesToCsv`, `csvToOpportunities` |

### Component responsibilities

| Component | Purpose |
|---|---|
| `BriefingView.svelte` | News feed: board-wide changes, 5 importance tiers, newspaper card layout |
| `PipelineView.svelte` | Opportunities by stage or horizon, nested deliverables, zoom into single group |
| `PipelineFunnel.svelte` | Proportional stage funnel SVG, interactive hover/click filtering |
| `OpportunityRow.svelte` | Single opportunity row with density modes (compact/overview/zoomed) |
| `DetailPane.svelte` | Opportunity detail: signal grid, stage navigation, exit states, commitments, notes, metadata |
| `DeliverablesView.svelte` | Execution matrix: deliverable rows, opportunity columns, contributor columns, zoom, drag-reorder |
| `DeliverableDetailPane.svelte` | Deliverable detail: size, certainty, links, contributors, consumers |
| `MeetingView.svelte` | Per-person agenda: entity-grouped changes, commitments, awaiting input, inline scoring, scoped stamp |
| `ScoreToggle.svelte` | Reusable score radiogroup (none/positive/uncertain/negative) with keyboard nav |
| `KeyboardHelp.svelte` | Shortcut reference overlay (? key) |
| `QuickAdd.svelte` | Quick-add dialog (n key, Tab to switch opportunity/deliverable) |
| `SyncPanel.svelte` | P2P room management: create/join rooms, publish/pull board, contributor mode |
| `ContributorView.svelte` | Contributor scoring view: assigned perspective cells with inline scoring |

## Conventions

### State management

- All shared state lives in `App.svelte` as `$state` fields
- No external state library -- state flows down via props, changes flow up via callbacks
- Undo: snapshot-based, 20 levels, `Ctrl+Z`. Push `BoardData` onto stack before mutations, pop to restore.
- Auto-save: `$effect` in `App.svelte` calls `saveBoard()` on every reactive change
- Meeting data is persisted separately from board data

### Reactivity rules

- Read all reactive values synchronously in `$effect` -- Svelte only tracks synchronous reads
- Use `$derived` for computed values, not manual caching
- External callbacks (setTimeout, event handlers outside Svelte context) must clone-and-reassign arrays/maps if mutating reactive state

### CSS design tokens

All visual values use CSS custom properties from `:root` in `index.html`:
- `--c-*` (colors, OKLCH color space)
- `--fs-*` (font sizes)
- `--sp-*` (spacing)
- `--radius-*` (border radii)
- `--shadow-*` (box shadows)
- `--tr-*` (transitions, respect `prefers-reduced-motion`)

Never use raw hex colors, pixel values, or magic numbers in component CSS. Per-instance dynamic values use scoped inline custom properties.

### Content-width layout

Scrollable views use a **full-width container / constrained content** pattern to keep the scrollbar at the viewport edge while centering a readable content column:

```css
.container {
  overflow-y: auto;       /* scrollbar spans full viewport width */
  align-items: center;    /* center the content column */
}
.container > * {
  width: 100%;
  max-width: 56rem;       /* ~896px -- adjust per view */
}
```

Never put `max-width` on the scrollable container itself -- that pulls the scrollbar inward and leaves dead gutter space. Each view picks its own content width (e.g. Briefing 720px, Pipeline 56rem).

### Accessibility & input

- Use `pointer` events (not `mouse`) for touch support
- Interactive elements need `:focus-visible` styles
- Animations respect `prefers-reduced-motion`

## Key Invariants

1. **Consent gates advancement** -- `stageConsent()` must return `ready` before an opportunity can advance. All three perspectives at the current stage must be scored with no objections.
2. **Aging resets on stage change** -- `stageEnteredAt` is set to `Date.now()` whenever `stage` changes.
3. **Exit preserves history** -- discontinuing sets `exitState`, `exitReason`, `discontinuedAt` but does not delete signals, verdicts, or commitments. Reactivation clears exit fields and restores the opportunity.
4. **Meeting snapshots are per-person** -- each person has an independent snapshot. "Done" stamps only that person's snapshot, not a global one.
5. **Undo captures full board state** -- the undo stack stores complete `BoardData` snapshots, not individual mutations.
6. **Origins are metadata, not workflow** -- origin type (Request/Idea/Incident/Debt) affects display and triage hints but does not change pipeline behavior.
7. **Horizons are freeform** -- no enforced format. Defaults to next quarter (e.g. "2026Q3"). Custom horizons can be any string.
8. **Coverage is binary choice** -- full or partial, no numeric percentages.
9. **Deliverables are orphans until linked** -- a new deliverable has no links and shows an "orphan" badge.
10. **No runtime dependencies beyond nostr-tools** -- the app runs on browser APIs (localStorage, crypto.randomUUID, DOM) plus nostr-tools for P2P relay communication.

## Design Hygiene

### Keep instructions current
- When a commit changes architecture, modules, conventions, or key invariants, update this file in the same commit.

### Module size
- **Source files > ~300 lines** are a smell. Split into focused sub-modules behind a re-export facade.
- **Components > ~300 lines of template** likely need extraction into child components or Svelte 5 `{#snippet}`s.
- Test files can be larger.

### Don't duplicate -- extract immediately
- Same 3+ lines appearing twice? Extract a named helper.
- Same template block in two `{#if}` branches? Use a `{#snippet}`.
- Same CSS block in 3+ components? Promote to a utility class.

## Build & Test

```sh
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # production build (single HTML file)
npm run check        # svelte-check (type checking)
npm run lint         # biome check
npm run test         # vitest run
```
