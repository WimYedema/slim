# Slim -- UX Review

Persona-based review of the tool across five rounds. The tool has four views (Latest, Pipeline, Deliverables, Meetings), localStorage persistence, full keyboard navigation, JSON/CSV import & export, brain dump import, 20-level undo, news feed with aging model, interactive funnel, stage/horizon grouping, signal grid with consent-based gating, meeting prep with role filter and stakeholder talking points, P2P sharing via Nostr relays, contributor scoring view, multi-board support, and a rich detail pane with commitments, people assignments, and exit states.

> **Post-review changes**: The Stakeholders view was merged into Meetings (with a role filter). The Overview sub-view was replaced by a Board Health dashboard.

---

## Round 1: Initial Reviews

Five personas evaluated an early version of the tool (4 tabs, no P2P sharing, no news feed aging model).

### Alex -- The Tactical PO

**Profile**: 4 years as PO, ~20 active opportunities. Uses Jira + Google Sheet.

**Key insights**: Signal grid is the core value -- instantly shows which perspectives are missing. Consent-based gating matches how mature teams decide. Coverage matrix solves a real spreadsheet problem. Meeting prep saves 20 minutes per 1:1.

**Open issues**: Signal score semantics unclear (re-score at each stage?). Coverage partial/full threshold ambiguous. Meeting "Done" has no undo. Funnel interactivity not discoverable.

**Still missing**: List filtering (by bucket, perspective, origin). Bulk operations.

**Verdict**: "This is the first tool I've seen that models the shape of a PO's actual job. I'm switching from my Google Sheet."

### Jordan -- The Solo PO

**Profile**: Only PO at a 6-person startup. Uses Notion.

**Key insights**: Quick-add (n key) and keyboard navigation make processing fast. Aging badges are a "visual conscience." Orphan badges on deliverables surface passion projects that serve no known goal.

**Open issues**: Signal grid (12 cells) feels heavy for a team of 6. People management features feel like overhead for solo use.

**Still missing**: Lightweight mode for small teams. Combined opportunity+deliverable view.

**Verdict**: "The model is right. For a solo PO, the daily driver is the triage list with nudges. Make that faster to process and I'd completely switch from Notion."

### Sam -- The Engineering Lead

**Profile**: Tech lead, 5-person team. Wants async feasibility input.

**Key insights**: Signal grid correctly decouples "is this desirable?" from "can we build this?" -- different people, different times. Meeting prep with inline scoring is a useful stopgap for async. Verdicts persist -- nobody re-asks the same question.

**Open issues**: Score semantics ambiguous (confidence vs. willingness to proceed). Stage-specific prompts are placeholders that vanish on typing -- should be visible labels.

**Since shipped**: Contributor view and P2P sharing now address the async workflow Sam wanted.

**Verdict**: "The data model is ideal for separating concerns. P2P sharing would make this my favorite product tool." *(Now shipped.)*

### The Spreadsheet Loyalist

**Profile**: 10 years of elaborate spreadsheets. Skeptical of new tools.

**Key insights**: Triage sort surfaces "work on today" automatically -- spreadsheets don't. Signal grid gives structured traceability vs. free-form columns. Aging per stage (not per card) is smarter than spreadsheet formulas. Semantic undo preserves computed state.

**Open issues**: No custom attributes on deliverables (spreadsheet has 15 columns). No computed summaries (total effort, coverage %).

**Since shipped**: CSV import and merge import now address migration concerns.

**Verdict**: "The four-view structure is more capable than my spreadsheet for triage, coverage mapping, and meeting prep."

### Maria -- The Stakeholder

**Profile**: VP of Product. Monthly roadmap review. Consumes summaries.

**Key insights**: Horizon mode with risk flags is 85% of her monthly review need. Maturity-horizon mismatch flags are the killer feature. Origin tag composition reveals pipeline balance.

**Open issues**: No summary statistics (total counts, effort per horizon). No horizon filter/collapse.

**Since shipped**: Latest tab with return summary and Overview sub-view partially address the changelog need.

**Verdict**: "If the PO can show me a filtered 'this quarter + next quarter' roadmap with effort totals, I'd stop asking for slide decks."

---

## Round 2: Post-Pipeline Review (condensed)

Five reviewers returned after the Latest tab (then called Briefing) and Pipeline view replaced the separate List + Roadmap approach. Key findings:

**Alex**: News feed with newspaper hierarchy (headline cards, wire feed, collapsed background) is the missing triage layer. Stale-item nudges showing CELL_QUESTIONS are "the cherry on top." Wants: tab badge for unseen tier-1 items, quick-park action on stale headlines, commitment milestone text in headlines.

**Jordan**: "Tab 1 is now my daily driver." The core loop becomes: Latest → click headline → act in detail pane → mark read. Pipeline combining stage + horizon grouping eliminates a view. Wants: board summary when news is empty. *(Shipped: Overview sub-view.)*

**Sam**: Unscored-assignment headlines turn the tool into a meeting agenda generator. Wants: softer language ("Awaiting Technical input" not "Sam hasn't scored..."), verdict preview in wire feed.

**Loyalist**: "Automated change detection with urgency sorting -- my spreadsheet will never do that." The layout IS the sort. CELL_QUESTIONS under stale headlines are schema-aware comments his spreadsheet can't generate.

**Maria**: Latest tab is too granular for monthly reviews; she needs changes since *her* last review, not the PO's daily cadence. Pipeline horizon mode preserves roadmap functionality. Wants: summary statistics in pipeline header, presentation/read-only mode.

---

## Round 3: Pipeline Deep Dive (condensed)

UX expert **Priya** and information architect **Dani** reviewed the pipeline in detail with the sample dataset. Key findings and recommendations:

**Shipped since this review:**
- Funnel: click-to-filter (not just hover), triage indicators (colored dots), shown in both modes, serves as zoom navigation
- Rows: two-line layout (title+health on line 1, nudge+meta on line 2), deliverable count replaces blind expand arrow
- Triage: bucket separators between urgent/attention/clear, specific header text ("1 feasibility objection")
- Zoom: progressive disclosure (expanded deliverables, verdict snippets, commitments inline), sticky breadcrumb, transition animation, expanded stage header with purpose and aggregate age
- Structure: PipelineView decomposed into PipelineFunnel + OpportunityRow, toggle moved into PipelineView, "Funnel | Horizon" label, revisit-due prompt for parked items

