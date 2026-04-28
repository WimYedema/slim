<script lang="ts">
	import type { Opportunity, Deliverable, OpportunityDeliverableLink, Stage, Perspective, CellSignal } from '../lib/types'
	import { PERSPECTIVES, PERSPECTIVE_LABELS, SCORE_DISPLAY, STAGES, stageLabel } from '../lib/types'
	import { publishBoard, queryBoard, publishScores, queryScores, applyScores, generateSyncKeys, generateRoomCode, type SyncKeys, type ScoreEntry } from '../lib/sync'
	import type { BoardData } from '../lib/store'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		onApplyScores: (updatedOpportunities: Opportunity[], message: string) => void
	}

	let { opportunities, deliverables, links, onApplyScores }: Props = $props()

	// --- Persistent sync state (stored in localStorage) ---
	const SYNC_KEY = 'upstream-sync'

	interface SyncState {
		roomCode: string
		keys: SyncKeys
		role: 'owner' | 'contributor'
		contributorName?: string
	}

	function loadSyncState(): SyncState | null {
		try {
			const raw = localStorage.getItem(SYNC_KEY)
			return raw ? JSON.parse(raw) : null
		} catch { return null }
	}

	function saveSyncState(state: SyncState | null) {
		if (state) localStorage.setItem(SYNC_KEY, JSON.stringify(state))
		else localStorage.removeItem(SYNC_KEY)
	}

	let syncState: SyncState | null = $state(loadSyncState())
	let joinCode = $state('')
	let contributorName = $state('')
	let status = $state('')
	let busy = $state(false)
	let showPanel = $state(false)
	let contributorScores = $state<ScoreEntry[]>([])

	// --- Owner actions ---

	async function createRoom() {
		busy = true
		status = 'Creating room…'
		try {
			const roomCode = generateRoomCode()
			const keys = generateSyncKeys()
			const board: BoardData = { opportunities, deliverables, links }
			await publishBoard(roomCode, keys, board)
			const state: SyncState = { roomCode, keys, role: 'owner' }
			syncState = state
			saveSyncState(state)
			status = 'Room created. Share the code with contributors.'
		} catch (e) {
			status = `Failed to create room: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	async function publishUpdate() {
		if (!syncState || syncState.role !== 'owner') return
		busy = true
		status = 'Publishing board…'
		try {
			const board: BoardData = { opportunities, deliverables, links }
			await publishBoard(syncState.roomCode, syncState.keys, board)
			status = 'Board published.'
		} catch (e) {
			status = `Publish failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	async function pullScores() {
		if (!syncState || syncState.role !== 'owner') return
		busy = true
		status = 'Pulling scores…'
		try {
			const submissions = await queryScores(syncState.roomCode)
			if (submissions.length === 0) {
				status = 'No score submissions found.'
			} else {
				const clonedOpps = structuredClone(opportunities)
				const board: BoardData = { opportunities: clonedOpps, deliverables, links }
				const count = applyScores(board, submissions)
				if (count > 0) {
					onApplyScores(clonedOpps, `Applied ${count} score${count === 1 ? '' : 's'} from ${submissions.length} submission${submissions.length === 1 ? '' : 's'}.`)
					status = `Applied ${count} score${count === 1 ? '' : 's'} from ${submissions.length} submission${submissions.length === 1 ? '' : 's'}.`
				} else {
					status = 'Submissions found but no new scores to apply.'
				}
			}
		} catch (e) {
			status = `Pull failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	// --- Contributor actions ---

	async function joinRoom() {
		if (!joinCode.trim() || !contributorName.trim()) return
		busy = true
		status = 'Joining room…'
		try {
			const board = await queryBoard(joinCode.trim())
			if (!board) {
				status = 'Room not found — check the code and try again.'
				busy = false
				return
			}
			const keys = generateSyncKeys()
			const state: SyncState = { roomCode: joinCode.trim(), keys, role: 'contributor', contributorName: contributorName.trim() }
			syncState = state
			saveSyncState(state)
			contributorScores = []
			status = `Joined room. Board has ${board.opportunities.length} opportunities.`
		} catch (e) {
			status = `Join failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	async function submitScores() {
		if (!syncState || syncState.role !== 'contributor' || contributorScores.length === 0) return
		busy = true
		status = 'Submitting scores…'
		try {
			await publishScores(syncState.roomCode, syncState.keys, {
				name: syncState.contributorName ?? 'Anonymous',
				scores: contributorScores,
				timestamp: Date.now(),
			})
			status = `Submitted ${contributorScores.length} score${contributorScores.length === 1 ? '' : 's'}.`
			contributorScores = []
		} catch (e) {
			status = `Submit failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	function leaveRoom() {
		syncState = null
		saveSyncState(null)
		contributorScores = []
		status = ''
	}

	function copyRoomCode() {
		if (!syncState) return
		navigator.clipboard.writeText(syncState.roomCode)
		status = 'Room code copied to clipboard.'
	}

	// --- Contributor scoring helpers ---

	function addScore(oppId: string, stage: Stage, perspective: Perspective, signal: CellSignal) {
		const existing = contributorScores.findIndex(
			(e) => e.opportunityId === oppId && e.stage === stage && e.perspective === perspective,
		)
		const entry: ScoreEntry = { opportunityId: oppId, stage, perspective, signal }
		if (existing >= 0) {
			contributorScores = [...contributorScores.slice(0, existing), entry, ...contributorScores.slice(existing + 1)]
		} else {
			contributorScores = [...contributorScores, entry]
		}
	}
</script>

<div class="sync-container">
	<button class="sync-toggle" onclick={() => showPanel = !showPanel} title="Share & sync board via encrypted relay">
		{#if syncState}
			🔗 {syncState.role === 'owner' ? 'Room' : 'Contributor'}
		{:else}
			Share
		{/if}
	</button>

	{#if showPanel}
		<div class="sync-panel">
			{#if !syncState}
				<!-- Not connected -->
				<div class="sync-section">
					<h3>Create a room</h3>
					<p class="sync-hint">Publish your board so contributors can score cells.</p>
					<button class="sync-btn primary" onclick={createRoom} disabled={busy}>Create Room</button>
				</div>
				<div class="sync-divider">or</div>
				<div class="sync-section">
					<h3>Join a room</h3>
					<input class="sync-input" type="text" placeholder="Room code" bind:value={joinCode} />
					<input class="sync-input" type="text" placeholder="Your name" bind:value={contributorName} />
					<button class="sync-btn" onclick={joinRoom} disabled={busy || !joinCode.trim() || !contributorName.trim()}>Join</button>
				</div>

			{:else if syncState.role === 'owner'}
				<!-- Owner panel -->
				<div class="sync-section">
					<h3>Room active</h3>
					<div class="room-code-display">
						<code class="room-code">{syncState.roomCode}</code>
						<button class="copy-btn" onclick={copyRoomCode} title="Copy room code">📋</button>
					</div>
					<div class="sync-actions">
						<button class="sync-btn primary" onclick={publishUpdate} disabled={busy}>Publish Board</button>
						<button class="sync-btn" onclick={pullScores} disabled={busy}>Pull Scores</button>
						<button class="sync-btn danger" onclick={leaveRoom}>Leave Room</button>
					</div>
				</div>

			{:else}
				<!-- Contributor panel -->
				<div class="sync-section">
					<h3>Contributing as {syncState.contributorName}</h3>
					<p class="sync-hint">Score cells in the board, then submit.</p>
					{#if contributorScores.length > 0}
						<p class="score-count">{contributorScores.length} score{contributorScores.length === 1 ? '' : 's'} pending</p>
						<button class="sync-btn primary" onclick={submitScores} disabled={busy}>Submit Scores</button>
					{/if}
					<button class="sync-btn danger" onclick={leaveRoom}>Leave Room</button>
				</div>
			{/if}

			{#if status}
				<p class="sync-status">{status}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.sync-container {
		position: relative;
	}

	.sync-toggle {
		background: none;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		color: var(--c-text);
		cursor: pointer;
		font-size: var(--fs-sm);
	}

	.sync-toggle:hover {
		background: var(--c-surface-hover);
	}

	.sync-panel {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 100;
		width: 320px;
		margin-top: var(--sp-xs);
		padding: var(--sp-md);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
	}

	.sync-section h3 {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}

	.sync-hint {
		margin: 0 0 var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.sync-divider {
		text-align: center;
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		margin: var(--sp-md) 0;
	}

	.sync-input {
		display: block;
		width: 100%;
		padding: var(--sp-xs) var(--sp-sm);
		margin-bottom: var(--sp-xs);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-bg);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}

	.sync-btn {
		padding: var(--sp-xs) var(--sp-sm);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
		font-size: var(--fs-xs);
	}

	.sync-btn:hover:not(:disabled) {
		background: var(--c-surface-hover);
	}

	.sync-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sync-btn.primary {
		background: var(--c-accent);
		color: var(--c-bg);
		border-color: var(--c-accent);
	}

	.sync-btn.primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.sync-btn.danger {
		color: var(--c-red);
		border-color: var(--c-red-border);
	}

	.sync-actions {
		display: flex;
		gap: var(--sp-xs);
		flex-wrap: wrap;
	}

	.room-code-display {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-sm);
	}

	.room-code {
		font-size: var(--fs-2xs);
		background: var(--c-bg);
		padding: var(--sp-2xs) var(--sp-xs);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
		word-break: break-all;
		flex: 1;
	}

	.copy-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-2xs);
		font-size: var(--fs-sm);
	}

	.score-count {
		margin: 0 0 var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-accent);
		font-weight: var(--fw-medium);
	}

	.sync-status {
		margin: var(--sp-sm) 0 0;
		padding: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: var(--c-bg);
		border-radius: var(--radius-sm);
		border: 1px solid var(--c-border);
	}

	.sync-section + .sync-section {
		margin-top: var(--sp-md);
	}
</style>
