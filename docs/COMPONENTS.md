# Components — Design Sketch

## Problem

Opportunities identify *what* matters; deliverables identify *what to build*. But deliverables are typically only known at the Decompose stage. At Sketch and Validate, product owners already know which parts of the product are affected ("this touches Auth and Billing") but have no lightweight way to capture that knowledge.

This gap makes feasibility assessment harder — assessors lack structural context — and prevents answering cross-cutting questions like "how many opportunities are hitting the same area?"

## Proposal

Add a freeform `components` field to both Deliverables and Opportunities. Components are plain strings (no new entity type) with autocomplete from the existing pool to prevent duplicates.

### Data model

```typescript
interface Deliverable {
  // ...existing fields
  components: string[];   // e.g. ["Auth", "Billing"]
}

interface Opportunity {
  // ...existing fields
  affectedComponents: string[];  // editable from Sketch onward
}
```

### The implicit registry

There is no Component entity. The registry is derived:

```typescript
const allComponents = new Set([
  ...opportunities.flatMap(o => o.affectedComponents),
  ...deliverables.flatMap(d => d.components),
]);
```

This keeps the data model flat and avoids a new link table.

### Typo prevention

- **Autocomplete** — the primary defense. When typing, existing components are suggested with case-insensitive matching.
- **Case normalization on save** — if "Billing" exists and the user types "billing", the stored value becomes "Billing".
- **Merge/rename (future)** — a toolbar action to batch-rename a component across all entities. Not needed on day one.

## Workflow

| Stage | Action |
|---|---|
| **Sketch** | Tag opportunity with affected components (multi-select with autocomplete). "This touches Auth and Billing." |
| **Validate** | Feasibility assessors see which components are affected, improving signal quality. |
| **Decompose** | Create deliverables with the same component names. The shared vocabulary links them naturally. |
| **Deliver** | Component grouping shows execution load per area. |

## What this unlocks

- **Group-by component** in the Deliverables view
- **Component impact column** in Pipeline view ("3 opps touch Auth")
- **Cross-cutting filter** — "show me everything touching Billing"
- **Load heatmap** — which components are under pressure from multiple opportunities
- **Effort per component** — sum of linked deliverable sizes, grouped by component

## Design principles

- **No new entity type** — components are strings, not objects with IDs and lifecycles
- **Zero friction** — typing a new name creates a new component; no setup step
- **Organic growth** — the pool grows as teams use it; no upfront taxonomy required
- **Promotable** — if teams later want governance (locked list, owners, descriptions), the field can back a first-class entity without data migration (the strings become the `name` field)

## Alternatives considered

| Approach | Trade-off |
|---|---|
| First-class Component entity with link tables | Higher complexity, new entity lifecycle to manage, overkill for early use |
| Tags on opportunities only | No deliverable grouping, no component load view |
| Deliverable `component` (singular) | Too restrictive — a deliverable can span multiple components |
| No component concept | Status quo; the Sketch→Decompose gap remains |
