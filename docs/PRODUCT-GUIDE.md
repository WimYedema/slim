# Slim -- Product Guide

> A planning tool for product owners, covering the work *before* the sprint board.

---

## The problem in a nutshell

Every agile tool in the market models the same thing: Todo -> Doing -> Done. That's the *production* pipeline -- the part developers live in. But the part where value decisions actually happen -- ideation, clarification, validation -- is treated as an undifferentiated "backlog."

Product owners manage that messy upstream work in their heads, spreadsheets, Confluence pages, and Miro boards. None of these tools model the *flow* of an idea from first spark to "ready for sprint."

Developers got Kanban boards fifteen years ago. Product owners got a text editor and good luck.

### What goes wrong without structure

- Ideas arrive at sprint planning three times bigger than anyone assumed -- too late to rescope.
- Nobody can see where things are stuck. Twelve items sit in "clarifying." Zero have been validated.
- Validation gets skipped entirely. An idea goes from "someone asked for this" straight to the backlog, because nothing enforces the step.
- In R&D environments, half the pipeline is supply-driven ("we *can* build this"), but there's no gate for "but *should* we?" Technically exciting ideas sail past validation by default.
- The link between business goals and the actual work gets lost in translation.
- Prioritization is gut feel, because value, risk, and effort live in different tools at different fidelities.

---

## Two axes, not one hierarchy

Conventional agile tools pretend there's a single chain: Epic -> Story -> Task. That's a simplification. In reality, there are two separate decomposition axes:

- **The value axis (why):** Theme -> Opportunity -> Sub-opportunity
- **The work axis (how):** System -> Feature -> Task

A user story sits at the pivot between these two trees -- it's the last value-level entity and the first work-level entity. Tools like Jira hide this pivot by treating everything as the same ticket type with different labels.

Slim makes the pivot explicit:

- **Above the pivot** -- value decomposition, owned by the PO: *Why are we doing this? Is it worth it? What's the smallest valuable slice?*
- **Below the pivot** -- work decomposition, owned by the dev team: *How do we build it? What are the tasks?*
- **The Decompose stage is the pivot itself** -- where value-framed opportunities get translated into buildable deliverables.

### The relationship is a graph, not a tree

The mapping between opportunities and deliverables isn't hierarchical -- it's many-to-many.

Consider three opportunities: faster checkout, better search, and dashboard speed. Now consider three deliverables: add a Redis cache, optimize DB queries, and set up a CDN. The Redis cache serves both faster checkout *and* dashboard speed. The DB optimization serves both faster checkout *and* better search. One deliverable can partially or fully cover an opportunity, and one opportunity may need several deliverables to be realized.

Each link between an opportunity and a deliverable carries a **coverage** indicator (full or partial) and, in future versions, a **flavor** (must-have, stretch, or cleanup) that captures how critical the deliverable is to that particular opportunity. The same deliverable can be must-have for one opportunity but stretch for another.

This graph structure lets the PO answer questions that tree-based tools can't: *Which opportunities break if we descope deliverable X? Is this deliverable still worth building if opportunity Y gets killed?*

Enterprise architecture frameworks like ArchiMate model similar relationships between goals and capabilities, including the idea that a single initiative can positively serve one goal while negatively impacting another -- a trade-off that's invisible when all links are simply "connected."

---

## A pipeline with thinking modes

Slim defines four stages with an opinionated flow. Each stage enforces a dominant way of thinking -- a principle drawn from Edward de Bono's work on separating creative and critical thought. When both happen simultaneously, criticism wins and ideas die before they're fully formed.

| Stage | Thinking mode | What happens here |
|---|---|---|
| **Explore** | Open | "What if." Imagine, combine, discover. No criticism, no estimates. |
| **Sketch** | Focused | Gather facts, define constraints, identify who's affected, describe what "done" looks like. |
| **Validate** | Evaluative | Test assumptions against evidence. New ideas go back to Explore. |
| **Decompose** | Structural | Split into deliverables, size them, map them to opportunities. The question of *whether* to build is already settled. |

