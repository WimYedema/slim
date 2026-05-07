# Samen — Room Protocol & Shared Infrastructure

**Samen** (Dutch: together) is the shared protocol layer for an ecosystem of loosely coupled agile tools. It provides three capabilities that no individual tool should own: **team identity**, **cross-tool event routing**, and **data availability**.

## The Ecosystem

A family of small, focused tools that share data through a common protocol. Each tool serves one role's core workflow, deployed as a single static HTML file with zero infrastructure.

| Tool | Language | Meaning | Domain | Status |
|---|---|---|---|---|
| **Slim** | Dutch | Smart / lean | Pre-sprint planning (PO) | Shipping |
| **Skatting** | Frisian | Estimation | Effort estimation (team) | Shipping |
| **Samen** | Dutch | Together | Room protocol & shared infra | Protocol exists, UI not wired |
| **Bouwen** | Dutch | To build | Architecture & decomposition (tech lead) | Concept |

Each tool is independently deployable and independently useful. Tools discover each other's data through the room — not through direct integration. A team can use one tool, two, or all of them.

```
                    ┌─────────────────────┐
                    │       Samen         │
                    │  (protocol layer)   │
                    │                     │
                    │  identity · events  │
                    │  availability       │
                    └──────────┬──────────┘
                               │ typed events (Nostr)
            ┌──────────┬───────┴───────┬──────────┐
            │          │               │          │
      ┌─────▼────┐ ┌───▼─────┐ ┌──────▼───┐ ┌────▼─────┐
      │   Slim   │ │Skatting │ │ Bouwen   │ │Connectors│
      │          │ │         │ │          │ │          │
      │ what+why │ │ how big │ │   how    │ │Jira, etc.│
      └──────────┘ └─────────┘ └──────────┘ └──────────┘
```

### What qualifies as a separate tool

A new standalone tool is justified when:
1. It owns data that doesn't belong in any existing tool
2. Its core interaction is fundamentally different (not just a filtered list)
3. Someone would use it without ever opening any other tool in the family

A filtered view of existing data belongs inside an existing tool, not as a new app.

## Problems Samen Solves

### 1. Identity fragmentation

Both Slim and Skatting suffer from freeform name entry. The same person appears as "Sarah", "sarah", "Sarah " — three distinct entries. Names are scattered across `PersonLink.name`, `CellSignal.owner`, `Commitment.to`, `Deliverable.extraContributors`, and `MeetingData.snapshots` with no shared registry.

Samen provides a **stable team roster** with canonical names, persistent member IDs (UUIDs), and multi-device support.

### 2. Point-to-point bridges don't scale

The current Slim→Skatting bridge is hardcoded: Slim publishes an `estimation-request` event, Skatting knows to look for it. Adding a third tool (Bouwen) means building two more point-to-point bridges. At N tools, that's N×(N-1)/2 bridges.

Samen defines a **typed event envelope** that any tool can publish and any tool can subscribe to. Tools don't need to know about each other — they need to agree on event schemas.

### 3. Data lives only in the browser

localStorage is a cache, not a persistence layer. Clearing browser data, switching devices, or reinstalling the browser loses everything. Today's workaround — manual JSON/CSV export — is fragile and rarely done.

Samen makes **Nostr relays the source of truth** and localStorage the cache. All important state is published to multiple relays. Any device with the room code can reconstruct the full room state.

## Design Principles

### Protocol, not application

Samen is primarily a **protocol and shared TypeScript module**, not a mandatory separate app. Every tool in the family embeds the Samen module and ships with full read/write capability. A user can create a team, join a team, and manage members without leaving the tool they are already in.

```
Samen = protocol   (event envelope + schemas + identity)
      + module     (pure TypeScript, embedded in each tool)
      + Team view  (built into Slim — room management, diagnostics)
```

### Serverless, but durable

No server, no database, no accounts. Data flows through Nostr relays (public infrastructure) encrypted with keys derived from a shared room code. But "serverless" does not mean "ephemeral":

- **Multi-relay redundancy** — publish to 2+ relays; query from all; one relay down is invisible to the user
- **Relay is source of truth** — localStorage is a cache that accelerates startup, not the canonical store
- **Reconstruct from room code** — any device with the room code can rebuild the full room state from relays
- **NIP-40 expiration** — events carry TTL tags; compliant relays auto-delete stale data; non-compliant relays still hold only ciphertext

### Incremental adoption

Tools work without Samen. If a roster exists for a room code, the tool uses it. If not, it falls back to freeform name entry. If relay data is unavailable, localStorage cache fills in. No big-bang migration, no hard dependencies.

