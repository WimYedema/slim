# Slim -- Design Principles

Governing principles for all design and interaction decisions.
Derived from the product model (consent-based pipeline, two-axis planning),
the current UX, graphic design, and information design reviews,
and the tool's single-user, fully-local posture.

---

## Philosophy

### 1. Show the shape of work, not a list of tickets

The primary view is a **pipeline with perspectives**, not a flat backlog.
Every screen should answer "where are things stuck?" before "what's next?"

- The funnel, aging badges, and triage buckets exist to reveal *flow health*.
- If a view doesn't help a PO spot bottlenecks or imbalances, it doesn't earn its place.

### 2. Questions over scores

The signal grid is a **structured conversation**, not a rating system.
Each cell asks a question ("Could we build it?"), not "rate feasibility 1-5."

- Scores are consent semantics: *unheard*, *concern*, *consent*, *objection*.
- Nudges and gap prompts phrase the next action as a question, never as a metric to improve.
- Avoid numeric aggregation. The moment we compute a weighted priority number, we've lost the consent model.
- The stagexperspective question should be a **visible label**, not a disappearing `placeholder`. Questions frame the input and must persist during editing.

### 3. Consent gates, not permission gates

Advancement requires *hearing all perspectives* and *resolving objections*.
It does not require approval from a specific person or role.

- Any perspective can block advancement (objection), but no single perspective can force it.
- `uncertain` counts as consent -- "I have concerns but I won't block progress."
- The UI makes blocking visible (red badges, objection counts) but never prevents the PO from overriding.

### 4. Warm, not corporate

The visual tone is personal and inviting -- a product owner's thinking tool, not an enterprise dashboard.

- Warm palette (desert sand, amber accents), rounded corners, generous spacing.
- Serif headings for content, sans-serif for chrome -- the separation reinforces "this is your writing, not system output."

---

## Information Design

### 5. Answer the user's question, not yours

Every view element should answer one of four questions:
*"What should I do?" / "Where are things stuck?" / "What just happened?" / "Is this ready?"*

- Structure information in the order a human would discuss it, not the order it's stored in the data model.
- If an element doesn't help the user decide or act, it's decoration.

### 6. Priority ordering = visual ordering

The most important information gets the leftmost, topmost, or largest position. Never bury the actionable signal.

- The **nudge is the most valuable element** on a card -- it answers "what should I do next?" Promote it visually; never style it as a footnote.
- If the layout order doesn't match the importance order, the layout is wrong.

### 7. Progressive disclosure in three layers

Show the minimum needed to decide; reveal detail when asked. Three density layers: **glance -> scan -> expand**.

- **Glance**: card title, stage dots, nudge, aging badge -- enough to triage.
- **Scan**: expanded card or summary row -- enough to compare and prioritize.
- **Expand**: full detail pane -- signals, verdicts, commitments, exit history. The detail pane reads like a **document**, not a form.
- Never front-load configuration or ceremony for quick capture (`n` -> type -> Enter).

### 8. Aggregate before enumerate

Show the summary number first; let the user drill into the list.

- "3 blocked" is faster than showing 3 red rows. Summaries appear at every group boundary -- horizon headers, bucket headers, perspective sections.
- If a view has rows without a summary row or column, it's incomplete.

### 9. Color encodes state, not decoration -- and labels beat symbols beat colors

Color carries meaning: green = consent, amber/warm = attention, red = objection, blue = action. Never use color as ornament.

- A word beats a glyph beats a color. Never rely on emoji, dots, or color alone as the only indicator.
- If an icon, dot, or badge appears, a **legend** must exist within visual range (not just a tooltip).

---

## Interaction

### 10. Keyboard-first, pointer-friendly

Power users triage 20+ items in a sitting. Every frequent action must be reachable by keyboard.

- `j`/`k` navigation, single-key actions (`a` advance, `n` add, `x` exit, `e` edit).
- Pointer interactions (drag-drop, click) are always available but never the *only* path.
- New features must ship with a keyboard binding or be accessible via Tab/Enter.

