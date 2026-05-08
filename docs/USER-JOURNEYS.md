# Slim -- User Journeys

## Overview

Slim is a lean planning tool for product owners, covering the workflow *before* the sprint board. See [PRODUCT-GUIDE.md](PRODUCT-GUIDE.md) for the full product introduction and [PRODUCT.md](PRODUCT.md) for the underlying theory.

### Roles

| | **PO** | **Contributor** (via P2P room) |
|---|---|---|
| See the full board | Read-write | Read-only (Pipeline + Deliverables) |
| Add opportunities | Yes | -- |
| Move opportunities between stages | Yes | -- |
| Score signal cells | Yes | Only assigned cells (via remote submission) |
| Exit / discontinue | Yes | -- |
| Add / manage deliverables | Yes | -- |
| Link deliverables to opportunities | Yes | -- |
| Import / export | Yes | -- |

### Views

The app has four top-level views, switchable via click or keyboard (1-4), organized by **temporal intent** -- matching the PO's natural daily workflow:

1. **Latest** -- an actionable news feed of board-wide changes with natural aging (Fresh / Read / Older bands), plus a Board Health dashboard showing aggregate metrics
2. **Pipeline** -- opportunities grouped by stage (default) or by horizon, with nested deliverables and zoom into single groups
3. **Deliverables** -- a cross-reference matrix (deliverables x opportunities) for execution-order planning with contributor columns and inline detail pane
4. **Meetings** -- per-person agenda builder with role filter (All / Team / Stakeholders), change detection, inline scoring, and auto-generated talking points for stakeholders

All views except Latest use a split layout: list/matrix on the left, detail pane on the right. The Latest view has two sub-views: a single-column news feed (News) and a Board Health dashboard (aggregate pipeline, consent, commitment, and deliverable metrics). The Meetings view uses a person sidebar on the left with a role filter to switch between team members and stakeholders.

**Pipeline modes**: The Pipeline view has two grouping modes toggled in the header:
- **By stage** -- funnel visualization + triage buckets (Blocked -> Needs Input -> On Track)
- **By horizon** -- horizon groups with effort summaries and risk flags

**Pipeline zoom**: Click a stage or horizon header to zoom into that group, showing expanded detail for every opportunity. Press `Esc` to zoom back out.

### Keyboard Shortcuts

Press **?** to see the full shortcut reference. Key bindings:

| Key | Action |
|---|---|
| j / Down | Next item in list |
| k / Up | Previous item in list |
| Enter | Edit selected title / zoom into group |
| Escape | Close pane / dialog / zoom out |
| 1-4 | Switch views (Latest, Pipeline, Deliverables, Meetings) |
| Tab | Toggle Pipeline grouping (stage <-> horizon) |
| n | Quick-add dialog (Tab to toggle opportunity/deliverable mode) |
| / | Focus the add input in current view |
| e | Edit selected title (focuses title input) |
| a | Advance selected to next stage (if consent ready) |
| x | Exit / discontinue selected |
| Ctrl+Z | Undo (20-level snapshot stack) |

---

## 1. Getting Started

### 1.1 First Open

1. Open the app -- the Opportunities tab loads with sample data (8 pre-populated opportunities across all five stages)
2. The top of the list shows an **interactive funnel** -- a proportional visualization of how many opportunities are at each stage (e.g. Explore: 4, Sketch: 3, Validate: 1, Decompose: 1). Hovering a stage segment highlights matching items in the list
3. Opportunities are grouped into **triage buckets**: Blocked (red), Needs Input (amber), On Track (green)
4. Each card shows: stage pips, title with aging badge, health dots (per perspective at current stage), a contextual nudge, horizon and origin tags, and an advance button if consent is achieved

No onboarding tour exists yet. The interface is self-explanatory: it looks like a prioritized list, and cards have obvious click targets. Pressing **?** shows a keyboard shortcuts reference.

### 1.2 Adding an Opportunity

Two ways to add:

**From the list view:**
1. Click the **+** button next to the funnel -- an inline input expands
2. Type a title and press Enter
3. A new opportunity appears in the Explore stage with a brief flash animation
4. It starts with empty signals across all three perspectives

