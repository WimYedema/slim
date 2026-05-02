# Samen — Shared Team Identity

**Samen** (Dutch: together) is a lightweight team roster tool that provides shared identity across a family of loosely coupled planning tools. It replaces freeform name entry with a stable, reusable team registry persisted over Nostr.

## Problem

Both **Slim** (planning) and **Skatting** (estimation) suffer from freeform name entry:

| App | Pain |
|---|---|
| **Slim** | Contributors must type their name exactly as the PO spelled it to see their assignments. "Alice" ≠ "alice ". No autocomplete, no registry. Meetings, commitments, signal owners — all keyed by brittle string matching. |
| **Skatting** | Name entered at join time. Conflict resolution by peer-ID tiebreak. No memory of "who is on this team" — only "who joined this session". |

Names appear in many places with no shared source of truth:

| Location | Type | Dedup |
|---|---|---|
| `PersonLink.name` | Object with UUID | Per-opportunity, not global |
| `Deliverable.extraContributors` | `string[]` | Simple includes check |
| `Commitment.to` | `string` | None |
| `CellSignal.owner` | `string` | None |
| `SyncState.contributorName` | `string` | None |
| `MeetingData.snapshots` | `Record<string, …>` | Case-sensitive key |

All matching is case-insensitive but not whitespace-normalized. The same person can appear as "Sarah", "sarah", "Sarah " — three distinct entries.

## Design Principles

### Unix philosophy

Samen is one tool in a family of small, focused tools with clearly defined interfaces:

| Tool | Language | Meaning | Domain |
|---|---|---|---|
| **Slim** | Dutch | Smart / lean | Pre-sprint planning |
| **Skatting** | Frisian | Estimation | Planning poker |
| **Samen** | Dutch | Together | Team identity |

Each tool is independently deployable as a single static HTML file. Tools share data through typed objects in a Nostr room, encrypted with keys derived from a shared room code. The room code is the "pipe" — the interface between tools.

### Separation of concerns

The team roster is not Slim's concern and not Skatting's concern. A PO might compose a team before ever opening Slim. A facilitator might create the team from Skatting. The roster is a peer concept to all tools — owned by none, consumed by all.

### Protocol, not gatekeeper

Samen is a **protocol and shared module**, not a mandatory separate app. Every tool in the family ships with full roster read/write capability. A user can create a team, join a team, and manage members without leaving the tool they are already in.

The standalone Samen app is one surface for the same operations — a convenience for dedicated team management, not a prerequisite. Think of it like `git`: the protocol is the shared layer, and there are many UIs (CLI, GitHub, GitKraken) that all speak the same protocol.

```
Samen = protocol  (types + roster CRUD + Nostr sync)
      + shared module  (pure TypeScript, copied into each tool)
      + optional standalone app  (dedicated team management UI)
      + inline integration  (create/join/pick — from within each tool)
```

### Seamless, not separate

Samen may be a separate app/repo, but to the user it should feel like one product. Three mechanisms make this work:

1. **Shared localStorage** — when tools are on the same origin, identity and cached rosters flow between them automatically. No re-entry.
2. **Deep links with context** — `samen.html?room=xyz` pre-fills everything. Same for `slim.html?room=xyz` and `skatting.html?room=xyz`. No "enter your room code" prompt.
3. **Consistent visual design** — shared CSS design tokens (`--c-*`, `--fs-*`, `--sp-*`). The member picker in Skatting, the people autocomplete in Slim, and the roster in Samen all look and feel the same.

### Incremental adoption

Tools work without Samen. If a roster exists for a room code, the tool uses it. If not, it falls back to freeform name entry. No big-bang migration.

## Architecture

### The room code contract

All tools in the family derive encryption keys from the same room code using HKDF-SHA256, but with different salt/info parameters — producing independent keys per tool:

