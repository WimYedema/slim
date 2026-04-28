# Upstream — UX Review

A critical review of the current PoC from multiple perspectives. Each reviewer walks through the tool with fresh eyes, noting what works, what confuses, and what's missing. Based on the actual PoC: four tabs (Briefing, Pipeline, Deliverables, Meetings), localStorage persistence, full keyboard navigation, JSON/CSV import & export, 20-level undo, newspaper-style briefing with importance tiering, interactive funnel, stage/horizon grouping, signal grid with consent-based gating, meeting prep with snapshot-based change detection, and a rich detail pane with commitments, people assignments, and exit states.

---

## Review 1: Alex — The Tactical PO

**Profile**: 4 years as PO. Manages ~20 active opportunities across 2 teams. Currently tracks everything in a Jira epic hierarchy plus a Google Sheet called "Product Radar." The sheet is the actual decision-making tool; Jira is for developers.

### First Impression

"Four tabs — I can see the shape of my job in this app. Opportunities is where I think, Deliverables is where I plan, Roadmap is what I show stakeholders, Meetings is how I coordinate. That's my actual workweek, not a generic Kanban."

"The smart triage is immediately useful. Blocked at the top, needs input next, on track at the bottom. That's exactly how I work through my inbox on Monday mornings."

"The keyboard shortcuts are a nice surprise — I pressed ? out of habit and got a full shortcut reference. j/k to move through the list, a to advance, n to add from anywhere. This feels like a tool built by someone who actually processes a backlog."

### What Works

**Signal grid** — "This is the real value. Three perspectives, four stages, simple scores. I can look at one card and instantly see: we've heard from design but not engineering. That question would have taken me 15 minutes of Slack archaeology before."

**Consent-based gating** — "I like that advancement isn't checkbox-based. It's: has everyone been heard, and does anyone object? That matches how mature teams actually make decisions. It also forces me to *talk to feasibility before moving to Sketch* instead of saying 'we'll figure out the tech later.'"

**Contextual nudges** — "The one-liners under each card ('Who has this problem?', 'Feasibility objection — resolve') are subtle but powerful. They turn the list into a to-do list without being prescriptive."

**Coverage matrix** — "I've been building versions of this in spreadsheets for years. The many-to-many mapping between goals and work items — that's the right abstraction. Contributor columns are a nice bonus — I can see who's overloaded at a glance."

**Roadmap view** — "Horizons grouped by quarter, with T-shirt size breakdown per horizon (2xS 1xM 3xL) — that's exactly what I'd put in a stakeholder slide. Drag-and-drop between horizons is intuitive. The certainty dots in the header give me a quick confidence read."

**Risk flags on the roadmap** — "Every row has tiny icons that tell me what's wrong: a symbol for objections, for things stuck too long, for unscored perspectives, for missing deliverables, for things targeted at near-term horizons that are still in early stages. That last one — the maturity-horizon mismatch — is exactly the warning my spreadsheet never gives me."

**Meeting prep** — "The per-person agenda is like having a pre-built briefing doc. Changes since last meeting, outstanding commitments, unscored cells — it saves me the 20 minutes I normally spend before every 1:1 assembling context from three different tools."

**Card aging** — "Each card shows how many days it's been sitting in its current stage. Fresh items are subtle. Things that have been sitting for a week get a warm badge. After two weeks, it's a red pill that screams 'this is stuck.' I don't need Jira cycle time reports — I can *see* the aging."

**Exit states** — "When I discontinue something, I get to choose *why* — kill it entirely, park it for later, incubate it as a seed for the future, or merge it into another opportunity. And there's an inline text field to capture the reason. Three months from now when someone asks 'why did we drop X?' I'll have the answer right there."

**Origin tags** — "Each opportunity is tagged as Request, Idea, Incident, or Debt. In the list view, these show as tiny tags next to the horizon. Useful for spotting an imbalance — if my pipeline is 80% ideas and 10% customer requests, something's wrong."

**Import/export** — "JSON export for full board backup, CSV export for my spreadsheet-loving stakeholders. JSON import to restore a board or share it with a colleague. That was the last thing I needed to start using this with real data."

**Undo** — "Ctrl+Z. Twenty levels deep. I accidentally discontinued something and just undid it. Simple, essential."

### What Confuses

**Signal scores vs. stage** — "I scored some cells at the Explore stage and then advanced to Sketch. Are those Explore-stage scores still relevant? Do I re-score at Sketch? The grid shows all stages, which is good for history, but I'm not sure what I'm supposed to fill in at each stage."

**Coverage semantics** — "Partial vs. full coverage — what's the threshold? Is 'partial' a 20% or an 80%? I'd instinctively want three levels (none / partial / full), which is what you have, but I'd also want to know *what's missing* for a partial link. Maybe a note per link?"

**Meetings 'Done' finality** — "I clicked 'Done' on a meeting and the snapshot locked in. But I forgot to score one cell first. I can't undo the meeting completion or re-open the agenda with the items that were showing. I need an undo or at least a confirmation prompt."

**Funnel interactivity is hidden** — "I hovered over the funnel by accident and the list rows dimmed — only the items matching that stage stayed lit. Cool! But I wouldn't have discovered this without stumbling on it. Maybe a tooltip or visual hint that the funnel is interactive?"

### What's Missing (Most Wanted)

1. **Filtering** — show me only blocked items, or only items where I haven't heard from feasibility
2. **Bulk operations** — select three opportunities, move them all to the same stage or horizon
3. **CSV import for migration** — JSON import works for backups, but I want to paste a list of opportunity titles from my existing spreadsheet
4. **Saved views / presets** — "My Monday triage" vs. "Stakeholder review" with different columns visible

### Verdict

"This is the first tool I've seen that models the shape of a PO's actual job — not just ticket management but the upstream thinking. The four-view structure (triage, matrix, roadmap, 1:1 prep) matches my workflow. Persistence works. Keyboard shortcuts work. I can import and export data. The aging badges and exit state tracking add substance beyond what my spreadsheet does. I'm switching from my Google Sheet."

---

## Review 2: Jordan — The Solo PO

**Profile**: Only PO in a startup (team of 6). Wears many hats. Currently uses a Notion database with a Kanban view. The three perspectives (desirability/feasibility/viability) are columns in the database, but nobody fills them in consistently. Shipping velocity is high but direction is uncertain.

### First Impression

"Four tabs is a lot for a team of 6. I'd live in Opportunities and maybe peek at the Roadmap before a board meeting. The Meetings tab seems designed for someone with 10+ stakeholders — I have 3. The Deliverables matrix is genuinely useful but I'd use it weekly, not daily."

"But the model is right. The problem isn't the *number* of views. The problem is I never ask the right questions systematically. Last month we shipped a feature that nobody on the customer success team thought was important."

"I pressed n and got a quick-add dialog. Tab to switch between opportunity and deliverable, type a title, Enter, done. That's the fast capture I need when an idea hits mid-meeting."

### What Works

**The funnel** — "Small but useful. I can see at a glance that I have 5 things in Explore and only 1 in Validate. That means I'm not validating enough. Simple, effective. And when I hover a stage segment, the list highlights just those items. Nice discovery tool for a small pipeline."

**Deliverable orphan badges** — "We have at least 2 'passion projects' in-flight right now that don't serve any known user need. Seeing 'orphan' on a deliverable row makes that painfully obvious."

**Discontinue with choices** — "I kill and revive ideas constantly. Most tools make killing permanent, so I end up with a 'maybe later' tag that I never revisit. Having kill vs. park vs. incubate — each with a different semantic meaning — makes me actually think about why I'm shelving something instead of just burying it."

**Horizon editing** — "I can double-click a horizon label to rename it, or add new ones freeform. 'Q2 launch' instead of '2026Q2' — that's how I actually think about timelines. The datalist autocomplete in the detail pane is a nice touch."