**From anywhere (quick-add):**
1. Press **n** -- a quick-add dialog appears
2. Type a title, press Enter
3. Press Tab to switch between Opportunity and Deliverable mode
4. Press Escape to cancel

New opportunities default to:
- Stage: Explore
- Origin: Request (can be changed in the detail pane)
- Horizon: next quarter (e.g. 2026Q3 when opened in Q2)
- All signals: unscored

### 1.3 Adding a Deliverable

1. Switch to the Deliverables tab (click or press **2**)
2. Type a title in the text input at the top, or press **n** and Tab to deliverable mode
3. Press Enter -- a new deliverable appears in the matrix as a new row
4. It starts unlinked (orphan badge), no size, no certainty

---

## 2. The Pipeline

> **Note:** This section describes the Pipeline view (key **2**), which replaces the earlier Opportunities and Roadmap views. The Pipeline shows opportunities grouped by stage (default) or by horizon, with deliverables nested under each opportunity.

### 2.1 Understanding the Signal Grid

Each opportunity has a **stage x perspective** matrix of signal cells. The three perspectives are:

| Perspective | Question it answers | Who typically fills it |
|---|---|---|
| **Desirability** (Users) | Do people want this? | Designer, researcher, PO |
| **Feasibility** (Technical) | Can we build this? | Tech lead, architect |
| **Viability** (Business) | Should we build this? | PO, business analyst |

Each cell has:
- A **score** -- one of four states following consent-based semantics:
  - **None** -- not yet consulted
  - **Positive** -- consent: "I support this"
  - **Uncertain** -- concern: "I have reservations but won't block"
  - **Negative** -- objection: "This needs resolution before we proceed"
- A **verdict** -- free text explaining the score (e.g. "Top request from enterprise prospects"). Each stage has a specific prompt as placeholder text (e.g. "Who might want this?" at Explore, "User confirmation?" at Validate)
- An **evidence** field -- optional URL or reference supporting the verdict
- An **owner** -- optional name of who provided this signal
- An optional **person assignment** -- who's responsible for filling this cell, with tracking of when it was assigned and whether a response has been recorded

### 2.2 Working Through the Detail Pane

1. Click any opportunity in the list -- the detail pane opens on the right (the list compresses to compact mode showing just title + stage letter)
2. The pane shows, in order:
   - **Header**: editable title + close button
   - **Stage bar**: back button, stage badge with aging indicator (e.g. "7d in Sketch"), advance button (shows next stage name when consent ready, or objection/unheard count when blocked), and exit menu button
   - **Gap prompts**: a checklist of unresolved perspectives -- objections first, then unheard perspectives. Clicking a prompt scrolls to the relevant signal cell in the grid
   - **Commitment alerts**: banners showing upcoming/overdue promises (e.g. "Promised CEO: 3d left") -- only visible when a deadline is within 14 days
   - **Notes**: free-form textarea (auto-saves on blur)
   - **Signal grid**: the core data entry area -- collapsible per perspective, rows per stage. Each cell has score buttons, verdict input with stage-specific placeholder, evidence, and owner fields
   - **Origin and Horizon**: origin type selector (Request, Idea, Incident, Debt) and horizon picker with datalist autocomplete -- grouped in a metadata section
   - **Commitments**: list of promises with add/remove. Each shows who it was promised to, milestone, and deadline with urgency indicators
   - **Deliverables section** (visible at Decompose stage or when links exist): linked deliverables with coverage toggle, "decomposition complete" checkbox, and controls to create new or link existing deliverables

3. To score a cell: click a score button and type a verdict
4. To assign someone: use the person picker on a cell -- the assignment tracks when it was made and whether a response has been recorded

### 2.3 Advancing an Opportunity

Stage advancement follows **consent-based gating**:

1. An opportunity can advance when all three perspectives at the current stage have been heard (no unscored cells) and there are no unresolved objections (no negative scores)
2. The advance button in the stage bar shows:
   - The next stage name when consent is achieved -- click to advance (or press **a**)
   - Objection/unheard count when blocked (e.g. "1 objection, 1 unheard") -- button is disabled
