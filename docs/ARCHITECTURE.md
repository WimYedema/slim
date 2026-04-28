# Upstream — Architecture

## Build & Deployment

| Concern | Solution |
|---|---|
| Language | TypeScript (strict mode) |
| UI framework | Svelte 5 (runes: `$state`, `$derived`, `$effect`) |
| Build | Vite 8 |
| Single-file output | vite-plugin-singlefile (whole app is one HTML file) |
| Lint + Format | Biome |
| Unit tests | Vitest |

### Build commands

```sh
npm install          # install dependencies
npm run dev          # start Vite dev server (or upstream:dev for upstream-specific entry)
npm run build        # production build → dist/index.html (single file, ~320 KB)
npm run check        # svelte-check (type checking)
npm run lint         # biome check
npm run test         # vitest run
```

### Entry point

`index.html` is the HTML entry point. It contains:
- All CSS design tokens in `:root`
- Google Fonts link (Lora)
- The `#app` mount point

`src/main.ts` mounts `App.svelte` into `#app`.

### Single-file output

The production build uses `vite-plugin-singlefile` to inline all JS and CSS into a single HTML file. No server required — the file can be opened from disk, hosted on any static server, or deployed to GitHub Pages.

---

## State Architecture

### Single mutable state object

All application state lives as `$state` fields in `App.svelte`. There is no external state library, no context API, no stores. Components receive state via props and emit changes via callback props or by mutating bound props.

```
App.svelte ($state)
├── opportunities: Opportunity[]
├── deliverables: Deliverable[]
├── links: OpportunityDeliverableLink[]
├── customHorizons: string[]
├── meetingData: MeetingData
├── briefingData: BriefingData          # board-wide snapshot + seen items
├── selectedOppId: string | null
├── selectedDeliverableId: string | null
├── currentView: ViewMode               # 'briefing' | 'pipeline' | 'deliverables' | 'meetings'
├── pipelineGrouping: 'stage' | 'horizon'
├── zoomedGroup: string | null          # stage key or horizon label when zoomed in
├── undoStack: BoardData[]
└── derived values ($derived)
    ├── allHorizons (union of opp horizons + custom)
    ├── selectedOpp / selectedDeliverable (lookups)
    ├── briefingItems (computed from snapshot diff)
    └── various computed props passed to views
```

### Persistence

Three localStorage keys:
- `upstream-board` — serialized `BoardData` (opportunities, deliverables, links, customHorizons)
- `upstream-meetings` — serialized `MeetingData` (lastDiscussed timestamps, records, snapshots)
- `upstream-briefing` — serialized `BriefingData` (board snapshot at last visit, seen item IDs, `lastBriefingAt` timestamp)

Auto-saved on every state change via a `$effect` in `App.svelte`. Loaded on mount with backfill for fields added after initial data was saved (horizon, stageEnteredAt).

### Undo

Snapshot-based. Before each mutation, the current `BoardData` is pushed onto an `undoStack` array (max 20 entries). `Ctrl+Z` pops the stack and replaces current state. This is semantic undo — it restores the full board state, not individual field changes.

---

## Data Model

### Two axes

The core insight is that upstream planning has two orthogonal decomposition axes:

1. **Opportunities** (value axis) — why are we doing this? Flows through a 4-stage pipeline: Explore → Sketch → Validate → Decompose
2. **Deliverables** (work axis) — what do we build? Linked to opportunities via many-to-many coverage relationships

These are connected by `OpportunityDeliverableLink` records with a `coverage` field (full or partial).

### Opportunity lifecycle

```
                   ┌──── Kill
                   ├──── Park
  Explore → Sketch → Validate → Decompose ──→ Sprint backlog
                   ├──── Incubate
                   └──── Merge
```

Each opportunity carries:
- A **signal grid**: 4 stages × 3 perspectives (desirability, feasibility, viability) = 12 cells
- **Origin type**: Request, Idea, Incident, Debt
- **Horizon**: freeform label (defaults to next quarter)
- **People**: expert/approver/stakeholder assignments with perspective delegation
- **Commitments**: promises with deadlines
- **Exit state**: kill/park/incubate/merge with reason (when discontinued)
- **Aging**: computed from `stageEnteredAt` timestamp (fresh < 7d, aging 7-14d, stale > 14d)