Contributors opening a card can tell what kind of thinking is invited by the stage it's in.

### Three perspectives, not one checklist

Slim borrows the three lenses from IDEO's human-centered design framework and applies them across every stage -- not just at the validation gate:

- **Desirability** -- does someone want this?
- **Feasibility** -- can we build it?
- **Viability** -- does it make business sense?

What changes across stages is the fidelity. At _Explore_, desirability is just "someone might want this." By _Validate_, it's "we tested with users and here's what happened." The same three questions get sharper answers as the opportunity matures.

This creates a two-dimensional space -- stage (horizontal) x perspective (vertical) -- where every opportunity lives. The result is a signal grid: a compact matrix that makes gaps obvious at a glance. An opportunity in Validate with an empty feasibility column visually screams "nobody checked whether we can actually build this."

KTH's Innovation Readiness Level framework independently arrived at the same three core dimensions (Customer Readiness, Technology Readiness, Business Model Readiness), lending external validation to this structure.

---

## How decisions work

### Consent, not consensus

Slim's scoring system draws on Sociocracy 3.0's consent-based decision-making. Each perspective at each stage receives one of four scores:

| Score | What it means | Effect |
|---|---|---|
| **Positive** | "I support this." | Clears the perspective. |
| **Uncertain** | "I have reservations but won't block." | Also clears -- the concern gets recorded as context. |
| **Negative** | "This needs resolution before we proceed." | Blocks advancement until resolved. |
| **None** | No one has weighed in yet. | Also blocks -- you can't consent to what you haven't heard. |

This is a meaningful departure from traffic-light scoring. Two positives and one uncertain? The opportunity can advance -- consent is achieved, concerns are noted. Two positives and one negative? It cannot -- there's an outstanding objection. Two positives and one silence? Also blocked -- someone hasn't been consulted.

The key shift is in the PO's question. Instead of "is this good enough?" (a judgment call), the frame becomes "is there a reason we can't try this?" (a consent check) -- a lower, more actionable bar that encourages experimentation.

### The funnel should narrow

Many ideas enter. Few should survive. A healthy pipeline looks like 47 -> 12 -> 5 -> 3. A pipeline reading 47 -> 45 -> 44 -> 43 means nobody is saying no. Slim makes the funnel shape visible at a glance, so the PO can feel the pressure without configuring dashboards or generating reports.

---

## People and accountability

Every opportunity can link to people with a specific role:

- **Approver** -- "I need this person's sign-off before this can move." The person who doesn't know they're blocking usually *is* the bottleneck.
- **Expert** -- "I need this person's knowledge during the Sketch or Validate stage."
- **Stakeholder** -- "This person cares about the outcome and should stay informed."

Each person can also be assigned to own a perspective on a specific opportunity. The tech lead owns feasibility; the designer owns desirability; the PO owns viability. This is a lightweight form of delegation -- structurally similar to Sociocracy 3.0's "delegate influence" pattern, but without the ceremony. The delegation is domain-scoped ("feasibility on this opportunity"), not task-scoped ("run this spike"). The accountability loop closes when the person records a score and verdict in the relevant grid cell.

The same data serves two audiences. The PO sees "ask Sarah for the unblock." Sarah sees "someone is stuck because of me." Meeting prep and personal to-do lists are the same filter, viewed from opposite ends.

---

## Where ideas come from

Opportunities enter the pipeline from four sources, a distinction inspired by the Osborn-Parnes creative problem-solving model's emphasis on problem-finding:

- **Demand** -- a user need or complaint. Arrives with a problem; must discover a solution direction before leaving Sketch.
- **Supply** -- a technical capability ("we can now do Y"). Arrives with a solution; must discover the *problem it solves* before leaving Sketch. This prevents exciting tech from skipping the "but should we?" question.
- **Incident** -- an urgent disruption. The only truly unplanned type.
- **Debt** -- a pattern of accumulated evidence from bugs, deferred concerns, or discovered degradation. Not a single bug, but the systemic signal that five bugs in the same subsystem might justify a new opportunity.