3. Advancing moves the opportunity to the next stage -- the funnel updates, the aging counter resets

| Transition | What's required | What kills it |
|---|---|---|
| Explore to Sketch | All 3 perspectives heard, no objections | Nobody cares, or it's a solution without a problem |
| Sketch to Validate | All 3 perspectives grounded, no objections | Can't articulate what done looks like |
| Validate to Decompose | All 3 perspectives validated, no objections | Fails a lens -- not wanted, can't build it, or doesn't fit |
| Decompose to Deliver | All 3 perspectives confirmed, ≥1 deliverable linked | Work wasn't sized, or cost isn't justified |

4. An opportunity can also be moved **backward** using the back button -- useful when new information surfaces
5. The list view also shows an advance arrow on each card when consent is ready -- click to advance without opening the detail pane

### 2.4 Exiting an Opportunity

1. In the detail pane stage bar, click the exit button (or press **x**)
2. An inline exit menu appears with four exit states and a reason field:
   - **Kill** -- permanently abandon this opportunity
   - **Park** -- pause for now, might return later
   - **Merge** -- absorbed into another opportunity
   - **Done** -- delivered as promised, commitments fulfilled (only available in Deliver stage)
3. Type a reason in the inline text field (optional but recommended)
4. Click the exit state button -- the opportunity moves to the "Exited" section at the bottom of the list
5. The exited section is collapsible and shows: title, exit icon, reason, and a **Reactivate** button
6. Reactivating restores the opportunity to its previous stage with all signals and verdicts intact

### 2.5 The Smart Triage

The list view automatically sorts opportunities into three buckets:

| Bucket | Criteria | Visual |
|---|---|---|
| **Blocked** | Has a negative score (objection) or an overdue commitment | Red indicators |
| **Needs Input** | Has unheard perspectives, upcoming deadlines, or incomplete signals | Amber indicators |
| **On Track** | Consent achieved at current stage, no imminent deadlines | Green indicators |

Each card displays a **contextual nudge** -- a one-line hint about what needs attention:
- "Who has this problem?" (unheard desirability at Explore)
- "Feasibility objection -- resolve before advancing"
- "Promised DACH partner: 3d overdue"
- "Ready to advance to Validate"

Additionally, **roadmap warnings** appear on cards:
- A mismatch flag when an early-stage opportunity targets a near-term horizon (e.g. still in Explore but targeted at Q2)
- A missing-deliverables flag when a late-stage opportunity has no linked work items

### 2.6 Card Aging

Each opportunity tracks how many days it has been in its current stage. The aging is visible in multiple places:

| Aging level | Duration | Badge style |
|---|---|---|
| **Fresh** | Under 7 days | Green text, subtle |
| **Aging** | 7-14 days | Warm text with a bordered pill |
| **Stale** | Over 14 days | Red pill with white text -- visually prominent |

Aging resets when the opportunity advances or moves to a different stage. This provides a lightweight cycle-time signal without requiring explicit workflow timers.

### 2.7 Origin Types

Each opportunity has an origin type that classifies where it came from:

| Origin | Label | Meaning |
|---|---|---|
| demand | Request | Customer or stakeholder request |
| supply | Idea | Internally generated idea |
| incident | Incident | Urgent issue or fire |
| debt | Debt | Technical or organizational debt |

Origin tags appear in the list view next to the horizon label. They help POs monitor pipeline balance -- a pipeline dominated by internal ideas with few customer requests may signal a blind spot.

### 2.8 The Funnel

The funnel bar at the top of the Pipeline view (in stage mode) is a proportional visualization:

```
 Explore (4)  ========
 Sketch (3)   ======
 Validate (1) ==
 Decompose(1) ==
```

A healthy funnel narrows left to right (many ideas in, few survive). If the funnel doesn't narrow, you're not saying no enough.

The funnel is **interactive**: hover a stage segment and the list dims all items except those at that stage. This provides a quick filter without changing the sort order. A small **+** button next to the funnel opens an inline input to add a new opportunity.

---

## 3. Managing People and Commitments

### 3.1 Linking People to Opportunities