**Agreed density model** (zoom × detail-pane yields four states):

| | No detail pane | Detail pane open |
|---|---|---|
| **Overview** | `overview` density | `compact` density |
| **Zoomed** | `zoomed` density | `overview` density |

**Still open:**

| # | Issue | Effort | Impact |
|---|---|---|---|
| 1 | **Medium-density compact mode** -- health dots + aging survive when detail pane open | S | High |
| 2 | **Funnel minimum segment width** -- prevent label overlap at small counts | XS | Low |
| 3 | **Exited section filter** -- filter by exit state (kill/park/merge) | S | Low |
| 4 | **Replace Tab shortcut** -- conflicts with browser focus navigation | XS | Low |

---

## Round 4: Fresh-Eyes PO Reviews

Six product owners, new to Slim, spend 30 minutes each with the live tool. None have read prior reviews. They arrive at the Welcome page cold.

---

### Kenta -- The Agency PO

**Profile**: PO at a digital agency (40 people). Manages 6-8 client projects simultaneously, each with its own pipeline. Switches context constantly. Currently uses Productboard for discovery and Jira for delivery.

#### First 5 Minutes

"The welcome page is clean. Three cards -- create a board, join a team, or explore a demo. I'll hit the demo first... OK, 8 opportunities, 7 deliverables, I can see what this is. The pipeline has a funnel at the top, triage buckets below. Click an item and a detail pane slides in. Standard split-pane, I'm oriented."

"Wait -- there's a board picker in the header. I can create multiple boards? That's essential for me. One board per client. Let me create a new one... 'What's on your plate?' with a text area. I can paste a rough list? Let me try..."

"OK, the brain dump parser is surprisingly good. I typed `## Client checkout redesign` and `## Search performance`, and it turned them into two opportunities in Explore. Added `- Redis cache` and `- CDN setup` as bullet points and they became deliverables. This is the fastest board setup I've seen in any tool."

#### What Works

**Multi-board** -- "Essential for agency work. One board per client. The board picker in the header is simple: click, switch, done. I created three boards in under a minute."

**Brain dump import** -- "This is the killer onboarding. Instead of clicking 'Add' ten times, I pasted my rough planning notes and got a populated board. The live preview on the right showed me exactly what it parsed. The syntax is intuitive: `##` for opportunities, `-` for deliverables, `#sketch` to set stage, `@Sarah` to assign people."

**Funnel / Horizon toggle** -- "I prepare quarterly roadmaps for clients. Tab to switch to horizon mode, drag opportunities between quarters. Back to funnel mode for my daily triage. One view, two mental modes. Productboard needs three separate views for this."

**Cross-view navigation** -- "I clicked a deliverable name in the opportunity detail pane and it switched to the Deliverables tab with that row selected. Clicked an opportunity in the deliverable detail and it jumped to Pipeline. Smooth. No hunting."

**Welcome page as re-entry** -- "The 'Join a team room' card on the welcome page is smart. If I'm bringing a client's tech lead into the loop, I can share a room code and they score their perspective cells without needing my board."

#### What Confuses

**Board isolation** -- "Each board is completely independent. But my agency often has shared deliverables across client projects -- 'upgrade infrastructure' serves multiple clients. There's no cross-board reference. I'd need to duplicate the deliverable in each board."

**No board-level metadata** -- "I can name a board and write a one-line description. But I want a client name, a project phase, a deadline. The board itself is a bit anonymous."

**Stakeholders tab context** -- "The Stakeholders tab collects people from all opportunities. But in my agency context, I want to see stakeholders *per client* (per board), which I do. But within one client board, I have 'client stakeholders' and 'internal team.' The tool doesn't distinguish. Everyone's in one flat list."

**Signal grid at Explore** -- "For agency work, I spend 5 minutes in Explore -- it's a brainstorm. Filling in three perspectives with verdicts and evidence at Explore feels heavy. The tool encourages it because the triage nudge says 'Get input on desirability.' But at Explore stage, I just want to capture ideas fast and move on."

#### What's Missing

1. **Board templates** -- start a new client board pre-configured with horizons ("Discovery / Alpha / Beta / Launch")
2. **Board tags or grouping** -- group boards by client or project type
3. **Linked deliverables across boards** -- or at least a reference ("see also: Infrastructure board")

#### Verdict

"Multi-board plus brain dump import is a strong combination for agency work. I set up three client boards in under 5 minutes -- faster than creating empty Productboard projects. The pipeline is well-designed for tracking individual client opportunities. The gap is cross-board awareness: I can't see my total workload across all clients. Each board is a silo. For single-product companies that's fine. For agencies, I'd want a portfolio view."

---

### Chiara -- The Regulated-Industry PO

**Profile**: PO at a medical device software company (200 people). Regulatory requirements dominate: every feature needs documented risk analysis and traceability. Currently uses Polarion for requirements + a compliance spreadsheet.

#### First 5 Minutes

"The demo board looks friendly. Sample data with opportunities and signals. Let me open one... Signal grid -- four stages, three perspectives. Each cell has a verdict, evidence, and owner. This is closer to a Design History File than I expected."

"I like that every decision is recorded: who scored it, why, what evidence supports it. And exit states with reasons -- 'killed because regulatory risk too high.' That's traceability."

#### What Works

**Verdict + evidence + owner per cell** -- "In regulated industries, you need to know *who* assessed *what* based on *which evidence*. The signal grid captures this naturally. Not as a compliance bolt-on, but as the core interaction. My team would fill these in because the tool structures the conversation around them."

**Exit states with rationale** -- "When we discontinue a feature, we need to document why. Kill/Park/Merge with an inline reason field is exactly the decision record format our quality team requires. I'd screenshot these for our DHF."

**Consent-based gating** -- "The idea that you can't advance without hearing all perspectives maps to our regulatory reality: you literally cannot proceed without risk assessment sign-off. The tool enforces this structurally without making it feel like a gate review."