Tracking the ratio (say, 60% demand, 20% supply, 10% debt, 10% incidents) is itself a useful diagnostic.

### Bugs vs. debt vs. opportunities

These are different things that live in different places:

- **Bugs** live in the sprint tool. They're about restoring expected value, triaged by probability x impact. A single bug gets a hotfix.
- **Debt** is what accumulates when concerns are noted but not resolved -- technical shortcuts, UX workarounds, compliance gaps. Individual debt items are standing evidence, not opportunities.
- **Opportunities** arise when the evidence reaches a tipping point. Five bugs pointing to the same root cause? That pattern enters Slim as a debt-driven opportunity, carrying the bug reports as built-in context.

Slim doesn't manage bugs or individual debt items. It makes the accumulation visible and gives the PO structured evidence when the pattern justifies systemic action.

---

## When ideas don't move forward

Not every opportunity advances. Some are rejected, some are shelved, some are absorbed into other opportunities. These exits are decisions with rationales -- not failures. Like architectural decision records for technical choices, Slim preserves product decisions so they can be referenced later rather than relitigated.

| Exit state | What it means |
|---|---|
| **Killed** | Evaluated and rejected. A perspective failed, or priorities shifted. Can be reopened as a new opportunity linked to the original. |
| **Parked** | Not rejected, just not now. Can set a horizon for revisitation. Returns to the stage it left when reactivated. |
| **Merged** | Duplicate or subsumed by another opportunity. It *is* the other one now. |
| **Delivered** | Decomposed, exported, built. |

Every exit captures *who* decided, *why*, and what the evidence looked like at that point. Over time, this builds institutional memory. "Why didn't we build X?" has a one-click answer.

---

## The four views

The data model is rich -- pipeline stages, maturity levels, people links, origin types, decision records, three perspectives, many-to-many graphs, delivery horizons. If the PO has to think about all of that at once, we've built Jira 2.0.

The answer is progressive disclosure across four views, organized around the PO's natural daily workflow:

### 1. Briefing -- "What happened?"

An actionable news feed, ranked by urgency. Objections, overdue commitments, and discontinued items are prominent. Minor edits fade quickly. Everything ages out naturally. Each item carries a verb -- "Review objection on X," "Score feasibility on Z" -- and links directly to the relevant detail.

The PO checks this first thing in the morning. Five minutes, context loaded.

### 2. Pipeline -- "What do I push?"

The working view. All active opportunities, grouped by stage or by delivery horizon, with linked deliverables nested underneath. A funnel visualization at the top. Triage buckets (blocked -> needs input -> on track) sort items within each group so what needs attention surfaces first.

Clicking a stage header zooms into a focused view of everything at that stage -- signal grids, deliverables, commitments, people involved -- replacing the click-open-close-click cycle of working through a backlog.

### 3. Deliverables -- "What's the build order?"

A cross-reference table. Deliverables are rows. Opportunities are columns. Coverage dots fill the cells. This is where the PO plans execution sequence -- a different mental mode from the Pipeline view's value-first perspective.

Additional columns show T-shirt size, certainty, and who's building or consuming each deliverable. Orphan badges flag deliverables serving no opportunity. Gap badges flag opportunities with no deliverables.

### 4. Meetings -- "Who do I talk to?"

A per-person meeting prep view. Select a person, get an auto-generated agenda: what changed since the last meeting (snapshot-based diffs), outstanding commitments, cells awaiting their input (scoreable inline), conflicting signals, and linked deliverables.

Complete the meeting, and the tool captures a snapshot for next time. No notes to write -- the tool tracks what changed structurally.

This turned out to be the highest-value feature per click. It eliminates 15-20 minutes of manual context assembly before each stakeholder conversation.

---

## Horizons and stages are independent

An opportunity's **stage** reflects confidence -- how thoroughly has this been validated? Its **horizon** reflects intent -- when does the PO aim to deliver it? These are separate dimensions:

- Explore stage + Q2 horizon = a risky bet (committed timeline, unvalidated idea)
- Validate stage + LATER horizon = a proven option (validated but not yet prioritized)