1. In the detail pane's signal grid, find a cell that needs expert input
2. Use the person picker to assign someone -- choose an existing name or type a new one
3. The assignment shows: name, how long ago it was assigned, and whether a response exists

People have one of three roles:

| Role | Meaning |
|---|---|
| **Expert** | Provides knowledge for a specific perspective -- the person who fills the cell |
| **Approver** | Someone whose approval you need before this can progress |
| **Stakeholder** | Cares about the outcome, wants to stay informed |

### 3.2 Commitments

1. In the detail pane, scroll to the Commitments section
2. Click to add a commitment: specify who it was promised to, which stage milestone, and a deadline
3. Active commitments appear as alerts near the top of the detail pane with urgency indicators:
   - "5d left" -- upcoming, informational
   - "3d overdue" -- past deadline, red alert
4. The list view uses overdue commitments to sort the opportunity into the "Blocked" bucket

---

## 4. The Deliverables Matrix

### 4.1 Understanding the Matrix

The Deliverables tab shows a cross-reference table:

- **Rows** = deliverables, sorted by **leverage score** (sum of linked opportunity maturity weights / effort)
- **Columns** = opportunities at Validate or Decompose stage (or any stage with existing links)
- **Cells** = coverage dots showing how much of the opportunity is served by the deliverable

The matrix answers: "What work items support which business goals, and how completely?"

### 4.2 Coverage Links

Each cell cycles through three states on click:

| State | Symbol | Meaning |
|---|---|---|
| Not linked | (dot) | This deliverable doesn't serve this opportunity |
| Partial | (half circle) | Partially addresses the opportunity |
| Full | (filled circle) | Fully addresses the opportunity |

### 4.3 Size and Certainty

Each deliverable row shows:

- **Size** -- T-shirt estimate (XS, S, M, L, XL). Click to cycle. Null = unestimated.
- **Certainty** -- 1-5 bars. Click to cycle. Null = unestimated.

Row height scales proportionally with size -- XL rows are visually taller than XS rows. Unestimated rows have blurred/gradient borders to call attention to the gap.

### 4.4 Contributor Columns

After a visual divider, the matrix shows **contributor columns** -- one per unique person assigned across all deliverables:

- Names are shown as vertical text headers (same style as opportunity headers)
- Each column header shows the person's name and assignment count
- Columns are sorted by assignment count descending (busiest people first -- bottleneck visibility)
- Cells are binary dots: filled = assigned, empty = not assigned
- Inherited assignments (from opportunity expert links) are shown as muted dots and can't be toggled
- Extra assignments can be toggled on/off by clicking

### 4.5 External Dependencies

If a deliverable has an external dependency (e.g. "Partner API access from Acme Corp"), a warning icon appears at the end of the row. Hover to see the dependency text. External dependencies are edited in the detail pane.

### 4.6 Row Status Badges

Rows show status badges:

| Badge | Condition | Meaning |
|---|---|---|
| **orphan** | No links to any opportunity | This work doesn't serve any known goal |
| **partial only** | All links are partial, none full | No opportunity is fully addressed by this deliverable |

### 4.7 Matrix Navigation

- **Drag reorder** -- drag the handle on rows or drag column headers to reorder
- **Vertical zoom** -- slider at the top adjusts row height scaling (0.4x - 2x)
- **Funnel label** -- "Showing X of Y opportunities (Validate and Decompose)"
- **Click a row** -- opens the deliverable detail pane on the right; the row highlights with an accent border
- **Keyboard** -- j/k to navigate rows

### 4.8 Gap and Coverage Indicators

- **Column-level**: opportunity columns with zero linked deliverables show a **"gap"** badge -- this opportunity needs work items
- **Fully covered**: opportunity columns where decomposition is marked complete and all links are full show a green bottom border
- **Legend**: explains the dot states and interaction patterns

---

## 5. The Deliverable Detail Pane

### 5.1 Opening the Pane

1. Click any row in the deliverables matrix -- the detail pane opens on the right
2. The selected row highlights with an accent left border
3. Click again (or the close button) to close

### 5.2 Editing a Deliverable

The pane shows:

- **Title** -- editable text field
- **External link** -- URL to Jira/Linear/etc.
- **Size picker** -- XS through XL toggle buttons; click to select, click again to deselect
- **Certainty picker** -- 5-level bar; click a level to set, click the same level to clear
- **External dependency** -- free text describing any external dependency
- **Linked opportunities** -- list showing each link with coverage toggle, stage label, and unlink button. Click an opportunity name to navigate to the Pipeline view. A "+ link opportunity" button opens a picker for unlinked opportunities.
- **Built by** -- contributor chips. Inherited experts shown in italic (can't remove). Extra contributors can be added/removed.
- **Deliver to** -- consumer chips. Inherited stakeholders/approvers shown in italic. Extras editable.
- **Delete** -- permanently removes the deliverable and all its links

---

## 6. Horizon Mode (Pipeline by Horizon)

> **Note:** Horizon grouping is now a mode within the Pipeline view (press **Tab** to toggle), not a separate tab. The functionality described here is accessed from the Pipeline view.

### 6.1 Understanding Horizon Mode

Toggle the Pipeline view to horizon mode (press **Tab** or click the grouping toggle). Opportunities are grouped by horizon, sorted chronologically. Each horizon group has:

- A **header row** with the horizon label (double-click to rename), effort summary (size breakdown, average certainty dots, unsized count), and a remove button for empty custom horizons
- **Opportunity rows** within the group, draggable between horizons
- **Click the header** to zoom into that horizon, showing expanded detail for every opportunity

### 6.2 Horizon Row Details

Each opportunity row shows:
- Drag handle for reordering between horizons
- Title with urgency badge if a commitment deadline is near
- Stage badge (Explore/Sketch/Validate/Decompose)
- Signal dots for the current stage's three perspectives
- **Risk flags**:
  - Objection flag (red) -- at least one unresolved objection blocks advancement
  - Aging flag (red/yellow) -- stuck in current stage for 7+ or 14+ days
  - Unscored flag (red/yellow) -- perspectives not yet consulted
  - No-deliverables flag (yellow) -- late-stage opportunity with no linked work items
  - Maturity-mismatch flag (red/yellow) -- early-stage opportunity targeted at a near-term horizon
- Deliverable count

### 6.3 Managing Horizons

- **Add a horizon**: use the input at the bottom of the horizon view
- **Rename a horizon**: double-click the label and type
- **Remove a horizon**: click the remove button (only visible on empty custom horizons)
- **Move opportunities between horizons**: drag and drop between horizon groups

### 6.4 Detail Pane

Clicking a row opens the standard opportunity detail pane on the right, with the same editing capabilities as in stage mode.

---

## 7. The Latest View

### 7.1 Understanding the Latest View

The Latest view (press **1**) is the PO's morning start screen. It has two sub-views toggled in the header: **News** (the default) and **Overview**.

**News** is an actionable feed of what changed since the last visit. Items are ranked by **urgency x recency** and grouped into three importance tiers:

| Tier | Examples |
|---|---|
| **Tier 1** | Objection scored, commitment overdue, item discontinued, stage advanced |
| **Tier 2** | Score added, deliverable linked, commitment due soon, aging to stale |
| **Tier 3** | Verdict edited, notes changed, horizon updated, size changed |

The feed uses an **aging model** with three visual bands:

| Band | Meaning | Visual treatment |
|---|---|---|
| **Fresh** | New or unread items | Full prominence -- tier-1 items as headline cards, tier-2/3 as wire items |
| **Read** | Marked as read via "Mark all read" | Muted styling with "Read" label |
| **Older** | Events older than 3 days | Collapsed `<details>` section with count |

Items have two categories with different lifecycles:
- **Events** (score-added, stage-advanced, etc.) naturally decay and disappear after 5 days
- **Conditions** (commitment-overdue, stale, unscored-assignment, etc.) persist as long as the underlying situation exists and generate **resolution notices** (e.g. "Commitment fulfilled", "No longer stale") when resolved

**Flap protection**: conditions that appear and resolve within 24 hours do not generate resolution notices.

**Board Health** shows aggregate metrics: pipeline shape (stage counts + stale), consent coverage (percentage + objections), commitments (overdue/due-soon), deliverables (orphans + avg links), and origin balance.

### 7.2 Return Summary

When the PO returns after 4+ hours, a banner summarizes what happened: e.g. "While you were away: 2 objections, 1 commitment overdue, 3 scores added." The banner auto-dismisses on the next snapshot change.

### 7.3 The Briefing Clock

The feed compares current board state against a **board-wide snapshot**. This is distinct from the per-person meeting snapshots -- meeting snapshots track what a specific person has been told, while the briefing snapshot tracks what the PO has seen.

Clicking "Mark all read" moves fresh items to the Read band and captures a new snapshot. Read items remain visible (muted) until they age past 3 days and move to the Older band, then decay entirely after 5 days.

---

## 8. Meeting Prep

### 8.1 Understanding the Meetings View

The Meetings tab (press **4**) is designed for 1:1 preparation. The left sidebar lists all people linked to any opportunity or deliverable, sorted by urgency (overdue commitments first, then most assignments, then alphabetical).

Each person entry shows:
- Name and involvement counts (opportunities, deliverables)
- Urgency badges (overdue commitments, upcoming deadlines, awaiting input count)
- Role tags and "last met" date

### 8.2 Building an Agenda

Click a person in the sidebar to see their personalized agenda:

1. **Changed Since Last Meeting** -- entities modified since the last meeting with this person, with change badges (e.g. "stage: explore to sketch", "signal added"). Clickable to navigate to the opportunity.

2. **Commitments** -- promises made to/by this person, sorted by urgency. Shows deadline status (met, overdue, upcoming).

3. **Awaiting Input** -- unscored signal cells assigned to this person. Includes the full scoring UI (score buttons + verdict input) so cells can be filled in directly during the meeting without navigating elsewhere.

4. **Conflicting Signals** -- perspectives that disagree at the same stage (e.g. "Tech positive vs. Business negative on SSO") with their verdicts, surfaced for discussion.

5. **Deliverables** -- work items this person is involved with, showing role, size, certainty, and linked opportunities.

6. **Linked Opportunities** -- general context of opportunities this person is connected to via assignments or commitments.

7. **Previous Meetings** (last 5) -- history log with dates and notes.

### 8.3 Completing a Meeting

Click "Done" to stamp the current timestamp. This saves a snapshot so next time you open this person's agenda, the "Changed Since Last Meeting" section will show only changes *since this meeting*.

Note: meeting completion cannot currently be undone. Forgetting to score a cell before clicking Done means you'll need to fill it in on a subsequent visit.

---

## 9. Cross-View Navigation

Clicking entity names in detail panes and news items navigates across views, switching the active tab and selecting the target entity.

### 9.1 From Latest to Pipeline / Deliverables

1. Click any news item -- the app switches to the Pipeline view (for opportunities) or Deliverables view (for deliverables) and selects the relevant entity
2. In the Overview sub-view, clicking an opportunity or deliverable row navigates to the corresponding view

### 9.2 From Deliverables to Pipeline

1. In the deliverable detail pane, click an opportunity name in the linked opportunities list
2. The app switches to the Pipeline view and selects that opportunity
3. The opportunity's detail pane opens

### 9.3 From Pipeline to Deliverables

1. In the opportunity detail pane's Deliverables section (visible at Decompose stage or when links exist), click a deliverable name
2. The app switches to the Deliverables view and selects that deliverable
3. The deliverable's detail pane opens

---

## 10. Data Management

### 10.1 Persistence

All data is saved to localStorage automatically on every state change. Data survives page refreshes and browser restarts. Clearing browser data or localStorage will erase the board.

### 10.2 Undo

Press **Ctrl+Z** to undo the last action. Up to 20 snapshots are stored. Undo restores the full board state including triage ordering, funnel counts, and all signal data. This is semantic undo, not text undo.

### 10.3 Import and Export

**Export:**
- **JSON** -- full board backup (all opportunities, deliverables, links, signals, meetings). Can be re-imported for a full restore.
- **CSV** -- opportunities only, as a flat table. Suitable for sharing with spreadsheet users or stakeholders.

**Import:**
- **JSON** -- replaces the entire board with the imported data. Meeting history is preserved separately.
- **CSV** -- opportunities imported from CSV format.
- **Merge import** -- adds imported data to the existing board with ID-based conflict resolution using `updatedAt` timestamps.

### 10.4 Reset

A reset option reloads the sample data, replacing the current board. This is destructive and not easily undone (though Ctrl+Z may recover the previous state if used immediately).

---

## Journey Map

```
                    Opportunities Tab                    Deliverables Tab
                         |                                     |
       +-----------------+                     +---------------+
       |                 |                     |               |
  Add opportunity   Select from list      Add deliverable  Click matrix row
  (+ button or n)        |                (input or n+Tab)     |
       |                 |                     |               |
       v                 v                     v               v
  Appears in        Detail pane opens     Appears as row   Detail pane opens
  Explore           (list compresses)     (orphaned)            |
       |                 |                     |               |
       |       +---------+----------+          +-------+-------+------+
       |       |         |          |          |       |       |      |
       |  Score cells  Manage    Set exit   Set size  Link   Add     Set
       |       |       people    state      Set cert  opps   people  ext.dep
       |       |         |      (x key)      |    Set coverage
       |       v         |          |          |               |
       |  Consent        |          |          |         Click opp name
       |  achieved?      |          |          |               |
       |    |            |          |          |               v
       | +--+----+       |          |     Navigate to Pipeline view
       | |       |       |          |
       | Advance Blocked |     +----+----+
       | (a key) (fix    |     |         |
       |  |    issues)   |   Kill    Reactivate
       |  v              |   Park    (restores
       | Next stage      |   Merge    previous
       |  |              |            state)
       v  v              |
  Decompose +------------+
  stage                  |
       |                 |
       v                 v
  Link/create        Meeting prep:
  deliverables       auto-generated
       |             1:1 agendas
       v
  Roadmap: grouped by horizon
  with risk flags + drag-drop
```

---

## 11. What's Not Yet Built

Features from the product spec that are not yet implemented:

| Feature | Notes |
|---|---|
| Skatting integration | Size/certainty are manual only |
| Token budgets | v2 feature |
| Opportunity nesting | Flat list only |
| Named scenarios | Snapshot-based side-by-side compare |
| Horizon filter/collapse | All horizons always visible |
| Filtering on list view | No filter by bucket, perspective, or origin |

Features that have been built beyond the original spec:

| Feature | Description |
|---|---|
| Latest view (news feed) | Board-wide news with aging model (Fresh/Read/Older bands), resolution notices, flap protection |
| Board Health dashboard | Aggregate metrics: pipeline shape, consent coverage, commitments, deliverables, origin balance |
| Return summary | "While you were away" banner after 4+ hours absence |
| Pipeline view | Stage/horizon grouping with funnel + zoom |
| Card aging | Visual badges (fresh/aging/stale) based on days in current stage |
| Origin types | Request/Idea/Incident/Debt classification per opportunity |
| Full exit states | Kill/Park/Merge with inline reason capture |
| WIP limits | Funnel coloring, stage badges, triage nudges |
| Interactive funnel | Hover a stage segment to highlight matching list items |
| Keyboard navigation | Full vim-style nav (j/k), view switching (1-4), quick-add (n), advance (a), exit (x) |
| 20-level undo | Ctrl+Z with semantic state restoration |
| JSON/CSV import + export | Full board backup, merge import, CSV round-trip |
| Quick-add dialog | Press n from any view to create opportunity or deliverable |
| Roadmap risk flags | Visual risk indicators per row |
| P2P sharing | Nostr relay rooms with encrypted board publishing |
| Contributor scoring | Remote verdict submission for assigned cells |
| Auto-poll for scores | PO gets badge notification when submissions arrive |
| Meeting role filter | All/Team/Stakeholders filter with talking points for stakeholder persons |
| Cross-view navigation | Click entity names to navigate between views |
| Multi-board support | Board picker with create/switch/delete |
| Brain dump import | Bulk text import for rapid board population |
| Welcome page | Onboarding for first-time users |