**Commitment tracking** -- "Regulatory submissions have hard deadlines. The commitment system with urgency indicators ('5d left', '3d overdue') and the way overdue commitments push items into the Blocked bucket -- that's exactly the pressure visibility we need."

**P2P sharing for contributor scoring** -- "Our clinical team needs to score Desirability (patient need), our regulatory team scores Viability (compliance risk), engineering scores Feasibility. The contributor view lets each expert score their assigned cells without seeing the full board. That's role-based access by design."

#### What Confuses

**No audit trail** -- "I can see the current state of every signal, but not the history. If someone changes a score from Positive to Negative, I see the Negative. I don't see that it was changed, when, or by whom. For compliance, I need change history."

**No attachments** -- "The evidence field is a text/URL reference. But I need to attach PDFs -- risk assessment forms, test protocols, regulatory correspondence. A URL to a shared drive works as a workaround, but inline attachment support would be stronger."

**Three perspectives may not be enough** -- "In medical device software, I'd want: Desirability (clinical need), Feasibility (technical), Viability (business), and Regulatory (compliance). The tool hardcodes three perspectives. A fourth perspective for my domain would be ideal."

**No approval workflow** -- "The Approver role exists on people links, but it doesn't gate anything. In my world, the regulatory officer's approval is a hard gate, not just a perspective score. The consent model comes close but doesn't distinguish between 'advisory consent' and 'formal approval.'"

#### What's Missing

1. **Change history per cell** -- who changed what, when (audit trail)
2. **Attachment support** -- or at least structured links per cell (not just one evidence URL)
3. **Configurable perspectives** -- add a fourth perspective for regulatory/compliance
4. **Formal approval flag** -- distinct from consent scoring, a hard sign-off gate

#### Verdict

"Surprisingly relevant for regulated industries. The signal grid is structurally similar to our risk analysis matrix, and the decision record pattern (exit states with rationale, verdict + evidence per cell) maps to compliance documentation needs. The tool wouldn't replace our formal requirements management system, but it could sit upstream of it -- where we decide *what* to build before entering the formal process. The gap is auditability: I need change history, and I need the ability to lock cells after approval."

---

### Tomás -- The Platform PO

**Profile**: PO for a developer platform (API, SDK, docs). Pipeline is 70% supply-driven ("we built a new capability, now find the use case"). Team of 15 engineers, 3 developer advocates. Currently uses Linear + Notion.

#### First 5 Minutes

"The origin types caught my eye immediately. Request vs. Idea vs. Incident vs. Debt. My pipeline is 70% Idea (supply-driven). In Linear, everything looks the same. Here, I can see that imbalance at a glance because origin tags show on every card."

"The coverage matrix is what I've been building in Notion for years. Deliverables as rows, opportunities as columns, dots showing coverage. Except this one also has contributor columns showing who's assigned to build each thing. That's the team allocation view I never got right in Notion."

#### What Works

**Origin types for supply-heavy pipelines** -- "Having 'Idea' as a first-class origin type validates supply-driven opportunities. The tool doesn't treat them as second-class to customer requests. But the signal grid correctly enforces: even for supply-driven ideas, *someone* needs to answer 'does anyone want this?' at Desirability. That's the gate that prevents us from building tech for tech's sake."

**Coverage matrix** -- "This is the pivot table I rebuild every quarter. Deliverables vs. opportunities with coverage dots. Plus contributor columns that show who's doing what. Plus orphan badges for deliverables that don't serve any opportunity. I have three of those right now in Linear and nobody noticed until I built the spreadsheet."

**Contributor columns in the matrix** -- "I can see that Sarah is assigned to 5 deliverables and everyone else has 2. That's my bottleneck. I didn't need a burndown chart -- I needed a heatmap of who's overloaded."

**Stakeholders tab** -- "We have developer advocates who track relationships with partner developers. The Stakeholders view with talking points is perfect for their meeting prep. 'Discuss: SSO commitment is 3d overdue. Ask about: feasibility input needed at Validate for the Webhooks API.' Auto-generated talking points from board data."

**Horizon mode for roadmap sharing** -- "I present a quarterly roadmap to the CTO. Horizon mode groups everything by quarter, shows size breakdowns, and has drag-drop to reschedule. I've been building this slide manually for years."

#### What Confuses

**Deliverable detail pane is sparse** -- "An opportunity gets a rich detail pane: signal grid, commitments, people, exit states. A deliverable gets: title, size, certainty, links, and contributors. Where do I capture technical notes? Architecture decisions? API design constraints? The Notes field on opportunities is good -- deliverables need one too."

**No dependency tracking** -- "Deliverable A depends on Deliverable B. The matrix shows coverage links (deliverables → opportunities), but not sequencing dependencies between deliverables. In platform work, the order matters: you can't ship the SDK before the API."

**WIP limits are suggestions** -- "The funnel shows 'crowded' when a stage has too many items. But it doesn't prevent adding more. For my team, I want a hard cap -- 'Validate can hold 3 items max, you must advance or exit before adding another.'"

#### What's Missing

1. **Notes/description field on deliverables** -- for technical context, API specs, architecture notes
2. **Dependency links between deliverables** -- sequence constraints for build order
3. **Hard WIP limits** -- configurable per-stage caps, not just visual warnings

#### Verdict

"The two-axis model (opportunities vs. deliverables) is exactly right for platform work. The coverage matrix is the view I've been hand-building for years. Origin types give visibility into our supply-heavy pipeline composition. The stakeholder talking points are a nice touch for developer relations. But the deliverable side of the model is underdeveloped compared to the opportunity side -- it needs richer detail support and inter-deliverable relationships."

---

### Fatima -- The Government PO

**Profile**: Product owner in a government digital services team (100 people). Manages citizen-facing services. Decisions require political sensitivity, multi-stakeholder alignment, and transparency. Currently uses MS Planner + extensive SharePoint documentation.

#### First 5 Minutes

"No login. No server. All data in the browser. I appreciate the privacy-first approach -- we have strict data sovereignty requirements. But localStorage means I can't access this from my office desktop *and* my home laptop. It's device-locked."

"The welcome page says 'All data stays in your browser.' That's both the selling point and the limitation."