| Tool | HKDF salt | HKDF info | d-tag suffix |
|---|---|---|---|
| Slim | `slim-planning-tool` | `slim-room-v1` | _(bare)_ |
| Skatting | `estimate-p2p-tool` | `skatting-room-v1` | _(bare)_ |
| **Samen** | `samen-team-tool` | `samen-roster-v1` | `-roster` |

Same room code → three independent encryption keys. Any app that knows the room code can read the roster, but cannot read another app's data.

### Nostr event layout

All tools use Nostr kind 30078 (parameterized replaceable events) with d-tags derived from the room code hash:

```
d-tag = SHA-256(roomCode)[0:16 hex]     — base hash
d-tag + "-roster"                        — Samen roster
d-tag + "-scores-" + pubkey[0:8]         — Slim score submissions (kind 30079)
d-tag + "-prep-" + pubkey[0:8]           — Skatting prep signals (kind 30079)
```

### Data flow

Every tool reads and writes the roster directly. The standalone Samen app is just another peer.

```
┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐
│   Slim   │   │  Skatting  │   │  Samen   │   │  Future  │
│ planning │   │ estimation │   │  (app)   │   │  tools   │
└────┬─────┘   └─────┬─────┘   └────┬─────┘   └────┬─────┘
     │               │              │              │
     │  read/write   │  read/write  │  read/write  │
     └───────────────┴──────┬───────┴──────────────┘
                            │
                     ┌──────▼──────┐
                     │ Nostr relay  │
                     │ (encrypted)  │
                     │              │
                     │  kind 30078  │
                     │  d: hash     │
                     │    -roster   │
                     └─────────────┘
```

## Data Model

### TeamSpace

```typescript
interface TeamSpace {
  roomCode: string        // Shared secret — HKDF seed
  name: string            // Team display name, e.g. "Platform Squad"
  members: TeamMember[]   // The roster
  createdAt: number       // Epoch ms
  updatedAt: number       // Epoch ms — bumped on any mutation
}
```

### TeamMember

```typescript
interface TeamMember {
  id: string              // Stable UUID — survives renames, device changes
  displayName: string     // Canonical name — the single source of truth
  publicKeys: string[]    // Nostr signing pubkeys (one per device)
  role: 'owner' | 'member'
  joinedAt: number        // Epoch ms
  lastSeenAt: number      // Epoch ms — updated on activity in any tool
}
```

**Design choices:**

- **`id` is a UUID, not a Nostr pubkey.** A person may use multiple devices, each with its own keypair. The member ID is stable; pubkeys are per-device.
- **`displayName` is canonical.** All references to this person across all tools resolve to this name. No more freeform entry.
- **`publicKeys` is an array.** Supports multi-device. A member joins from a new device → matched by name → pubkey added to the array.
- **`role` is simple.** Owner can manage the roster. Members can add themselves and update their own info.

## User Flows

All flows work from **any tool** — Samen, Slim, or Skatting. The tool you happen to be in can create, join, and manage teams inline.

### Create a team (from any tool)

```
From Skatting:                          From Slim:                       From Samen app:
─────────────                           ──────────                       ──────────────
1. SessionLobby → "Create session"      1. SyncPanel → "Create room"     1. Home → "Create team"
2. "Create team for this room" toggle   2. "Create team" toggle           2. Enter team name
3. Enter team name + your name          3. Enter team name + your name   3. Enter your name
4. Room code generated                  4. Room code generated           4. Room code generated
5. Roster published to Nostr            5. Roster published to Nostr     5. Roster published
6. Share room code with team            6. Share room code               6. Share room code
```

The room code is the same one the tool already generates. Creating a team is a checkbox/toggle — not a separate workflow.

### Join a team (from any tool)

```
1. User enters room code (in any tool's join flow)
2. Tool queries Nostr for roster event alongside its own data
3. If roster exists:
   a. Shows team name + member list
   b. User picks themselves (matched by localStorage pubkey) or adds themselves
   c. Roster updated, identity now stable
4. If no roster exists:
   a. Falls back to freeform name entry (current behavior)
   b. User can optionally create a roster from here
```

