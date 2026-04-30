# Slim -- Sample Data Scenario

## The Product Owner

**Alex Torres**, 4 years as PO at **Relay**, a B2B SaaS platform that helps mid-size companies manage partner integrations. Alex manages ~20 active opportunities across two development teams ("Platform" and "Growth"). He used to track everything in a Jira epic hierarchy plus a Google Sheet called "Product Radar." The sheet was the real decision-making tool -- Jira was for developers. He switched to Slim three weeks ago and hasn't opened the sheet since.

Alex's management style: consent-driven, evidence-based, slightly over-communicative. He'd rather have an awkward conversation with engineering now than discover a showstopper in sprint planning. His Monday mornings start with the Briefing view -- coffee, scan for red, click into what needs him.

## The Company

**Relay** -- Series B, 85 employees, ~$12M ARR. The product is an integration middleware platform: customers wire up their internal tools (CRMs, ERPs, analytics) to partner APIs through Relay's managed connectors. Think Zapier, but for companies that need SLAs, audit trails, and on-prem options.

Growth has been strong in the SMB segment but the board is pushing enterprise. That means SSO, webhooks, compliance features -- the kind of work that's high-effort but unlocks a completely different price tier. Meanwhile, the community of existing users keeps asking for dark mode and mobile access.

The tension is classic: **build for the customers you have vs. the customers you want**.

## The People

| Name | Role | Perspective | Shows up in |
|---|---|---|---|
| **Alice** | Senior engineer, Platform team | Feasibility | SAML, OIDC, Webhook event bus, retry & DLQ, docs |
| **Bob** | Backend engineer, Platform team | Feasibility | Webhook event bus, retry & DLQ |
| **Carol** | Designer + technical writer | Desirability / Feasibility | Partner dashboard, webhook docs |
| **Sarah** | Security architect | Feasibility | SSO validation (assigned 3d ago) |
| **Marcus** | Head of Sales | Viability | SSO business case (assigned 5d ago) |
| **Alex (PO)** | Product owner | All perspectives | AI reports feasibility exploration |
| **DevOps team** | Infrastructure | Feasibility | Webhook retry & DLQ |

Sarah and Marcus were pulled in specifically for the SSO validation stage -- Sarah because SAML/OIDC touches the security boundary, Marcus because the enterprise pricing model needs sign-off before committing engineering time.

## The Board -- Current State

### 2026Q2 horizon (this quarter -- shipping soon)

**Webhooks API** -- *Decompose* -- The flagship feature this quarter. Fully validated across all three perspectives at every stage. Three integration partners beta-tested it. Budget allocated. The team is now decomposing it into sprint-ready work. Four deliverables are linked:

- **Webhook event bus** (L, certainty 4/5) -- core infrastructure, Alice + Bob
- **Webhook retry & dead-letter queue** (M, certainty 3/5) -- resilience layer, DevOps + Bob
- **Partner dashboard** (XL, certainty 2/5) -- the risky one. Depends on partner API access from Acme Corp, which keeps slipping. Carol is lead but the external dependency makes this a wild card.
- **Webhook docs & SDK examples** (XS, certainty 5/5) -- Carol's writing is reliable

This is the "green" opportunity -- everything is scored, no objections, clear path to delivery. The only risk is the partner dashboard's external dependency.

**SSO login for enterprise** -- *Validate* -- The strategic bet. Twelve enterprise accounts are waiting for SSO before they'll sign. Marcus (sales) projects a 40% ARR increase. The explore and sketch stages are done -- signals are mostly positive, but there's a feasibility uncertainty at sketch: the platform needs to support *both* SAML and OIDC, and Sarah (security) hasn't weighed in on the validate stage yet.

There's a commitment to the CEO: validation complete by April 29 (5 days from now). Alex put Sarah on feasibility and Marcus on viability for the validate stage, but neither has scored yet. This will be the first thing Alex sees in Monday's briefing -- the clock is ticking.

