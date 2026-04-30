# Slim — Product Concept

> A lean planning tool for product owners, covering the workflow *before* the sprint board.

See [PRODUCT-GUIDE.md](PRODUCT-GUIDE.md) for a non-technical introduction, [USER-JOURNEYS.md](USER-JOURNEYS.md) for feature walkthroughs.

## Problem

Every agile tool models the production pipeline (Todo → Doing → Done) and treats everything upstream as an undifferentiated "backlog." Product owners are left to manage ideation, clarification, and validation in their heads, spreadsheets, Confluence pages, and Miro boards — none of which model the *flow* of an idea from inception to "ready for sprint."

Developers got Kanban boards 15 years ago. Product owners got a text editor and good luck.

### Symptoms

- POs discover opportunities are 3× bigger than assumed during sprint planning — too late to rescope
- No visibility into where ideas are stuck (12 items in "clarifying," zero validated)
- Validation is skipped because nothing structurally enforces it
- In R&D, supply-driven ideas ("we *can* build this") skip the "should we?" gate by default
- The value → work decomposition happens implicitly, losing the link between business goals and dev work
- Prioritization is gut feel because value, risk, and effort aren't captured with the same rigor

## Foundations

### The false hierarchy

Conventional agile tools pretend there's a single decomposition hierarchy: Epic → Story → Task. This is false. There are two orthogonal decomposition axes:

1. **Value axis (WHY):** Theme → Opportunity → Sub-opportunity
2. **Work axis (HOW):** System → Feature → Task

A user story sits at the **pivot point** between these two trees. Jira hides this pivot by treating everything as the same ticket type with different labels. Slim makes it explicit:

- **Above the pivot** (value decomposition) lives in Slim, owned by the PO
- **Below the pivot** (work decomposition) lives in the sprint tool, owned by the dev team
- **The Decompose stage is the pivot itself** — where value-framed opportunities get *translated* into deliverables

### The many-to-many mapping

The relationship between the two axes is not a tree — it's a **graph**. One opportunity may need multiple deliverables. One deliverable may serve multiple opportunities (partially or fully). Each link carries coverage (full/partial) and, in future versions, flavor (must-have/stretch/cleanup).

This lets the PO answer questions current tools can't:
- "Which opportunities are at risk because deliverable X was descoped?"
- "Is this deliverable still worth building if opportunity Y is killed?"

### Influence relationships (inspired by ArchiMate)

A deliverable can *hurt* one opportunity while serving another. Without polarity, the PO can't see trade-offs. Polarity and weight are a v2 enrichment of the link graph — just adding `{polarity, weight}` to each edge. Opposing polarities surface **contradictions** (TRIZ) — creative tensions where the best solutions tend to emerge.

## Lean Pipeline

### Stages as thinking modes

Inspired by De Bono's separation principle: don't mix thinking modes simultaneously. When creative and critical thinking happen at the same time, critical always wins — ideas die before they're formed.

| Stage | Thinking mode | What belongs here | What does NOT belong here |
|---|---|---|---|
| **Explore** | Open | "What if..." — explore, combine, imagine | Criticism, estimates, go/no-go |
| **Sketch** | Focused | Facts, constraints, who's affected, what "done" means | Judgment, solution design |
| **Validate** | Evaluative | Testing assumptions against evidence | New ideas (those go back to Explore) |
| **Decompose** | Structural | Splitting, sizing, mapping to deliverables | Revisiting whether we should build it |

### Three perspectives as a dimension, not a stage

The three IDEO lenses (desirability, feasibility, viability) are not specific to Validate — they're a **second dimension** across the entire pipeline. What changes is the fidelity:

| | Desirability | Feasibility | Viability |
|---|---|---|---|
| **Explore** | "Someone might want this" | "Seems possible" | "Fits our area" |
| **Sketch** | "Here's who and why" | "Here are the constraints" | "Strategy alignment checked" |
| **Validate** | "We tested — they do/don't" | "Spike confirmed/denied" | "Business case holds/fails" |
| **Decompose** | "This deliverable serves that need" | "Sized and estimated" | "Worth the cost" |

**Validated by KTH Innovation Readiness Level.** KTH's IRL framework independently identified the same three core dimensions (Customer Readiness, Technology Readiness, Business Model Readiness). Their additional dimensions (IPR, Team, Funding readiness) suggest the perspective axis should be **extensible** in future versions.

### Consent-based advancement (Sociocracy 3.0)

Score semantics follow S3's consent model rather than traffic-light assessment:

| Score | Consent meaning | Effect on advancement |
|---|---|---|
| **Positive** | "I support this" | Clears the perspective |
| **Uncertain** | "I have reservations but won't block" | Clears (concern is logged as the verdict) |
| **Negative** | "This needs resolution before we proceed" | Blocks until resolved |
| **None** | "No voice heard" | Blocks (you can't consent to what you haven't heard) |