**Persistence + undo** — "Data survives refresh. And if I make a mistake, Ctrl+Z takes me back. Relief."

**Keyboard shortcuts** — "j/k through the list, Enter to edit, a to advance. This is how I process a backlog — rapid keyboard-driven triage. I was doing something like this with Notion's keyboard shortcuts but this is more purpose-built."

**Aging badges** — "The red pill that shows '14d' on a stale opportunity — that's the accountability I'm missing in Notion. My '17-day-old idea that nobody's looked at' is now visually screaming at me."

### What Confuses

**People assignments in a small team** — "I'm the only PO. The engineer fills in feasibility, I fill in the rest. The people management features (expert/approver/stakeholder roles, person pickers on cells) feel like overhead for my context. Can I skip it entirely?"

**Size vs. certainty for small teams** — "I set size to 'M' and certainty to 3. What does that tell me that I don't already know from a 5-minute conversation? It makes more sense in the roadmap header (sum per horizon), but at the individual deliverable level it feels like ceremony."

**Matrix column ordering** — "The opportunities in the matrix columns are at Validate and Decompose stages. But what if I have a deliverable that's related to something still in Explore? I can't see that link. I have to go back to the Opportunities tab to check."

**Roadmap as a separate view from list** — "What I want is: my Opportunities list sorted/grouped by horizon. The Roadmap view gives me that but with less detail per row (no nudges, no gap prompts). Why can't the list view have a 'group by horizon' toggle?"

**"now" and "next" labels** — "Two opportunities in the list have 'now' and 'next' tags next to their horizon. But only for the nearest two horizons — the rest show nothing. It took me a moment to realize these aren't custom tags but computed labels based on horizon ordering. Useful once you understand them, but not self-explanatory."

### What's Missing (Most Wanted)

1. **Lightweight mode** — collapse people management, simplify the signal grid to just pass/fail, minimize ceremony for teams under 10
2. **Mobile view** — I review my product landscape during my commute. A responsive read-only summary would be useful
3. **Single combined view** — I want to see opportunities AND deliverables at once, maybe the matrix but with triage nudges visible
4. **Horizon grouping on list view** — not a separate tab, just a sort/group toggle

### Verdict

"The model is right but the UX assumes a larger-team context. For a solo PO, I want less ceremony per card and faster throughput. The quick-add (n key) and keyboard navigation (j/k) help a lot — processing 8 items took me under a minute. The aging badges give me a visual conscience. But my daily driver is the triage list with nudges. Make that even faster to process (filtering, batch actions) and I'd completely switch from Notion."

---

## Review 3: Sam — The Engineering Lead

**Profile**: Tech lead on a 5-person team. Gets pulled into "feasibility checks" that are usually 30-minute interruptions. Would love a way to asynchronously leave feasibility assessments without sitting in a meeting.

### First Impression

"Oh, I only care about one column: Feasibility. And I want to fill it in on my own time, without attending a refinement session. Does this let me do that?"

"Currently single-user. But the Meeting Prep tab is interesting — it literally builds my 1:1 agenda. If the PO showed me that meeting agenda screen, I'd see: 'Sam has 3 unscored feasibility cells, 1 overdue commitment, and the SAML deliverable changed since last time.' That's useful even without multi-user — the PO runs the tool and walks me through my items."

### What Works

**Signal grid decouples perspectives** — "Finally someone understands that 'is this desirable?' and 'can we build this?' are answered by different people at different times. Every other tool lumps them into one 'priority score' and then the PO fills it in alone."

**Meeting prep inline scoring** — "Wait — in the Meeting tab, I can score cells directly? The PO opens my agenda, I look at my unscored cells, and I can set scores and verdicts right there without navigating to 5 different opportunity detail panes. That's the async workflow I wanted, just... in person."

**Verdicts** — "I can write *why* I scored Feasibility as 'objection' — like 'requires migration to new auth provider, 3-sprint effort.' That verdict persists. Nobody will ask me the same question three weeks later."

**Size column in the matrix** — "T-shirt sizing is the right level for upstream planning. I don't want story points here. XS-XL tells me enough to spot scope mismatches between opportunities."

**Change detection** — "The 'Changed since last meeting' section shows me exactly what shifted — 'Stage: explore to sketch', 'feasibility@validate: unscored to positive'. That saves the first 5 minutes of every 1:1 where we try to remember what happened."

**Roadmap risk flags** — "The stuck-time icon shows things sitting too long, the unscored icon shows missing perspectives. As a tech lead, I look at the roadmap and immediately spot where *I* haven't provided input. No Slack nudging needed — the tool does it visually."

### What Confuses

**Score semantics** — "Positive / Uncertain / Negative — are these my confidence in the *outcome* or my *willingness to proceed*? If I think we can build it but it'll take 6 months, is that Positive (yes it's feasible) or Uncertain (I have concerns about timeline)?"

**Multiple stages in the grid** — "You want me to re-assess Feasibility at Explore, Sketch, Validate, AND Decompose? That's 4 assessments per opportunity. In practice, Feasibility at Explore is 'gut check: is this even possible?' and at Validate it's 'we've spiked it, here's the result.'" *(Note: the tool provides stage-specific prompts as verdict placeholders, e.g. "Could we build it?" at Explore vs. "Did a spike confirm we can build it?" at Validate. But the placeholder vanishes when you start typing. The question should remain visible as a label.)*

**Roadmap is for POs** — "I don't need the Roadmap or Meetings tabs. Can we have role-based tab visibility? As a tech lead, show me: Deliverables matrix + my assigned cells."

**Exit states don't affect me** — "The PO discontinued something with 'park' and a reason. I can see the history in the exited section at the bottom of the list. But as a tech lead, I just need this removed from my work queue. The park/kill/incubate distinction is PO thinking — I don't need to know it."

### What's Missing (Most Wanted)

1. **Contributor view** — I want to see my TODO list across all opportunities: "Cards where Feasibility is unscored and I'm assigned"
2. **P2P sharing** — the core value prop for me is *not attending meetings*. Let the PO share a link, I open it, fill in my cells, done
3. **Score semantics help text** — in the detail pane, near the score buttons, a one-liner explaining "consent: willingness to proceed, not prediction of success"
4. **Stage-specific guidance made visible** — cell prompts should be visible labels, not placeholder text that vanishes when you start typing

### Verdict

"The data model is ideal for separating concerns. The Meeting Prep tab is a clever stopgap for multi-user — even in single-player mode, it structures 1:1s effectively. The change detection is the kind of thing that would make me trust the PO's tool instead of asking 'what changed since last week?' The roadmap risk flags give me a passive awareness of where I'm needed. But I still want async self-service. P2P sharing would make this my favorite product tool."

---

## Review 4: The Spreadsheet Loyalist

**Profile**: Experienced PO who has built elaborate spreadsheets over 10 years. Has a battle-tested system. Skeptical of new tools because every tool they've tried either (a) forces a specific methodology, or (b) becomes a data silo they can't export from.

### First Impression

"Can I import my existing data? Let me check... JSON import for a full board backup. CSV export for the opportunities list. OK, I can get data *out*. Getting data *in* is JSON only — I'd need to structure my spreadsheet data as JSON to import. Not ideal but not a dead end."

"Let me look at the roadmap... OK, this is what my 'Product Roadmap' Google Sheet does. Opportunities grouped by quarter, with size breakdowns per horizon. But mine has 15 columns of metadata. What does this give me that Sheets doesn't?"

### What Works

**The triage sort** — "OK, this is useful. My spreadsheet doesn't automatically sort by 'what needs attention.' I have to manually scan all 30 rows. If this tool can surface the 3 things I should work on today, that saves me 20 minutes."