### 11. Context stays visible -- cross-reference, don't navigate

When editing a detail, the list remains visible. The user should never lose spatial orientation.

- Split-pane layout: list on the left, detail on the right.
- Selection highlight scrolls into view and stays highlighted.
- When one view refers to an entity shown in another view, show its key info **inline** rather than requiring a tab switch.
- View switches preserve position: closing a pane returns to the list position, not the top.

### 12. Feedback is spatial, not modal

Prefer inline indicators over dialogs, toasts, or banners.

- Undo confirmation is a transient label near the header, not a toast.
- Validation errors prevent the action silently -- no error dialog.
- Score changes take effect immediately -- no "Save" button.
- The only modals are overlays the user explicitly opens (help, quick-add, exit menu).

### 13. Motion is acknowledgment, not show

Transitions confirm that something happened. They are never decorative.

- Duration < 200 ms, minimal easing. Respect `prefers-reduced-motion`.
- If the user can't tell what changed without the animation, the layout is the problem.

---

## Visual System

### 14. Tokens are the source of truth

Every visual value -- color, size, weight, spacing, shadow, radius -- lives in a CSS custom property. No raw hex colors, pixel values, or magic numbers in component CSS.

- One element, one size: if the same element (dot, badge, button) appears in multiple views, it uses the same token.
- Stage colors are consistent everywhere -- funnel, badges, pips, and detail pane use the same `--c-stage-*` tokens.
- Per-instance dynamic values use scoped inline custom properties.

### 15. Borders separate; shadows elevate

Flat elements are peers (cards in a list). Elevated elements float above context (detail pane, overlays).

- Borders mark edges within a surface. Shadows mark layers.
- Never combine a heavy border with a heavy shadow on the same element.

### 16. Typography is bimodal

Sans-serif for UI chrome (labels, buttons, navigation). Serif for user content (titles, verdicts, notes).

- This separation reinforces what is system vs. what is the user's own writing.
- Three font sizes cover most needs: body, small, tiny. Outliers use tokens, not hardcoded values.

---

## Data & Lifecycle

### 17. One truth, shown many ways

All views (Opportunities, Deliverables, Roadmap, Meetings) read from the same data.
A change in any view is immediately reflected in all others.

- No derived or cached state that can drift. Use `$derived` for all computed values.
- No "sync" or "refresh" actions. Reactivity handles consistency.
- Export (JSON/CSV) dumps the same data the UI displays -- no hidden state.

### 18. Time is a first-class signal

Aging, deadlines, and staleness are visible at every level, not buried in metadata.

- Stage age resets on advancement -- it measures *time stuck*, not *time alive*.
- Commitment deadlines surface in nudges, triage sort, meeting agendas, and roadmap flags.
- "When was this last touched?" is always answerable at a glance.

### 19. Exit is a decision, not deletion

Discontinuing an opportunity captures *why* and *how* -- kill, park, incubate, or merge.

- History (signals, verdicts, commitments) is preserved. Reactivation is one click.
- Exit states serve future-self: "Why did we drop this?" is always answerable.
- The "exited" section is collapsed but accessible -- out of the workflow, not out of the system.

### 20. Data belongs to the user

No accounts, no server, no analytics. All data lives in localStorage and leaves via JSON/CSV export.

- Import/export are always available. The user is never locked in.
- Data format is stable and documented -- a JSON export from today should load in future versions.
- Schema changes backfill gracefully. Old data gains new fields with sensible defaults; new data never breaks old schema readers.

### 21. Ceremony scales with team size

A solo PO triaging 8 ideas and a team PO coordinating 30 opportunities with 10 stakeholders use the same tool, but at different depths.

- People assignments, meeting prep, and contributor columns are additive -- the tool works without them.
- The minimum viable loop is: create opportunity -> score three perspectives -> advance or exit.
- Features that add overhead (commitments, person delegation, coverage matrix) earn their cost when team size or pipeline volume demands coordination.