Horizons are freeform strings. Teams can use quarterly labels, "NOW / NEXT / LATER," or anything that works for them.

---

## What it's built on

| Layer | Choice |
|---|---|
| Language | TypeScript |
| UI | Svelte 5 |
| Build | Vite (single HTML file output) |
| Storage | Browser localStorage |
| Network | None -- fully local, no server, no accounts |

Everything runs in the browser. No dependencies, no per-seat pricing, no data leaving the machine.

---

## Who it's for

### The typical product owner

Product owners don't follow a single career path. They arrive from business analysis, QA, domain expertise, project management, or development. Most learn the role on the job, possibly with a weekend certification course. Slim can't assume lean or design thinking vocabulary -- it teaches through structure, not labels.

The "Product Owner" title also masks different scopes. Roman Pichler's taxonomy identifies at least six: full-product PO, feature owner, component owner, SAFe tactical PO, platform owner, portfolio owner. Most POs in practice are feature owners managing 10-30 opportunities, not strategic leaders steering an entire product. Slim is designed for that reality.

### Two personas

**Alex, the tactical PO** works at a 30-150 person company, owns one or two product areas, and reports to a head of product. About 40% of the pipeline is supply-driven (engineers proposing capabilities). Alex manages 15-40 active opportunities, meets 3-5 stakeholders weekly, and loses track of who's waiting on what. The spreadsheet is the current tool. The need: say no to ideas with structural backing, not just gut feel.

**Jordan, the solo PO** works at a 10-30 person startup, wears multiple hats, and keeps everything in a Notion doc. No budget for enterprise tools, no time for configuration. The need: something that works in five minutes and replaces the spreadsheet for daily use.

---

## The competitive landscape

| Tool | Position | What's missing |
|---|---|---|
| Productboard | Enterprise discovery + roadmapping | Expensive, complex, no offline mode |
| Aha! / Airfocus | Roadmap + prioritization | PM-team-centric, SaaS, seats-based pricing |
| Jira Product Discovery | Atlassian's upstream play | Assumes the Atlassian ecosystem |
| Spreadsheets | *The actual incumbent* | Free and flexible, but zero flow visibility |
| Miro / Confluence / Notion | Ad-hoc tooling | No structured pipeline |

The real competitor is the spreadsheet. Slim must be easier for daily use while showing what the spreadsheet can't: where ideas are stuck, who's blocking what, whether the funnel is narrowing, and what to say in tomorrow's 1:1.

---

## What's built today

| Feature | Status |
|---|---|
| Briefing view (board-wide news feed, 5 importance tiers) | Done |
| Pipeline view with stage/horizon grouping + funnel + zoom | Done |
| Triage list with smart sort and contextual nudges | Done |
| Signal grid (4 stages x 3 perspectives) with consent gating | Done |
| Coverage matrix with contributor columns | Done |
| Roadmap with horizon grouping and size breakdown | Done |
| Meeting prep with snapshot-based change detection | Done |
| People links, delegation, commitments | Done |
| Local persistence (localStorage) | Done |
| Card aging (time-in-stage visual decay) | Done |
| Full exit states (kill / park / merge) with reason capture | Done |
| Origin types (demand / supply / incident / debt) | Done |
| Import / export (JSON + CSV, merge import) | Done |
| WIP limits per stage (funnel coloring, badges, nudges) | Done |
| 20-level undo (Ctrl+Z) | Done |
| Keyboard navigation + quick-add dialog | Done |
| P2P sharing (Nostr relay, encrypted rooms) | Done |
| Contributor scoring view (remote verdict submission) | Done |
| Skatting integration | Planned |
| Token budgets | Planned |
| Opportunity nesting | Planned |
| Named scenarios (side-by-side compare) | Planned |

---

## The product roadmap

### Horizon 1 -- Solo PO (current)

Replace the spreadsheet. A solo PO can import their backlog, maintain a pipeline for a month, export for sprint planning, and prepare all their 1:1s from the tool.

### Horizon 2 -- Team PO