### Seamless, not separate

To the user, the ecosystem should feel like one product. Three mechanisms:

1. **Shared localStorage** — when tools are on the same origin, identity and cached rosters flow automatically
2. **Deep links with context** — `?room=xyz` on any tool pre-fills everything; no "enter your room code" prompt
3. **Consistent visual design** — shared CSS design tokens (`--c-*`, `--fs-*`, `--sp-*`)

## Architecture

### Team code as anchor

A team uses multiple rooms over time — several Slim boards, transient Skatting sessions, a Bouwen workspace. Rather than organizing these in a hierarchy (a "workspace" room that owns child rooms), the model is flat: one **team code** anchors identity and discovery, and each tool-specific room references it.

```
Team "Platform Squad" (team code T)
  → Roster lives here (identity, member list)
  → Event bus lives here (cross-tool messages)
  → Room index lives here (convenience, not authority)

Slim board "Q3 Planning" (room code A, teamCode: T)
Slim board "Platform Roadmap" (room code C, teamCode: T)
Skatting sessions (transient, teamCode: T)
Bouwen workspace (room code F, teamCode: T)
```

**Why flat, not hierarchical:**

1. **No single point of failure.** Each room is independent and self-contained. Corrupting one room doesn't affect others.
2. **Encryption isolation.** Each room has its own HKDF-derived key. Compromising the Q3 board doesn't expose the Platform Roadmap. A hierarchical model pressures you to derive child keys from the parent — convenient but dangerous.
3. **Backward compatible.** Rooms without `teamCode` work exactly as today. Adding a team is opt-in enrichment.
4. **No coordination bottleneck.** Any tool can create a room and tag it with the team code. No parent record needs to be updated first.

The **team code is the roster's room code**. The Samen roster already has its own room code — that code is promoted to "the team code." It's what you share with teammates ("our team code is `keteteri`"). Tool-specific room codes are internal details that tools generate and manage.

### Room codes

Every room code is a universal access token. Knowing it grants read/write access to everything in that room. All encryption keys are derived from it via HKDF-SHA256.

Each tool derives its own independent key using distinct HKDF parameters — same room code, different keys. Samen derives a separate key for cross-tool data (roster, event bus).

| Channel | HKDF salt | HKDF info | d-tag pattern | Room code |
|---|---|---|---|---|
| Roster (Samen) | `samen-team-tool` | `samen-roster-v1` | `<hash>-roster` | Team code |
| Event bus (Samen) | `samen-team-tool` | `samen-events-v1` | `<hash>-events` | Team code |
| Room index (Samen) | `samen-team-tool` | `samen-rooms-v1` | `<hash>-rooms` | Team code |
| Slim board | `slim-planning-tool` | `slim-room-v1` | `<hash>` | Board room code |
| Slim scores | `slim-planning-tool` | `slim-room-v1` | `<hash>-<pubkey[:8]>` (kind 30079) | Board room code |
| Skatting room | `estimate-p2p-tool` | `skatting-room-v1` | `<hash>` | Session room code |
| Skatting prep | `estimate-p2p-tool` | `skatting-room-v1` | `<hash>-<pubkey[:8]>` (kind 30079) | Session room code |
| Bridge (estimation) | `slim-estimate-bridge` | `bridge-v1` | `<hash>-request`, `<hash>-verdicts` | Bridge room code |

Where `<hash>` = `SHA-256(roomCode)[0:16 hex]`.

**Room code format:** syllable codes (e.g. `keteteri`) for team codes — human-friendly, shareable verbally. Tool-specific room codes may use any format (Slim currently uses UUIDs for estimation bridge rooms).

### Nostr as persistence layer

All tools use Nostr kind 30078/30079 (parameterized replaceable events). These events are stored by relays and survive indefinitely (unless NIP-40 expiration is set). This means:

- **Relays are the source of truth**, not localStorage
- **localStorage is a cache** — accelerates startup, provides offline fallback, but is never the only copy
- **Any device with the room code can reconstruct state** — clearing browser data is recoverable
- **Multi-relay redundancy** — publish to 2+ relays; query from all; single relay failure is invisible

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│   Slim   │  │ Skatting │  │  Bouwen  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │publish      │publish      │publish
     │query        │query        │query
     └─────────────┴──────┬──────┘
                          │
              ┌───────────▼───────────┐
              │   Nostr relays (2+)   │
              │                       │
              │  kind 30078/30079     │
              │  AES-256-GCM          │
              │  NIP-40 expiration    │
              └───────────────────────┘
