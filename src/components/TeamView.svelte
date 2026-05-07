<script lang="ts">
	import type { RoomInfo } from './SyncPanel.svelte'
	import type { SamenEvent } from '../lib/samen/types'
	import type { RelayHealth } from '../lib/samen/nostr-config'
	import { checkRelayHealth, RELAY_URLS } from '../lib/samen/nostr-config'
	import { queryEvents } from '../lib/samen/events'
	import { parseRoomCode } from '../lib/samen/types'

	interface Props {
		roomInfo: RoomInfo
		onLeaveRoom: () => void
	}

	let { roomInfo, onLeaveRoom }: Props = $props()

	// ── Room info ──
	let copyStatus = $state('')

	function inviteText(): string {
		if (location.protocol.startsWith('http')) {
			const url = new URL(location.href)
			url.searchParams.set('room', roomInfo.roomCode)
			return url.toString()
		}
		return roomInfo.roomCode
	}

	function copyRoomCode() {
		navigator.clipboard.writeText(inviteText())
		copyStatus = 'Copied!'
		setTimeout(() => { copyStatus = '' }, 2000)
	}

	// ── Roster ──
	let newMemberName = $state('')

	async function addNewMember() {
		const name = newMemberName.trim()
		if (!name || !roomInfo.addMember) return
		const ok = await roomInfo.addMember(name)
		if (ok) newMemberName = ''
	}

	// ── Activity (event log) ──
	let events = $state<SamenEvent[]>([])
	let eventsLoading = $state(false)
	let eventsError = $state('')

	let teamCode = $derived(parseRoomCode(roomInfo.roomCode).teamCode ?? roomInfo.roomCode)

	async function fetchEvents() {
		eventsLoading = true
		eventsError = ''
		try {
			events = await queryEvents(teamCode)
		} catch (e) {
			eventsError = e instanceof Error ? e.message : 'Failed to fetch events'
		}
		eventsLoading = false
	}

	function eventLabel(type: string): string {
		if (type.startsWith('slim:estimation-request')) return 'Estimation requested'
		if (type.startsWith('skatting:verdicts')) return 'Estimates received'
		if (type === 'slim:board-summary') return 'Board published'
		return type
	}

	function eventIcon(type: string): string {
		if (type.startsWith('slim:estimation-request')) return '📋'
		if (type.startsWith('skatting:verdicts')) return '✅'
		if (type === 'slim:board-summary') return '📊'
		return '📨'
	}

	function relativeTime(ms: number): string {
		const delta = Date.now() - ms
		if (delta < 60_000) return 'just now'
		if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
		if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
		return `${Math.floor(delta / 86_400_000)}d ago`
	}

	// ── Relay health ──
	let relayHealth = $state<RelayHealth[]>([])
	let healthLoading = $state(false)
	let healthLastChecked = $state<number | null>(null)

	let allRelaysDown = $derived(relayHealth.length > 0 && relayHealth.every(r => !r.reachable))
	let connectedCount = $derived(relayHealth.filter(r => r.reachable).length)

	async function refreshHealth() {
		healthLoading = true
		try {
			relayHealth = await checkRelayHealth()
			healthLastChecked = Date.now()
		} catch {
			// non-fatal
		}
		healthLoading = false
	}

	// ── Room index ──
	let rooms = $derived(roomInfo.roster?.rooms ?? [])

	// ── Security ──
	let rotatingRoom = $state(false)

	// ── Fetch data on mount ──
	$effect(() => {
		// Track teamCode to re-fetch on change
		void teamCode
		fetchEvents()
		refreshHealth()
	})
</script>