### Example: Skatting session with team

```
Facilitator (Alice):                    Participant (Bob):
────────────────────                    ─────────────────
1. Create session                       1. Enter room code
2. ✓ "Create team" → "Platform Squad"   2. Sees: "Platform Squad" (2 members)
3. Shares room code                     3. Picks himself or types "Bob"
4. Sees Bob join (roster name, no       4. Roster updated, joins session
   conflict possible)                   5. Next time: auto-recognized
```

### Example: Slim contributor with existing team

```
PO (Alice):                              Contributor (Bob):
───────────                              ───────────────────
1. SyncPanel → room already has team     1. Enters room code
2. Add person to opportunity →           2. Sees roster → picks "Bob"
   dropdown shows roster members         3. Sees his assigned cells
3. Picks "Bob" (not typing "bob")        4. No name mismatch possible
```

### Manage team (from any tool or standalone app)

```
Any tool with an active team shows a "Team" section:
  - Member list with roles
  - Add member (enter name)
  - Remove member (owner only)
  - Rename member (owner or self)
  - Copy invite link / room code
  - Link to standalone Samen app for full management
```

## Module Structure

### Shared module (the protocol)

The core of Samen is ~200 lines of pure TypeScript with no UI framework dependency. This module is copied into every tool:

```
src/lib/samen/
  types.ts         — TeamSpace, TeamMember interfaces
  roster.ts        — CRUD: createTeamSpace, addMember, removeMember, renameMember, findMemberByPubkey
  roster-sync.ts   — Nostr: publishRoster, queryRoster (full read/write)
  crypto.ts        — deriveRosterKey, computeDTag (samen-specific HKDF params)
```

Every tool ships with full read/write capability. No tool is privileged. The shared module depends only on `nostr-tools` (already a dependency in Slim and Skatting) and the Web Crypto API.

### Standalone Samen app (optional, deep-link target)

A dedicated Svelte 5 app for full team management. Serves as the "Manage team →" deep-link target from other tools. Not a prerequisite — all CRUD also works inline.

Supports URL parameters for seamless navigation:
- `samen.html?room=xyz` — opens specific team (no room code prompt)
- `samen.html` — shows recent teams list or create/join

Same stack: Svelte 5 + Vite + vite-plugin-singlefile.

```
samen/
  index.html          — entry point + CSS design tokens (shared palette)
  src/
    main.ts           — mount point
    App.svelte         — root state, routing by URL params
    components/
      Home.svelte      — recent teams, create new, enter room code
      TeamView.svelte  — member list, add/remove, rename, invite link
      JoinView.svelte  — "pick yourself" or add as new member
    lib/
      samen/           — shared module (same files as above)
      store.ts         — localStorage: cached roster, recent teams
```

### In-tool integration (Slim, Skatting)

Each tool adds:

1. **`src/lib/samen/`** — shared module copy (types + CRUD + Nostr sync + crypto)
2. **Member picker component** — dropdown of roster members with freeform fallback. Reused across all add-person surfaces in that tool.
3. **Team section in settings/sync panel** — inline member list, add/remove, invite link. Links to standalone app for full management.

## Deployment Model

### Repos and origins

Each tool has its own repo and its own GitHub Pages deployment. Samen is no different:

```
username.github.io/slim/        ← slim repo
username.github.io/skatting/    ← skatting repo
username.github.io/samen/       ← samen repo
```

All three are on the **same origin** (`username.github.io`). This means localStorage is shared — identity, cached rosters, and recent teams flow between them without user action.

### Same-origin UX (GitHub Pages, same domain)

