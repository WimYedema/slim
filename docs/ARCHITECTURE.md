# Slim -- Architecture

For module responsibilities, component tables, code style, and conventions, see [copilot-instructions.md](../.github/copilot-instructions.md) -- that file is the single source of truth for development.

## State Architecture

All application state lives as `$state` fields in `App.svelte`. No external state library, no context API, no stores.

```
App.svelte ($state)
|--- opportunities: Opportunity[]
|--- deliverables: Deliverable[]
|--- links: OpportunityDeliverableLink[]
|--- customHorizons: string[]
|--- meetingData: MeetingData
|--- briefingSnapshot: BoardSnapshot | null
|--- selectedId / selectedDeliverableId
|--- view: ViewMode ('briefing' | 'pipeline' | 'deliverables' | 'meetings')
|--- contributorInfo: ContributorInfo | null   # P2P contributor state
|--- pipelineGrouping: 'stage' | 'horizon'
|--- undoStack: BoardData[] (max 20)
`--- $derived values
    |--- allHorizons, selectedOpp, selectedDeliverable
    `--- contributor briefing stats (when in contributor mode)
```

### Persistence

Three localStorage keys:
- `slim-board` -- `BoardData` (opportunities, deliverables, links, customHorizons, briefingSnapshot)
- `slim-meetings` -- `MeetingData` (lastDiscussed, records, snapshots)
- `slim-sync` -- `SyncState` (roomCode, keys, role, contributorName)

Auto-saved on every state change via `$effect` in `App.svelte`. Loaded on mount with backfill for schema migrations.

### Undo

Snapshot-based. Before each mutation, `BoardData` is pushed onto an array (max 20). `Ctrl+Z` pops and restores. Semantic undo -- restores full board state, not individual fields.

## CSS Architecture

### Design tokens

All visual values are CSS custom properties in `:root` in `index.html`:

- `--c-*` -- colors (OKLCH color space, `color-mix()` for derived tints)
- `--fs-*` -- font sizes
- `--sp-*` -- spacing
- `--radius-*` -- border radii
- `--shadow-*` -- box shadows
- `--tr-*` -- transitions (respect `prefers-reduced-motion`)

### Font

- **Lora** (serif) -- primary font, headings and user content
- **Caveat** (cursive) -- sketchy aesthetic accents
- Sans-serif system font -- UI chrome (labels, buttons)

### Component CSS

- Scoped `<style>` per component, no global utility classes
- No CSS-in-JS, no Tailwind
- Dynamic values use scoped inline custom properties (`style:--row-height`)

## Design Decisions

### Why Svelte 5 runes, not stores?

`$state` + `$derived` + `$effect` provide fine-grained reactivity without indirection. All state in `App.svelte`, flows down via props. Avoids testing complexity of stores.

### Why a single HTML file?

Zero-infrastructure deployment: GitHub Pages, opened from disk, emailed to a colleague. `vite-plugin-singlefile` inlines all JS and CSS.

### Why localStorage, not IndexedDB?

Data volume is small (tens of opportunities). localStorage is synchronous, simpler to debug, sufficient for the PoC. IndexedDB appropriate if/when large boards or binary attachments are needed.

### Why consent-based, not scoring?

Numeric scoring (WSJF, RICE) creates false precision and is easily gamed. Consent asks: "Has everyone been heard, and does anyone object?" -- more honest and actionable.

## Removed Components (historical)

Earlier iterations included `ListView`, `RoadmapView`, `CardDetail`, `CubeView`, `LanesView`, `PipelineBoard`, `ScatterView`, and `TernaryView`. Their functionality was either folded into `PipelineView` or never shipped. All were removed as dead code.
