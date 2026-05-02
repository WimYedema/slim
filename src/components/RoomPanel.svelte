<script lang="ts">
	import type { Opportunity } from '../lib/types'
	import type { RoomInfo } from './SyncPanel.svelte'
	import { queryScores, applyScores, type ScoreSubmission, type ScoreEntry } from '../lib/sync'
	import type { BoardData } from '../lib/store'

	interface Props {
		roomInfo: RoomInfo
		opportunities: Opportunity[]
		onApplyScores: (updatedOpportunities: Opportunity[], message: string) => void
		onClose: () => void
		onLeaveRoom: () => void
	}

	let { roomInfo, opportunities, onApplyScores, onClose, onLeaveRoom }: Props = $props()

	let submissions = $state<ScoreSubmission[]>([])
	let loading = $state(false)
	let error = $state('')
	let lastFetched = $state<number | null>(null)
	let rotatingRoom = $state(false)
	let newMemberName = $state('')

	async function addNewMember() {
		const name = newMemberName.trim()
		if (!name || !roomInfo.addMember) return
		const ok = await roomInfo.addMember(name)
		if (ok) newMemberName = ''
	}

	// Group submissions by contributor name
	let grouped = $derived(groupByContributor(submissions))

	// Submitted contributor names (lowercased for matching)
	let submittedNamesLower = $derived(new Set(grouped.map(g => g.name.toLowerCase())))

	// Expected contributors: people assigned to perspectives on active opportunities
	let expectedContributors = $derived(deriveExpectedContributors())

	function deriveExpectedContributors(): { name: string; status: 'submitted' | 'awaiting' }[] {
		const seen = new Map<string, string>() // lowercase → display name
		for (const opp of opportunities) {
			if (opp.discontinuedAt) continue
			for (const person of opp.people) {
				if (person.perspectives.length > 0) {
					const lower = person.name.toLowerCase()
					if (!seen.has(lower) && lower !== roomInfo.ownerName.toLowerCase()) {
						seen.set(lower, person.name)
					}
				}
			}
		}
		// Also include anyone who submitted but isn't in the board people
		for (const g of grouped) {
			const lower = g.name.toLowerCase()
			if (!seen.has(lower) && lower !== roomInfo.ownerName.toLowerCase()) {
				seen.set(lower, g.name)
			}
		}
		return [...seen.entries()]
			.map(([lower, name]) => ({
				name,
				status: submittedNamesLower.has(lower) ? 'submitted' as const : 'awaiting' as const,
			}))
			.sort((a, b) => a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'awaiting' ? -1 : 1)
	}

	// Track which scores the PO has accepted (by a composite key)
	let accepted = $state<Set<string>>(new Set())
	let rejected = $state<Set<string>>(new Set())

	function scoreKey(name: string, e: ScoreEntry): string {
		return `${name}::${e.opportunityId}::${e.stage}::${e.perspective}`
	}

	function groupByContributor(subs: ScoreSubmission[]): { name: string; scores: ScoreEntry[]; timestamp: number }[] {
		const map = new Map<string, { scores: ScoreEntry[]; timestamp: number }>()
		for (const sub of subs) {
			const existing = map.get(sub.name)
			if (existing) {
				existing.scores.push(...sub.scores)
				existing.timestamp = Math.max(existing.timestamp, sub.timestamp)
			} else {
				map.set(sub.name, { scores: [...sub.scores], timestamp: sub.timestamp })
			}
		}
		return [...map.entries()].map(([name, v]) => ({ name, ...v }))
	}

	function oppTitle(id: string): string {
		return opportunities.find(o => o.id === id)?.title ?? id.slice(0, 8)
	}

	function currentScore(entry: ScoreEntry): string {
		const opp = opportunities.find(o => o.id === entry.opportunityId)
		if (!opp) return 'none'
		return opp.signals[entry.stage]?.[entry.perspective]?.score ?? 'none'
	}

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

	async function fetchSubmissions() {
		loading = true
		error = ''
		try {
			submissions = await queryScores(roomInfo.roomCode, roomInfo.trustedPubkeys)
			lastFetched = Date.now()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch'
		}
		loading = false
	}

	function toggleAccept(key: string) {
		const next = new Set(accepted)
		if (next.has(key)) {
			next.delete(key)
		} else {
			next.add(key)
			// remove from rejected if present
			const rNext = new Set(rejected)
			rNext.delete(key)
			rejected = rNext
		}
		accepted = next
	}

	function toggleReject(key: string) {
		const next = new Set(rejected)
		if (next.has(key)) {
			next.delete(key)
		} else {
			next.add(key)
			// remove from accepted if present
			const aNext = new Set(accepted)
			aNext.delete(key)
			accepted = aNext
		}
		rejected = next
	}

	function acceptAllFrom(name: string, scores: ScoreEntry[]) {
		const next = new Set(accepted)
		const rNext = new Set(rejected)
		for (const e of scores) {
			const k = scoreKey(name, e)
			next.add(k)
			rNext.delete(k)
		}
		accepted = next
		rejected = rNext
	}

	function rejectAllFrom(name: string, scores: ScoreEntry[]) {
		const next = new Set(rejected)
		const aNext = new Set(accepted)
		for (const e of scores) {
			const k = scoreKey(name, e)
			next.add(k)
			aNext.delete(k)
		}
		rejected = next
		accepted = aNext
	}

	let acceptedCount = $derived(accepted.size)

	function applyAccepted() {
		if (accepted.size === 0) return
		// Build a filtered submission list with only accepted scores
		const filtered: ScoreSubmission[] = []
		for (const sub of submissions) {
			const kept = sub.scores.filter(e => accepted.has(scoreKey(sub.name, e)))
			if (kept.length > 0) {
				filtered.push({ ...sub, scores: kept })
			}
		}
		const cloned: Opportunity[] = JSON.parse(JSON.stringify(opportunities))
		const board: BoardData = { opportunities: cloned, deliverables: [], links: [] }
		const count = applyScores(board, filtered)
		if (count > 0) {
			onApplyScores(cloned, `Applied ${count} score${count === 1 ? '' : 's'} from review.`)
		}
		// Clear reviewed items
		accepted = new Set()
		rejected = new Set()
		submissions = []
	}

	// Fetch on mount
	fetchSubmissions()