```

### Data availability model

**Clearing browser cache should never mean data loss.** The availability strategy has three tiers:

| Tier | Mechanism | Latency | Scope |
|---|---|---|---|
| **L1: localStorage** | Cached state from last session | Instant | Single browser, single origin |
| **L2: Nostr relays** | Encrypted events on 2+ public relays | 1–3s | Any device with room code |
| **L3: Manual export** | JSON/CSV download | User-initiated | Offline backup |

**Startup sequence** (every tool, every launch):
1. Load L1 cache → render immediately (stale data is better than loading spinner)
2. Query L2 relays in background → merge newer data → update cache
3. If L1 is empty (new device, cleared cache), block on L2 query → reconstruct from relays

**Publish discipline** — every state change that matters must be published to relays, not just cached locally:
- Roster mutations → publish immediately
- Board state changes → publish on explicit "sync" or on a debounced auto-publish
- Estimation results → publish on reveal
- Event bus messages → publish immediately

### Multi-device support

A person uses Slim on their laptop and Skatting on their phone. Each device generates its own Nostr keypair. Samen ties multiple keypairs to one identity:

```
TeamMember {
  id: "uuid-123"                    // Stable — survives device changes
  displayName: "Alice"              // Canonical — the single source of truth
  publicKeys: ["abc...", "def..."]  // One per device
}
```

**First use from a new device:**
1. Open any tool, enter room code
2. Tool queries roster from relay → shows member list
3. User picks themselves ("I am Alice") → device's pubkey added to Alice's `publicKeys` array
4. Roster updated on relay — all other devices see the new pubkey on next sync

**Identity caching** — `localStorage['samen-identity']` stores `{ memberId, displayName, publicKeyHex }`. On same-origin deployments, this cache is shared across tools. On cross-origin, each origin caches independently but the relay is the source of truth.

## Data Model

### TeamSpace

```typescript
interface TeamSpace {
  roomCode: string        // Team code — the shared anchor for all tools
  name: string            // Team display name, e.g. "Platform Squad"
  members: TeamMember[]   // The roster
  rooms: RoomRef[]        // Known tool-specific rooms (convenience index)
  createdAt: number       // Epoch ms
  updatedAt: number       // Epoch ms — bumped on any mutation
}
```

### RoomRef

```typescript
interface RoomRef {
  roomCode: string        // Tool-specific room code
  tool: string            // 'slim' | 'skatting' | 'bouwen' | etc.
  label: string           // Human-readable, e.g. "Q3 Planning"
  createdBy: string       // TeamMember.id
  createdAt: number       // Epoch ms
  active: boolean         // false = archived / completed
}
```

**Room index is a convenience, not authority.** Any tool can create a room without updating the index. The index helps discovery ("show me all boards for this team") but is not required. Tools that don't know the team code still work — they just can't be discovered through the index.

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

### Event envelope

All cross-tool messages use a common envelope. Tools publish events they produce; tools subscribe to event types they understand. No tool needs to know which other tool published an event.

```typescript
interface SamenEvent {
  type: string            // Namespaced: 'slim:deliverables', 'skatting:verdicts', 'bouwen:dependencies'
  version: number         // Schema version — receivers ignore versions they don't understand
  payload: unknown        // Type-specific, defined per event type
  publishedBy: string     // TeamMember.id (or anonymous if no roster)
  publishedAt: number     // Epoch ms
}
```

**Namespacing convention:** `<tool>:<noun>`. The tool prefix prevents collisions. A tool only needs to understand event types it cares about — unknown types are silently ignored.

**Current event types** (already implemented as bridge messages, to be migrated to this envelope):

| Type | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `slim:estimation-request` | Slim | Skatting | Deliverables to estimate, unit, board name |
| `skatting:verdicts` | Skatting | Slim | Estimation results per deliverable |
| `slim:board-summary` | Slim | Bouwen | Opportunity/deliverable counts, pipeline health |
| `bouwen:dependencies` | Bouwen | Slim | Deliverable dependency graph |

**Extensibility:** a new tool or connector adds new event types. Existing tools ignore types they don't subscribe to. No coordination required — just publish to the room.

## User Flows

All flows work from **any tool** — Slim, Skatting, or future tools. The tool you happen to be in can create, join, and manage teams inline. Slim's Team view provides the fullest management surface (roster, event log, relay health, estimation bridge).

### Create a team

```
From any tool:
1. "Create team" → enter team name + your name
2. Team code generated (syllable code, e.g. "keteteri")
3. Roster published to relay
4. Share team code with teammates
5. Tool-specific room created and registered in room index
```

The team code is what you share. The tool-specific room code is an internal detail.

### Join a team

```
1. User enters team code (in any tool's join/create flow)
2. Tool queries relay for roster
3. If roster exists:
   a. Shows team name + member list + known rooms
   b. User picks themselves (matched by cached identity or pubkey) or adds themselves
   c. Roster updated on relay, identity cached locally
   d. Tool opens/creates the relevant tool-specific room
4. If no roster exists:
   a. Falls back to freeform name entry (current behavior)
   b. User can optionally create a roster from here
```

### Open an existing room

```
1. User opens any tool with a cached team
2. Tool shows room index: "Q3 Planning", "Platform Roadmap", etc.
3. User picks a room → tool decrypts with that room's code
4. Or creates a new room → registered in room index automatically
```

The room index is a convenience. A user with a direct room code can always bypass it.

### New device / cleared cache

```
1. User opens any tool on new device
2. Enter team code
3. Tool queries relay → finds roster + room index + all room state
4. "Pick yourself" from member list → device pubkey added to member
5. Room index shows available rooms → pick one to open
6. localStorage populated from relay data — back to normal
```

No data loss. No import/export. The team code is all you need.

### Manage team

```
Any tool with an active team shows a "Team" section:
  - Member list with roles
  - Room index (all tool-specific rooms for this team)
  - Add member (enter name or invite with team code)
  - Remove member (owner only)
  - Rename member (owner or self)
  - Copy invite link / team code
  - Archive/remove rooms from index
```

## Module Structure

### Shared module (embedded in every tool)

The core of Samen is pure TypeScript with no UI framework dependency. Each tool embeds a copy:

```
src/lib/samen/
  types.ts          — TeamSpace, TeamMember, RoomRef, SamenEvent, SamenIdentity
  roster.ts         — CRUD: createTeamSpace, addMember, removeMember, renameMember, findMemberByPubkey
  rooms.ts          — Room index: addRoom, removeRoom, archiveRoom, findRoomsByTool
  roster-sync.ts    — Nostr: publishRoster, queryRoster (kind 30078, roster key)
  rooms-sync.ts     — Nostr: publishRoomIndex, queryRoomIndex (kind 30078, rooms key)
  roster-store.ts   — localStorage: cachedRoster, cachedRoomIndex, identity (cross-tool cache)
  events.ts         — Event bus: publishEvent, queryEvents, subscribeEvents (kind 30078, events key)
  crypto.ts         — deriveRosterKey, deriveEventsKey, deriveRoomsKey, computeDTag
  nostr-config.ts   — Relay URLs, expiration defaults
```

### Samen Team view (built into Slim)

Slim's Team view (tab 5, visible when a room is joined) serves as the primary room management surface. No separate app needed — all CRUD works inline. Provides:
- Room info and invite link
- Roster management (add/remove members)
- Estimation bridge (create Skatting session, share code, disconnect)
- Cross-tool activity log (event feed from relay)
- Relay health monitoring
- Room security (key rotation placeholder)
- Leave room

### Integration in existing tools

Each tool adds:

1. **`src/lib/samen/`** — shared module (via git subtree)
2. **Member picker component** — dropdown of roster members with freeform fallback
3. **Team section in settings/sync panel** — inline roster management
4. **Event bus subscription** — subscribe to event types the tool understands

### Code sharing via git subtree

The shared module lives in a dedicated **samen-protocol** repo — just the TypeScript source, tests, and a README. No build step, no npm publish. Each consuming tool (Slim, Skatting, Bouwen) pulls it in via `git subtree` at `src/lib/samen/`.

**Why subtree over alternatives:**

| Approach | Verdict |
|---|---|
| **Git submodule** | Requires `--recursive` on clone, detached HEAD confusion, CI footguns. Not worth it for ~10 files. |
| **npm package** | Build/publish ceremony for pure TypeScript that doesn't need compilation. Overkill. |
| **Monorepo** | Forces all tools into one repo. Loses independent deployability. |
| **Copy-paste** | Versions drift silently. Bug fixes don't propagate. |
| **Git subtree** | Code is part of the repo — `git clone` just works. Pull updates when ready. Push back edits from any tool. Degrades to copy-paste if abandoned. |

**Setup (one-time per consuming repo):**

```bash
git remote add samen git@github.com:<user>/samen-protocol.git
git subtree add --prefix=src/lib/samen samen main --squash
```

**Pull updates from samen-protocol:**

```bash
git subtree pull --prefix=src/lib/samen samen main --squash
```

**Push changes back (after editing samen code in-place):**

```bash
git subtree push --prefix=src/lib/samen samen main
```

**Conventions:**
- The samen-protocol repo is the source of truth. Prefer editing there directly when possible.
- Use `--squash` on pull to keep consuming repos' history clean.
- If you edit samen code inside a tool (quick fix during development), push it back before the next pull from another tool.
- CI in each tool runs the samen tests (`src/lib/samen/*.test.ts`) as part of its own test suite — no separate CI for the protocol repo needed.

## Deployment & Cross-Origin

### Same origin (GitHub Pages, same domain)

```
username.github.io/slim/
username.github.io/skatting/
username.github.io/samen/
```

All on the same origin → localStorage shared → identity flows automatically:

```
Day 1 (Skatting): Create session → ✓ "Create team" → share room code
  localStorage: samen-identity = { memberId, displayName, publicKeyHex }

Day 2 (Slim): Enter room code → "Welcome back, Alice" (from localStorage)
  Roster loaded from cache, refreshed from relay in background

Day 5 (Slim Team view): navigate to Team tab → already identified → full management
```

### Cross-origin (custom domains, forks)

```
slim.example.com
skatting.example.com
```

Different origins → localStorage not shared. Degrades gracefully:

| Feature | Same origin | Cross-origin |
|---|---|---|
| Auto-identity ("Welcome back") | Automatic | User picks themselves from roster once per origin |
| Cached roster (offline) | Shared across tools | Each origin caches independently |
| Roster data (relay) | Works | Works — relay is source of truth |
| Deep links (`?room=xyz`) | Works | Works |

One extra "pick yourself" prompt per origin. After that, identity is cached locally and refreshed from relay.

### localStorage keys

| Key | Written by | Read by | Content |
|---|---|---|---|
| `samen-identity` | First tool where user identifies | All tools on same origin | `{ memberId, displayName, publicKeyHex }` |
| `samen-roster-{hash}` | Any tool that queries/mutates roster | All tools on same origin | Cached `TeamSpace` (includes room index) |
| `samen-recent-teams` | Any tool | All tools on same origin | `[{ teamCode, name, lastUsed }]` |

Prefixed `samen-` to avoid collision with tool-specific keys (`slim-board`, `estimate-sessions`, etc.).

## Integration Points

### Slim

| Area | Change |
|---|---|
| `SyncPanel.svelte` | "Create room" gains "Create team" toggle. Contributor join queries roster → member picker. |
| `CardDetail.svelte` | Add person → autocomplete from roster (freeform fallback). |
| `DeliverableDetailPane.svelte` | Add contributor/consumer → autocomplete from roster. |
| Event bus | Subscribe to `skatting:verdicts` → apply estimation results to deliverables. Replace hardcoded bridge query. |
| Event bus | Publish `slim:estimation-request` via Samen envelope instead of direct bridge event. |
| New: member picker component | Dropdown of roster members with freeform fallback. Reused across all add-person surfaces. |

### Skatting

| Area | Change |
|---|---|
| `SessionLobby.svelte` | Join flow queries roster → member picker with freeform fallback. |
| `session-controller.ts` | Roster-identified members skip name-conflict resolution. |
| Event bus | Subscribe to `slim:estimation-request` via Samen envelope. Replace hardcoded bridge query. |
| Event bus | Publish `skatting:verdicts` via Samen envelope instead of direct bridge event. |

### External integrations (future)

The event bus enables connectors that bridge to existing trackers:

| Level | Mechanism | Effort |
|---|---|---|
| **Bookmarklet** | Scrape Jira board → copy structured data to clipboard → paste into Slim BrainDump | Low |
| **URL import** | Slim/Bouwen accept a Jira/Linear issue URL, fetch public API, pull title + description | Medium |
| **Samen connector** | Room-level API token. Connector publishes `jira:stories` events; tools subscribe. Bidirectional sync via event bus. | High |

Level 1 (bookmarklet) works today with no protocol changes. Level 3 requires the event bus to be stable.

## Security & Confidentiality

Users will put confidential product strategy and competitive insights into this system. The security model must be credible for that use case, not just for casual collaboration.

### Current strengths

| Property | Mechanism |
|---|---|
| **Encryption at rest** | AES-256-GCM with HKDF-SHA256 key derivation. Relay operators see only ciphertext. |
| **No cloud, no accounts** | No vendor holds your data. No breach surface beyond relays (which hold only ciphertext). |
| **Room code entropy** | UUID v4 = 122 bits. Brute force infeasible. |
| **Auditability** | Single HTML file, open source, no hidden network calls. |

### Threat model

The primary threats for a team planning tool are:

1. **Accidental exposure** — room code shared in Slack, email, screenshot
2. **Former team member** — still has room code after leaving the team
3. **Device compromise** — lost laptop, browser extension with localStorage access
4. **Relay persistence** — encrypted events live indefinitely, retroactive decryption if key leaks
5. **Impersonation** — throwaway keypairs mean anyone with the room code can publish as anyone

Adversarial Nostr clients crafting malicious events are a secondary concern — this is a team tool where participants have a trust relationship.

### Security measures (by phase)

#### Phase 1 — Persistent identity (Samen core)

Samen replaces throwaway per-session keypairs with **persistent identity**:

- Each member has a stable UUID and one or more Nostr pubkeys (one per device)
- Every event is signed by a known pubkey, attributable to a roster member
- `queryBoard` and `queryScores` filter events by roster pubkeys — ignore unknown signers
- Owner pubkey is pinned in the roster — only the owner can publish board state

This closes: **impersonation**, **unauthorized board overwrites**.

#### Phase 2 — Key lifecycle

| Gap | Measure | Mechanism |
|---|---|---|
| Key leakage = total exposure | **Room code rotation** | Owner generates a new room code, republishes roster + board, notifies members via the old room (migration event). Old events become unreadable to new code holders. |
| No forward secrecy | **Epoch-based encryption** | Derive a new AES key per epoch (day or session). Each event carries an epoch counter. Compromise of one epoch key does not expose other epochs. |
| Relay persistence | **NIP-40 expiration tags** | Published events carry an `expiration` tag. Compliant relays auto-delete after TTL. Non-compliant relays still hold ciphertext only. |
| No revocation | **Roster-based filtering** | Removed members' pubkeys are purged from the roster. All clients ignore events from unknown pubkeys. Owner rotates room code after removing a member for full revocation. |

#### Phase 3 — Local storage protection

| Gap | Measure | Mechanism |
|---|---|---|
| localStorage plaintext on disk | **Passkey (PRF) or passphrase encryption** | Preferred: WebAuthn PRF extension — user touches biometric (fingerprint / Face ID / YubiKey), passkey produces a deterministic secret used as AES key to encrypt localStorage. No password to remember or leak. Fallback: user sets a passphrase, PBKDF2-derived key encrypts localStorage. Both are optional — unset = plaintext (current behavior). |
| Same-origin XSS | **Content Security Policy** | Single-file HTML sets strict CSP: `script-src 'self'`, no inline scripts (Vite inlines into a single file, so CSP applies to the whole bundle). |
| Self-hosted alternative | **file:// deployment** | For maximum isolation, serve the single HTML file from `file://` or a dedicated subdomain with no other content. |

##### Passkey + PRF details

The [PRF extension](https://w3c.github.io/webauthn/#prf-extension) (formerly `hmac-secret`) derives a deterministic secret from a passkey credential without exposing the private key:

```
Register:   navigator.credentials.create({ publicKey: { extensions: { prf: {} } } })
Decrypt:    navigator.credentials.get({ publicKey: { extensions: { prf: { eval: { first: salt } } } } })
            → prf.results.first  (32 bytes — use as AES-256 key)
```

Flow:
1. First visit: "Protect your data with a passkey?" → user registers a credential
2. Every subsequent visit: browser prompts for biometric → PRF output decrypts all `samen-*` and `slim-*` localStorage values
3. No password to remember, key material in secure hardware (TPM / Secure Enclave)

Limitations:
- **Not for Nostr signing.** Passkeys use ECDSA P-256; Nostr uses secp256k1. Different curves — passkeys cannot sign Nostr events.
- **Cross-device PRF outputs may differ.** Synced passkeys (Apple/Google/Microsoft) sync the credential but PRF output depends on the authenticator. A passkey created on iPhone may produce a different PRF output on Mac. Mitigation: encrypt the AES key itself with PRF output, store the wrapped key — re-wrap on new device.
- **Browser support.** Chrome/Edge (solid), Safari 17.4+ (supported), Firefox (limited as of mid-2026). Feature-detect `PublicKeyCredential` and PRF support; fall back to passphrase.

| | Passkey + PRF | Passphrase |
|---|---|---|
| UX | Touch biometric | Type password |
| Key strength | Hardware-backed, 256-bit | As strong as the password |
| Phishing risk | None (bound to origin) | Shoulder-surfing, reuse |
| Browser support | Broad but not universal | Universal |
| Cross-device | Needs key wrapping | Works everywhere |

TOTP authenticator apps (Google Authenticator, Authy) are **not applicable** — TOTP is a server-verified time-based code. Without a server there is nothing to check it against.

### Trust model

```
Trust boundary          What it proves                    Enforced by
──────────────          ──────────────                    ───────────
Room code (HKDF seed)   "I belong to this team"           Crypto (AES-256-GCM)
Nostr pubkey (signing)  "This event is from me"           Crypto (secp256k1)
Roster membership       "I am authorized"                 Client-side filtering
Owner role              "I can manage the team"           Client-side convention
Passphrase / Passkey    "I can unlock local data"         Crypto (PBKDF2 / PRF + AES)
```

**Key insight:** enforcement is cooperative, not adversarial. Clients enforce the roster — a modified client could ignore it. This is acceptable because:

1. Participants are teammates with a trust relationship
2. The room code is the real access control — knowing it requires being invited
3. Relay data is encrypted — even with a modified client, you need the room code
4. For higher assurance, use auth-capable relays (NIP-42) that reject events from non-roster pubkeys

### What this does NOT protect against

- A determined attacker who obtains the room code and builds a custom Nostr client (mitigated by room code rotation)
- A compromised device where the attacker captures the passphrase (standard endpoint security applies)
- Relay operators colluding to correlate metadata (event timing, pubkey relationships) — mitigated by expiration tags and ephemeral relay connections

### Confidentiality checklist for deployment

For teams handling sensitive data:

- [ ] Use a passkey (PRF) or passphrase to encrypt localStorage
- [ ] Self-host on a dedicated subdomain (no shared origin with untrusted content)
- [ ] Enable NIP-40 expiration tags (default TTL: 30 days)
- [ ] Rotate room code when a team member leaves
- [ ] Use relays that support NIP-42 auth for write-side access control
- [ ] Review CSP headers if deploying behind a reverse proxy

## Design Decisions

### Flat rooms, not hierarchical workspaces

Each tool-specific room is independent and carries a `teamCode` reference back to the team. No parent-child key derivation, no workspace record that must be updated before creating a room. The team code provides identity and discovery; room codes provide encryption isolation.

The room index (stored on the team code) is a **convenience, not authority**. Tools can create rooms without updating it. The index helps Slim's Team view and other tools answer "what rooms exist for this team?" but is not required for any room to function.

### Roster write authority

**Self-registration (Option C):** any member can add *themselves* (knowing the room code = trust). Only the owner can remove others or change roles. Knowing the room code is the trust boundary. Owner can curate.

### Room code format

Syllable codes (e.g. `keteteri`) for team rooms — human-friendly, shareable verbally. Matches Skatting's existing format. Tools may use their own formats internally (Slim uses UUIDs for estimation rooms), but the team room code is always a syllable code.

### Roster conflicts

Two people add a member at the same time → two competing roster events on Nostr. Nostr replaceable events: last event (by `created_at`) wins. For small teams (3–12) this is unlikely in practice. Samen can detect stale reads and prompt retry.

### Event bus vs. direct queries

The current bridge uses direct Nostr queries — Slim publishes to a known d-tag, Skatting queries that d-tag. This works for two tools but doesn't scale. The event bus adds a thin envelope (type + version + identity) around the same Nostr mechanism. Migration path: wrap existing bridge messages in `SamenEvent` envelopes, keep the same d-tags and encryption.

## Implementation Plan

### Phase 1: Event envelope & schema (the foundation)

Define the protocol that all tools will speak. This is the API contract — changes here are expensive later.

- [x] Define `SamenEvent` interface in `src/lib/samen/types.ts`
- [x] Define event type registry: `slim:estimation-request`, `skatting:verdicts` (migrate existing bridge)
- [x] Implement `publishEvent` and `queryEvents` in `src/lib/samen/events.ts`
- [x] Unit tests for envelope serialization, encryption round-trip
- [x] Migrate Slim→Skatting bridge to use Samen envelope (backward-compatible: accept both old and new format)

### Phase 2: Identity — wire the existing roster

The roster module exists and is tested. Wire it into both tools.

- [x] Slim: member picker component (autocomplete from roster, freeform fallback)
- [x] Slim: wire member picker into `DetailPane.svelte`, `DeliverableDetailPane.svelte`, `CommitmentsAndPeople.svelte`
- [x] Slim: "Create team" toggle in `SyncPanel.svelte`, team section with roster management
- [x] Skatting: copy `src/lib/samen/` module (via git subtree), query roster on join, name pills in lobby
- [x] Skatting: skip name-conflict resolution for roster-identified members
- [x] Both: cache identity and roster in localStorage, refresh from relay on startup

### Phase 3: Data availability hardening

Make relay-as-source-of-truth robust enough that clearing localStorage is a non-event.

- [x] Publish to 2+ relays on every state change (already in place — all publish functions use `Promise.any(pool.publish(RELAY_URLS, event))`)
- [x] Startup: L1 cache → render → L2 relay query → merge newer data → update cache (SyncPanel background roster refresh; contributor auto-loads board on init)
- [x] New device flow: block on relay query → reconstruct room state → "pick yourself" from roster (SyncPanel auto-join from `?room=` URL; roster query + member picker on join)
- [x] Relay health monitoring: detect when a relay is down, warn user, ensure at least one relay is reachable (`checkRelayHealth()` in samen module; SyncPanel shows warning when all relays unreachable)
- [x] NIP-40 expiration: set appropriate TTLs (30 days for persistent state via `expirationTag()`, 7 days for transient sessions via `sessionExpirationTag()`)

### Phase 4: Team view in Slim (done)

Room management built into Slim as a dedicated tab, replacing the originally planned standalone dashboard.

- [x] TeamView component: room info, roster CRUD, estimation bridge, event log, relay health
- [x] Estimation panel: create Skatting session, share room code, disconnect
- [x] Push/pull deliverables toolbar in Deliverables view
- [x] RoomPanel slimmed to score review + "Open Team view" link

### Phase 5: External integrations

Import deliverables from sprint-board tools (Jira, GitHub Issues, Linear, etc.) into Slim. Slim owns the "why" and "what"; sprint tools own the "how" and "when". The interface sits at the handoff boundary — Decompose stage output → sprint board input, status flowing back.

**Core abstraction:** All providers map to a common `ExternalItem` shape (title, URL, size, status, labels, assignee). Slim deduplicates on `externalUrl` — items already imported show as "linked" and are hidden.

```typescript
interface ExternalItem {
  externalId: string        // provider-specific ("PROJ-123", "#42")
  title: string
  url: string               // → Deliverable.externalUrl
  size?: TShirtSize | null
  status?: 'open' | 'done' | 'dropped'
  labels?: string[]
  assignee?: string         // → extraContributors candidate
}
```

**Two connector approaches:**

| | Data-only (A) | ES module (B) |
|---|---|---|
| How | Slim `fetch()`s a URL, gets `ExternalItem[]` JSON | Slim `import()`s an ES module implementing `ExternalProvider` |
| Connector author | Deploys a serverless function (Cloudflare Worker, etc.) | Publishes a JS file (GitHub, esm.sh, unpkg) |
| Solves CORS | Yes (proxy built-in) | No (client-side only) |
| Security | No code execution in Slim | Trusts the module (user adds URL explicitly) |
| Best for | CORS-blocked APIs (Jira Cloud), custom internal tools | CORS-open APIs (GitHub, Linear), offline use |

**What ships where:**

| Component | Repo | Rationale |
|---|---|---|
| `ExternalItem` + `ExternalProvider` types | `slim` (`src/lib/external-provider.ts`) | Core contract, ships with Slim |
| GitHub Issues provider | `slim` (`src/lib/github-provider.ts`) | Built-in: CORS works, PAT trivial, universal |
| Import dialog UI | `slim` (`ImportDeliverables.svelte`) | Ships with Slim |
| Jira DC connector | `slim-connector-jira` (Cloudflare Worker) | Reference connector: dogfoods the extension API |
| Connector template | `slim-connector-template` | Empty scaffold for community connectors |

GitHub is built-in because it requires zero infrastructure (CORS works, PAT is simple). Jira DC ships as a separate connector to dogfood the extension mechanism — if Jira can't be built as a connector, the API is too weak. The Jira repo doubles as real-world documentation for connector authors.

**Provider config** stored in localStorage (`slim-providers`). Token + base URL per provider.

**Roadmap:**

- [ ] `ExternalItem` types + `ExternalProvider` interface (`src/lib/external-provider.ts`)
- [ ] Import dialog UI: source picker, item list, select & import (`ImportDeliverables.svelte`)
- [ ] Built-in GitHub Issues provider (PAT, CORS works, `src/lib/github-provider.ts`)
- [ ] Data-only connector support (approach A): fetch URL → JSON → import UI
- [ ] Connector template repo: Cloudflare Worker scaffold + README ("deploy in 2 minutes")
- [ ] Jira DC connector repo: reference implementation using data-only approach
- [ ] Dynamic `import()` connector support (approach B): load ES module from URL
- [ ] Status sync: check if linked items are closed/done → prompt to mark Deliverable done
- [ ] Paste/CSV fallback: tab-separated or CSV with Title + URL + Size columns (no provider needed)
