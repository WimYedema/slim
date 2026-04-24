# Upstream — Consolidated Design Plan

Actionable improvements from the UX, graphic design, and information design reviews.
Organized into phases by dependency order: foundations first, then adoption, then structural changes.

---

## Phase 1: Token Foundation

Unblocks all subsequent phases. Add missing design tokens to `:root` in `index.html`.

- [ ] Add small font-size tokens: `--fs-2xs: 0.7rem`, `--fs-3xs: 0.6rem`
- [ ] Add line-height tokens: `--lh-tight: 1.1`, `--lh-normal: 1.4`, `--lh-relaxed: 1.6`
- [ ] Add font-weight tokens: `--fw-normal: 400`, `--fw-medium: 600`, `--fw-bold: 700`
- [ ] Add dot-size tokens: `--dot-size: 17px`, `--dot-size-sm: 12px`
- [ ] Add opacity tokens for `color-mix()`: `--opacity-subtle: 8%`, `--opacity-moderate: 18%`, `--opacity-emphasis: 30%`
- [ ] Add stage color tokens: `--c-stage-explore`, `--c-stage-sketch`, `--c-stage-validate`, `--c-stage-decompose`

**Effort**: Small. Pure CSS additions, no component changes.

---

## Phase 2: Token Adoption

Mechanical replacements across all components. Can be done file-by-file.

- [ ] Replace hardcoded font-sizes < 0.8rem with `--fs-2xs` / `--fs-3xs` (~50 occurrences across 6+ components)
- [ ] Replace scattered line-height values (0, 1, 1.3, 1.4, 1.5) with `--lh-*` tokens
- [ ] Standardize font-weight: remap 500 → 600, use only 400/600/700 via `--fw-*` tokens
- [ ] Replace `color-mix()` hardcoded percentages (5%–35%) with `--opacity-*` tokens
- [ ] Replace dot/pip `width`/`height` with `--dot-size*` tokens
- [ ] Unify stage colors: funnel fills, badges, and pips all reference `--c-stage-*` tokens

**Effort**: Medium. ~100 CSS property replacements, mostly search-and-replace. Test visually after each component.

---

## Phase 3: Accessibility (P1)

Focus management and keyboard navigation fixes.

- [ ] Add global `:focus-visible` rule to `index.html`: `outline: 2px solid var(--c-accent); outline-offset: 2px`
- [ ] Fix score toggle group keyboard navigation — currently un-navigable by keyboard
- [ ] Audit every interactive element (`<button>`, `<a>`, custom clickable `<div>`) for visible focus indicator
- [ ] Ensure all score dots and stage pips have accessible labels (not just color)

**Effort**: Medium. Requires component-level testing.

---

## Phase 4: Information Hierarchy

Address information design issues that affect usability.

### 4a. Nudge prominence
The nudge ("what should I do next?") is the most valuable element on a card but is currently styled as a footnote (italic, small, `--c-text-soft`, truncated).

- [ ] Promote nudge text to higher visual weight: larger font-size, stronger color, no truncation
- [ ] Position nudge as the primary readable element after the title

### 4b. Verdict input framing
The stage×perspective question (e.g., "Did users confirm they want this?") disappears when editing because it's a `placeholder`.

- [ ] Convert verdict `placeholder` to a persistent `<label>` above the input field
- [ ] Keep question visible while the user types their answer

### 4c. Summary rows and columns
Coverage matrix and roadmap have no aggregate summaries — users must scan every cell.

- [ ] Add summary column to coverage matrix: "X of Y covered" per opportunity
- [ ] Add summary row to coverage matrix: deliverable load count
- [ ] Add horizon-level health summary to roadmap: "N blocked / M total"

### 4d. Risk flag legend
Roadmap risk icons (⚡ ⏰ ∅ ⚠) have no legend — users must hover each one.

- [ ] Add inline legend row or key at the top of the roadmap view
- [ ] Consider replacing pure-emoji indicators with labeled badges

### 4e. Certainty visualization
Deliverable certainty (5 bars, filled/empty) has no label or tooltip.