#### What Works

**Privacy by design** -- "No accounts, no cloud, no analytics. For a government team evaluating tools, the first question is always 'where does the data go?' The answer being 'nowhere -- it never leaves your machine' eliminates an entire procurement category of concerns."

**P2P encrypted sharing** -- "The room-based sharing with encryption is interesting. I can share a board with a colleague via a room code, and the data travels encrypted through a relay. For inter-departmental collaboration, this might actually pass our security review -- no central server has access to the data."

**Consent model matches government decision-making** -- "Government decisions genuinely work by consent -- no single department can force a decision, but any can raise an objection that must be addressed. The scoring model (positive/uncertain/negative with blocking semantics) maps to how inter-departmental governance actually works."

**Meeting prep for multi-stakeholder coordination** -- "I coordinate with 8 departments. Each has its own concerns. The Meetings tab builds per-person agendas with changes, commitments, and unscored cells. The Stakeholders tab adds talking points. Together, these replace my 45-minute meeting prep ritual."

**Exit states as decision records** -- "In government, every decision must be defensible. 'We discontinued this because...' with a recorded rationale is the kind of documentation our oversight committees require."

#### What Confuses

**No access control** -- "Everyone with a room code sees everything. I can't share the board with Department A while hiding sensitive items relevant only to Department B. The contributor view limits *editing* to assigned cells, but all data is visible."

**No version history** -- "If I export a JSON backup today and another next month, I have two snapshots. But I can't diff them in the tool. For transparency requirements, I need to show what changed between board versions."

**Single-device limitation** -- "I work from two machines. localStorage doesn't sync. I'd need to export/import JSON to move between devices. That's a manual workflow that will break down."

**No commenting or discussion** -- "When a colleague scores a cell with 'Uncertain' and a verdict of 'Accessibility compliance unclear,' I want to reply to that verdict inline. Start a conversation. The tool captures decisions but not the deliberation that leads to them."

#### What's Missing

1. **Device sync** -- export/import is too manual; cloud-optional sync would help
2. **Scoped sharing** -- share subsets of a board with specific stakeholders
3. **Discussion threads** -- inline replies to verdicts and commitments
4. **Board diffing** -- compare two snapshots to show what changed

#### Verdict

"The privacy-first architecture is a genuine advantage for government procurement. The consent model is surprisingly well-aligned with how public sector governance actually works. The meeting prep and stakeholder features would save me hours of inter-departmental coordination. But the single-device limitation is a practical blocker -- government POs often work from multiple secure workstations. P2P sharing partly addresses multi-device use, but it's designed for team collaboration, not personal sync."

---

### Rosa -- The Newly Minted PO

**Profile**: 6 months as PO, promoted from QA. First product role. Attended a CSPO course last month. Manages one product area at a 50-person company. Has used Jira as a user, never configured it. Thinks in test cases, not business cases.

#### First 5 Minutes

"I picked 'Explore a demo board' on the welcome page. The pipeline view opens. I see a funnel at the top -- 4 stages with numbers. Below, items grouped by stage. Each has dots, a nudge text, aging badges. It's dense but the visual hierarchy works: stale items scream at me in red, healthy ones are quiet."

"I opened an opportunity and the signal grid is intimidating. A 4x3 matrix with cells I'm supposed to fill. Each cell has a score, verdict, evidence, and owner. That's a lot of fields. But the stage-specific prompts help: 'Who might want this?' at Explore is a clear question. I can answer that."

#### What Works

**Stage-specific prompts** -- "The verdict placeholder at each cell says something like 'Who might want this?' or 'Did a spike confirm we can build it?' This is the training I need. I don't know what questions to ask at each stage -- the tool tells me."

**Triage nudges** -- "The one-liner under each card ('Get engineering input', 'Ready to advance to Sketch') is my to-do list. I don't have to figure out what to do next -- the tool surfaces it."

**Aging badges** -- "I recognize this pattern from QA: stale bugs are the ones nobody's looking at. Stale opportunities are the same. The red '14d' badge is a visual code smell for product work."

**The Latest tab** -- "I expected to start in the Pipeline, but the Latest tab greeted me with a summary of what's going on. Resolution notices -- 'No longer stale', 'Commitment fulfilled' -- are satisfying. They feel like test results passing."

**Consent model as training wheels** -- "My CSPO course talked about 'getting buy-in from stakeholders.' This tool operationalizes it: you literally can't advance until all three perspectives are heard and none object. It forces me to do the thing my course taught me. I like that."

#### What Confuses

**What's an opportunity vs. a deliverable?** -- "My Jira world has Epics, Stories, and Tasks. The tool has Opportunities and Deliverables. The welcome page says 'above the pivot' and 'below the pivot' but I don't know what the pivot is. A plain-language explainer -- 'Opportunity = why we're doing this, Deliverable = what we're building' -- would help."

**When to advance vs. when to exit** -- "I see an opportunity with all green dots. The advance button says 'Sketch.' Should I advance? What if I'm wrong? The undo reassures me (Ctrl+Z), but I'm not confident about the *criteria*. The consent gating is clear (all heard, no objections), but the *judgment* of whether verdicts are strong enough is on me."

**Three perspectives feel abstract** -- "Desirability, Feasibility, Viability. I know these from my course but applying them is hard. Is 'legal compliance' under Viability? Is 'team capacity' under Feasibility? The tool doesn't guide this mapping."

**Overview sub-view is for whom?** -- "The Latest tab has a News/Overview toggle. News is clear -- changes. But Overview shows a static snapshot: opportunities by stage, deliverables, stakeholders. When would I use this instead of just switching to Pipeline?"

#### What's Missing

1. **Glossary / onboarding tooltips** -- brief explanations of key concepts (opportunity, deliverable, consent, perspective) accessible from the UI
2. **Guided first-run** -- a quick walkthrough highlighting "add an opportunity, score a cell, advance it" flow
3. **Perspective examples** -- "Desirability examples: user interviews, support ticket trends, NPS feedback"
4. **Confidence check before advancement** -- "You're advancing with 1 Uncertain score. Proceed?" (not blocking, just confirming)

#### Verdict

