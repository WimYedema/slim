# Data Architecture

Slim is a fully local planning tool. All data lives in the browser's `localStorage`. There is no server, no database, and no user accounts. The only network activity is optional peer-to-peer board sharing over Nostr relays, end-to-end encrypted.

This document covers the data schema, the confidentiality/integrity/availability model, and the briefing news feed algorithm.

---

## Schema

### Two axes, linked many-to-many

The data model has two entity types and one link table:

```
Opportunity ←——→ OpportunityDeliverableLink ←——→ Deliverable
```

An opportunity tracks *why* something matters. A deliverable tracks *what* gets built. Links connect them with a coverage qualifier (full or partial).

### Opportunity

| Field | Type | Notes |
|---|---|---|
| id | UUID | `crypto.randomUUID()` |
| title | string | |
| description | string | Freeform notes |
| stage | `'explore' \| 'sketch' \| 'validate' \| 'decompose' \| 'deliver'` | Pipeline position |
| origin | `'demand' \| 'supply' \| 'incident' \| 'debt'` | Optional classification |
| horizon | string | Freeform target (e.g. "2026Q3") |
| signals | `Record<Stage, Record<Perspective, CellSignal>>` | 5×3 signal grid (Deliver row is structurally present but unused) |
| people | `PersonLink[]` | Linked experts, approvers, stakeholders |
| commitments | `Commitment[]` | Promises with deadlines |
| createdAt, updatedAt, stageEnteredAt | number | Epoch timestamps |
| exitState | `'killed' \| 'parked' \| 'merged' \| 'done'` | Set when discontinued or delivered |
| exitReason | string | Why it was discontinued |
| discontinuedAt | number | When it was discontinued |
| parkUntil | string | Horizon label for revisit |
| decompositionComplete | boolean | PO marks decompose as done |

### Signal grid

Each opportunity carries a 5×3 matrix of `CellSignal` values — one per stage×perspective intersection:

```
             desirability    feasibility     viability
explore      CellSignal      CellSignal      CellSignal
sketch       CellSignal      CellSignal      CellSignal
validate     CellSignal      CellSignal      CellSignal
decompose    CellSignal      CellSignal      CellSignal
deliver      (unused)        (unused)        (unused)
```

The Deliver stage has no signal grid — the decision to build was already made. The row exists structurally for type consistency but is never scored.

Each `CellSignal`:

| Field | Type | Purpose |
|---|---|---|
| score | `'none' \| 'uncertain' \| 'positive' \| 'negative'` | Consent-based vote |
| source | `'manual' \| 'skatting'` | How the score was entered |
| verdict | string | One-line finding |
| evidence | string | URL or reference |
| owner | string | Who provided this signal |

All 15 cells initialize to `{ score: 'none', source: 'manual', verdict: '', evidence: '', owner: '' }` (Deliver cells stay at defaults permanently).

**Consent gating**: an opportunity can only advance when all three perspectives at the current stage have a score other than `none`, and none of them is `negative`. The `uncertain` score counts as consent — it means "I don't object, but I'm not confident." The Deliver stage bypasses consent gating — `stageConsent()` always returns `ready` for Deliver since there is nothing to score.

### PersonLink

People are linked to opportunities with a role and optional perspective assignments:

| Field | Type |
|---|---|
| id | UUID |
| name | string |
| role | `'expert' \| 'approver' \| 'stakeholder'` |
| perspectives | `Array<{ perspective, stage, assignedAt }>` |

Perspective assignments delegate scoring responsibility. When a person is assigned a perspective at a stage, they're expected to score that cell.

### Commitment

| Field | Type |
|---|---|
| id | UUID |
| to | string (person name) |
| milestone | Stage (what stage should be reached) |
| by | number (deadline timestamp) |

### Deliverable

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| title | string | |
| kind | `'delivery' \| 'discovery'` | |
| status | `'active' \| 'done' \| 'dropped'` | |
| size | `'XS' \| 'S' \| 'M' \| 'L' \| 'XL' \| null` | T-shirt sizing |
| certainty | `1 \| 2 \| 3 \| 4 \| 5 \| null` | Confidence level |
| externalUrl | string | Jira/Linear link |
| externalDependency | string | Blocking dependency note |
| extraContributors | string[] | People building this |
| extraConsumers | string[] | People receiving this |
| updatedAt | number | |
| completedAt | number | When status became 'done' |
| dropReason | string | Why it was dropped |

### OpportunityDeliverableLink

| Field | Type |
|---|---|
| opportunityId | string |
| deliverableId | string |
| coverage | `'full' \| 'partial'` |

### Board-level types

```typescript
interface BoardData {
  opportunities: Opportunity[]
  deliverables: Deliverable[]
  links: OpportunityDeliverableLink[]
  customHorizons?: string[]       // user-created empty horizon buckets
  briefingSnapshot?: BoardSnapshot // persisted for news feed diffing
  ownerName?: string              // room owner name for sync
}

interface BoardEntry {
  id: string          // UUID
  name: string        // user-facing board name
  description?: string // one-liner product description
  createdAt: number
  updatedAt: number
}
```

---