This reframes the PO's question from "is this good enough?" (judgment) to "is there a reason we can't try this?" (consent) — a lower, more actionable bar that encourages experimentation.

### Design principles (pipeline level)

- **WIP limits per stage** — visual pressure without configuration
- **Cards age visibly** — time-in-stage drives fresh → aging → stale badges. Stale ideas are impossible to ignore.
- **The funnel should narrow** — "47 → 12 → 5 → 3" is healthy. "47 → 45 → 44 → 43" means you're not saying no.
- **The board looks wrong when things are wrong** — no dashboards needed. The visual state *is* the diagnostic.
- **Skipping stages is visible, not impossible** — a conscious choice, not the default
- **Blocked is a first-class state** — naming *who* is blocking turns four separate stalls into one conversation

### Origin types and problem-finding

Inspired by Osborn-Parnes: every opportunity must name both problem and solution by Sketch exit.

- **Demand** — arrives with a problem, must discover a solution direction
- **Supply** — arrives with a solution, must discover the problem it solves
- **Incident** — urgent disruption. The only unplanned type.
- **Debt** — accumulated evidence from bugs, deferred concerns, or degradation

### Debt and bugs

Debt is what accumulates when concerns are noted but not resolved. It comes in three flavors mirroring the three perspectives:

| Perspective | What debt looks like |
|---|---|
| Feasibility | **Technical debt** — fragile implementation, workarounds |
| Desirability | **User debt** — UX workarounds, accessibility gaps |
| Viability | **Business debt** — manual processes, compliance gaps |

**Bugs are a fundamentally different entity.** They don't fit the opportunity model — they're about restoring expected value, triaged by probability × impact. Bugs live in the sprint tool. But the **bug → debt → opportunity loop** is Slim's concern: five bugs revealing the same root cause enter Slim as a debt-driven opportunity with the bug reports as evidence.

### People links and delegation

Perspective delegation is structurally equivalent to S3's "delegate influence": the PO grants a subdomain (one perspective on one opportunity) to a role-filler who has autonomy to investigate but is accountable for reporting back. The accountability loop closes when the cell gets a score and verdict — no ceremony, no governance meeting.

Filtering by person is **bidirectional**: the PO sees "ask Sarah for the unblock." Sarah sees "someone is stuck because of me." Meeting prep and personal queues are the same data, viewed from opposite ends.

### Decision records

Exits (kill/park/merge) are **decisions with rationales**, not failures. Like ADRs for technical choices, Slim preserves product decisions so they can be referenced, not relitigated. The card's pipeline journey provides the evidence; the exit stamps a reason and freezes the state.

## Structured Estimation via Skatting

Skatting's core mechanic — group opinions on a 2D continuous plane with uncertainty — is not specific to effort estimation. The axes are configurable:

| Stage | Question | X axis | Y axis |
|---|---|---|---|
| Validate | Business value | Impact (low → high) | Certainty |
| Validate | Risk | Exposure (low → high) | Certainty |
| Decompose | Effort | Size (small → large) | Certainty |

### Integration model

- PO tool exports a batch → Skatting room (CSV round-trip)
- Team estimates → verdicts flow back to PO tool
- Future: shared room link, shared storage on same origin

## P2P Architecture

Local-first, P2P-shared. Same philosophy as Skatting.

| Concern | Approach |
|---|---|
| Storage | localStorage — PO's browser is the source of truth |
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
| Move / exit / reorder | Yes | — |
| Submit verdicts | — | Via encrypted Nostr events |
| Pull submitted scores | Yes | — |

## Future: Token Budgets (v2+)

When Slim grows beyond single-PO use, stakeholders and dev teams express priorities through **token allocation** — a fixed budget that forces honest prioritization.

### The emergent 2×2

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
| **H1** (current) | Solo PO | Monday triage, quarterly roadmap, 1:1 prep — one page | Spreadsheet → Slim |
| **H2** (current) | Team PO | Share a link, they fill in their column | PO fills everything → contributors self-serve |
| **H3** (future) | Stakeholder-facing PO | Two scenarios, one screen, data talks | Verbal arguments → data-backed scenarios |
| **H4** (future) | Scaling PO | Cross-team portfolio visibility | Per-team silos → portfolio visibility |

## Open Questions

- **Configurable pipeline** — start rigid, but how soon do POs demand custom stages?
- **Opportunity nesting depth** — arbitrary depth or cap at two levels?
- **Extensible perspectives** — how many custom lenses before the card becomes a spreadsheet?
- **Influence polarity** — when do weighted/signed links earn their complexity?
- **Token visibility** — should stakeholders see each other's allocations?