Add contributor workflow. Share a board link. Team members fill in their own perspectives without attending a meeting. The PO sees results asynchronously.

### Horizon 3 -- Stakeholder-facing PO

Add scenario planning. The PO saves two roadmap configurations and presents them side by side. The stakeholder compares trade-offs on screen, and the discussion stays grounded in data.

### Horizon 4 -- Scaling PO

Add portfolio visibility. Token-based priority budgets force honest prioritization across teams. Shared deliverables surface cross-cutting dependencies.

Each horizon builds on the same data model -- no architectural rewrites, just richer views over the same primitives.

---

## Future: token-based prioritization

When Slim grows beyond single-PO use, stakeholders and dev teams can express priorities through fixed token budgets. Scarcity forces honesty: when everything is P1, tokens reveal what's *actually* P1.

Stakeholders allocate tokens across opportunities. The dev team allocates tokens representing capacity. Two independent allocation decisions produce a natural prioritization matrix:

- **Both high** -- aligned, do this.
- **Stakeholder high, dev low** -- wanted but capacity-constrained.
- **Stakeholder low, dev high** -- technical health investment.
- **Both low** -- nobody wants it and nobody can staff it. Drop.

Dev tokens also make technical investment visible and legitimate: infrastructure work enters the pipeline as a funded item, not something sneaked into a sprint.

---

## What Slim deliberately is not

- Not a sprint board. Use Jira or Linear for that.
- Not a documentation tool. Link to Confluence or Notion.
- Not a Gantt chart. The roadmap shows delivery *intent*, not task dependencies.
- Not a bug tracker. Bugs live in the sprint tool. Patterns of bugs become opportunities.
- Not a collaboration platform (yet). One PO curates; contributors update their own cards.

---

## Future directions

### Giving viability more structure

Of the three perspectives, viability is currently the vaguest. Desirability has concrete hooks (user testing, personas, "do they want this?"). Feasibility is grounded in technical spikes and sizing. But viability is just "does the business case hold?" -- no structure underneath.

Osterwalder and Pigneur's Business Model Canvas offers useful vocabulary here. Its nine building blocks don't map one-to-one onto Slim -- they scatter across the three perspectives -- but several of them sharpen the viability question:

| Business model block | What it asks |
|---|---|
| Revenue streams | How does this make money? |
| Cost structure | What does it cost to operate? |
| Channels | How do we reach users? |
| Key partnerships | What external dependencies exist? |

Rather than adding a canvas view or nine new fields (that would violate the simplicity constraint), two lightweight integrations are worth exploring:

**Enriched challenge questions.** The viability prompts at each stage could reference business model concepts without naming the framework. Instead of "does the business case hold?" at Validate, the prompt might ask: "do the affected parts of the model -- revenue, cost, channels, partnerships -- still work with this change?" The PO gets more specific guidance without needing to know what a Business Model Canvas is.

**Model-block tags on viability verdicts.** When someone scores viability, they could optionally tag which aspect of the business model they're assessing -- revenue, cost, channel, partnership. This would make viability signals more scannable and debatable without adding weight to the data model (the verdict free-text already captures the substance; tags just add a facet for filtering).

The key insight: opportunities exist *within* an existing business model. The viability question isn't "design a business model for this opportunity" -- it's "does this opportunity fit, extend, or break the current model?" The BMC blocks give vocabulary for where the fit or break happens.

---

## The litmus test

> Would a product owner open this on Monday morning *instead of* their spreadsheet?

Only if it takes less effort while showing something the spreadsheet can't: where ideas are stuck, and who needs what from whom.

---

*Slim draws on ideas from design thinking (IDEO), lateral thinking (De Bono), consent-based governance (Sociocracy 3.0), innovation readiness assessment (KTH IRL), enterprise architecture (ArchiMate / TOGAF), inventive problem solving (TRIZ), creative problem-solving (Osborn-Parnes), business model design (Osterwalder & Pigneur), and product ownership research (Pichler). These influences shape the tool's structure -- the pipeline stages, the three-perspective grid, the consent-based scoring, and the graph-based decomposition model.*
