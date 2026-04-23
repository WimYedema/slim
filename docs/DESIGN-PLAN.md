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

## Summary

| Phase | Focus | Priority | Effort |
|---|---|---|---|
| 1 | Token foundation | **Must** | Small |
| 2 | Token adoption | **Must** | Medium |
| 3 | Accessibility | **Must** | Medium |
| 4 | Information hierarchy | **Should** | Large |
| 5 | Visual consistency | **Should** | Medium |
| 6 | Cross-view continuity | **Should** | Medium |
| 7 | Future polish | **Could** | Variable |

Phases 1–3 are prerequisite work that makes everything else easier. Phase 4 delivers the biggest usability gain. Phases 5–7 are refinements.