**The signal grid** — "This is structured where my spreadsheet is free-form. I have a 'Desirability' column but it's just a number 1-5 with no explanation. The verdict + person + timestamp model is much richer. I'd actually have traceability."

**Consent model** — "I like that it's not a scoring model. My spreadsheet has WSJF/RICE formulas that nobody trusts. This is more honest: have relevant people been consulted, and does anyone object? That's a better question than 'what's the weighted priority score?'"

**Roadmap size summaries** — "The horizon header showing size breakdown, certainty dots, and unsized count — that's my quarterly planning summary in one line. Compact, scannable. Better than my SUMPRODUCT formula because it separates size from certainty."

**Meeting prep** — "Huh. I've been preparing for 1:1s by manually scanning my spreadsheet and writing notes. This auto-generates the agenda based on what changed, what's overdue, and what's unscored. If I had this alongside my sheet, the meeting prep alone would justify the tool."

**Undo** — "Twenty levels of undo (Ctrl+Z). I discontinued an opportunity and immediately undid it. My spreadsheet has undo too, but this tool's undo preserves all the computed state (triage buckets, funnel counts) — it's not just text undo, it's semantic undo."

**Card aging** — "My spreadsheet has a 'created date' column that I compute days-since-creation on. But this tool shows aging *per stage*, not per card. A card that's been in Explore for 14 days gets a red stale badge — but if it advances to Sketch, the counter resets. That's smarter than my spreadsheet formula."

**Origin tracking** — "Request vs. Idea vs. Incident vs. Debt — that's my 'source' column in the spreadsheet. Having it as first-class metadata with color-coded tags is better than a free-text column."

### What Confuses

**Data model rigidity** — "I have custom attributes on my deliverables: target sprint, team assignment, risk category. Where do I put those? The detail pane has title, size, certainty, external dependency, and that's it. My spreadsheet has 15 columns."

**No calculated fields** — "In my spreadsheet, I compute: (total estimated days x risk multiplier) / remaining sprint capacity = probability of delivering this quarter. Where does that calculation live here? The roadmap shows T-shirt breakdown, but doesn't synthesize it into 'can we deliver this quarter's plan?'"

**Export is one-way** — "I can export CSV and JSON. But I want to round-trip: export opportunities to a spreadsheet, add columns, then import them back. The JSON import doesn't merge — it replaces the entire board. I'd lose my meeting history."

### What's Missing (Most Wanted)

1. **CSV import** — hard requirement. JSON import is there but I need to import from a spreadsheet without manually converting to JSON
2. **Custom attributes** — or at least a JSON/notes field per card where I can stash my extra data
3. **Computed summaries** — total effort per horizon (weighted by size), coverage percentage per opportunity, time-since-last-movement per opportunity
4. **Print view** — I print my roadmap for stakeholder reviews. I need a clean summary I can take to meetings
5. **Merge import** — import data *into* an existing board without replacing it

### Verdict

"Much better than before. Persistence, undo, and export were my blockers — all three now work. The four-view structure is more capable than my spreadsheet for triage, coverage mapping, and meeting prep. The aging badges and exit state tracking give me traceability I'd need dozens of spreadsheet formulas to replicate. CSV import and custom attributes are what I still need before fully switching."

---

## Review 5: Maria — The Stakeholder

**Profile**: VP of Product at a mid-size SaaS company. Reviews the product roadmap monthly. Needs high-level visibility into what's planned, what's at risk, and what's being dropped. Doesn't touch the tool daily — consumes summaries prepared by POs.

### First Impression

"The Roadmap tab is what I'd look at. Horizons, grouped opportunities, size breakdowns — that's the quarterly view I ask for in every product review. The certainty dots are useful: if Q2 is all 1-dot certainty, we're planning on wishes."

"But where's the executive summary? I want: this quarter we're committing to 5 opportunities, 3 are validated, 2 are still sketching. We have 12 deliverables, 4 are unsized. Red flag: 2 opportunities in Q2 still have unresolved objections."

### What Works

**Roadmap view** — "This is the only view I need. Horizons as rows, opportunities under each, size breakdown in the header. If the PO showed me this in a review, I'd have the context I need in 30 seconds."

**Risk flags everywhere** — "Every roadmap row has risk indicators. Symbols for objections (someone disagrees), things stuck too long, things in early stages targeted at near-term horizons. That last one is the killer feature for me — if something's still in Explore and we're targeting it for this quarter, I want to know *now*."

**Stage badges on roadmap rows** — "I can see that 3 of my Q2 items are at Validate and 1 is still at Explore. That Explore one is a red flag — we're committing to deliver something in Q2 that we haven't even sketched yet. And the mismatch flag confirms it."

**Urgency badges** — "Overdue commitments visible right in the roadmap row — that's accountability. 'Promised DACH partner: 5d overdue' staring at me from the roadmap. Good."

**Origin tags** — "I can see at a glance whether our Q2 plan is customer-driven (Request) or internally sourced (Idea). If everything in Q2 is Idea and nothing is Request, we're not listening to customers."

**Exited items visible** — "The Opportunities tab has a collapsed section at the bottom showing discontinued items with their exit reason. I can see *why* things were killed or parked — that's the decision history my organization always loses."

### What Confuses

**Roadmap shows all horizons including far-future** — "I have 3 opportunities in 2026Q4. I don't care about Q4 in a Q2 review. I want to collapse or filter horizons."

**No summary statistics** — "How many opportunities total? How many are at risk? What's the total effort per horizon? I can count manually but that defeats the purpose of a tool."

**Can't tell what changed since last review** — "The Meeting Prep view tracks changes per person, but I want changes per horizon or per the whole board. 'Since last month: 2 new opportunities added, 1 discontinued, 3 advanced stage.'"

**"now" and "next" appear in the list but not the roadmap** — "The list view shows tiny 'now' and 'next' labels next to horizons. The roadmap — where I'd actually use this information — doesn't show them. Inconsistent."

### What's Missing (Most Wanted)

1. **Roadmap summary bar** — total counts, risk indicators, effort totals per horizon
2. **Horizon filter/collapse** — hide far-future horizons, focus on NOW+NEXT
3. **Board-level changelog** — "what changed since date X" across the whole board
4. **Read-only shareable view** — a URL I can open that shows the roadmap without editing controls

### Verdict

"The Roadmap view is 85% of what I need for monthly reviews. The risk flags are a genuine improvement — I can spot maturity-horizon mismatches and stuck items at a glance. The missing 15% is summary statistics and filtering. If the PO can show me a pre-filtered 'this quarter + next quarter' roadmap with effort totals and risk highlights, I'd stop asking for slide decks."

---

## Priority Summary

Issues ranked by how many reviewers flagged them and severity:

| # | Issue | Flagged by | Severity | Effort | Status |
|---|---|---|---|---|---|
| 1 | ~~**No persistence**~~ | ~~All 5~~ | ~~Blocker~~ | — | Shipped (localStorage) |
| 2 | ~~**No import/export**~~ | ~~Alex, Loyalist~~ | ~~High~~ | — | Shipped (JSON import/export, CSV export) |
| 3 | **No multi-user / P2P** | Alex, Sam | High | L | Not built |
| 4 | ~~**Keyboard navigation**~~ | ~~Alex, Jordan~~ | ~~Medium~~ | — | Shipped (j/k, 1-4, n, a, x, ?, Ctrl+Z) |
| 5 | ~~**No undo**~~ | ~~Loyalist~~ | ~~Medium~~ | — | Shipped (Ctrl+Z, 20 levels) |
| 6 | ~~**Rationale capture on discontinue**~~ | ~~Alex~~ | ~~Medium~~ | — | Shipped (exit states + inline reason) |
| 7 | **Score semantics unclear** | Sam, Loyalist | Medium | XS | Not built |
| 8 | **Stage-specific prompts not visible enough** | Sam | Medium | XS | Partially built (placeholders exist) |
| 9 | **Meeting "Done" has no undo** | Alex | Medium | S | Not built |
| 10 | **Roadmap summary statistics** | Maria | Medium | S | Partially built (size breakdown + risk flags) |
| 11 | **Horizon filter/collapse on roadmap** | Maria, Jordan | Medium | S | Not built |
| 12 | **Funnel interactivity not discoverable** | Alex | Low | XS | Not built |
| 13 | **CSV import (not just JSON)** | Loyalist | Medium | S | Not built |
| 14 | **Merge import (additive, not replace)** | Loyalist | Medium | M | Not built |
| 15 | **Coverage link notes** | Alex | Low | S | Not built |
| 16 | **Custom attributes on deliverables** | Loyalist | Low | M | Not built |
| 17 | **Lightweight mode for small teams** | Jordan | Low | M | Not built |
| 18 | ~~**Board-level changelog**~~ | ~~Maria~~ | ~~Low~~ | — | Shipped (Briefing view) |
| 19 | **"now"/"next" labels on roadmap** | Maria | Low | XS | Not built |
| 20 | **Filtering on list view** | Alex | Medium | S | Not built |

### What Works Well (Keep)

- **Two-axis model** (opportunities vs. deliverables with many-to-many links) — every reviewer understood and valued this
- **Briefing as morning triage** — newspaper layout with tier-1 headlines, tier-2 wire feed, collapsed background
- **Smart triage with contextual nudges** — the highest-value daily feature for POs
- **Signal grid with consent-based gating** — better than scoring/ranking; forces structured thinking
- **Coverage matrix with contributor columns** — solves a real problem that no mainstream tool addresses
- **Verdicts as decision records** — traceability without formal documentation
- **Exit states with reason capture** — kill/park/incubate/merge preserves decision history with rationale
- **Card aging** — visual wear badges (fresh, aging, stale) based on days in current stage
- **Origin types** — Request/Idea/Incident/Debt tags provide pipeline composition awareness
- **Pipeline with risk flags** — surface maturity/horizon mismatches at a glance
- **Interactive funnel** — hover a stage segment to highlight matching items in the list
- **Meeting prep with change detection** — auto-generated 1:1 agendas with snapshot-based diffs
- **Keyboard-first navigation** — j/k/a/x/n/? plus number keys for views
- **20-level undo** — Ctrl+Z with semantic state restoration
- **Import/export** — JSON round-trip for boards, CSV export for spreadsheet interop
- **Persistence** — localStorage saves board + meeting state reliably

### What Needs Fixing (Prioritize)

- **Score semantics** — brief help text near the score buttons: "consent to proceed, not prediction of success"
- **Stage guidance visibility** — cell prompts exist but are placeholders that disappear on typing; make them always-visible labels
- **Meeting Done undo** — either confirm before completing, or allow re-opening last meeting
- **Funnel discoverability** — no visual cue that hovering the funnel will highlight matching rows
- **CSV import** — JSON import exists but spreadsheet users need CSV-to-opportunity conversion

### What Can Wait