"This is a better learning tool than any PO training course I've attended. The signal grid with stage-specific prompts teaches me *what questions to ask*. The consent model teaches me *how to make decisions*. The triage nudges teach me *what to work on*. But the onboarding assumes I already know the vocabulary (opportunity, deliverable, perspectives). A glossary or guided first-run would bridge the gap between 'I understand the UI' and 'I understand the method.'"

---

### Hiroshi -- The Data-Informed PO

**Profile**: PO at a B2C product company (500 people). Relies heavily on analytics: A/B tests, conversion funnels, user segmentation. Decisions backed by numbers. Currently uses Amplitude for analytics + Notion for product strategy + Jira for execution.

#### First 5 Minutes

"I notice the consent scoring immediately. Positive / Uncertain / Negative. No numbers. No weighted priorities. No RICE, no WSJF. This is deliberately anti-quantitative. Interesting."

"The evidence field per signal cell is a text/URL field. I'd paste an Amplitude chart link there. 'Desirability at Validate: Positive -- 34% conversion lift in A/B test, evidence: [Amplitude link].' OK, that works. The *structure* is quantitative even if the *scores* aren't."

#### What Works

**Evidence URLs per cell** -- "This is where my A/B test results, analytics dashboards, and user research links live. Each perspective at each stage gets its own evidence reference. That's more structured than my Notion docs where I dump everything in one page."

**Verdicts as structured arguments** -- "The verdict field forces me to articulate *why* I scored Positive, not just that I did. 'User testing showed 8/10 participants completed checkout in <2 minutes' is a verdict that carries weight. My Notion docs have this buried in paragraphs."

**The aging model as a forcing function** -- "In my analytics-driven workflow, I tend to wait for 'one more A/B test.' The aging badges punish indecision. After 14 days in Validate, the stale badge appears and the Latest tab surfaces it as a headline. That's the push I need to stop gold-plating the data and make a decision."

**Coverage matrix as impact mapping** -- "Each opportunity-deliverable link with coverage (partial/full) is a lightweight impact map. I can see which deliverable serves the most opportunities and which opportunity has the weakest coverage. That's prioritization information without computing a number."

**Stakeholder talking points** -- "The auto-generated talking points are built from board data: overdue commitments, pending input, recent changes. When I meet my VP, I don't have to build the narrative manually -- the tool has already assembled the data points."

#### What Confuses

**No metrics integration** -- "The evidence field is a plain text/URL. I can paste a link to Amplitude, but the tool doesn't know what's behind that link. If I could embed a key metric -- '34% conversion' -- as structured data, the tool could aggregate it. 'Opportunities backed by quantitative evidence: 4/8' would be useful."

**Consent scores don't aggregate** -- "I have 8 opportunities. I can't sort by 'most consented' or 'most objected.' The triage already does this (Blocked/Needs Input/On Track), but there's no board-level aggregate like 'pipeline health score' or 'consent coverage percentage.' I'm used to dashboards that give me one number at a glance."

**No A/B test lifecycle** -- "At Validate, the question is 'did we test this?' but the tool doesn't track the test itself -- just the verdict after the fact. A lightweight 'validation experiment' object (hypothesis, metric, result) would bridge the gap between 'we should test this' and 'here's what we found.'"

**Return summary is too brief** -- "After 4 hours away, the banner says 'While you were away: 2 objections, 1 commitment overdue.' That's good but I want the delta: 'Pipeline health changed from 6/8 on track to 4/8. 2 items moved backward.' Trend information, not just counts."

#### What's Missing

1. **Structured metrics per cell** -- beyond free-text evidence, a key-value pair for the headline metric
2. **Board-level health dashboard** -- one-line consent coverage, aging distribution, pipeline velocity
3. **Validation experiment tracking** -- hypothesis/metric/result as a first-class concept under Validate-stage cells
4. **Trend information in return summary** -- show what improved vs. deteriorated, not just current state

#### Verdict

"The anti-numeric philosophy is provocative for someone like me. My first instinct was 'where's the RICE score?' But after 30 minutes, I see the point: the signal grid forces *structured arguments* where my spreadsheet had magic numbers. The evidence URLs carry the quantitative data I need; the consent scores carry the *decision*, not the *calculation*. It's a different mental model. I'd use this alongside Amplitude, not instead of it -- the tool handles decision structure, the analytics tool handles metrics. The gap is connecting them: I want the tool to know that this opportunity has data behind it, not just a URL."

---

## Round 5: UX Academic Review

### Professor Vivian Hartley -- UX Program Director

**Profile**: Professor of Human-Computer Interaction at a research university. Teaches interaction design, information architecture, and usability evaluation at graduate level. Published on enterprise tool UX, consent-based interfaces, and progressive disclosure in complex domains. Has graded tool UX as part of industry-academic partnerships. Uses Nielsen's heuristics, Shneiderman's Eight Golden Rules, and her own "Cognitive Load Budget" framework for evaluation.

Reviews the live tool, the UX Principles document, the Product Guide, and the User Journeys document. Grades on a 100-point scale across five dimensions.

---

#### Evaluation Framework

| Dimension | Weight | What it measures |
|---|---|---|
| **Conceptual Model** | 25% | Does the tool's abstraction match the user's mental model? Are concepts learnable and internally consistent? |
| **Information Architecture** | 25% | Is information organized, labeled, and prioritized correctly? Can users find what they need? |
| **Interaction Design** | 20% | Are interactions efficient, predictable, and recoverable? Does the tool support both novice and expert users? |
| **Visual Design & Aesthetics** | 15% | Does the visual system support comprehension? Is it consistent and accessible? |
| **Completeness & Polish** | 15% | Is the tool feature-complete for its stated purpose? Are there rough edges? |

---

#### 1. Conceptual Model -- 88/100

**Strengths:**

The two-axis model (opportunities x deliverables) with many-to-many links is the strongest conceptual contribution of this tool. It correctly identifies that the relationship between business goals and work items is a *graph*, not a tree -- a distinction that every mainstream agile tool gets wrong. The ArchiMate-inspired coverage model (full/partial) adds nuance without complexity.