## Confidentiality, Integrity, Availability

### Storage (local)

All board data is in `localStorage`. Keys:

| Key | Content |
|---|---|
| `slim-boards` | JSON array of `BoardEntry[]` (registry) |
| `slim-active-board` | UUID of the active board |
| `slim-board:{id}` | JSON `BoardData` for one board |
| `slim-meetings:{id}` | JSON `MeetingData` for one board |
| `slim-welcomed` | Flag: has the user seen onboarding |

**Confidentiality**: data never leaves the browser unless the user explicitly creates a sync room. There is no telemetry, no analytics, no server. The app runs as a single static HTML file.

**Integrity**: the app applies schema backfill on every load to handle version drift. Backfill ensures missing fields get safe defaults (e.g. `horizon` defaults to next quarter, legacy `exitState === 'incubating'` migrates to `'parked'`, missing `deliverable.kind` defaults to `'delivery'`). The multi-board migration (`migrateToMultiBoard()`) handles one-time conversion from the legacy single-board schema to the registry pattern.

**Availability**: `localStorage` is synchronous and always available in modern browsers. The app degrades gracefully if storage is full (writes fail silently). Undo is snapshot-based (20 levels of full `BoardData` copies in memory), so accidental data loss is recoverable within a session.

### Sync (P2P via Nostr)

When a user creates a sync room, the board can be shared peer-to-peer over Nostr relays.

**Protocol**:
- Board owner publishes encrypted board state as Nostr kind `30078` (replaceable event)
- Contributors query for the board, decrypt, score their assigned cells, and submit scores as kind `30079`
- All Nostr content is end-to-end encrypted — relays see only ciphertext

**Key derivation**:
1. User enters a room code (shared out-of-band)
2. **HKDF-SHA256** derives a 256-bit symmetric key from the room code
   - Salt: `'slim-planning-tool'`
   - Info: `'slim-room-v1'`
3. A **d-tag** (first 16 hex chars of SHA-256 of room code) enables relay filtering without revealing the room code

**Encryption**:
- Algorithm: **AES-256-GCM** (authenticated encryption)
- IV: 12 random bytes per encryption
- Wire format: base64(`IV || ciphertext`)
- The room code is the only secret. Anyone with the code can decrypt. Anyone without it sees only opaque base64.

**Confidentiality**: relay operators cannot read board content. The room code is never transmitted. Key derivation is deterministic from the code, so there is no key exchange protocol — just share the code.

**Integrity**: AES-GCM provides authentication. Tampered ciphertext fails decryption. The app validates the decrypted payload structure (`isBoardData()`, `isScoreSubmission()`) before accepting it. Score application checks opportunity IDs and cell coordinates before writing.

**Availability**: the app queries multiple relays (`Promise.any` — succeeds if any relay responds). Board state is a replaceable event (kind 30078), so only the latest version is retained per d-tag. If all relays are unreachable, the local board is unaffected — sync is strictly additive.

**Room rotation**: the board owner can publish a `MigrationNotice` to the old room code, pointing to a new room. Contributors querying the old room receive the notice and can rejoin.

### Merge

When pulling a remote board, `mergeBoards()` combines it with local state:

- Entities are matched by UUID
- Conflict resolution: **incoming `updatedAt` wins** (last-write-wins)
- Local ordering is preserved; new incoming entities are appended
- Merge is non-destructive: no local entities are deleted
- `MergeResult` includes stats (added/updated counts) for user feedback

---

## News feed algorithm

The "Latest" tab (formerly Briefing) shows a news feed of board changes. It works by diffing the current board state against a stored snapshot.

### Snapshot

A `BoardSnapshot` is a deep clone of `{ opportunities, deliverables, links }` plus a `takenAt` timestamp and an optional `dismissedKeys` array. It is persisted in `BoardData.briefingSnapshot` and updated when the user clicks "Mark all seen."

### Diff engine

`diffBoard(snapshot, currentBoard, meetingData)` produces an array of `BriefingItem` records. Each item has a verb, a target entity, a description, and a tier.

The diff runs five parallel analyses:

**1. Opportunity diffs** — compares old vs. new opportunities:
- `added` — new opportunity (not in snapshot)
- `removed` — opportunity deleted
- `stage-changed` — stage advanced or returned
- `exited` — opportunity killed, parked, or merged
- `reactivated` — exit state cleared
- `objection-added` — a signal score changed to `negative`
- `objection-resolved` — a signal score changed from `negative`
- `signal-changed` — a new verdict entered or existing verdict updated

**2. Deliverable diffs**:
- `deliverable-added` — new deliverable
- `deliverable-removed` — deliverable deleted
- `deliverable-changed` — size, certainty, dependency, or contributors changed

**3. Current-state warnings** (computed fresh, not from diff):
- `commitment-overdue` — commitment deadline passed, milestone not reached
- `commitment-due-soon` — deadline within 7 days
- `stale` — opportunity aging level is `stale` (≥14 days in stage, or ≥10 with horizon pressure)
- `revisit-due` — parked opportunity whose `parkUntil` horizon has passed