</script>

<div class="room-panel">
	<div class="rp-header">
		<h2 class="rp-title">Room</h2>
		<button class="rp-close" onclick={onClose} title="Close">✕</button>
	</div>

	<div class="rp-body">
		<!-- Room info -->
		<section class="rp-section">
			<h3 class="rp-section-title">Room info</h3>
			<div class="rp-info-row">
				<span class="rp-label">Owner</span>
				<span class="rp-value">{roomInfo.ownerName}</span>
			</div>
			<div class="rp-info-row">
				<span class="rp-label">Code</span>
				<div class="rp-code-row">
					<code class="rp-code">{roomInfo.roomCode}</code>
					<button class="rp-copy-btn" onclick={copyRoomCode} title="Copy invite link">
						{copyStatus || '📋'}
					</button>
				</div>
			</div>
		</section>

		<!-- Contributors list -->
		<section class="rp-section">
			<h3 class="rp-section-title">Contributors</h3>
			{#if expectedContributors.length === 0}
				<p class="rp-hint">No contributors assigned yet. Add people to opportunities to see them here.</p>
			{:else}
				<ul class="rp-member-list">
					{#each expectedContributors as contributor}
						<li class="rp-member" class:rp-member-submitted={contributor.status === 'submitted'}>
							<span>{contributor.name}</span>
							<span class="rp-member-status">{contributor.status === 'submitted' ? '✓ submitted' : '⏳ awaiting'}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Submissions -->
		<section class="rp-section">
			<div class="rp-section-header">
				<h3 class="rp-section-title">Score review</h3>
				<button class="rp-refresh" onclick={fetchSubmissions} disabled={loading} title="Refresh">
					{loading ? '⏳' : '↻'}
				</button>
			</div>
			{#if lastFetched}
				<p class="rp-hint">Last checked: {new Date(lastFetched).toLocaleTimeString()}</p>
			{/if}
			{#if error}
				<p class="rp-error">{error}</p>
			{/if}
		</section>

		{#if grouped.length === 0 && !loading}
			<p class="rp-empty">No submissions yet. Share the room code with contributors.</p>
		{/if}

		<!-- Per-contributor score review -->
		{#each grouped as contributor}
			<section class="rp-section rp-contributor">
				<div class="rp-contributor-header">
					<h3 class="rp-section-title">{contributor.name}</h3>
					<span class="rp-score-count">{contributor.scores.length} score{contributor.scores.length === 1 ? '' : 's'}</span>
				</div>
				<p class="rp-hint">Submitted {new Date(contributor.timestamp).toLocaleString()}</p>

				<div class="rp-bulk-actions">
					<button class="rp-btn rp-btn-accept" onclick={() => acceptAllFrom(contributor.name, contributor.scores)}>Accept all</button>
					<button class="rp-btn rp-btn-reject" onclick={() => rejectAllFrom(contributor.name, contributor.scores)}>Reject all</button>
				</div>

				<div class="rp-scores">
					{#each contributor.scores as entry}
						{@const key = scoreKey(contributor.name, entry)}
						{@const current = currentScore(entry)}
						{@const isNew = current !== entry.signal.score}
						<div class="rp-score-row" class:rp-accepted={accepted.has(key)} class:rp-rejected={rejected.has(key)}>
							<div class="rp-score-info">
								<span class="rp-opp-title">{oppTitle(entry.opportunityId)}</span>
								<span class="rp-score-detail">
									{entry.stage} · {entry.perspective}
								</span>
								<span class="rp-score-change" class:rp-changed={isNew}>
									{current} → {entry.signal.score}
								</span>
								{#if entry.signal.verdict}
									<span class="rp-verdict">"{entry.signal.verdict}"</span>
								{/if}
							</div>
							<div class="rp-score-actions">
								<button
									class="rp-action-btn"
									class:active={accepted.has(key)}
									onclick={() => toggleAccept(key)}
									title="Accept">✓</button>
								<button
									class="rp-action-btn rp-action-reject"
									class:active={rejected.has(key)}
									onclick={() => toggleReject(key)}
									title="Reject">✗</button>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		<!-- Apply button -->
		{#if acceptedCount > 0}
			<div class="rp-apply-bar">
				<button class="rp-btn rp-btn-primary" onclick={applyAccepted}>
					Apply {acceptedCount} score{acceptedCount === 1 ? '' : 's'}
				</button>
			</div>
		{/if}

		<!-- Team roster -->
		{#if roomInfo.roster}
			<section class="rp-section">
				<h3 class="rp-section-title">Team members</h3>
				<ul class="rp-member-list">
					{#each roomInfo.roster.members as member}
						<li class="rp-member">
							<span>
								{member.displayName}
								{#if member.role === 'owner'}
									<span class="rp-role-badge">owner</span>
								{/if}
							</span>
							{#if member.role !== 'owner' && roomInfo.revokeMember}
								<button
									class="rp-action-btn rp-action-reject"
									onclick={() => roomInfo.revokeMember?.(member.id)}
									title="Remove {member.displayName} and rotate room code"
								>✗</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if roomInfo.addMember}
					<div class="rp-add-member">
						<input
							class="rp-add-input"
							type="text"
							placeholder="Add member…"
							bind:value={newMemberName}
							onkeydown={(e) => { if (e.key === 'Enter') addNewMember() }}
						/>
						<button class="rp-btn" onclick={addNewMember} disabled={!newMemberName.trim()}>Add</button>
					</div>
				{/if}
			</section>
		{/if}

		<!-- Access concern -->
		{#if roomInfo.rotateRoom}
			<section class="rp-section">
				<h3 class="rp-section-title">Suspect unauthorized access?</h3>
				<p class="rp-hint">This generates a new room code. Team members will reconnect automatically.</p>
				<button class="rp-btn rp-btn-warn" onclick={() => roomInfo.rotateRoom?.('Manual rotation')} disabled={rotatingRoom}>
					{rotatingRoom ? 'Resetting…' : 'Reset access'}
				</button>
			</section>
		{/if}

		<!-- Leave room -->
		<section class="rp-section rp-leave-section">
			<button class="rp-btn rp-btn-danger" onclick={onLeaveRoom}>Leave Room</button>
		</section>
	</div>
</div>

<style>
	.room-panel {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.rp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-md) var(--sp-lg);
		border-bottom: 1px solid var(--c-border-soft);
		flex-shrink: 0;
	}

	.rp-title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}

	.rp-close {
		background: none;
		border: none;
		cursor: pointer;
		font-size: var(--fs-lg);
		color: var(--c-text-muted);
		padding: var(--sp-xs);
	}

	.rp-close:hover {
		color: var(--c-text);
	}

	.rp-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-md) var(--sp-lg);
	}

	.rp-section {
		margin-bottom: var(--sp-lg);
	}

	.rp-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.rp-section-title {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}

	.rp-info-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-bottom: var(--sp-xs);
		font-size: var(--fs-sm);
	}

	.rp-label {
		color: var(--c-text-muted);
		min-width: 4rem;
	}

	.rp-code {
		font-size: var(--fs-2xs);
		background: var(--c-bg);
		padding: var(--sp-2xs) var(--sp-xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
		word-break: break-all;
		flex: 1;
	}

	.rp-code-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex: 1;
	}

	.rp-copy-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-2xs);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		flex-shrink: 0;
	}

	.rp-copy-btn:hover {
		color: var(--c-text);
	}

	.rp-member-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
	}

	.rp-member {
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
		background: var(--c-bg);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.rp-member-submitted {
		border-color: var(--c-green-border, var(--c-border));
	}

	.rp-member-status {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.rp-member-submitted .rp-member-status {
		color: var(--c-green);
	}

	.rp-leave-section {
		border-top: 1px solid var(--c-border-soft);
		padding-top: var(--sp-lg);
		margin-top: var(--sp-md);
	}

	.rp-btn-danger {
		color: var(--c-red);
		border-color: var(--c-red-border, var(--c-border));
	}

	.rp-hint {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.rp-error {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-red);
	}

	.rp-empty {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		text-align: center;
		padding: var(--sp-xl) 0;
	}

	.rp-refresh {
		background: none;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: var(--sp-2xs) var(--sp-xs);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.rp-refresh:hover:not(:disabled) {
		color: var(--c-text);
		background: var(--c-surface-hover);
	}

	.rp-contributor {
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-md);
		padding: var(--sp-md);
	}

	.rp-contributor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.rp-score-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.rp-bulk-actions {
		display: flex;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-sm);
	}

	.rp-btn {
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
		font-size: var(--fs-xs);
	}

	.rp-btn:hover:not(:disabled) {
		background: var(--c-surface-hover);
	}

	.rp-btn-accept {
		color: var(--c-green);
		border-color: var(--c-green-border, var(--c-border));
	}

	.rp-btn-reject {
		color: var(--c-red);
		border-color: var(--c-red-border, var(--c-border));
	}

	.rp-btn-primary {
		background: var(--c-accent);
		color: var(--c-bg);
		border-color: var(--c-accent);
		font-size: var(--fs-sm);
		width: 100%;
	}

	.rp-btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.rp-scores {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.rp-score-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border-soft);
		background: var(--c-bg);
		transition: background var(--tr-fast);
	}

	.rp-score-row.rp-accepted {
		background: oklch(0.95 0.03 145);
		border-color: var(--c-green-border, var(--c-border));
	}

	.rp-score-row.rp-rejected {
		background: oklch(0.95 0.03 25);
		border-color: var(--c-red-border, var(--c-border));
		opacity: 0.6;
	}

	.rp-score-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.rp-opp-title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rp-score-detail {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.rp-score-change {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.rp-score-change.rp-changed {
		color: var(--c-accent);
		font-weight: var(--fw-medium);
	}

	.rp-verdict {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-style: italic;
	}

	.rp-score-actions {
		display: flex;
		gap: var(--sp-2xs);
		flex-shrink: 0;
	}

	.rp-action-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		cursor: pointer;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.rp-action-btn:hover {
		background: var(--c-surface-hover);
	}

	.rp-action-btn.active {
		background: var(--c-green);
		color: white;
		border-color: var(--c-green);
	}

	.rp-action-btn.rp-action-reject.active {
		background: var(--c-red);
		color: white;
		border-color: var(--c-red);
	}

	.rp-apply-bar {
		position: sticky;
		bottom: 0;
		padding: var(--sp-md) 0;
		background: var(--c-surface);
		border-top: 1px solid var(--c-border-soft);
	}

	.rp-role-badge {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		background: var(--c-bg);
		padding: 1px var(--sp-2xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border-soft);
		margin-left: var(--sp-2xs);
	}

	.rp-btn-warn {
		color: var(--c-yellow, oklch(0.7 0.15 85));
		border-color: var(--c-yellow-border, var(--c-border));
	}

	.rp-add-member {
		display: flex;
		gap: var(--sp-xs);
		margin-top: var(--sp-sm);
	}

	.rp-add-input {
		flex: 1;
		padding: var(--sp-2xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}
</style>