- [ ] Add text label: "Certainty: 3/5" alongside or replacing the bar visualization
- [ ] Add tooltip explaining what certainty means in context

**Effort**: Large. Requires template and CSS changes across ListView, DetailPane, DeliverablesView, RoadmapView.

---

## Phase 5: Visual Consistency

Codify recurring UI patterns.

### 5a. Button variants
Three distinct button patterns exist with inconsistent radius and padding.

- [ ] Define three button variant classes: `btn-ghost`, `btn-solid`, `btn-icon`
- [ ] Standardize padding, radius, and hover effects for each variant
- [ ] Replace ad-hoc button styles across all components

### 5b. Detail pane hierarchy
All detail pane sections currently have the same visual weight.

- [ ] Introduce three density zones: **header** (title, stage, key signals), **action** (scoring, commitments), **reference** (metadata, history, links)
- [ ] Use spacing, dividers, and type scale to create visual hierarchy

### 5c. Funnel alignment
Funnel visualization uses hardcoded px values and divergent colors.

- [ ] Migrate funnel fills to `--c-stage-*` tokens (depends on Phase 1)
- [ ] Replace hardcoded dimensions with relative/token values

**Effort**: Medium. Mostly CSS and template restructuring.

---

## Phase 6: Cross-View Continuity

Address the "lost context on view switch" problem.

- [ ] Preserve selected opportunity/deliverable ID when switching between views
- [ ] When a view references an entity from another tab, show key info inline (name, stage, health) instead of requiring navigation
- [ ] Evaluate breadcrumb or "you were looking at X" indicator on view switch

**Effort**: Medium. Requires App.svelte state management changes.

---

## Phase 7: Future / Nice-to-Have

- [ ] Prepare dark mode token structure (OKLCH lightness inversion layer on existing warm palette)
- [ ] Restructure meeting agenda sections to conversational flow: "what changed → what do we need from you → what's stuck → anything else"

**Effort**: Variable. Dark mode is token-only if Phase 1–2 are complete. Meeting restructure requires template changes.

---

## Phase 8: View Restructuring

Reorganize the four views from data-type grouping (Opportunities / Deliverables / Roadmap / Meetings) to temporal-intent grouping (Briefing / Pipeline / Deliverables / Meetings). This is the most significant structural change — it replaces two views and adds one.

### 8a. Pipeline view (replaces Opportunities + Roadmap)

Create `PipelineView.svelte` that merges ListView and RoadmapView. Three sub-phases:

#### 8a-1. Stage-grouped pipeline (MVP — replaces ListView)

- [ ] Create `PipelineView.svelte` with opportunities grouped by stage
- [ ] Each group has a collapsible header showing stage name + count
- [ ] Opportunity cards show: stage badge, title, signal health dots, aging indicator, nudge
- [ ] Expanding a card (▸/▾) shows nested deliverables with coverage dot, title, size badge, certainty
- [ ] Triage sorting within each group: Blocked → Needs Input → On Track
- [ ] Funnel visualization at the top
- [ ] Wire into App.svelte as view `'pipeline'`, keyboard shortcut `2`
- [ ] Keep detail pane behavior (click opp → DetailPane, click deliverable → DeliverableDetailPane)
- [ ] Port add-opportunity UX from ListView (+ button, inline input)
- [ ] Port keyboard navigation (j/k, Enter, Escape, a, x, e)

#### 8a-2. Horizon grouping mode

- [ ] Add `pipelineGrouping: 'stage' | 'horizon'` state to App.svelte
- [ ] Add grouping toggle in PipelineView header: `[Stage]` / `[Horizon]`
- [ ] Keyboard: `Tab` toggles grouping in Pipeline view
- [ ] Horizon mode groups opportunities by horizon label (same data, different buckets)
- [ ] Port horizon headers from RoadmapView: effort summary, size breakdown, risk flags
- [ ] Port drag-drop between horizons
- [ ] Port horizon management (add, rename, remove)

#### 8a-3. Zoom into single group

