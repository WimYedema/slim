# Deliver Stage — Product Spec

## Problem

Once an opportunity reaches Decompose and its deliverables are linked, sized, and estimated, the PO's work isn't done. Promises were made to stakeholders. Deliverables are being built by the team. But Slim loses sight of the opportunity at this point — it has no stage for tracking delivery outcomes.

Today the PO has three bad options:
1. Leave the card in Decompose forever, where it clutters the pipeline.
2. Exit it (Kill/Park/Merge), which implies the work was abandoned.
3. Track delivery outside Slim, breaking the promise trail.

None of these capture the actual state: **we decided to build it, and now we're watching it land.**

## Solution

Add a fifth stage — **Deliver** — that represents the operational phase after decomposition. This stage answers a different question than the first four:

| Stage | Question | Thinking mode |
|---|---|---|
| Explore | "What if...?" | Open |
| Sketch | "What exactly?" | Focused |
| Validate | "Does it hold?" | Evaluative |
| Decompose | "How do we build it?" | Structural |
| **Deliver** | **"Did we land it?"** | **Observational** |

### How it differs from Explore–Decompose

The first four stages **validate** the opportunity — "are we building the right thing?" Deliver **verifies** the delivery — "did we build what was promised?" This validation→verification arc mirrors the systems engineering V-model, where the left side descends from stakeholder needs to detailed design, and the right side ascends from implementation to acceptance.

In Slim's terms: the left side descends from opportunity to deliverable (the pivot). The Deliver stage is the right side — ascending back up to check whether the deliverables actually fulfilled the opportunity's promises.

Key structural differences:

1. **No signal grid.** The 4×3 consent matrix doesn't apply — the decision to build was already made. There's nothing to score.
2. **Commitments become primary.** Drawing on the Last Planner System's concept of reliable promises, the commitments made during earlier stages are now the measure of success.
3. **Deliverables are the main content.** The PO watches linked deliverables land — tracking sizes, estimates, and completion.
4. **Evidence is read-only.** Previous stage verdicts are preserved as an audit trail but can't be edited.

### Advancement into Deliver

An opportunity can advance to Deliver when:
- All three Decompose perspectives have consent (same gating as any other stage transition).
- At least one deliverable is linked.

This can happen via the existing "→" advance button. No auto-advance — the PO explicitly decides "we're building this now."

### Exit from Deliver

A new exit state: **Done** — "Delivered as promised, commitments fulfilled."

| Exit | Icon | Description |
|---|---|---|
| Done | ✓ | Delivered — commitments fulfilled |
| Kill | ✗ | Cancelled after starting delivery |
| Park | ⏸ | Delivery paused |
| Merge | ⤵ | Subsumed by another opportunity |

Done is a positive exit (unlike Kill). It preserves the full decision trail: Explore → Sketch → Validate → Decompose → Deliver → Done. The card stays accessible in the Exited section for reference.

### What the PO sees in the Deliver stage

The DetailPane for a Deliver-stage opportunity shifts focus:

| Section | Content |
|---|---|
| **Commitments** | Elevated to top position. Urgency indicators (overdue/due-soon/on-track). This is the primary action zone. |
| **Deliverables** | Linked deliverables with sizes, estimates, coverage. EffortBoxPlot showing the combined estimate. |
| **Evidence trail** | Read-only verdicts from all prior stages, grouped by stage. Shows the decision history that led here. |
| **Context** | People, origin, horizon, notes — same as other stages, lower priority. |

Gap prompts in Deliver don't ask consent questions. Instead they surface commitment pressure:
- "Promise to CEO due in 3 days — has the team started?"
- "2 deliverables still unsized — can we estimate?"

### Pipeline view: Promises grouping

The Pipeline view gets a third grouping option alongside Funnel (by stage) and Horizon:

**Promises** — shows only Deliver-stage opportunities, grouped by commitment status:

| Group | Contains |
|---|---|
| At risk | Overdue commitments or due within 7 days |
| On track | Active commitments, not yet urgent |
| Delivered | All commitments met (candidates for Done exit) |
| No commitments | In Deliver but no promises to track |

This gives the PO a single view to answer: "What did I promise, and where do things stand?"

### Board Health impact

The Board Health dashboard gains:
- A fifth segment in the pipeline bar (Deliver, with its own stage color).
- A "Promises" card showing: N in delivery, N at risk, N ready to close.

### Briefing / News feed impact

New briefing event verbs:
- `commitment-fulfilled` — all commitments for an opportunity are met (tier 1).
- `delivery-stale` — opportunity has been in Deliver for >14 days with no deliverable changes (tier 2).

### Aging in Deliver

Deliver uses different aging thresholds than the analysis stages:
- Fresh: < 14 days (delivery takes longer than analysis)
- Aging: 14–27 days
- Stale: ≥ 28 days

This reflects that delivery is expected to take weeks, not days.

## Data model changes

```typescript
// types.ts
export type Stage = 'explore' | 'sketch' | 'validate' | 'decompose' | 'deliver'

export const STAGES: { key: Stage; label: string; thinking: string }[] = [
  { key: 'explore', label: 'Explore', thinking: 'Open' },
  { key: 'sketch', label: 'Sketch', thinking: 'Focused' },
  { key: 'validate', label: 'Validate', thinking: 'Evaluative' },
  { key: 'decompose', label: 'Decompose', thinking: 'Structural' },
  { key: 'deliver', label: 'Deliver', thinking: 'Observational' },
]

export type ExitState = 'killed' | 'parked' | 'merged' | 'done'

export const EXIT_STATES = [
  ...existing...,
  { key: 'done', label: 'Done', icon: '✓', description: 'Delivered — commitments fulfilled' },
]

// Opportunity.signals gains a deliver key — but it's unused (no grid).
// Keep it for structural consistency: signals: Record<Stage, StageSignals>
// The deliver signals stay at default (none/none/none), never scored.
```

### Commitment milestone reference

`Commitment.milestone` is typed as `Stage`. With `deliver` added, a commitment can target the Deliver stage: "Promise to reach Deliver by date X" = "we'll be building it by then."

### Schema migration

Existing boards have `signals` with four keys. On load, backfill:
```typescript
if (!opp.signals.deliver) {
  opp.signals.deliver = createEmptySignals()
}
```

## Consent and gating

- `stageConsent()` for Deliver always returns `{ status: 'ready' }` — there's nothing to score.
- `nextStage('decompose')` returns `'deliver'`.
- `nextStage('deliver')` returns `null` — can't advance further, only exit.
- `CELL_QUESTIONS` gains a `deliver` entry, but it's vestigial (never shown in the signal grid).

## What this does NOT change

- **The consent model.** Explore through Decompose work exactly as before.
- **The 4×3 signal grid.** It remains the core of the first four stages. Deliver simply doesn't use it.
- **Meeting view.** People linked to Deliver-stage opportunities still appear in meeting agendas with their commitments and changes.
- **Estimation bridge.** Skatting integration works the same — estimates on deliverables linked to Deliver-stage opportunities are still valid.
- **CSV import/export.** Stage column now includes 'deliver' as a valid value.

## Open questions

1. **Should "Done" auto-trigger when all commitments are met?** Leaning no — the PO should explicitly mark an opportunity as done, just like they explicitly advance stages. But we could show a prompt: "All commitments fulfilled — ready to mark as done?"
2. **Should Deliver have its own stage color?** Yes — needs a `--c-stage-deliver` token. Suggest a cool blue-green to signal completion proximity.
3. **Should the funnel visualization include Deliver?** The funnel is narrowing (filtering) — Deliver is after the narrowest point. Could be shown as a separate bucket below the funnel, or as the fifth segment. The fifth segment is simpler.