The four-stage pipeline with consent-based gating is well-grounded in theory (Sociocracy 3.0, de Bono's thinking hats) and maps cleanly to observed product management practice. The separation of thinking modes per stage (open/focused/evaluative/structural) is pedagogically valuable -- it teaches the user how to think at each stage, not just what to put in the fields.

The signal grid (4 stages x 3 perspectives) as the core data structure is elegant. It creates a natural matrix that makes gaps and inconsistencies visible at a glance. The IDEO-inspired three-perspective framework is well-established in design thinking and avoids the domain-specific complexity of frameworks like KTH's IRL.

The five-view structure organized by temporal intent (what happened / what to push / what to build / who to talk to / who cares) maps to documented PO workflow patterns. Each view answers a different question, and the progression from briefing to working to coordination is natural.

**Weaknesses:**

The distinction between Opportunities and Deliverables is clear in theory but requires vocabulary that new users don't have. Rosa's review confirms this: someone coming from Jira thinks in Epics/Stories, not Opportunities/Deliverables. The "pivot" metaphor from the Product Guide is powerful but abstract. The tool needs in-context education -- not a manual, but UI-level hints that reinforce the conceptual model during use.

The consent semantics (positive = consent, uncertain = concern, negative = objection) are sophisticated but potentially confusing. Sam's review highlighted the ambiguity: is "Uncertain" about the outcome or about willingness to proceed? The tool provides a one-liner on the contributor scoring view ("Consent to proceed -- not a prediction of success") but this text doesn't appear in the PO's own detail pane. The conceptual model leaks precisely where it matters most.

The news feed's event-vs-condition distinction (events decay, conditions persist) is conceptually clean but invisible to users. No UI text explains why a "commitment overdue" item can't be dismissed while a "score added" item can. The system model is correct; the user's model has no way to discover this.

**Grade justification:** Exceptionally strong theoretical grounding, internally consistent, well-mapped to domain. Deducted for learnability barriers at the vocabulary and scoring-semantics levels.

---

#### 2. Information Architecture -- 85/100

**Strengths:**

The progressive disclosure architecture is well-executed across three density layers: glance (card with health dots + aging badge), scan (expanded row with nudge + meta), and expand (full detail pane). The zoomed-stage mode adds a fourth intermediate density that correctly bridges scan and expand. This is textbook progressive disclosure with the rare quality of having each layer be *independently useful*.

The Latest tab's newspaper metaphor (headline cards for tier-1, wire feed for tier-2/3, collapsed for older) is an inspired choice for temporal information. The aging bands (Fresh/Read/Older) map naturally to how humans process news. The resolution notices ("No longer stale", "Commitment fulfilled") close the narrative loop -- most tools show problems but never acknowledge when problems are resolved.

The Stakeholders tab adds a valuable third navigation axis. The existing views are entity-centric (opportunity pipeline, deliverable matrix) and event-centric (news feed, meeting agenda). Stakeholders provides a person-centric lens that answers "what does this individual care about?" -- a question that POs ask constantly but most tools can't answer without manual assembly.

Triage ordering (blocked → needs input → on track) within stage groups is the correct priority ordering for a PO's scanning behavior. The nudge text per card ("Get engineering input", "Ready to advance") transforms a status display into an action list.

**Weaknesses:**

The Overview sub-view in the Latest tab is architecturally orphaned. It shows a static board snapshot (opportunities by stage, deliverables, stakeholders) but doesn't carry information that isn't available in the Pipeline or Deliverables views. Its value is as a lightweight "dashboard at a glance" for POs who don't want to switch tabs -- but this positioning isn't communicated. Rosa's confusion ("when would I use this?") confirms the labeling problem. Consider renaming to "Board Summary" or integrating summary statistics directly into the tab header.

The Meetings view and Stakeholders view overlap in function. Both answer "what do I need to discuss with this person?" Meetings provides per-person agendas with change detection and inline scoring. Stakeholders provides profiles with talking points and commitment status. A PO preparing for a 1:1 might use either view, and the tool doesn't guide the choice. This is not yet a problem at 5 views, but it's a structural risk as features accumulate.

The exited opportunities section at the bottom of the Pipeline is an ever-growing list with no internal organization. Dani flagged this in Round 3 and it remains unsolved. For boards with significant history (20+ exits over months), this becomes a scroll pit. At minimum: filter by exit state, search by title.

**Grade justification:** Strong hierarchical disclosure, well-chosen metaphors (newspaper, funnel, matrix), effective triage ordering. Deducted for the Overview sub-view positioning, Meetings/Stakeholders overlap, and unstructured exit history.

---

#### 3. Interaction Design -- 82/100

**Strengths:**

Keyboard-first navigation is exceptionally well-implemented. The `j/k` vim-style list navigation, number keys for view switching, single-key actions (`a` advance, `x` exit, `n` add, `e` edit), and `?` for help constitute a power-user interaction vocabulary that most enterprise tools never achieve. The quick-add dialog (`n`, Tab to toggle mode) is a model of minimal-ceremony capture.

The undo system (20-level snapshot stack, Ctrl+Z) is correctly implemented as semantic undo -- restoring full board state rather than individual field changes. This is the right choice for a planning tool where actions have cross-cutting effects (advancing a stage affects the funnel, the triage sort, the meeting agenda, and the news feed).

Cross-view navigation (click a deliverable name in the opportunity pane → jump to Deliverables tab) reduces the tab-switching tax. The navigation is bidirectional (Pipeline ↔ Deliverables) and also works from the Latest tab to the relevant entity view. This is well-integrated and feels natural.

The brain dump import is an excellent example of low-ceremony onboarding. Instead of forcing users through a form-based setup, the tool accepts rough text input with simple syntax (`##` for opportunities, `-` for deliverables) and provides a live preview. The conversion from informal notes to structured board data is seamless.

**Weaknesses:**

The detail pane interaction model has a significant gap: when the pane is open, the list compresses to compact mode (title + stage letter only), losing all triage-relevant signals. The user must close the pane to scan, then reopen to act. Priya and Dani identified this in Round 3. A medium-density compact mode (health dots + aging badge surviving pane-open state) would resolve the close-scan-reopen cycle. This is flagged as "Not built" in the priority list and remains the most impactful unshipped interaction improvement.

Meeting completion has no confirmation and cannot be undone. Alex flagged this in Round 1. A "Done" action that locks in a snapshot should either be undoable or confirm before committing. This is a small but genuine risk of user error in a high-value workflow.

The funnel's interactivity (hover to highlight, click to filter) has no affordance. No cursor change, no tooltip, no visual hint that the SVG segments are interactive. Alex, Priya, and Dani have all noted this independently. While the interaction itself is well-designed, its discoverability is zero.

The Tab key for funnel/horizon toggle conflicts with standard browser focus navigation. Priya and Dani flagged this in Round 3. It's a minor but persistent accessibility violation.

**Grade justification:** Excellent keyboard-first design, strong undo, good cross-view navigation. Deducted for the compact-mode information loss, meeting Done irrecoverability, and funnel discoverability.

---

#### 4. Visual Design & Aesthetics -- 80/100

**Strengths:**

The design token system (CSS custom properties for colors, spacing, typography, shadows) enforces visual consistency across all views. The OKLCH color space for tokens is a sophisticated choice that ensures perceptual uniformity across the palette. The warm tone (desert sand base, amber accents) achieves the UX Principles' goal of "warm, not corporate" -- this feels like a personal thinking tool, not an enterprise dashboard.

The aging badges (fresh → aging → stale with escalating visual weight) are an effective use of the principle "time is a first-class signal." The progression from subtle green text to warm bordered pill to red filled pill creates an intuitive urgency gradient without requiring labels.

The newspaper hierarchy in the Latest tab (headline cards with colored borders, wire-feed items with minimal styling, collapsed older section) is visually distinctive and functionally effective. The density difference between tiers communicates importance before the user reads any text.

The funnel visualization with stage-colored segments, triage indicators, and interactive filtering is the most visually sophisticated element. It communicates pipeline shape, stage health, and item distribution in a single compact widget.

**Weaknesses:**

Information density is high in several views. The deliverables matrix with coverage dots, size badges, certainty bars, contributor columns, and opportunity headers is visually overwhelming on first encounter. The legend helps, but the matrix needs more generous spacing between the coverage section and the contributor section to create a visual breathing point.

The signal grid in the detail pane presents 12 cells (4 stages x 3 perspectives) with up to 4 fields each (score, verdict, evidence, owner). Even with collapsible perspective rows, the expanded grid is dense. For stages the user hasn't reached yet ("future" stages), the cells could be visually demoted further -- lighter borders, collapsed by default -- to reduce the perceived load.

Color accessibility is untested. The OKLCH tokens likely produce sufficient contrast ratios, but the tool relies on color coding (green/amber/red) for score states, health dots, and triage buckets. Without verification against WCAG 2.1 AA contrast requirements, this is a risk. The UX Principles document prescribes "a word beats a glyph beats a color alone" -- and this is mostly followed (scores have labels, dots have tooltips), but several views rely on color-only dots for quick scanning.

**Grade justification:** Consistent token system, effective visual hierarchy, strong thematic identity. Deducted for density management in the matrix and signal grid, and untested color accessibility.

---

#### 5. Completeness & Polish -- 78/100

**Strengths:**

For its stated scope (solo PO, pre-sprint planning), the tool is remarkably complete. The five views cover triage, pipeline management, execution planning, meeting prep, and stakeholder coordination. Persistence, undo, import/export, keyboard navigation, P2P sharing, and contributor scoring are all functional. The aging model with decay and resolution notices adds temporal sophistication beyond what most production tools offer.

The brain dump import provides a low-friction onboarding path. The welcome page with three clear choices (create, join, demo) is well-structured. The sample dataset is rich enough to demonstrate all features without overwhelming.

The P2P sharing via Nostr relays with room-level encryption is an ambitious feature that is well-integrated into the contributor workflow. The assignment → publish → score → submit → apply cycle is complete and functional.

**Weaknesses:**

Several features identified as priorities across multiple review rounds remain unshipped. The medium-density compact mode (Round 3 priority #9), funnel minimum segment width (Round 3 priority #12), and exited section filtering (Round 3 priority #14) are known issues with documented solutions. The persistence of these gaps across review cycles suggests a prioritization issue rather than a design challenge.

The deliverable data model is noticeably thinner than the opportunity model. Opportunities have signals, stages, aging, exit states, commitments, people links, and notes. Deliverables have title, size, certainty, links, contributors, and consumers -- no notes, no history, no status tracking. Tomás's review confirms this asymmetry is noticeable. For a tool that models "two axes," one axis is significantly more developed.

List-level filtering (by stage, perspective, origin, status) is absent. Alex and Jordan flagged this in Round 1. The triage sort provides implicit filtering (blocked items surface first), but explicit filtering ("show me only items where Feasibility is unscored") is a standard interaction pattern that's missing.

No error states or degradation are visible. What happens when localStorage is full? When a relay is unreachable? When a JSON import has invalid data? The tool likely handles these silently, but resilience isn't demonstrated in the UI.

**Grade justification:** Impressively complete for stated scope, strong onboarding, ambitious P2P feature set. Deducted for persistent known gaps, deliverable model asymmetry, missing filtering, and invisible error handling.

---

#### Overall Grade: 83/100 (A-)

| Dimension | Score | Weight | Weighted |
|---|---|---|---|
| Conceptual Model | 88 | 25% | 22.0 |
| Information Architecture | 85 | 25% | 21.25 |
| Interaction Design | 82 | 20% | 16.4 |
| Visual Design & Aesthetics | 80 | 15% | 12.0 |
| Completeness & Polish | 78 | 15% | 11.7 |
| **Total** | | **100%** | **83.35** |

---

#### Summary Judgment

Slim is a conceptually sophisticated tool that successfully models a domain no mainstream product addresses: the pre-sprint upstream planning workflow. Its theoretical grounding (consent-based governance, thinking-mode separation, many-to-many goal-work mapping) is stronger than that of any commercial competitor I've evaluated. The five-view architecture organized by temporal intent is well-reasoned and maps to documented PO workflows.

**What elevates it above average:**
- The signal grid as a structured conversation (not a scoring matrix) is a genuine conceptual innovation in this space
- The aging model with decay, resolution notices, and flap protection shows unusual temporal sophistication
- The keyboard-first interaction vocabulary enables expert-level throughput
- The brain dump import demonstrates a rare commitment to low-ceremony onboarding
- Cross-view navigation and the bidirectional opportunity-deliverable linking close interaction loops that most tools leave open

**What prevents an A+:**
- The deliverable model is underdeveloped relative to the opportunity model -- the "two axes" promise is asymmetric
- The compact-mode information loss when the detail pane opens is a significant daily-use friction that has been documented for three review rounds
- List-level filtering is a table-stakes feature for any tool managing 20+ items
- The conceptual vocabulary (opportunities, deliverables, consent, perspectives) assumes domain knowledge that new users don't have, and in-context education is insufficient
- Known issues from early reviews remain open, suggesting the tool's development prioritizes new features over fit-and-finish

**Recommendation:** This tool is ready for daily use by experienced POs who already think in terms of value-vs-work decomposition. It would benefit from a focused "polish sprint" addressing the compact-mode density, list filtering, deliverable model parity, and in-context glossary before targeting the broader PO market. The theoretical foundation and interaction design are strong enough to support significant feature expansion without architectural rewrites.

---

#### Appendix: Comparison to UX Principles Document

The tool's 21 UX Principles are ambitious and well-articulated. Compliance assessment:

| Principle | Compliance | Notes |
|---|---|---|
| 1. Show shape of work, not list of tickets | **Full** | Funnel, triage buckets, aging -- all show flow health |
| 2. Questions over scores | **Full** | Stage-specific cell prompts, consent not numeric |
| 3. Consent gates, not permission gates | **Full** | Any perspective can block, none can force |
| 4. Warm, not corporate | **Full** | Warm palette, serif/sans separation, generous spacing |
| 5. Answer the user's question | **Mostly** | Nudges and triage answer well; Overview sub-view less clear |
| 6. Priority = visual ordering | **Full** | Blocked at top, nudge prominent, stale items loud |
| 7. Progressive disclosure in 3 layers | **Full** | Glance/scan/expand + zoomed as 4th layer |
| 8. Aggregate before enumerate | **Mostly** | Stage headers aggregate; matrix lacks column summaries |
| 9. Color encodes state + labels beat symbols | **Mostly** | Score buttons labeled; some health dots color-only |
| 10. Keyboard-first | **Full** | Comprehensive keybindings, all actions keyboard-reachable |
| 11. Context stays visible | **Partial** | Split pane works but compact mode loses too much |
| 12. Feedback is spatial | **Full** | No modal dialogs, inline everything |
| 13. Motion is acknowledgment | **Full** | Subtle transitions, respects prefers-reduced-motion |
| 14. Tokens are source of truth | **Full** | CSS custom properties for everything |
| 15. Borders separate, shadows elevate | **Full** | Consistent layering model |
| 16. Typography is bimodal | **Full** | Serif headings, sans-serif chrome |
| 17. One truth, shown many ways | **Full** | All views reactive to same state |
| 18. Time is first-class signal | **Full** | Aging, deadlines, staleness visible everywhere |
| 19. Exit is a decision | **Full** | Kill/park/merge with rationale and reactivation |
| 20. Data belongs to the user | **Full** | No accounts, local storage, JSON/CSV export |
| 21. Ceremony scales with team size | **Mostly** | People features are optional; signal grid still 12 cells for solo POs |

15 of 21 principles are fully met. 5 are mostly met with documented gaps. 1 is partially met (compact mode). This is a strong compliance rate for a 21-principle framework -- most commercial tools would fail 5-6 entirely.

---

### Priority Recommendations (Post Round 4 + Academic Review)

| # | Issue | Source | Impact | Effort |
|---|---|---|---|---|
| 1 | ~~**Compact-mode retains health dots + aging**~~ — Resolved: compact mode removed; detail pane shows overview density | Priya/Dani R3, Prof. Hartley | High | S |
| 2 | ~~**Perspective lens**~~ — Resolved: toggle buttons in pipeline header re-orient around one perspective's consent state with summary line ("Technical: 3 unheard, 1 objection, 4 consented"), score-based re-sort, and auto-collapse in detail pane | Alex R1, Sam R1, Prof. Hartley | High | S |
| 3 | ~~**In-context glossary / tooltips**~~ — Resolved: concept explainers in BrainDump, WelcomePage, and QuickAdd; perspectives use plain labels (Users/Technical/Business) | Rosa R4, Prof. Hartley | Medium | S |
| 4 | ~~**Deliverable notes/description field**~~ — Resolved: `notes` field added to Deliverable model and detail pane with textarea, matching opportunity Notes pattern | Tomás R4 | Medium | XS |
| 5 | ~~**Score semantics help text in PO detail pane**~~ — Resolved: expanded score buttons show text labels (Not consulted/Consent/Concern/Objection) for current stage; "Consent to proceed — not a prediction of success" hint shown inline | Sam R1, Prof. Hartley | Medium | XS |
| 6 | ~~**Meeting Done confirmation or undo**~~ — Resolved: confirm dialog before stamping (shows discussed count); undo snapshot pushed via `onBeforeDone` | Alex R1, Prof. Hartley | Medium | S |
| 7 | **Event-vs-condition explain in UI** | Prof. Hartley | Low | XS |
| 8 | **Board templates for onboarding** | Kenta R4 | Low | S |
| 9 | **Funnel hover affordance** (cursor, tooltip) | Alex R1, Priya R3, Prof. Hartley | Low | XS |
| 10 | **Exited section filter by exit state** | Dani R3, Prof. Hartley | Low | S |

### Follow-up: Two-Line Row Polish (Priya x Dani)

Four issues from reviewing the shipped two-line layout. Items 1, 2, 4 resolved; item 3 deferred.

| # | Fix | Status |
|---|---|---|
| 1 | ~~Rename bucket `blocked` → `urgent`~~ | Resolved |
| 2 | ~~Move origin + horizon tags to line 1~~ | Resolved |
| 3 | Diamond prefix on horizon labels | Deferred |
| 4 | ~~Bottom padding on `.pl-rows`~~ | Resolved |
