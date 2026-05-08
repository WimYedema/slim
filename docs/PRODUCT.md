# Slim -- Product Concept

> A lean planning tool for product owners, covering the opportunity lifecycle from first spark to fulfilled promise.

See [PRODUCT-GUIDE.md](PRODUCT-GUIDE.md) for a non-technical introduction, [USER-JOURNEYS.md](USER-JOURNEYS.md) for feature walkthroughs.

## Problem

Every agile tool models the production pipeline (Todo -> Doing -> Done) and treats everything upstream as an undifferentiated "backlog." Product owners are left to manage ideation, clarification, and validation in their heads, spreadsheets, Confluence pages, and Miro boards -- none of which model the *flow* of an idea from inception to "ready for sprint."

Worse: once an idea *does* reach the sprint board, the PO's promises to stakeholders vanish into the delivery machinery. There's no structural connection between "I promised the CEO we'd ship this by Q3" and the sprint tickets that are supposed to make it happen.

Developers got Kanban boards 15 years ago. Product owners got a text editor and good luck.

### Symptoms

- POs discover opportunities are 3x bigger than assumed during sprint planning -- too late to rescope
- No visibility into where ideas are stuck (12 items in "clarifying," zero validated)
- Validation is skipped because nothing structurally enforces it
- In R&D, supply-driven ideas ("we *can* build this") skip the "should we?" gate by default
- The value -> work decomposition happens implicitly, losing the link between business goals and dev work
- Prioritization is gut feel because value, risk, and effort aren't captured with the same rigor
- Promises made to stakeholders during planning have no accountability loop -- the PO can't see whether what was committed actually shipped

### External evidence for the problem

The symptoms above are not speculative -- they are named anti-patterns and documented pain points across practitioner literature and industry research.