- Multi-user / P2P (significant effort, unblocks Sam's async workflow)
- Custom attributes (power-user feature, the notes field is an escape hatch for now)
- Lightweight mode (design question: what do small teams actually skip?)
- Horizon filter/collapse on roadmap (complements existing risk flags)
- Mobile view (secondary platform)
- Merge import (edge case for data migration)

---

## Round 2: Post-Briefing Review

Five reviewers return after the Briefing view was added (Phase 9) and the Pipeline view replaced the separate List + Roadmap approach. Each reviewer spends 15 minutes with the updated tool.

---

### Alex — The Tactical PO (Return Visit)

**Context**: Last reviewed the tool when it had Opportunities/Deliverables/Roadmap/Meetings tabs. Now sees Briefing/Pipeline/Deliverables/Meetings.

#### First Reaction

"OK, the first tab is now Briefing instead of a list. Let me open it fresh... I see 5 headline cards with red left borders at the top, then a wire feed list below. The headlines are things like 'Gone stale in Sketch — 31d without activity' and 'Commitment to DACH partner is 3d overdue.' Below the entity name, the stale ones show bullet-pointed questions: 'Who exactly is affected, and what does done look like?' That's... really good. It's not just telling me something is stuck — it's telling me what to ask."

"The two-column layout for headlines is nice. On my wide monitor I see two headline cards side by side. On the narrow laptop it collapses to one. Responsive without me noticing."

#### What Works

**Newspaper hierarchy** — "Tier 1 gets headline cards with red border and background tint. Tier 2 is a compact wire feed — dot, description, entity name, time. Tier 3 is collapsed behind a 'Background (4)' toggle. I can scan 15 items in 10 seconds because the visual weight tells me what matters."

**Stale questions as nudges** — "The CELL_QUESTIONS appearing under stale headlines are exactly the right nudge. Three bullets telling me what I forgot to ask. I click the headline, the detail pane opens right there — no view switch — and I can score the cells immediately."

**News-first descriptions** — "'Gone stale in Sketch — 31d without activity' reads like a news headline. The entity name is on the second line, muted. I scan the description to decide if I care, then glance at the entity. That's the right reading order."

**Peek-in-place** — "Clicking a briefing headline opens the detail pane on the right, same as in Pipeline. No tab switch, no loss of context. I can work through tier-1 items one by one without leaving the briefing. That's the triage workflow I wanted."

**Mark all seen** — "After I've processed everything, I hit 'Mark all seen' and the briefing empties. Next time I open the tool, only genuine changes since this moment will appear. Clean reset."

**Stale as event, not nag** — "I noticed that stale items only appear once — as news. If I mark seen without acting, the stale item doesn't reappear next time. That's respectful. Other tools would keep nagging. This trusts me to have seen it."

#### What Could Be Better

**Commitment overdue headlines lack context** — "The 'Commitment to DACH partner is 3d overdue' headline is useful, but when I click it, I'm in the full detail pane. I wish the headline itself told me what the commitment was about — the milestone text, not just the recipient."

**No quick-park from headline** — "For stale items, 90% of the time I'll either score signals or park the opportunity. A small 'Park' action button on the headline card would save me the round-trip through the detail pane."

**Grouped items are less scannable** — "The grouped items in the wire feed say things like 'New in Sketch: Dark mode, AI-generated reports, Multi-language support.' Useful, but when there are 4+ names, the line wraps and it looks cramped. Maybe truncate after 3 with '+2 more'?"

**No count badge on the tab** — "When I'm in Pipeline view, I can't tell if there are tier-1 briefing items waiting for me. A small badge on the Briefing tab (like '3') would pull me back when something urgent happens."

#### Verdict

"The Briefing view is what was missing. Before, I had to scan the whole opportunity list to find what needed attention. Now the tool tells me. The newspaper layout with tiered urgency is exactly right — headline cards for urgent, wire feed for notable, collapsed for background. Adding the CELL_QUESTIONS as nudges on stale items is the cherry on top. This is now my morning start page."

---

### Jordan — The Solo PO (Return Visit)

**Context**: Solo PO, team of 6. Was overwhelmed by 4 tabs last time. Now evaluating brief + pipeline.

#### First Reaction

"Wait — the Briefing tab is actually useful for me. Last time I said 4 tabs was a lot. But now tab 1 says: here are the 3 things you need to deal with. I don't even need to look at the other tabs most mornings."

"The pipeline view is much better than the old separate list + roadmap. Stage grouping by default, Tab to switch to horizon grouping for my monthly board meeting. One view, two lenses. That's the right call."

#### What Works

**Briefing as daily start** — "Open the tool, see 2 headline cards and 5 wire items. Process the headlines (click → detail pane → score/park/advance), scan the wire feed, mark seen. Done in 2 minutes. My morning triage just got halved."

**Pipeline replaces two views** — "I used to bounce between List and Roadmap. Now Pipeline gives me stages (daily triage) and horizons (board prep) in one view with a Tab toggle. One fewer mental model."

**Unscored questions on stale items** — "For my team of 6, the stale items are common because I context-switch a lot. Seeing 'Could we build it?' and 'Does it fit our strategy?' under a stale headline reminds me what I forgot. I score those two cells and the stale item resolves itself."

#### What Could Be Better

**Empty briefing feels dead** — "After I mark all seen, the briefing says 'All caught up — nothing new since your last check.' Cool, but now it's a blank page. Could it show a summary — '8 opportunities, 3 in Sketch, 12 deliverables' — so the page is useful even when empty?"

**Still no lightweight mode** — "The signal grid is 4 stages × 3 perspectives = 12 cells per opportunity. For a team of 6, that's still a lot of ceremony. If I could hide the Decompose row until I actually get there, the grid would feel more approachable."

**Meetings tab still too heavy** — "I meet 3 people. The per-person agenda is nice but the Meeting view UI is designed for someone with 15 stakeholders. The person list sidebar, the snapshot comparison, the inline scoring — it's more UI than I need for a weekly 1:1 with my engineer."

#### Verdict

"The Briefing tab changes the equation. Last time I said 4 tabs was too many — now tab 1 is my daily driver and I only visit others when the briefing points me there. Pipeline combining list + roadmap is the right structural move. For small teams, the core loop is now: Briefing → click headline → act in detail pane → mark seen. Fast, focused, useful."

---

### Sam — The Engineering Lead (Return Visit)

**Context**: Tech lead, cares about feasibility cells and async workflows. Now seeing the briefing.

#### First Reaction

"I still can't use this tool independently — it's single-user, and I need the PO to walk me through it. But the Briefing view is interesting from the PO's perspective: when they open the tool before our 1:1, they now see 'Sam hasn't scored Technical at Validate (3d)' as a tier-1 headline. That's my name on a red card. The PO doesn't need to search for what to ask me — the tool built the agenda."

#### What Works

**Unscored assignment headlines** — "The 'Sarah hasn't scored Technical at Validate (3d)' headline is a direct pointer. The PO opens our 1:1, clicks it, and lands on the exact cell that needs my input. No meeting prep needed."

**Stale questions as engineering prompts** — "For stale opportunities, the questions like 'What are the technical constraints and dependencies?' are actually useful for me too. When the PO reads that during our 1:1, it structures the conversation around the right question."

**Wire feed is scannable** — "The tier-2 items ('New in Validate — SSO login for enterprise', 'New in Decompose — Webhooks API') give me situational awareness in 5 seconds. I can see what's moving without having to browse every opportunity."

#### What Could Be Better

**My name in tier 1 feels like blame** — "'Sam hasn't scored Technical at Validate (3d)' with a red border feels accusatory. I'm a busy engineer who forgot about one cell. Maybe soften the language to something like 'Awaiting Technical input at Validate' and show the person name on the second line?"

**No evidence preview** — "When I scored feasibility last time, I added an evidence URL (a Slack thread about the auth migration). In the briefing, I see 'Feasibility objection at Validate' but not the evidence. Showing the verdict one-liner in the wire feed would save me a click."

**Still waiting for async** — "The core limitation hasn't changed: I can't open this tool on my own and fill in my cells. The Briefing tab makes the PO's experience better, but mine is still mediated."

#### Verdict

"The Briefing view makes the PO more prepared for our 1:1, which indirectly makes my experience better. I spend less time in meetings because the PO already knows exactly what to ask me. The unscored assignment headlines turn the tool into a meeting agenda generator. But the fundamental gap — me being able to use this independently — remains."

---

### The Spreadsheet Loyalist (Return Visit)

**Context**: Power user with elaborate spreadsheets. Was blocked on CSV import. Now evaluating the briefing and pipeline.

#### First Reaction

"Briefing is the changelog I always wished my spreadsheet had. In Google Sheets, I added a 'Last Modified' column and conditional formatting, but I never had automated change detection. The tool sees that an opportunity went stale, that a commitment is overdue, that someone hasn't scored a cell — and surfaces all of it sorted by urgency. My spreadsheet will never do that."

"The pipeline with Tab-toggled grouping is cleaner than my separate 'Stage View' and 'Timeline View' sheets. Less to maintain."

#### What Works

**Automated change detection** — "My spreadsheet requires me to remember what changed. This tool diffs against a snapshot and tells me. The 'Gone stale' headline only appears once — it's not a formula that recalculates every time I open the sheet. That's semantically richer than anything I can build in Sheets."

**Tier hierarchy is self-sorting** — "My spreadsheet has conditional formatting for overdue items, but I have to manually sort by urgency. The briefing auto-sorts: red headlines at top, neutral wire feed below, background collapsed. The layout IS the sort."

**Questions as actionable nudges** — "The CELL_QUESTIONS under stale headlines are like inline comments in my spreadsheet, except they're computed. The tool knows which cells are empty and shows the right question. My spreadsheet doesn't know its own schema."

#### What Could Be Better

**Still no CSV import** — "I have 40 opportunities in a spreadsheet. JSON import requires me to convert them by hand. A CSV importer that maps columns to fields (title → title, stage → stage) would let me migrate in one step."

**No freeform notes on briefing items** — "When I see 'Commitment to DACH partner is 3d overdue,' I want to jot a quick note: 'Discussed in Slack, extended by 2 weeks.' There's no way to annotate briefing items. I'd add a sticky note to my spreadsheet, but here I have to open the detail pane and edit the commitment."

**Export doesn't include briefing state** — "If I export JSON and re-import, does the briefing snapshot come with it? If not, the reimported board will show every item as 'new.' Meeting data is separate from board data — that could cause confusion on restore."

#### Verdict

"The Briefing view is the killer feature my spreadsheet will never replicate. Automated change detection with urgency sorting transforms a planning tool into a morning briefing tool. Combined with the pipeline's dual-mode grouping and the existing signal grid, this is now a more capable system than my 15-column spreadsheet. CSV import is the last migration barrier."

---

### Maria — The Stakeholder (Return Visit)

**Context**: VP of Product. Reviews the pipeline monthly. Last wanted summary statistics and horizon filtering.

#### First Reaction

"The Briefing tab is interesting but not for me. It's the PO's daily view — too granular for a monthly review. I need: 'Show me what changed since last month's review.' The briefing shows changes since the last 'Mark seen' click, which is the PO's cadence, not mine."

"The Pipeline view with horizon grouping is closer to what I need. Tab to switch to horizons, I see opportunities grouped by quarter with stage badges. But I still want summary statistics."

#### What Works

**Pipeline horizon view** — "Tab-toggled horizon grouping in the pipeline is what the old Roadmap view did, but now it's integrated with the stage view. The funnel still works, the risk flags are still there. One view, two organizational modes."

**Briefing could work as a pre-meeting export** — "If the PO opened the briefing *before* our monthly review and walked me through the tier-1 headlines, that's actually a great structure for the meeting. 'Here are the 3 things that need your attention' followed by 'Here are 8 things that changed.' The newspaper hierarchy works as a presentation format."

**Risk flags in pipeline rows** — "I can still see the symbols: objections, stale items, maturity-horizon mismatches. These are my primary decision inputs. The pipeline preserves all of them from the old roadmap."

#### What Could Be Better

**Multi-person briefing snapshots** — "The briefing shows changes since the PO marked seen. For my monthly review, I'd want changes since *my last review*, which is different from the PO's daily cadence. Multiple snapshot slots ('daily triage' vs. 'monthly review') would solve this."

**Still no summary statistics** — "I want a line at the top of the pipeline: '22 opportunities: 8 Explore, 6 Sketch, 5 Validate, 3 Decompose. 4 at risk, 2 stale.' One-line dashboard. The funnel shows it visually but I want the numbers."

**Briefing doesn't filter by horizon** — "Show me only tier-1 headlines for Q2 opportunities. With 20+ items, I need to focus on what's relevant to the quarter we're reviewing."

**Read-only mode still missing** — "I don't want editing controls when reviewing. A 'presentation mode' that hides score buttons, add forms, and edit fields would make this appropriate for a boardroom meeting."

#### Verdict

"The Briefing is a strong addition for daily PO use but doesn't replace my need for summary-level views. The pipeline with horizon grouping is the right evolution of the roadmap. For my monthly review, the ideal flow would be: PO opens the tool, shows me the pipeline in horizon mode, and walks through the briefing headlines. The tool structures the conversation even if it's not perfectly tailored for the stakeholder persona."

---

## Updated Priority Summary (Post Round 2)

| # | Issue | Flagged by | Severity | Effort | Status |
|---|---|---|---|---|---|
| 1 | **Tab badge for unseen tier-1 items** | Alex R2 | Medium | XS | Not built |
| 2 | **Empty briefing shows board summary** | Jordan R2 | Low | XS | Not built |
| 3 | **Softer language for unscored assignments** | Sam R2 | Medium | XS | Not built |
| 4 | **Grouped items truncate after 3 names** | Alex R2 | Low | XS | Not built |
| 5 | **Headline shows commitment milestone text** | Alex R2 | Low | XS | Not built |
| 6 | **Quick-park action on stale headlines** | Alex R2 | Medium | S | Not built |
| 7 | **Summary statistics line in pipeline** | Maria R1+R2 | Medium | S | Not built |
| 8 | **Score semantics help text** | Sam R1 | Medium | XS | Not built |
| 9 | **CSV import** | Loyalist R1+R2 | Medium | S | Not built |
| 10 | **Meeting "Done" undo/confirm** | Alex R1 | Medium | S | Not built |
| 11 | **Verdict preview in wire feed** | Sam R2 | Low | XS | Not built |
| 12 | **Multi-snapshot slots (daily vs. monthly)** | Maria R2 | Low | M | Not built |
| 13 | **Horizon filter in briefing** | Maria R2 | Low | S | Not built |
| 14 | **Presentation / read-only mode** | Maria R1+R2 | Low | M | Not built |
| 15 | **No multi-user / P2P** | Alex, Sam R1 | High | L | Not built |

### What's Working Well (Validated in Round 2)

- **Briefing as daily start page** — every PO reviewer confirmed this changes their workflow
- **Newspaper hierarchy** — tier-1 headlines with card treatment, tier-2 wire feed, tier-3 collapsed
- **Stale as one-time event** — respectful, not nagging; trust the user to have seen it
- **CELL_QUESTIONS as stale nudges** — transforms a "stuck" alert into a structured action prompt
- **Peek-in-place** — clicking briefing headlines opens detail pane without leaving the view
- **Pipeline dual-mode** — stage/horizon toggle replaces two separate views
- **Mark all seen** — clean snapshot reset with clear before/after state
- **News-first descriptions** — "Gone stale in Sketch" scans faster than "AI-generated reports: stale"

### Quick Wins (XS Effort, High Impact)

1. **Tab badge** — show count of unseen tier-1 items on the Briefing tab
2. **Softer assignment language** — "Awaiting Technical input at Validate" instead of "Sam hasn't scored..."
3. **Score help text** — one-liner near score buttons explaining consent semantics
4. **Grouped name truncation** — show 3 names + "(+N more)" to prevent line wrapping
5. **Commitment milestone in headline** — include the promise text, not just the recipient

---

## Round 3: Pipeline Stage View — Priya × Dani Discussion

**Priya** (UX Expert): Senior UX designer, 8 years in B2B SaaS. Has designed dashboard and kanban tools for product teams.
**Dani** (Information Architect): IA specialist, 6 years at enterprise analytics companies. Focuses on content structure, labeling, grouping logic, navigation patterns.

Both have read the full UX review (Rounds 1 & 2), the product spec, and the architecture doc. They're looking at the live tool with the sample dataset — 8 opportunities across 4 stages, 6 deliverables.

---

**Priya**: Let's start at the top. The funnel. I like it — hover a segment and the list rows dim to show just that stage's items. Really nice interaction. But nobody will discover it.

**Dani**: Agreed. There's no cursor change, no tooltip, no visual affordance that says "I'm interactive." Alex flagged this in Round 1 and it's still true. But I have a bigger issue with the funnel: it's *redundant*. The funnel says "3 in Sketch." The Sketch header below it also says "Sketch 3." Same number, two places.

**Priya**: So one of them needs to earn its space by carrying information the other doesn't.

**Dani**: Exactly. The funnel gives *shape* — the visual proportions show whether the pipeline narrows healthily or has a bulge. The header gives *triage* — "2 blocked, 1 needs input." Neither carries what the other has. My instinct is: let the funnel carry triage too. A tiny red dot on a segment for "has blocked items," an amber dot for "needs input." Then the funnel becomes the scan-and-spot layer, and the headers become simple anchors.

**Priya**: I like that. But I'd go further — make the funnel *click-to-filter*, not just hover. Click Sketch, and only Sketch items show. Click again to unfilt. Hover remains a preview, click commits. Right now the hover highlight vanishes the moment you move the mouse down to actually interact with the rows.

**Dani**: That's the fundamental problem — the highlight is a tease. It shows you a filtered view but won't let you act on it.

**Priya**: And at smaller window widths the funnel has a different problem: the Validate and Decompose segments get so thin their labels overlap. With sample data it's 1 item each — those segments are slivers. Need a minimum segment width or abbreviated labels for narrow ones.

**Dani**: Minimum width, yes. The labels could abbreviate to E/S/V/D at small widths — the full names are already on the headers below.

---

**Priya**: Let's talk about the rows. Each one packs seven pieces of information: expand toggle, title, aging badge, health dots, nudge text, meta tags, advance button. That's a lot for one row.

**Dani**: The nudge is the most valuable one — "Get engineering input" tells me what to do next. But it sits after the health dots, competing with origin tags and horizon labels. If I'm scanning 20 items, my eye hits the red aging badge, skips the dots, and lands on the nudge. But only if the window is wide enough for the nudge not to truncate.

**Priya**: I'd restructure the row as two lines. Line 1: title + health dots + aging. Line 2: nudge + meta + action. Give the nudge room to breathe. Right now everything is crammed into one flex row and the nudge gets squeezed.

**Dani**: Two lines would also help with the expand toggle confusion. Currently ▸ (expand) and → (advance) are both arrow-like controls in the same row serving different purposes. New users will confuse them.

**Priya**: Good catch. My fix: don't use ▸ at all. Replace it with a deliverable count — "3 deliverables" as the toggle. When there are zero, hide it entirely. Right now, rows with no deliverables still show the expand arrow, and clicking gives an empty expansion. Wasted click, wasted attention.

**Dani**: And it reveals *what's behind the toggle* before I click. "3 deliverables" tells me there's substance. A blind ▸ tells me nothing.

---

**Priya**: The triage buckets — blocked, needs input, clear — are the right ranking. But look at the actual rows. The only visual distinction between a blocked row and a clear row is a subtle left border color. Red for blocked, amber for attention, default for clear. In a mixed stage — say 1 blocked and 4 clear — the blocked item barely stands out.

**Dani**: The header *promises* a triage breakdown — "2 blocked, 1 needs input" — but the rows below don't visually cluster to match. There's no separator, no extra whitespace, no group label between buckets. The header sets an expectation the body doesn't deliver.

**Priya**: Even just an 8px gap between bucket clusters would fix this. Or a thin horizontal rule. Something that says: "above this line is blocked, below is clear."

**Dani**: I also question the "needs input" label on the header. In the rows, the nudge says specific things: "Get engineering input," "feasibility objection — resolve." But the header just says "N needs input." If there's only 1 item, the header could be more specific: "1 needs feasibility input." Progressive disclosure should still *hint* at the detail below.

**Priya**: That's a nice touch. Low effort too — the data is right there in the nudge.

---

**Dani**: Now the big one. Compact mode.

**Priya**: The "glorified table of contents" problem.

**Dani**: When you open the detail pane, the list collapses to compact mode: just title and a one-letter stage initial. You lose aging badges, health dots, nudge text, advance button. Every triage-relevant signal is stripped.

**Priya**: The list becomes useless for scanning. I'm supposed to read the detail pane for one item and simultaneously triage the rest — but the "rest" is now just a list of names. I can't see which ones are stale, which are blocked, which need input. I have to close the detail pane, scan, then reopen on the next item. Close-scan-reopen, close-scan-reopen.

**Dani**: What would you keep in compact mode?

**Priya**: Health dots and aging badge, at minimum. Those are the two pieces that let me scan the list while reading a detail pane. Drop the nudge — it's in the detail pane anyway. Drop meta tags and the advance button. But health + age must survive.

**Dani**: So a three-density system: full (no detail pane), medium (detail pane open, health + age visible), and the current compact (for very narrow panes or mobile).

**Priya**: Exactly. The medium density is the daily workhorse. Full density is for standalone pipeline review without a detail pane.

---

**Dani**: Let me raise something neither of us has touched yet: the stage headers have no temporal signal.

**Priya**: What do you mean?

**Dani**: The header says "Sketch 3 — 2 blocked, 1 needs input." It tells me *what's here* and *what's wrong*. But it doesn't tell me *how long things have been sitting*. I can see individual aging badges per row — 14d, 3d, 22d — but the header doesn't aggregate them. Is this stage a bottleneck? Is everything fresh? Is one item deeply stuck while the rest are fine?

**Priya**: "Oldest 22d, avg 11d" under the header?

**Dani**: Something like that. Even just "oldest 22d" would flag a bottleneck stage at a glance. The briefing already computes aging — "Gone stale in Sketch — 14d without activity." The pipeline stage headers should give the same awareness without making me read every row.

**Priya**: And it'd make the funnel more useful too. If each funnel segment could show a tiny heat indicator — green for all-fresh, amber for aging, red for has-stale — the funnel becomes a health dashboard, not just a count chart.

**Dani**: Now *that* would justify the funnel's screen space. Shape + health in one glance.

---

**Priya**: Zoom. I zoom into Sketch by clicking the header. The funnel disappears, other stages vanish, a breadcrumb appears. The transition is abrupt — suddenly I've lost all pipeline context.

**Dani**: Zoom should collapse other stages into single-line summaries — "Explore: 3, Validate: 1, Decompose: 1" — rather than removing them entirely. The funnel should stay visible with the active stage highlighted. Zoom means "focus" not "isolate."

**Priya**: Right. And there's no animation, no visual continuity. One frame I see four stages, next frame I see one plus a breadcrumb. At least a simple height collapse transition would maintain spatial awareness.

**Dani**: Also — if I zoom into Validate, then open a detail pane, then close it — I'm still zoomed. The only indicator is the breadcrumb. If I scroll down, the breadcrumb scrolls away and I've lost the context that I'm in a filtered state. The breadcrumb should be sticky.

**Priya**: But here's the deeper problem: when I zoom in, I see *exactly the same rows* I saw before. Same columns, same density, same information. The only thing that changed is that the other stages disappeared. That's not zoom — that's filter.

**Dani**: Yes. A real zoom should be *progressive disclosure*. Zooming in means "I'm spending focused time on this stage" — so show me things I couldn't justify showing in the overview. The overview is a scan layer. Zoom is a work layer.

**Priya**: What would the work layer add?

**Dani**: Several things. First: **auto-expand deliverables**. In overview mode, deliverables are collapsed behind the ▸ toggle. In zoom mode, every opportunity's deliverables should be visible by default — I'm here to work through this stage's items, not to click 5 toggles. Second: **verdict previews**. The signal dots show positive/uncertain/negative, but the *reason* — the verdict text — is only in the detail pane. In zoom mode, show a one-liner per signal: "LLM costs too high at scale." That's the information I need to decide whether to act.

**Priya**: I'd add **the full nudge as a subtitle** — or even the specific unanswered questions from the signal grid. In overview, "Get engineering input" is enough. In zoom, I want: "Could we build this? (unscored) — Feasibility at Sketch." The granularity should increase with the zoom level.

**Dani**: And **commitments inline**. In overview, a commitment shows as a nudge: "Promised CEO: 5d left." In zoom, I want to see the commitment target, the milestone, and the deadline as structured data, not compressed into a nudge string.

**Priya**: So the zoomed row becomes almost a mini detail pane — without needing to open the actual detail pane at all.

**Dani**: Exactly. Think of it as three density levels:
1. **Compact** (detail pane open) — title + health dots + aging. Minimal.
2. **Overview** (normal pipeline) — title, health, aging, nudge, meta, advance button. One line per item.
3. **Zoomed** (focused on one stage) — two or three lines per item. Deliverables expanded. Verdict snippets visible. Commitments inline. The full working surface.

**Priya**: That's a lovely progression. And it means zoom isn't just "filter out other stages" — it's "shift to working mode for this stage." The information architecture changes, not just the scope.

**Dani**: It also solves the compact mode problem we discussed. If zoom is the high-density working mode, and overview is the scanning mode, you don't need the detail pane as much in zoom mode — the zoomed rows carry enough context to triage without clicking through.

**Priya**: Though you'd still want the detail pane for editing signals and verdicts. The zoomed row is read-mostly.

**Dani**: Agreed. Zoom for triage and review, detail pane for editing. They serve different interaction modes.

**Priya**: One more thing — when I zoom into a stage, the header should also expand. Show the stage's thinking mode description (divergent/convergent/empirical/analytical), the aggregate age statistics we discussed, maybe even a one-line stage purpose: "Sketch: define the shape of the solution." The header earns more real estate in zoom because it's the only header on screen.

**Dani**: And the funnel should stay visible with the zoomed stage highlighted — so I always know where I am in the pipeline. The funnel becomes a navigation element: click another segment to zoom there without going back to overview first.

---

**Dani**: The exited section at the bottom.

**Priya**: `<details>` expand, list of killed/parked/merged items. Fine for 5 items. Unworkable at 30.

**Dani**: It accumulates forever — items are never deleted, only discontinued. Three months of active use and this list could have 20-30 items. There's no search, no filtering by exit state. If I want to find "that thing we parked last month," I'm scrolling through every exited item.

**Priya**: Minimum: filter by exit state — show only parked, only killed, etc. Better: inline search. Best: the briefing already detects `revisit-due` for parked items whose horizon arrived — surface a "review parked" prompt in the pipeline header when any parked items are due.

**Dani**: That last one is smart. The exited section is a graveyard — people don't browse graveyards. But the briefing can tap you on the shoulder and say "hey, you parked something with a Q2 revisit date and it's Q2."

**Priya**: Which we already built. It just needs a connection from the pipeline view.

---

**Dani**: Let me bring up one structural thing in the code. The `oppRowSnippet` template handles both stage-grouped and horizon-grouped rows via `showStageBadge`. In stage mode it shows origin tags + horizon labels. In horizon mode it shows stage badges + risk flags + drag handles. That's a lot of branching in one snippet.

**Priya**: Does it cause visual inconsistency?

**Dani**: Somewhat. The stage-mode row and the horizon-mode row present different information at the same position. The nudge column sometimes has roadmap warnings, sometimes risk flags, sometimes neither. A user switching between stage and horizon views sees rows that *look* the same but carry different signals in the same visual slots.

**Priya**: I'd argue that's acceptable as long as the information is correct for the grouping context. But if the template keeps accumulating branches, it'll become hard to maintain. At some point, separate snippets per mode would be cleaner.

**Dani**: For now it works. Just flagging it as technical debt that'll bite when more features land.

---

### Follow-up: Zoom Density (Priya × Dani × Sam × Raj)

**Agreed**: One zoom level is sufficient. Two toggles (zoomed × detail-pane-open) yield four clean states:

| | No detail pane | Detail pane open |
|---|---|---|
| **Overview** | `overview` density | `compact` density |
| **Zoomed** | `zoomed` density | `overview` density |

**Agreed**: Zoom is read-only progressive disclosure. Detail pane is for editing. Three layers: overview tells you *where* to look, zoom tells you *what's going on*, detail pane lets you *act*.

**Agreed** (Priya over Dani): Zoomed layout is consistent across stages — no per-stage template branching. Data-driven emphasis: early stages naturally have sparse deliverables/commitments, so verdict gaps dominate; late stages have dense deliverables, so those dominate. Same layout, different content.

**Sam's concern**: PipelineView is 1,637 lines. **Raj's solution**: decompose into:
- `PipelineView.svelte` — orchestrator (~200 lines)
- `PipelineFunnel.svelte` — funnel SVG, hover/click-to-filter
- `StageGroup.svelte` — stage header + rows
- `HorizonGroup.svelte` — horizon header + drag-drop + rows
- `OpportunityRow.svelte` — single row, `density` prop (`compact | overview | zoomed`)

### Follow-up: Grouping Toggle (all four)

**Agreed**: Move the Stage/Horizon toggle from App.svelte's tab bar into PipelineView, next to the funnel. It's a sub-mode of Pipeline, not a peer-level tab.

**Agreed**: Rename labels from `Stage | Horizon` to `Funnel | Horizon`. "Funnel" names the concept (maturity flow) rather than the data model term.

**Agreed**: Replace the Tab keyboard shortcut — it conflicts with browser focus navigation. Use a non-conflicting key.

### Follow-up: Funnel in Horizon Mode

**Agreed**: Show the funnel in both modes. The pipeline shape is board-level information, not view-specific. In funnel mode the funnel is navigation (hover/click to filter). In horizon mode it's a passive health indicator. Hover/click should still work in horizon mode — highlighting items at a particular stage across all horizons.

---

### Final Priority List

| # | Issue | Effort | Impact | Status |
|---|---|---|---|---|
| 1 | ~~**Decompose PipelineView**~~ — extract Funnel, OpportunityRow | M | High (enabler) | Shipped (PipelineFunnel + OpportunityRow) |
| 2 | ~~**Show funnel in horizon mode**~~ — always visible, cross-mode filtering | XS | Medium | Shipped |
| 3 | ~~**Move toggle into PipelineView**~~ — out of App tab bar, next to funnel | S | Medium | Shipped |
| 4 | ~~**Rename Stage→Funnel label**~~ — `Funnel | Horizon` | XS | Low | Shipped |
| 5 | **Replace Tab shortcut** — non-conflicting key for grouping toggle | XS | Low | Not built |
| 6 | ~~**Bucket separators**~~ — visual gap between blocked/attention/clear clusters | XS | Medium | Shipped |
| 7 | ~~**Deliverable count on toggle**~~ — replace blind ▸ with "N▸", hide when zero | XS | Medium | Shipped (OpportunityRow) |
| 8 | ~~**Zoomed row progressive disclosure**~~ — expanded deliverables, verdict snippets, commitments inline | M | High | Shipped |
| 9 | **Medium-density compact mode** — health dots + aging survive when detail pane open | S | High | Not built |
| 10 | ~~**Stage header aggregate age**~~ — "oldest Nd" in header subtitle | S | Medium | Shipped |
| 11 | ~~**Funnel triage indicators**~~ — colored dots for blocked/attention | XS | Medium | Shipped |
| 12 | **Funnel minimum segment width** — prevent label overlap | XS | Low | Not built |
| 13 | ~~**Sticky zoom breadcrumb**~~ — position: sticky | XS | Low | Shipped |
| 14 | **Exited section filter** — filter by exit state | S | Low | Not built |
| 15 | ~~**Click-to-filter funnel**~~ — hover = preview, click = commit filter; click again to clear | S | Medium | Shipped |
| 16 | ~~**Two-line row layout**~~ — line 1: title + health + aging; line 2: nudge + meta + action | S | Medium | Shipped |
| 17 | ~~**Specific header text for single items**~~ — "1 needs feasibility input" instead of generic "1 needs input" | XS | Low | Shipped |
| 18 | ~~**Zoom transition animation**~~ — smooth collapse/expand for spatial continuity | XS | Low | Shipped (collapse transition on filtered stages) |
| 19 | ~~**Funnel as zoom navigation**~~ — click funnel segment to zoom directly to that stage | S | Medium | Shipped |
| 20 | ~~**Expanded stage header in zoom**~~ — stage purpose description, thinking mode, aggregate stats | S | Medium | Shipped |
| 21 | ~~**Revisit-due prompt in pipeline**~~ — surface parked items due for revisit (from briefing's `revisit-due`) | XS | Medium | Shipped |

---

### Follow-up: Two-Line Row Polish (Priya × Dani)

After reviewing the shipped two-line layout with the live sample dataset, four issues surfaced:

**Priya**: "Blocked" as a bucket label is misleading. These items aren't *blocked* in the PM sense — work can't proceed until something is resolved, but it's not an external dependency. It's "this needs your attention urgently." A feasibility objection is urgent input needed, not a roadblock. Same for overdue commitments. The red border and bold title already carry the urgency signal. Let's call it "urgent" — fewer connotations.

**Dani**: Agreed. And in the stage header badges — "1 blocked" reads as "someone is waiting on someone else." "1 urgent" or "1 objection" is more honest about what the user should do. The specific text we added ("1 feasibility objection") is good, but the fallback "N blocked" should become "N urgent."

**Priya**: The origin and horizon tags on line 2 feel like an afterthought. They're metadata about the card — *what kind of thing it is* and *when it's targeted*. That belongs with the identity on line 1, not with the action nudge on line 2. Move them to line 1, between the title and the health dots. The nudge line should be pure "what to do next" — no classification noise.

**Dani**: Good call. And while we're at it, the bare "now" and "next" horizon labels are cryptic. If I haven't internalized the horizon ordering, "next" tells me nothing. It could mean next sprint, next quarter, next year. A small prefix would help: "◆ now" and "◇ next" — the filled vs. hollow diamond gives a visual weight cue, and the words always appear with a glyph that says "this is a horizon indicator." Or even simpler: just show the actual horizon value. But the now/next shorthand is compact and useful for people who know the system, so a prefix glyph is probably the right minimal fix.

**Priya**: I like the diamond. Subtle, takes no extra space, adds an affordance that says "this is a tag, not just a random word."

**Dani**: Last issue — the second row (nudge text) gets clipped at the bottom when the next stage header is close. The stage group container clips the row's bottom padding. Need to ensure the `.pl-rows` content has adequate bottom padding, or the row itself has enough margin to clear the next header.

**Agreed fixes** (all XS effort):
1. Rename bucket `blocked` → `urgent` everywhere (type, CSS class, header badge text)
2. Move origin + horizon tags from line 2 to line 1, between title and health dots
3. Prefix horizon labels: "◆ now", "◇ next"
4. Add bottom padding on `.pl-rows` to prevent last-row clipping