```
Day 1 (Skatting):
  Create session → ✓ "Create team: Platform Squad" → share room code
  localStorage: samen-identity = { id: "...", name: "Alice" }
  localStorage: samen-roster-{hash} = { ... cached roster ... }

Day 2 (Slim):
  Enter room code → "Welcome back, Alice" (from localStorage)
  Team roster loaded (from localStorage cache, refreshed from Nostr)
  No setup. No re-entry.

Day 5 (Samen app — "Manage team →" link from Skatting):
  samen.html?room=xyz → already identified → full roster management
  Browser back → returns to Skatting
  Feels like a settings page, not a different app.
```

### Cross-origin UX (custom domains, forks, different orgs)

```
slim.example.com
skatting.example.com
samen.example.com
```

Different origins. localStorage is not shared. But the design degrades gracefully:

| Feature | Same origin | Cross-origin |
|---|---|---|
| Auto-identity ("Welcome back") | Automatic | User enters room code once per origin |
| Cached roster (offline) | Shared across tools | Each origin caches independently |
| Roster data (Nostr) | Works | Works — Nostr is the source of truth |
| Deep links (`?room=xyz`) | Works | Works — skips room code entry |

**Nostr is the source of truth, not localStorage.** localStorage is a cache and convenience layer. Cross-origin means one extra room-code entry per origin, once. After that, identity is cached locally.

### localStorage keys (per-origin)

| Key | Written by | Read by | Content |
|---|---|---|---|
| `samen-identity` | First tool where user identifies | All tools | `{ memberId, displayName, publicKeyHex }` |
| `samen-roster-{hash}` | Any tool that queries/mutates roster | All tools | Cached `TeamSpace` object |
| `samen-recent-teams` | Any tool | All tools | `[{ roomCode, name, lastUsed }]` |

These keys use the `samen-` prefix to avoid collision with each tool's own localStorage keys (`slim-board`, `estimate-sessions`, etc.).

## Integration Points

### Slim

| Area | Change |
|---|---|
| `SyncPanel.svelte` | "Create room" gains a "Create team" toggle. Contributor join queries roster → member picker. |
| `CardDetail.svelte` — add person | Autocomplete from roster members (fallback to freeform). |
| `DeliverableDetailPane.svelte` — add contributor/consumer | Autocomplete from roster members. |
| `store.ts` | Cache last-known roster in `localStorage['slim-roster']`. |
| New: `src/lib/samen/` | Shared module copy — types, roster CRUD, Nostr sync, crypto. |
| New: member picker component | Dropdown of roster members with freeform fallback. Reused across all add-person surfaces. |
| New: team section in SyncPanel | Member list, add/remove when owner, link to standalone app. |

### Skatting

| Area | Change |
|---|---|
| `SessionLobby.svelte` | "Create session" gains a "Create team" toggle. Join flow queries roster → member picker. |
| `session-controller.ts` — name conflicts | Roster members identified by UUID — no name conflicts possible. |
| `session-store.ts` | Store `teamRoomCode?: string` alongside saved sessions. |
| `ParticipantsList.svelte` | Show roster role (owner/member) alongside participant info. |
| New: `src/lib/samen/` | Shared module copy — types, roster CRUD, Nostr sync, crypto. |
| New: team section in sidebar | Member list, manage team inline. |

## Open Questions

1. **Roster write authority.** Who can publish roster updates?
   - **Option A**: Owner only. Simple, matches PO/creator model. Other members must ask the owner to add them.
   - **Option B**: Any member. Last-write-wins on Nostr replaceable events. Risk of accidental overwrites.
   - **Option C**: Self-registration. Any member can add *themselves* (knowing the room code = trust). Only the owner can remove others or change roles.
   - **Leaning**: Option C for v1. Knowing the room code is the trust boundary. Self-registration from any tool. Owner can curate.

2. **Multi-device identity.** A member uses Slim on laptop and Skatting on phone. Each device has its own Nostr keypair.
   - On first use from new device: query roster → can't find pubkey → prompt "Pick yourself from the roster" → add pubkey to `publicKeys` array.
   - Requires the member to have the room code on the new device.