**The upstream tooling gap is well-recognized.** Stefan Wolpers (Professional Scrum Trainer, Scrum.org; author of *The Scrum Anti-Patterns Guide*) identifies "Storage for ideas" -- using the Product Backlog as a repository of ideas -- as a named anti-pattern: "Ideas do not belong in the Product Backlog; they are part of the product discovery system." Yet POs have no structured tool for that discovery system. The result: "The additional noise created by the sheer number of issues may cloud the detection of valuable items" (Wolpers, [Product Owner Anti-Patterns](https://age-of-product.com/product-owner-anti-patterns/), 2024). The airfocus product management platform leads with the tagline "Get out of slides. Get out of spreadsheets" -- the spreadsheet is the recognized incumbent.

**Validation is routinely skipped.** Wolpers lists "No research -- the Product Backlog contains few to no spikes or time-boxed research tasks" as a common anti-pattern. Jeff Patton, originator of story mapping, writes: "One of the tragedies in software development is that much of what we build doesn't succeed. It doesn't deliver the benefit we'd hoped" ([Dual Track Development](https://jpattonassociates.com/dual-track-development/), 2017). Marty Cagan (SVPG) observes that feature teams "will often think they are doing product discovery, but really it's just design and maybe a little usability testing" ([Product vs Feature Teams](https://www.svpg.com/product-vs-feature-teams/), 2019).

**Most teams are not empowered to do upstream work.** Cagan's taxonomy distinguishes delivery teams (backlog administrators), feature teams (output-focused squads given a roadmap of features), and product teams (empowered to solve problems). Only the last group does real discovery. In the far more common feature team model, "value and business viability are the responsibility of the stakeholder or executive that requested the feature on the roadmap" -- the link between business goals and work is structurally absent. The product manager role degrades to "mainly project manager, and partly (unskilled) designer."

**Under-refined work arriving at sprint planning is a named pattern.** Wolpers identifies "No preparation" (PO doesn't invest in continuous refinement), "Last minute changes" (items squeezed in without refinement), and "Unfinished business" (spillover without discussion) as recurring anti-patterns. Wolpers's anti-pattern list has been cited by 42,000+ newsletter subscribers and used in Scrum.org webinars.

**The Standish Group CHAOS reports confirm the cost of poor upstream decisions.** The 2015 CHAOS Report (50,000 projects studied) found that only a minority of projects are fully successful (on time, on budget, with satisfactory results). Smaller projects succeed far more often than large ones -- validating the need to decompose and validate before committing large efforts. The report ranks "Clear Business Objectives" and "User Involvement" among the top success factors. Notably, the Standish Group found that "projects with precise goals are less successful than ones with vague goals" -- supporting the idea that rigid upfront specification (what Slim calls skipping the Explore stage) hurts outcomes. Jennifer Lynch of the Standish Group stated: "Only that which is unknown produces real value" ([InfoQ interview](https://www.infoq.com/articles/standish-chaos-2015/), 2015).

**Boehm's cost curve grounds the economics of upstream investment.** Barry Boehm's foundational research at USC (*Software Engineering Economics*, 1981) established that the cost of fixing a defect grows exponentially the later it is discovered -- from 1x at requirements to 5--10x at coding to 30--70x in production. This is the economic argument for Slim's staged validation: catching a bad idea in Explore costs a conversation; catching it in production costs a release cycle.

**The false hierarchy is recognized by dual-track practitioners.** Patton explicitly describes discovery (value) and delivery (work) as "two kinds of work, and two kinds of thinking" requiring different processes. Cagan's four-risk framework separates value/viability (opportunity-level concerns, owned by the product manager) from usability/feasibility (solution-level concerns, owned by design and engineering). Both independently validate Slim's two-axis model.

**Promise accountability is the least-documented gap -- and potentially Slim's most distinctive insight.** No practitioner source we found offers a structured mechanism for tracking whether stakeholder commitments were fulfilled after sprint delivery. Wolpers describes the "Delaying PO" (doesn't inspect done items) and the "Absent PO" (unreachable during sprints) as symptoms. Cagan notes that "even though the stakeholder is responsible for value and viability, they will still find a way to blame you if results are not realized." The gap exists everywhere; no tool addresses it structurally. Glenn Ballard's Last Planner System from lean construction provides the theoretical model (Percent Promises Complete as a reliability metric) but has not been applied to product management tooling.

**The Standish Group's feature usage claim deserves a caveat.** The widely-cited "64% of features are rarely or never used" (Jim Johnson, XP 2002 keynote) was based on only four internal-use applications, as Mike Cohn of Mountain Goat Software [documented](https://www.mountaingoatsoftware.com/blog/are-64-of-features-really-rarely-or-never-used). Slim's problem statement does not rely on this statistic. The stronger evidence is structural: tools that model only delivery cannot help POs make better upstream decisions, regardless of the precise waste percentage.

## Foundations

### The false hierarchy

Conventional agile tools pretend there's a single decomposition hierarchy: Epic -> Story -> Task. This is false. There are two orthogonal decomposition axes:

1. **Value axis (WHY):** Theme -> Opportunity -> Sub-opportunity
2. **Work axis (HOW):** System -> Feature -> Task

A user story sits at the **pivot point** between these two trees. Jira hides this pivot by treating everything as the same ticket type with different labels. Slim makes it explicit:

- **Above the pivot** (value decomposition) lives in Slim, owned by the PO
- **Below the pivot** (work decomposition) lives in the sprint tool, owned by the dev team
- **The Decompose stage is the pivot itself** -- where value-framed opportunities get *translated* into deliverables
- **The Deliver stage watches across the pivot** -- the PO doesn't manage the sprint work, but tracks whether the decomposed work fulfilled the opportunity's promises

### The many-to-many mapping

The relationship between the two axes is not a tree -- it's a **graph**. One opportunity may need multiple deliverables. One deliverable may serve multiple opportunities (partially or fully). Each link carries coverage (full/partial) and, in future versions, flavor (must-have/stretch/cleanup).

This lets the PO answer questions current tools can't:
- "Which opportunities are at risk because deliverable X was descoped?"
- "Is this deliverable still worth building if opportunity Y is killed?"

### Influence relationships (inspired by ArchiMate)

A deliverable can *hurt* one opportunity while serving another. Without polarity, the PO can't see trade-offs. Polarity and weight are a v2 enrichment of the link graph -- just adding `{polarity, weight}` to each edge. Opposing polarities surface **contradictions** (TRIZ) -- creative tensions where the best solutions tend to emerge.

## Lean Pipeline

### The full Deming cycle

Slim's five stages map to Deming's Plan-Do-Check-Act cycle at the *opportunity* level:

| PDCA | Slim stages | What happens |
|---|---|---|
| **Plan** | Explore → Decompose | Decide what to build and why |
| **Do** | Sprint board (external) | Build it |
| **Check** | Deliver | Did we fulfill what was promised? |
| **Act** | Exit (Done/Kill/Park) | Close the loop: celebrate, correct, or abandon |

Without the Deliver stage, Slim would cover only the Plan. With it, the PO closes the feedback loop -- and the institutional record shows not just what was decided, but whether the decision led to the intended outcome.

### Stages as thinking modes

Inspired by De Bono's separation principle: don't mix thinking modes simultaneously. When creative and critical thinking happen at the same time, critical always wins -- ideas die before they're formed.

The first four stages **validate** the opportunity ("are we building the right thing?"). The Deliver stage **verifies** the delivery ("did we build what was promised?"). This distinction comes from systems engineering's V&V model: validation asks whether the intent is correct; verification asks whether the output matches the intent.

| Stage | Thinking mode | What belongs here | What does NOT belong here |
|---|---|---|---|
| **Explore** | Open | "What if..." -- explore, combine, imagine | Criticism, estimates, go/no-go |
| **Sketch** | Focused | Facts, constraints, who's affected, what "done" means | Judgment, solution design |
| **Validate** | Evaluative | Testing assumptions against evidence | New ideas (those go back to Explore) |
| **Decompose** | Structural | Splitting, sizing, mapping to deliverables | Revisiting whether we should build it |
| **Deliver** | Observational | Tracking promises, watching deliverables land | Second-guessing the decision to build |

### Three perspectives as a dimension, not a stage

The three IDEO lenses (desirability, feasibility, viability) are not specific to Validate -- they're a **second dimension** across the entire pipeline. What changes is the fidelity:

| | Desirability | Feasibility | Viability |
|---|---|---|---|
| **Explore** | "Someone might want this" | "Seems possible" | "Fits our area" |
| **Sketch** | "Here's who and why" | "Here are the constraints" | "Strategy alignment checked" |
| **Validate** | "We tested -- they do/don't" | "Spike confirmed/denied" | "Business case holds/fails" |
| **Decompose** | "This deliverable serves that need" | "Sized and estimated" | "Worth the cost" |
| **Deliver** | *(no signal grid -- commitments and deliverables are the measure)* | | |

**Validated by KTH Innovation Readiness Level.** KTH's IRL framework independently identified the same three core dimensions (Customer Readiness, Technology Readiness, Business Model Readiness). Their additional dimensions (IPR, Team, Funding readiness) suggest the perspective axis should be **extensible** in future versions.

### Consent-based advancement (Sociocracy 3.0)

Score semantics follow S3's consent model rather than traffic-light assessment:

| Score | Consent meaning | Effect on advancement |
|---|---|---|
| **Positive** | "I support this" | Clears the perspective |
| **Uncertain** | "I have reservations but won't block" | Clears (concern is logged as the verdict) |
| **Negative** | "This needs resolution before we proceed" | Blocks until resolved |
| **None** | "No voice heard" | Blocks (you can't consent to what you haven't heard) |

This reframes the PO's question from "is this good enough?" (judgment) to "is there a reason we can't try this?" (consent) -- a lower, more actionable bar that encourages experimentation.

### Design principles (pipeline level)

- **WIP limits per stage** -- visual pressure without configuration
- **Cards age visibly** -- time-in-stage drives fresh -> aging -> stale badges. Stale ideas are impossible to ignore.
- **The funnel should narrow** -- "47 -> 12 -> 5 -> 3" is healthy. "47 -> 45 -> 44 -> 43" means you're not saying no. The Deliver stage sits past the funnel's narrowest point -- it's the output end where promises are tracked, not filtered.
- **The board looks wrong when things are wrong** -- no dashboards needed. The visual state *is* the diagnostic.
- **Skipping stages is visible, not impossible** -- a conscious choice, not the default
- **Blocked is a first-class state** -- naming *who* is blocking turns four separate stalls into one conversation

### Origin types and problem-finding

Inspired by Osborn-Parnes: every opportunity must name both problem and solution by Sketch exit.

- **Demand** -- arrives with a problem, must discover a solution direction
- **Supply** -- arrives with a solution, must discover the problem it solves
- **Incident** -- urgent disruption. The only unplanned type.
- **Debt** -- accumulated evidence from bugs, deferred concerns, or degradation

### Debt and bugs

Debt is what accumulates when concerns are noted but not resolved. It comes in three flavors mirroring the three perspectives:

| Perspective | What debt looks like |
|---|---|
| Feasibility | **Technical debt** -- fragile implementation, workarounds |
| Desirability | **User debt** -- UX workarounds, accessibility gaps |
| Viability | **Business debt** -- manual processes, compliance gaps |

**Bugs are a fundamentally different entity.** They don't fit the opportunity model -- they're about restoring expected value, triaged by probability x impact. Bugs live in the sprint tool. But the **bug -> debt -> opportunity loop** is Slim's concern: five bugs revealing the same root cause enter Slim as a debt-driven opportunity with the bug reports as evidence.

### People links and delegation

Perspective delegation is structurally equivalent to S3's "delegate influence": the PO grants a subdomain (one perspective on one opportunity) to a role-filler who has autonomy to investigate but is accountable for reporting back. The accountability loop closes when the cell gets a score and verdict -- no ceremony, no governance meeting.

Filtering by person is **bidirectional**: the PO sees "ask Sarah for the unblock." Sarah sees "someone is stuck because of me." Meeting prep and personal queues are the same data, viewed from opposite ends.

### Commitments as reliable promises (Last Planner)

Slim's commitment model draws on Glenn Ballard's Last Planner System from lean construction: the **promise** is the basic unit of coordination. A reliable promise names what will be done, who it's promised to, and by when. The accountability loop closes when the promise is either kept or renegotiated -- never silently dropped.

The Deliver stage makes this loop structural. Commitments made during earlier stages become the primary measure of success in Deliver. The Promises grouping in the Pipeline view is a visual analogue of LPS's "Percent Promises Complete" -- showing at a glance how reliably the team delivers on what was committed.

### Decision records

Exits (kill/park/merge/done) are **decisions with rationales**, not failures. Like ADRs for technical choices, Slim preserves product decisions so they can be referenced, not relitigated. The card's pipeline journey provides the evidence; the exit stamps a reason and freezes the state.

**Done** is unique among exit states -- it's a positive exit representing fulfilled delivery, not abandonment. An opportunity that reaches Deliver and has all commitments met can be marked Done. The full trail (Explore → Sketch → Validate → Decompose → Deliver → Done) is preserved as an institutional record of what was promised and what was delivered.

## Structured Estimation via Skatting

Skatting's core mechanic -- group opinions on a 2D continuous plane with uncertainty -- is not specific to effort estimation. The axes are configurable:

| Stage | Question | X axis | Y axis |
|---|---|---|---|
| Validate | Business value | Impact (low -> high) | Certainty |
| Validate | Risk | Exposure (low -> high) | Certainty |
| Decompose | Effort | Size (small -> large) | Certainty |

### Integration model

- PO tool exports a batch -> Skatting room (CSV round-trip)
- Team estimates -> verdicts flow back to PO tool
- Future: shared room link, shared storage on same origin

## P2P Architecture

Local-first, P2P-shared. Same philosophy as Skatting.

| Concern | Approach |
|---|---|
| Storage | localStorage -- PO's browser is the source of truth |
| Sharing | P2P via Nostr relays, AES-256-GCM encryption per room |
| Board access | Room code. PO publishes, contributors pull. |
| Card contributions | Contributors score their assigned perspective cells remotely |
| Pipeline control | Only the PO moves cards between stages, kills/parks, or reorders |
| Backup | Export to file (JSON/CSV) |

### Contribution model

The PO creates a room and shares a code. Contributors join, see the board (read-only pipeline + deliverables), and score their assigned cells. Scores are submitted as encrypted events on Nostr relays and pulled by the PO.

| Action | PO | Contributor |
|---|---|---|
| See the full board | Read-write | Read-only |
| Score signal cells | All | Only assigned cells |
| Move / exit / reorder | Yes | -- |
| Submit verdicts | -- | Via encrypted Nostr events |
| Pull submitted scores | Yes | -- |

## Future: Token Budgets (v2+)

When Slim grows beyond single-PO use, stakeholders and dev teams express priorities through **token allocation** -- a fixed budget that forces honest prioritization.

### The emergent 2x2

Two independent allocation decisions produce a prioritization matrix without a spreadsheet:

| | Dev tokens: high | Dev tokens: low |
|---|---|---|
| **Stakeholder tokens: high** | Do this (aligned) | Want but can't (capacity gap) |
| **Stakeholder tokens: low** | Tech health (team investment) | Drop (nobody wants it) |

Dev tokens make technical investment visible and legitimate: infrastructure work enters the pipeline as a funded item, not something sneaked into a sprint.

## Product Roadmap

Each horizon targets a broader PO audience by lowering a specific barrier:

| Horizon | Target | Value prop | Barrier lowered |
|---|---|---|---|
| **H1** (current) | Solo PO | Monday triage, quarterly roadmap, 1:1 prep -- one page | Spreadsheet -> Slim |
| **H2** (current) | Team PO | Share a link, they fill in their column | PO fills everything -> contributors self-serve |
| **H3** (future) | Stakeholder-facing PO | Two scenarios, one screen, data talks | Verbal arguments -> data-backed scenarios |
| **H4** (future) | Scaling PO | Cross-team portfolio visibility | Per-team silos -> portfolio visibility |

## Open Questions

- **Configurable pipeline** -- start rigid, but how soon do POs demand custom stages?
- **Opportunity nesting depth** -- arbitrary depth or cap at two levels?
- **Extensible perspectives** -- how many custom lenses before the card becomes a spreadsheet?
- **Influence polarity** -- when do weighted/signed links earn their complexity?
- **Token visibility** -- should stakeholders see each other's allocations?