### Consent-based gating

Stage advancement requires consent across all three perspectives at the current stage:
- All perspectives must be scored (no `none` scores)
- No objections (no `negative` scores)
- `uncertain` counts as consent (concern noted, but willing to proceed)

### Meeting data

Meeting prep uses snapshot-based change detection:
- `snapshots` — per-person board snapshot taken when "Done" is clicked
- `lastDiscussed` — per-person timestamp of last meeting
- `records` — history of past meetings with dates

The agenda is computed by diffing current board state against the stored snapshot.

---

## Module Structure

```
src/
├── main.ts                          # Entry point, mounts App
├── App.svelte                       # Root component, all state, undo, persistence
├── lib/
│   ├── types.ts                     # Data types, constants, factory functions
│   ├── queries.ts                   # Pure query/computation functions (26 functions)
│   ├── store.ts                     # localStorage read/write (BoardData, MeetingData)
│   ├── meeting.ts                   # Meeting agenda computation, person collection, change detection
│   └── briefing.ts                  # Board-wide change detection, importance tiers, grouping
└── components/
    ├── BriefingView.svelte          # News feed: board-wide changes, 5 importance tiers
    ├── PipelineView.svelte          # Opportunities by stage or horizon, nested deliverables, zoom
    ├── PipelineFunnel.svelte        # Proportional stage funnel SVG, hover/click filtering
    ├── OpportunityRow.svelte        # Single opportunity row with density modes
    ├── DetailPane.svelte            # Opportunity detail: signal grid, stage nav, exit, commitments
    ├── DeliverablesView.svelte      # Execution matrix: rows, columns, contributor columns, zoom
    ├── DeliverableDetailPane.svelte # Deliverable detail: size, certainty, links, people
    ├── MeetingView.svelte           # Per-person agenda: entity-grouped changes, scoped stamp
    ├── ScoreToggle.svelte           # Reusable score radiogroup with keyboard nav
    ├── KeyboardHelp.svelte          # Shortcut reference overlay (? key)
    └── QuickAdd.svelte              # Quick-add dialog (n key)
```

### View evolution

The original PoC had four views: Opportunities (ListView), Deliverables, Roadmap, Meetings. The redesign merges Opportunities and Roadmap into **Pipeline** (same data, two grouping modes: by stage / by horizon) and adds **Briefing** as the first view. The four views are now organized by temporal intent: news → act → plan → talk.

| View | Replaces | Key change |
|---|---|---|
| Briefing | (new) | Board-wide actionable news feed |
| Pipeline | Opportunities + Roadmap | Two grouping modes (stage/horizon) + zoom into single group |
| Deliverables | Deliverables | Unchanged — execution-order planning matrix |
| Meetings | Meetings | Unchanged — per-person agenda builder |

### Unused/experimental components (not wired into App)

These exist in the codebase but are not currently reachable from the UI:

- `ListView.svelte` — original opportunities triage list (replaced by PipelineView)
- `RoadmapView.svelte` — original horizon-grouped table (folded into PipelineView)
- `CardDetail.svelte` — earlier card detail experiment
- `CubeView.svelte` — 3D portfolio cube visualization
- `LanesView.svelte` — Kanban-style lane layout
- `PipelineBoard.svelte` — earlier pipeline board experiment
- `ScatterView.svelte` — scatter plot visualization
- `TernaryView.svelte` — ternary triangle visualization using barycentric coordinates

### Module responsibilities