3. **Room code format.** Skatting uses syllable codes (`keteteri`), Slim uses UUIDs. Samen should pick one.
   - **Leaning**: Syllable codes for team rooms (human-friendly, shareable verbally). Tools keep their own formats for tool-specific room codes.

4. **Roster conflicts.** Two people add a member at the same time → two competing roster events on Nostr.
   - Nostr replaceable events: last event (by `created_at`) wins.
   - Samen could detect stale reads and prompt retry.
   - For small teams (3–12) this is unlikely in practice.

5. **Offline.** Nostr relays down? All tools cache the last-known roster in localStorage. Refreshed whenever a relay query succeeds.

## Implementation Plan

### Phase 1: Fix name handling in Slim (immediate pain relief)

Improve people management within Slim before introducing the Samen protocol. This phase delivers value without any cross-tool dependency.

- [ ] Build a board-wide people registry: derive a deduplicated list from all `PersonLink`, `extraContributors`, `extraConsumers`, `Commitment.to`, and `CellSignal.owner` entries
- [ ] Add a member picker component: dropdown with autocomplete from the registry, freeform fallback for new names
- [ ] Wire member picker into `CardDetail.svelte` (add person), `DeliverableDetailPane.svelte` (add contributor/consumer), and `Commitment.to` field
- [ ] Normalize names on entry: trim whitespace, consistent casing strategy
- [ ] Contributor join flow (`SyncPanel.svelte`): show known people from the board as suggestions instead of blind text input

This phase uses only data already in the board — no Nostr, no new persistence, no protocol. It fixes the "Alice" vs "alice " problem immediately.

### Phase 2: Introduce Samen protocol in Slim

Upgrade from a board-local registry to a persistent, shared team roster on Nostr.

- [ ] Implement shared module in `src/lib/samen/`: types, roster CRUD, crypto, Nostr sync
- [ ] Unit tests for roster CRUD, crypto, and round-trip publish/query
- [ ] `SyncPanel.svelte`: "Create room" gains a "Create team" toggle — creates roster alongside board
- [ ] `SyncPanel.svelte`: contributor join queries roster → member picker auto-populated from team
- [ ] Board-wide people registry (phase 1) merges with roster data: roster members shown first, board-only names shown as "not in team"
- [ ] Cache roster in `localStorage['samen-roster-{hash}']`
- [ ] Cache local identity in `localStorage['samen-identity']`
- [ ] Team section in SyncPanel: member list, add/remove (owner), invite link

### Phase 3: Adapt Skatting

Port the Samen module into Skatting and wire it into the existing session flow.

- [ ] Copy shared module into `src/lib/samen/`
- [ ] `SessionLobby.svelte`: "Create session" gains a "Create team" toggle
- [ ] `SessionLobby.svelte`: join flow queries roster → member picker with freeform fallback
- [ ] Session controller: skip name-conflict resolution for roster-identified members
- [ ] Sidebar: team section with member list, manage team inline
- [ ] Cache roster in localStorage alongside saved sessions
- [ ] Room code format: adopt syllable codes for team rooms (align with Skatting's existing format)

### Phase 4: Standalone Samen app (optional)

Dedicated team management surface. Not blocking phases 2–3.

- [ ] Scaffold Svelte 5 + Vite + vite-plugin-singlefile project
- [ ] Build Home → Create / Join flow
- [ ] Build TeamView with member list, add/remove, rename, invite link
- [ ] Recent teams list from localStorage
- [ ] Deep links: `samen.html?room=xyz` opens specific team

### Phase 5: Cross-tool enrichment (future)

- [ ] Samen app shows which tools a member is active in
- [ ] Slim shows estimation history for a person (from Skatting)
- [ ] Skatting shows planning context for a ticket (from Slim)
- [ ] Shared CSS design token package (or documented palette) for visual consistency across tools