**4. People warnings**:
- `unscored-assignment` — person assigned to a perspective but score is still `none`
- `meeting-overdue` — more than 7 days since last discussed with this person

**5. WIP warnings**:
- `wip-over` / `wip-under` — stage has too many or too few items vs. guideline

**Stale suppression**: if an opportunity has fresh signal activity (signal-changed, objection-added, or objection-resolved), the `stale` warning is suppressed — the opportunity isn't truly stalled. Additionally, `stale` only fires when the opportunity wasn't already stale in the snapshot (it crossed the threshold since the last view).

### Item lifecycle: events vs. conditions

News feed items fall into two fundamentally different categories that age differently:

**Events** are diff-based items produced by comparing the snapshot to current state. They record something that *happened*: a stage advanced, a signal was scored, a deliverable was added. Events have a natural lifecycle:

1. An event appears when the diff detects a change between the snapshot and the current board.
2. The event persists until the user clicks "Mark all seen", which takes a fresh snapshot. Since the new snapshot captures the current state, the next diff no longer produces this event — it has been absorbed into the baseline.
3. Before being absorbed, an event can also be individually dismissed via the × button, which adds its key to `dismissedKeys`. Dismissed events are filtered out in the view but remain in the diff output until the snapshot is refreshed.

Event verbs: `added`, `removed`, `stage-changed`, `signal-changed`, `objection-added`, `objection-resolved`, `exited`, `reactivated`, `deliverable-added`, `deliverable-removed`, `deliverable-changed`, `link-added`, `link-removed`.

**Conditions** are current-state warnings computed fresh on every render, regardless of the snapshot. They reflect something that *is true right now*: a commitment is overdue, an opportunity is stale, a person hasn't scored their cell. Conditions have a different lifecycle:

1. A condition appears whenever the underlying state meets the trigger criteria.
2. "Mark all seen" does **not** eliminate conditions — they reappear immediately because they are recomputed from current state, not diffed against the snapshot. The new snapshot may affect some conditions (e.g. `stale` checks whether the opportunity was also stale in the snapshot to avoid re-reporting), but most conditions persist until resolved.
3. A condition disappears only when the underlying problem is fixed: the commitment is met, the opportunity advances (resetting aging), the person scores their cell, or the parked opportunity's horizon is still in the future.
4. Individual dismissal (×) suppresses a condition, but it will reappear after the next "Mark all seen" if the underlying condition still holds — because the fresh snapshot doesn't include the old `dismissedKeys` for conditions that keep regenerating.

Condition verbs: `commitment-overdue`, `commitment-due-soon`, `stale`, `revisit-due`, `unscored-assignment`, `meeting-overdue`, `wip-over`, `wip-under`.

This distinction matters for the user experience:

| | Events | Conditions |
|---|---|---|
| Source | Diff against snapshot | Current board state |
| "Mark all seen" | Absorbed (disappears) | Persists until resolved |
| Individual dismiss | Suppressed until next snapshot | Suppressed until next snapshot |
| How it resolves | Automatically, by taking a new snapshot | Only by fixing the underlying problem |
| Example | "Advanced to Sketch" | "Commitment to Alice is 3d overdue" |
| User action | Acknowledge | Act |

### Importance tiers

Every verb maps to a fixed tier:

| Tier | Label | Verbs |
|---|---|---|
| **1** | Critical | `objection-added`, `commitment-overdue`, `stale`, `exited`, `unscored-assignment`, `meeting-overdue`, `revisit-due` |
| **2** | Important | `stage-changed`, `added`, `signal-changed`, `reactivated`, `objection-resolved`, `commitment-due-soon`, `deliverable-added`, `deliverable-changed`, `wip-over` |
| **3** | Background | `removed`, `deliverable-removed`, `link-added`, `link-removed`, `wip-under` |

Items are sorted by tier (1 first), then by timestamp descending within each tier.

### Deduplication

`deduplicateItems()` removes duplicates per `targetType:targetId:verb`. For signal changes, the description is included in the key to preserve per-perspective granularity.

### Grouping

`groupItems()` collapses multiple items of the same verb+description into a single `GroupedBriefingItem`. For example, three opportunities that all advanced to Sketch become one grouped item: "Advanced to Sketch: Alpha, Beta, Gamma." Groupable verbs: `added`, `stage-changed`, `deliverable-added`, `link-added`, `link-removed`.

### Dismissal

Individual items can be dismissed. The snapshot stores `dismissedKeys` — an array of `verb:targetId` strings. Dismissed items are filtered out in the view layer. When "Mark all seen" is clicked, all currently visible item keys are added to `dismissedKeys` and a fresh snapshot is taken. Stale keys (for items that no longer exist in the current diff) are pruned on each mark.

### Rendering

The view layer splits items into three tiers:

- **Tier 1** renders as large headline cards with action buttons (e.g. "Park it" for stale items)
- **Tier 2** renders as a compact wire feed (dot + description + timestamp)
- **Tier 3** renders inside a collapsed `<details>` element ("Background")

The Changes sub-view shows this feed. The Overview sub-view shows a static inventory (opportunities grouped by stage, deliverables, stakeholder chips) — complementary views under the same tab.
