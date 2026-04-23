# Upstream — UX Review

A critical review of the current PoC from multiple perspectives. Each reviewer walks through the tool with fresh eyes, noting what works, what confuses, and what's missing. Based on the actual PoC: four tabs (Opportunities, Deliverables, Roadmap, Meetings), localStorage persistence, full keyboard navigation, JSON/CSV import & export, 20-level undo, card aging, origin types, exit states with reason capture, interactive funnel, and meeting prep with snapshot-based change detection.

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

**People assignments in a small team** — "I'm the only PO. The engineer fills in feasibility, I fill in the rest. The people management features (expert/blocker/stakeholder roles, person pickers on cells) feel like overhead for my context. Can I skip it entirely?"

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
| 18 | **Board-level changelog** | Maria | Low | M | Not built |
| 19 | **"now"/"next" labels on roadmap** | Maria | Low | XS | Not built |
| 20 | **Filtering on list view** | Alex | Medium | S | Not built |

### What Works Well (Keep)

- **Two-axis model** (opportunities vs. deliverables with many-to-many links) — every reviewer understood and valued this
- **Smart triage with contextual nudges** — the highest-value daily feature for POs
- **Signal grid with consent-based gating** — better than scoring/ranking; forces structured thinking
- **Coverage matrix with contributor columns** — solves a real problem that no mainstream tool addresses
- **Verdicts as decision records** — traceability without formal documentation
- **Exit states with reason capture** — kill/park/incubate/merge preserves decision history with rationale
- **Card aging** — visual wear badges (fresh, aging, stale) based on days in current stage
- **Origin types** — Request/Idea/Incident/Debt tags provide pipeline composition awareness
- **Roadmap with risk flags** — surface maturity/horizon mismatches at a glance
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
- Board-level changelog (useful for stakeholders, not daily PO work)
- Lightweight mode (design question: what do small teams actually skip?)
- Horizon filter/collapse on roadmap (complements existing risk flags)
- Mobile view (secondary platform)
- Merge import (edge case for data migration)