- [ ] Add `zoomedGroup: string | null` state to App.svelte
- [ ] Click stage/horizon header to zoom in (or press Enter on focused header)
- [ ] Zoomed view shows expanded detail for every opportunity: inline signal grid at current stage, all linked deliverables, commitment deadlines, people chips
- [ ] Breadcrumb: `Pipeline › Validate` with back navigation
- [ ] `Esc` zooms back out
- [ ] Keyboard: j/k navigates between opportunities in zoomed view

### 8b. Briefing view (new)

Create `BriefingView.svelte` and `briefing.ts` for board-wide change detection.

#### 8b-1. Briefing data model

- [ ] Define `BriefingData` interface in types.ts: `lastBriefingAt: number`, `boardSnapshot: BoardSnapshot`, `seenItems: Set<string>`
- [ ] Define `BoardSnapshot` — similar to meeting's `PersonSnapshot` but board-scoped (all opps, all deliverables)
- [ ] Add `saveBriefingData` / `loadBriefingData` to store.ts with localStorage key `upstream-briefing`
- [ ] Add `briefingData` to App.svelte state

#### 8b-2. Change detection engine (briefing.ts)

- [ ] `diffBoard(current: BoardData, snapshot: BoardSnapshot): BriefingItem[]` — compute all changes
- [ ] `BriefingItem` type: `{ id, targetType, targetId, verb, description, tier, timestamp, scrollTo? }`
- [ ] Importance tier classification: breaking / important / update / minor
- [ ] Time-window filtering: items older than their tier's persistence window are dropped
- [ ] `markSeen(itemId: string, data: BriefingData): BriefingData` — toggle seen state
- [ ] `snapshotBoard(data: BoardData): BoardSnapshot` — create snapshot on briefing open
- [ ] Unit tests for diffBoard, tier classification, time-window filtering

#### 8b-3. Briefing view component

- [ ] Create `BriefingView.svelte` — single-column news feed
- [ ] Items ranked by tier (breaking first) then recency
- [ ] Each item shows: importance indicator, action verb, description, time ago
- [ ] Unread items have full visual weight; seen items have quiet styling + "✓ Reviewed"
- [ ] Click navigates to Pipeline/Deliverables view, selects target, scrolls to section
- [ ] Empty state: "Nothing new — your board is up to date"
- [ ] Wire as view `'briefing'`, keyboard shortcut `1`

### 8c. Navigation update

- [ ] Update App.svelte view switching: `1` = briefing, `2` = pipeline, `3` = deliverables, `4` = meetings
- [ ] Update nav bar labels
- [ ] Update KeyboardHelp.svelte
- [ ] Ensure cross-view navigation callbacks use new view names
- [ ] Retire ListView.svelte and RoadmapView.svelte (move to experimental/unused)

### Implementation order

```
8a-1  Pipeline (stage mode)     ← build first, replaces ListView
8c    Nav update                ← wire pipeline into app, update shortcuts
8a-2  Pipeline (horizon mode)   ← fold RoadmapView into pipeline
8a-3  Pipeline (zoom)           ← add zoom capability
8b-1  Briefing data model       ← types + persistence
8b-2  Briefing engine           ← change detection + tests
8b-3  Briefing view             ← UI component
```

**Effort**: Large. The Pipeline view is the biggest single component. The Briefing engine needs careful design of the snapshot diff algorithm. Estimated 3 sub-phases, each independently shippable.

---

## Summary

| Phase | Focus | Priority | Effort |
|---|---|---|---|
| 1 | Token foundation | **Done** | Small |
| 2 | Token adoption | **Done** | Medium |
| 3 | Accessibility | **Done** | Medium |
| 4 | Information hierarchy | **Done** | Large |
| 5 | Visual consistency | **Done** | Medium |
| 6 | Cross-view continuity | **Should** | Medium |
| 7 | Future polish | **Could** | Variable |
| 8 | View restructuring | **Must** | Large |

Phases 1–5 are complete. Phase 8 is the next major milestone — it restructures the app's navigation around the PO's daily workflow. Phase 6 (cross-view continuity) will be naturally addressed by Phase 8's navigation changes. Phase 7 remains future polish.