Two deliverables linked so far (both partial coverage -- scope isn't fully defined yet):
- **SAML integration** (S, certainty 5/5) -- Alice, well-understood
- **OIDC integration** (S, certainty 4/5) -- Alice, slightly less certain

The Partner dashboard is also partially linked to SSO -- it'll need an enterprise admin section.

### 2026Q3 horizon (next quarter)

**Dark mode** -- *Sketch* -- The crowd-pleaser. Community votes put it at #2 most requested feature. CSS variables are mostly ready (explore/feasibility uncertain), but nobody has assessed viability yet. It's only 3 days into sketch so there's no urgency. This is a "keep warm" item -- important for retention, low technical risk, but not strategically critical.

**AI-generated reports** -- *Sketch* -- The moonshot. Managers want automated insights, and it could be a premium add-on. But there's a **feasibility objection** from the explore stage: LLM costs are too high at scale. The team is investigating local models at the sketch stage (uncertainty status). Alex pulled himself in as the feasibility expert for this one -- he wants to understand the cost structure before letting it advance.

This is 18 days into sketch -- getting warm. If nobody resolves the feasibility concern soon, it'll go stale.

**Multi-language support** -- *Sketch* -- Driven by the DACH market expansion. The i18n framework is ready (positive at explore and sketch), translation budget is approved, and it opens three new markets. But there's a **commitment 3 days overdue** -- they promised a DACH partner that sketch would be done by now. This will show as tier-1 in the briefing.

### 2026Q4 horizon (future)

**Offline mode** -- *Explore* -- Field workers mentioned wanting it. One uncertain signal on desirability, nothing else scored. This is a seed -- it might grow, it might not. Currently just sitting in the explore stage collecting context.

**Mobile app** -- *Explore* -- 60% of users access via mobile browser (analytics evidence). Strong desirability signal, but feasibility and viability are completely blank. Nobody has thought about whether to build native, PWA, or responsive. It's fine at explore -- these questions belong at sketch.

**CSV export revamp** -- *Explore* -- A tech debt item. The current CSV export is clunky. This has been sitting for **22 days** with zero signals -- it's stale. Alex keeps meaning to scope it but bigger fish keep jumping in the boat. The stale badge is a reminder that even small maintenance work gets forgotten without visibility.

## Meeting History

Alex uses the Meetings view to prep for 1:1s and team syncs. The tool tracks what changed since each person's last meeting, so Alex never walks in cold.

### Past meetings

**Alice -- 5 days ago** (April 19)
Alice is the engineering anchor -- she touches almost every deliverable on the 2026Q2 horizon. In their last 1:1, Alex and Alice reviewed:
- Webhook event bus architecture (she confirmed the pub/sub pattern, certainty bumped to 4/5)
- SAML integration scope -- "straightforward, I've done this before" (certainty 5/5)
- OIDC integration -- slightly less certain because of a newer spec revision (certainty 4/5)
- Alex asked Alice to look at whether retry & DLQ needed a separate service or could piggyback on the event bus. She said she'd spike it within the week.

Summary: 4 deliverables reviewed, 0 commitments, 0 conflicts. Clean meeting.

**Marcus -- 5 days ago** (April 19)
Marcus was assigned to SSO viability at validate stage the same day as the meeting. Alex briefed him on the enterprise pipeline numbers and asked for a pricing model assessment. Marcus said he'd have the ARR projections updated by end of week. He hasn't scored yet -- this is what Alex will follow up on Monday.

Summary: 1 opportunity reviewed (SSO), 1 commitment discussed (CEO deadline April 29), 1 unscored cell (viability@validate).

**Bob -- 8 days ago** (April 16)
Bob is focused on the webhook infrastructure alongside Alice. In their last sync, Alex and Bob discussed:
- Webhook event bus -- Bob confirmed his availability for the next two sprints
- Retry & DLQ -- DevOps needs to provision the dead-letter queue infrastructure. Bob flagged that the DevOps team is stretched with another project. Alex made a note to check capacity.
- No signals to discuss -- Bob isn't assigned to any perspective scoring.

Summary: 2 deliverables reviewed, 0 unscored cells, 1 capacity concern flagged.

**Carol -- 12 days ago** (April 12)
Carol wears two hats: designer for the partner dashboard and technical writer for webhook docs. Her meeting was the longest:
- Partner dashboard (XL, certainty 2/5) -- Carol expressed concern about the Acme Corp API access timeline. She can't start the admin UI design until the partner API shape is finalized. This is the biggest risk item on the board.
- Webhook docs & SDK examples -- Carol said content is 80% drafted, just waiting for final API surface to be locked down after the event bus is complete.
- Alex asked Carol to sketch a rough wireframe for the partner dashboard even without the final API, to validate the UX flow. She agreed but flagged it would be throwaway work if the API changes.

Summary: 2 deliverables reviewed, 1 external dependency discussed, 1 risk escalated.

**Sarah -- never met before in Slim**
Sarah was just assigned 3 days ago for the SSO validation. Her first meeting with Alex (via Slim) hasn't happened yet. When Alex opens her meeting card, he'll see: 1 unscored cell (feasibility@validate), 1 commitment nearby (CEO deadline), 0 change history (first meeting).

**DACH partner -- never met**
The DACH partner is only a commitment target, not an assigned person. They won't show up in the meetings view as a person to meet with -- but their overdue commitment (multi-language sketch, 3 days late) will surface on any meeting where multi-language support comes up.

### Upcoming meetings (Alex's week)

| Day | Who | Why | What to discuss |
|---|---|---|---|
| Mon AM | Sarah | SSO feasibility | Has she reviewed the SAML/OIDC architecture? Any security concerns? Score feasibility@validate. |
| Mon PM | Marcus | SSO viability | ARR projections ready? Enterprise pricing model approved? Score viability@validate. |
| Tue | Alice | Sprint planning prep | Finalize webhook decomposition into sprint tasks. Review OIDC spec concern. |
| Wed | Carol | Partner dashboard risk | Any update from Acme Corp on API access? Should we de-scope or delay the dashboard? |
| Thu | Bob | Webhook implementation | DLQ spike results. DevOps capacity check. Ready to start next sprint? |

If Sarah and Marcus both score positive on Monday, SSO advances to decompose -- ahead of the CEO's April 29 deadline. If either raises a concern, Alex needs to decide whether to push back the commitment or narrow the scope.

## What Alex Sees Monday Morning

The Briefing view will surface (approximately):

**Action needed (Tier 1):**
- Multi-language support -- commitment to DACH partner is 3 days overdue
- CSV export revamp -- stuck in Explore for 22 days (stale)

**What changed (Tier 2):**
- All the opportunities and deliverables appear as "new" if this is the first briefing snapshot
- Stage changes, signal updates since last session

**Background (Tier 3):**
- Link additions between opportunities and deliverables

After scanning the briefing, Alex will:
1. Switch to Pipeline (key `2`), hit `Tab` to horizon mode, check if 2026Q2 is on track
2. Click into SSO, check if Sarah and Marcus have scored validate yet (they haven't -- the briefing would flag this if signals changed)
3. Send a nudge to the DACH partner about the late commitment
4. Consider whether the CSV revamp should be parked (it's been stale 22 days and nobody is championing it)

## Design Notes

### Why this scenario works for a demo

1. **Each stage is represented** -- Explore (3), Sketch (3), Validate (1), Decompose (1). The funnel is bottom-heavy, which is realistic -- most ideas don't survive to validation.

2. **Each perspective combination is represented** -- Some items have only desirability scored (early explore). Some have all three green (webhooks). Some have objections (AI reports). Some have mixed uncertain/positive (SSO). This shows the signal grid's expressiveness.

3. **Temporal pressure varies** -- Webhooks is calm and green. SSO has a 5-day deadline. Multi-language is overdue. CSV is stale. This makes the briefing view non-trivial.

4. **Origins are diverse** -- Demand (SSO, dark mode, offline, webhooks), supply (AI reports), debt (CSV revamp). The missing origin is "incident" -- no production fires right now, which is realistic for a well-run platform.

5. **The graph is non-trivial** -- Partner dashboard links to *both* webhooks and SSO (many-to-many). Some deliverables have 2 contributors, some have 1. External dependency exists on one deliverable. This exercises the coverage matrix.

6. **Horizons create natural tension** -- 2026Q2 items should be decomposed or close. 2026Q3 items are in sketch where they belong. 2026Q4 items are exploring. The maturity-horizon mismatch warning fires if anything is misaligned.

### What could be added later

- An "incident" origin opportunity (e.g., "Fix rate limiting after Dec outage") to complete the origin type coverage
- A parked or killed opportunity in the exited section to demonstrate exit states
- A deliverable with no links (orphan badge)
- More people to make the meeting view richer
- Custom horizons (e.g., "LATER", "SOMEDAY") to show freeform horizon naming