<div class="tv-container">
	<!-- Room header -->
	<section class="tv-header-section">
		<div class="tv-room-header">
			<div class="tv-room-info">
				<h2 class="tv-title">{roomInfo.teamName ?? roomInfo.roster?.name ?? 'Room'}</h2>
				<div class="tv-owner">Owner: {roomInfo.ownerName}</div>
			</div>
			<div class="tv-room-code">
				<code class="tv-code">{roomInfo.roomCode}</code>
				<button class="tv-copy-btn" onclick={copyRoomCode} title="Copy invite link">
					{copyStatus || '📋'}
				</button>
			</div>
		</div>
		<div class="tv-connection-status" class:tv-status-ok={!allRelaysDown} class:tv-status-down={allRelaysDown}>
			{#if allRelaysDown}
				⚠ All relays unreachable — changes won't sync
			{:else if connectedCount > 0}
				Connected to {connectedCount}/{relayHealth.length || RELAY_URLS.length} relay{connectedCount === 1 ? '' : 's'}
			{:else}
				Checking connectivity…
			{/if}
		</div>
	</section>

	<!-- Roster -->
	{#if roomInfo.roster}
		<section class="tv-section">
			<h3 class="tv-section-title">Members</h3>
			<ul class="tv-member-list">
				{#each roomInfo.roster.members as member}
					<li class="tv-member">
						<span class="tv-member-name">
							{member.displayName}
							{#if member.role === 'owner'}
								<span class="tv-role-badge">owner</span>
							{/if}
						</span>
						<span class="tv-member-meta">
							{#if member.lastSeenAt}
								<span class="tv-member-seen">{relativeTime(member.lastSeenAt)}</span>
							{/if}
							{#if member.role !== 'owner' && roomInfo.revokeMember}
								<button
									class="tv-remove-btn"
									onclick={() => roomInfo.revokeMember?.(member.id)}
									title="Remove {member.displayName}"
								>✗</button>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
			{#if roomInfo.addMember}
				<div class="tv-add-member">
					<input
						class="tv-add-input"
						type="text"
						placeholder="Add member…"
						bind:value={newMemberName}
						onkeydown={(e) => { if (e.key === 'Enter') addNewMember() }}
					/>
					<button class="tv-btn" onclick={addNewMember} disabled={!newMemberName.trim()}>Add</button>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Activity log -->
	<section class="tv-section">
		<div class="tv-section-header">
			<h3 class="tv-section-title">Activity</h3>
			<button class="tv-refresh" onclick={fetchEvents} disabled={eventsLoading} title="Refresh">
				{eventsLoading ? '⏳' : '↻'}
			</button>
		</div>
		{#if eventsError}
			<p class="tv-error">{eventsError}</p>
		{/if}
		{#if events.length === 0 && !eventsLoading}
			<p class="tv-empty">No cross-tool activity yet.</p>
		{:else}
			<ul class="tv-event-list">
				{#each events as event}
					<li class="tv-event">
						<span class="tv-event-icon">{eventIcon(event.type)}</span>
						<div class="tv-event-info">
							<span class="tv-event-label">{eventLabel(event.type)}</span>
							<span class="tv-event-time">{relativeTime(event.publishedAt)}</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Room index -->
	{#if rooms.length > 0}
		<section class="tv-section">
			<h3 class="tv-section-title">Rooms</h3>
			<ul class="tv-room-list">
				{#each rooms as room}
					<li class="tv-room-item">
						<span class="tv-room-tool">{room.tool}</span>
						<span class="tv-room-label">{room.label}</span>
						<span class="tv-room-badge" class:tv-room-active={room.active} class:tv-room-archived={!room.active}>
							{room.active ? 'active' : 'archived'}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Connectivity -->
	<section class="tv-section">
		<div class="tv-section-header">
			<h3 class="tv-section-title">Connectivity</h3>
			<button class="tv-refresh" onclick={refreshHealth} disabled={healthLoading} title="Check now">
				{healthLoading ? '⏳' : '↻'}
			</button>
		</div>
		{#if healthLastChecked}
			<p class="tv-hint">Last checked: {new Date(healthLastChecked).toLocaleTimeString()}</p>
		{/if}
		<div class="tv-relay-list">
			{#each relayHealth as relay}
				<div class="tv-relay-row">
					<span class="tv-relay-dot" class:tv-relay-up={relay.reachable} class:tv-relay-down={!relay.reachable}></span>
					<span class="tv-relay-url">{relay.url}</span>
					{#if relay.latencyMs !== null}
						<span class="tv-relay-latency">{relay.latencyMs}ms</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Security -->
	{#if roomInfo.rotateRoom}
		<section class="tv-section">
			<h3 class="tv-section-title">Security</h3>
			<p class="tv-hint">Generate a new room code if you suspect unauthorized access. Team members will reconnect automatically.</p>
			<button class="tv-btn tv-btn-warn" onclick={() => roomInfo.rotateRoom?.('Manual rotation')} disabled={rotatingRoom}>
				{rotatingRoom ? 'Resetting…' : 'Reset access'}
			</button>
		</section>
	{/if}

	<!-- Leave -->
	<section class="tv-section tv-leave-section">
		<button class="tv-btn tv-btn-danger" onclick={onLeaveRoom}>Leave Room</button>
	</section>
</div>

<style>
	.tv-container {
		overflow-y: auto;
		padding: var(--sp-lg) var(--sp-xl);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.tv-container > * {
		width: 100%;
		max-width: 40rem;
	}

	/* Header */
	.tv-header-section {
		margin-bottom: var(--sp-lg);
	}

	.tv-room-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-md);
		margin-bottom: var(--sp-sm);
	}

	.tv-title {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
	}

	.tv-owner {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin-top: var(--sp-2xs);
	}

	.tv-room-code {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-shrink: 0;
	}

	.tv-code {
		font-size: var(--fs-2xs);
		background: var(--c-bg);
		padding: var(--sp-2xs) var(--sp-xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
		word-break: break-all;
	}

	.tv-copy-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-2xs);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.tv-copy-btn:hover {
		color: var(--c-text);
	}

	.tv-connection-status {
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		text-align: center;
	}

	.tv-status-ok {
		background: oklch(0.95 0.03 145);
		color: var(--c-green, oklch(0.55 0.15 145));
	}

	.tv-status-down {
		background: oklch(0.95 0.03 25);
		color: var(--c-negative, oklch(0.55 0.15 25));
	}

	/* Sections */
	.tv-section {
		margin-bottom: var(--sp-lg);
	}

	.tv-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tv-section-title {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.tv-hint {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.tv-error {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-negative, oklch(0.65 0.2 25));
	}

	.tv-empty {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		text-align: center;
		padding: var(--sp-lg) 0;
	}

	.tv-refresh {
		background: none;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: var(--sp-2xs) var(--sp-xs);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.tv-refresh:hover:not(:disabled) {
		color: var(--c-text);
		background: var(--c-surface-hover);
	}

	/* Members */
	.tv-member-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.tv-member {
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tv-member-meta {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.tv-member-seen {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.tv-role-badge {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		background: var(--c-bg);
		padding: 1px var(--sp-2xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border-soft);
		margin-left: var(--sp-2xs);
	}

	.tv-remove-btn {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: 0;
	}

	.tv-remove-btn:hover {
		color: var(--c-negative, oklch(0.65 0.2 25));
		background: var(--c-surface-hover);
	}

	.tv-add-member {
		display: flex;
		gap: var(--sp-xs);
		margin-top: var(--sp-sm);
	}

	.tv-add-input {
		flex: 1;
		padding: var(--sp-2xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}

	/* Events */
	.tv-event-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.tv-event {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}

	.tv-event-icon {
		flex-shrink: 0;
	}

	.tv-event-info {
		display: flex;
		justify-content: space-between;
		flex: 1;
		min-width: 0;
	}

	.tv-event-label {
		font-weight: var(--fw-medium);
	}

	.tv-event-time {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	/* Room index */
	.tv-room-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.tv-room-item {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}

	.tv-room-tool {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		text-transform: capitalize;
		color: var(--c-accent);
	}

	.tv-room-label {
		flex: 1;
	}

	.tv-room-badge {
		font-size: var(--fs-2xs);
		padding: 1px var(--sp-2xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border-soft);
	}

	.tv-room-active {
		color: var(--c-green, oklch(0.55 0.15 145));
		background: oklch(0.95 0.03 145);
	}

	.tv-room-archived {
		color: var(--c-text-muted);
		background: var(--c-bg);
	}

	/* Relay health */
	.tv-relay-list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.tv-relay-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}

	.tv-relay-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.tv-relay-up {
		background: var(--c-green, oklch(0.55 0.15 145));
	}

	.tv-relay-down {
		background: var(--c-negative, oklch(0.65 0.2 25));
	}

	.tv-relay-url {
		flex: 1;
		font-family: monospace;
		font-size: var(--fs-xs);
	}

	.tv-relay-latency {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	/* Buttons */
	.tv-btn {
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
		font-size: var(--fs-sm);
	}

	.tv-btn:hover:not(:disabled) {
		background: var(--c-surface-hover);
	}

	.tv-btn-warn {
		color: var(--c-yellow, oklch(0.7 0.15 85));
		border-color: var(--c-yellow-border, var(--c-border));
	}

	.tv-btn-danger {
		color: var(--c-negative, oklch(0.65 0.2 25));
		border-color: var(--c-red-border, var(--c-border));
	}

	.tv-leave-section {
		border-top: 1px solid var(--c-border-soft);
		padding-top: var(--sp-lg);
		margin-top: var(--sp-md);
	}
</style>