| Module | Purpose |
|---|---|
| `types.ts` | Data shapes (`Opportunity`, `Deliverable`, `OpportunityDeliverableLink`, `CellSignal`, etc.), constants (`STAGES`, `PERSPECTIVES`, `CELL_QUESTIONS`, `ORIGIN_TYPES`, `EXIT_STATES`), factory functions (`createOpportunity`, `createDeliverable`). Re-exports all query functions from `queries.ts` for backward compatibility. |
| `queries.ts` | Pure query/computation functions (26 functions). Stage navigation (`stageIndex`, `nextStage`, `prevStage`), horizon helpers (`defaultHorizon`, `currentQuarter`, `isFutureHorizon`), score helpers (`nextScore`, `cellHasSignal`, `scoreClass`), aging (`daysInStage`, `agingLevel`, `pacingSummary`), display (`originLabel`, `stageLabel`, `formatDaysLeft`), link queries (`linksForOpportunity`, `linksForDeliverable`), commitments (`commitmentUrgency`), consent (`currentStageScores`, `perspectiveWeight`, `consentStatus`, `stageConsent`), people (`perspectiveOwner`, `perspectiveAssignment`, `inheritedPeople`), visualization (`ternaryPosition`). |
| `store.ts` | localStorage wrappers: `saveBoard`/`loadBoard`/`clearBoard`, `saveMeetingData`/`loadMeetingData`. Includes backfill logic for schema migrations. |
| `meeting.ts` | `collectPeople` (aggregate all people across opportunities/deliverables), `buildMeetingAgenda` (diff current state vs. snapshot), `personUrgency` (compute urgency for sidebar sorting), `completeMeeting` (stamp snapshot, supports scoped stamp for partial meetings) |
| `briefing.ts` | Board-wide change detection (`snapshotBoard`, `diffBoard`), importance tier classification, deduplication (`deduplicateItems`), grouping (`groupItems`), time-windowed filtering |

---

## CSS Architecture

### Design tokens

All visual values are CSS custom properties defined in `:root` in `index.html`:

- `--c-*` — colors (background, surface, accent, semantic colors)
- `--fs-*` — font sizes
- `--sp-*` — spacing
- `--radius-*` — border radii
- `--shadow-*` — box shadows
- `--tr-*` — transitions (respect `prefers-reduced-motion`)

Color space: OKLCH for perceptual uniformity. Uses `color-mix()` for derived tints.

### Font

- **Lora** (serif) — primary font family, loaded from Google Fonts
- **Caveat** (cursive) — used for the sketchy/handwritten aesthetic in some UI elements
- `--font-reading` — applies Lora with appropriate line-height for detail pane body text

### Component CSS

- Each `.svelte` component uses `<style>` scoped CSS
- No global utility classes except `.overlay` (for modals/overlays)
- No CSS-in-JS, no Tailwind
- Dynamic values use scoped inline custom properties (e.g. `--peer-color`, `style:--row-height`)

---

## Key Design Decisions

### Why Svelte 5 runes, not stores?

Svelte 5's `$state` + `$derived` + `$effect` provide fine-grained reactivity without an external state library. All state lives in `App.svelte` and flows down via props. This avoids the indirection and testing complexity of stores while keeping reactivity automatic.

### Why a single HTML file?

The target deployment is zero-infrastructure: no server, no database, no Docker. A single HTML file can be:
- Hosted on GitHub Pages (current deployment)
- Opened from disk (works offline)
- Emailed to a colleague
- Embedded in documentation

### Why localStorage, not IndexedDB?

The data volume is small (tens of opportunities, not thousands). localStorage is synchronous, simpler to debug, and sufficient for the PoC. IndexedDB would be appropriate if/when the tool needs to handle large boards or binary attachments.

### Why consent-based, not scoring?

Traditional prioritization tools use numeric scoring (WSJF, RICE, MoSCoW). These create false precision and are easily gamed. Consent-based gating asks a better question: "Has everyone been heard, and does anyone object?" This is both more honest and more actionable.

### Why no P2P yet?

The Estimate project has a mature P2P implementation (WebRTC via Trystero + Nostr relay fallback). Upstream can reuse this architecture when multi-user becomes a priority. The current PoC validates the data model and UX without the complexity of real-time sync.

---

## Dependencies

### Runtime

The PoC currently has **no runtime dependencies**. All functionality is built with Svelte 5, TypeScript, and browser APIs (localStorage, crypto.randomUUID, Canvas 2D for experimental views).

The parent repo's `package.json` lists P2P dependencies (trystero, nostr-tools, @noble/*) but these are used only by the Estimate app, not by Upstream.

### Dev

| Package | Purpose |
|---|---|
| `svelte` | UI framework |
| `@sveltejs/vite-plugin-svelte` | Vite integration for Svelte |
| `vite` | Build tool |
| `vite-plugin-singlefile` | Inline all assets into one HTML file |
| `typescript` | Type checking |
| `svelte-check` | Svelte-specific type checking |
| `@biomejs/biome` | Lint + format |
| `vitest` | Test runner |
| `@testing-library/svelte` | Component testing utilities |
| `jsdom` | DOM environment for tests |
