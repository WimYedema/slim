<script lang="ts" module>
	import type { BoardData } from '../lib/store'
	import type { ScoreEntry } from '../lib/sync'
	import type { Stage, Perspective, CellSignal } from '../lib/types'

	export interface ContributorInfo {
		name: string
		board: BoardData
		scores: ScoreEntry[]
		submittedScores: ScoreEntry[]
		busy: boolean
		addScore: (oppId: string, stage: Stage, perspective: Perspective, signal: CellSignal) => void
		submitScores: () => void
		refreshBoard: () => void
	}

	export interface RoomInfo {
		roomCode: string
		ownerName: string
		role: 'owner' | 'contributor'
		leaveRoom: () => void
		teamName?: string
		/** All roster member pubkeys — used for trusted event filtering */
		trustedPubkeys?: string[]
		/** Owner's pubkey only — used for board state filtering */
		ownerPubkeys?: string[]
	}
</script>

<script lang="ts">
	import type { Opportunity, Deliverable, OpportunityDeliverableLink } from '../lib/types'
	import { publishBoard, queryBoard, publishScores, queryScores, applyScores, generateSyncKeys, generateRoomCode, type SyncKeys } from '../lib/sync'
	import { createTeamSpace, findMemberByName as findRosterMember } from '../lib/samen/roster'
	import { publishRoster, queryRoster } from '../lib/samen/roster-sync'
	import type { TeamSpace, SamenIdentity } from '../lib/samen/types'

	import MemberPicker from './MemberPicker.svelte'
	import { boardNames } from '../lib/queries'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		knownNames?: string[]
		onApplyScores: (updatedOpportunities: Opportunity[], message: string) => void
		onContributorChange?: (info: ContributorInfo | null) => void
		onRoomInfoChange?: (info: RoomInfo | null) => void
		onOpenRoomPanel?: () => void
	}

	let { opportunities, deliverables, links, knownNames = [], onApplyScores, onContributorChange, onRoomInfoChange, onOpenRoomPanel }: Props = $props()

	// --- Persistent sync state (stored in localStorage) ---
	const SYNC_KEY = 'slim-sync'

	interface SyncState {
		roomCode: string
		keys: SyncKeys
		role: 'owner' | 'contributor'
		contributorName?: string
		hasTeam?: boolean
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

	interface LastOwner { roomCode: string; name: string }
	const LAST_OWNER_KEY = 'slim-sync-owner'

	function loadLastOwner(): LastOwner | null {
		try {
			const raw = localStorage.getItem(LAST_OWNER_KEY)
			return raw ? JSON.parse(raw) : null
		} catch { return null }
	}

	function saveLastOwner(owner: LastOwner | null) {
		if (owner) localStorage.setItem(LAST_OWNER_KEY, JSON.stringify(owner))
		else localStorage.removeItem(LAST_OWNER_KEY)
	}

	// --- Roster cache (localStorage per-room) ---

	function rosterCacheKey(roomCode: string): string {
		return `samen-roster-${roomCode.slice(0, 16)}`
	}

	function loadCachedRoster(roomCode: string): TeamSpace | null {
		try {
			const raw = localStorage.getItem(rosterCacheKey(roomCode))
			return raw ? JSON.parse(raw) : null
		} catch { return null }
	}

	function saveCachedRoster(roster: TeamSpace | null) {
		if (roster) localStorage.setItem(rosterCacheKey(roster.roomCode), JSON.stringify(roster))
	}

	function clearCachedRoster(roomCode: string) {
		localStorage.removeItem(rosterCacheKey(roomCode))
	}

	// --- Identity cache (cross-session, cross-tool) ---

	const IDENTITY_KEY = 'samen-identity'

	function loadIdentity(): SamenIdentity | null {
		try {
			const raw = localStorage.getItem(IDENTITY_KEY)
			return raw ? JSON.parse(raw) : null
		} catch { return null }
	}

	function saveIdentity(identity: SamenIdentity) {
		localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
	}

	let cachedRoster = $state<TeamSpace | null>(null)
	let syncState: SyncState | null = $state(loadSyncState())

	// Initialize cached roster from localStorage after syncState is set
	if (syncState) {
		cachedRoster = loadCachedRoster(syncState.roomCode)
	}

	let joinCode = $state('')
	let ownerName = $state('')
	let status = $state('')
	let rosterNames = $state<string[]>([])
	let busy = $state(false)
	let showPanel = $state(false)
	let contributorScores = $state<ScoreEntry[]>([])
	let submittedScores = $state<ScoreEntry[]>([])
	let remoteBoard = $state<BoardData | null>(null)
	let previewBoard = $state<BoardData | null>(null)
	let previewNames = $derived(previewBoard ? boardNames(previewBoard.opportunities, previewBoard.deliverables) : [])
	let previewOwnerName = $derived(previewBoard?.ownerName ?? null)
	// Merge roster + board names for the join picker: roster members first, board-only names after
	let joinPickerNames = $derived(mergeNames(rosterNames, previewNames))

	function mergeNames(roster: string[], board: string[]): string[] {
		const seen = new Set(roster.map(n => n.toLowerCase()))
		const boardOnly = board.filter(n => !seen.has(n.toLowerCase()))
		return [...roster, ...boardOnly]
	}

	// Roster-based pubkey filtering for trusted event verification
	let allRosterPubkeys = $derived(cachedRoster
		? cachedRoster.members.flatMap(m => m.publicKeys)
		: undefined)
	let ownerPubkeys = $derived(cachedRoster
		? cachedRoster.members.filter(m => m.role === 'owner').flatMap(m => m.publicKeys)
		: undefined)

	// Notify parent of contributor state changes (called by $effect below)
	// Also used for imperative leaveRoom notification

	// Re-notify parent whenever contributor-relevant state changes
	$effect(() => {
		if (syncState?.role === 'contributor' && remoteBoard) {
			// Read all reactive values to establish dependencies
			const _b = busy
			const _s = contributorScores
			const _ss = submittedScores
			onContributorChange?.({
				name: syncState.contributorName ?? '',
				board: remoteBoard,
				scores: contributorScores,
				submittedScores,
				busy,
				addScore,
				submitScores,
				refreshBoard,
			})
		} else if (!syncState) {
			onContributorChange?.(null)
		}
	})

	// Notify parent of room info changes
	$effect(() => {
		if (syncState) {
			onRoomInfoChange?.({
				roomCode: syncState.roomCode,
				ownerName: syncState.contributorName ?? '',
				role: syncState.role,
				leaveRoom,
				teamName: cachedRoster?.name,
				trustedPubkeys: allRosterPubkeys,
				ownerPubkeys,
			})
		} else {
			onRoomInfoChange?.(null)
		}
	})

	// Load remote board on init if we're a contributor
	if (syncState?.role === 'contributor') {
		queryBoard(syncState.roomCode, ownerPubkeys).then((board) => {
			if (board) {
				remoteBoard = board
			}
		})
	}

	// Track pending submissions for PO notification badge
	let pendingSubmissionCount = $state(0)

	async function checkForSubmissions() {
		if (!syncState || syncState.role !== 'owner') return
		try {
			const submissions = await queryScores(syncState.roomCode, allRosterPubkeys)
			// Count only submissions that would actually apply new scores
			const cloned: BoardData = JSON.parse(JSON.stringify({ opportunities, deliverables, links }))
			const wouldApply = applyScores(cloned, submissions)
			pendingSubmissionCount = wouldApply
		} catch {
			// Silently ignore — this is a background check
		}
	}

	// Auto-check for submissions when owner has a room
	$effect(() => {
		if (syncState?.role === 'owner') {
			checkForSubmissions()
			const interval = setInterval(checkForSubmissions, 30_000)
			return () => clearInterval(interval)
		} else {
			pendingSubmissionCount = 0
		}
	})

	// --- Owner actions ---

	async function createRoom() {
		if (!ownerName.trim()) {
			status = 'Enter your name first.'
			return
		}
		busy = true
		status = 'Creating room…'
		try {
			const roomCode = generateRoomCode()
			const keys = generateSyncKeys()
			const name = ownerName.trim()
			const board: BoardData = { opportunities, deliverables, links, ownerName: name }
			await publishBoard(roomCode, keys, board)

			const team = createTeamSpace(roomCode, name, name, keys.publicKeyHex)
			await publishRoster(roomCode, keys, team)
			cachedRoster = team
			saveCachedRoster(team)
			saveIdentity({ memberId: team.members[0].id, displayName: name, publicKeyHex: keys.publicKeyHex })

			const state: SyncState = { roomCode, keys, role: 'owner', contributorName: name, hasTeam: true }
			syncState = state
			saveSyncState(state)
			saveLastOwner({ roomCode, name })
			ownerName = ''
			status = ''
			showPanel = false
			onOpenRoomPanel?.()
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
			const board: BoardData = { opportunities, deliverables, links, ownerName: syncState.contributorName }
			await publishBoard(syncState.roomCode, syncState.keys, board)
			status = 'Board published.'
			showPanel = false
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
			const submissions = await queryScores(syncState.roomCode, allRosterPubkeys)
			if (submissions.length === 0) {
				status = 'No score submissions found.'
			} else {
				const clonedOpps: Opportunity[] = JSON.parse(JSON.stringify(opportunities))
				const board: BoardData = { opportunities: clonedOpps, deliverables: JSON.parse(JSON.stringify(deliverables)), links: JSON.parse(JSON.stringify(links)) }
				const count = applyScores(board, submissions)
				if (count > 0) {
					onApplyScores(clonedOpps, `Applied ${count} score${count === 1 ? '' : 's'} from ${submissions.length} submission${submissions.length === 1 ? '' : 's'}.`)
					status = `Applied ${count} score${count === 1 ? '' : 's'} from ${submissions.length} submission${submissions.length === 1 ? '' : 's'}.`
					pendingSubmissionCount = 0
					showPanel = false
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

	async function lookupRoom() {
		if (!joinCode.trim()) return
		busy = true
		status = 'Looking up room…'
		try {
			const code = joinCode.trim()
			const [board, roster] = await Promise.all([
				queryBoard(code),
				queryRoster(code),
			])
			if (!board) {
				status = 'Room not found — check the code and try again.'
				busy = false
				return
			}
			if (roster) {
				cachedRoster = roster
				saveCachedRoster(roster)
				rosterNames = roster.members.map(m => m.displayName)
			}
			const last = loadLastOwner()
			if (last && last.roomCode === code) {
				// Auto-reclaim as owner
				await reclaimAsOwner(last.name)
				return
			}
			previewBoard = board
			const nameSource = rosterNames.length > 0 ? 'team' : 'board'
			status = `Found ${nameSource} with ${board.opportunities.length} opportunities. Pick your name to join.`
		} catch (e) {
			status = `Lookup failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	function joinOrReclaim(name: string) {
		if (previewOwnerName && name.trim().toLowerCase() === previewOwnerName.toLowerCase()) {
			reclaimAsOwner(name)
		} else {
			joinAsContributor(name)
		}
	}

	function joinAsContributor(name: string) {
		if (!previewBoard || !joinCode.trim() || !name.trim()) return
		const keys = generateSyncKeys()
		const hasTeam = cachedRoster !== null
		const state: SyncState = { roomCode: joinCode.trim(), keys, role: 'contributor', contributorName: name.trim(), hasTeam }
		syncState = state
		saveSyncState(state)

		// If we have a roster, record identity for this member
		if (cachedRoster) {
			const member = findRosterMember(cachedRoster, name.trim())
			if (member) {
				saveIdentity({ memberId: member.id, displayName: name.trim(), publicKeyHex: keys.publicKeyHex })
			}
		}

		contributorScores = []
		remoteBoard = previewBoard
		previewBoard = null
		rosterNames = []
		status = `Joined as ${name.trim()}. Board has ${remoteBoard.opportunities.length} opportunities.`
		showPanel = false
	}

	async function reclaimAsOwner(name: string) {
		if (!name.trim() || !joinCode.trim()) return
		busy = true
		status = 'Reclaiming room…'
		try {
			const roomCode = joinCode.trim()
			const keys = generateSyncKeys()
			const board: BoardData = { opportunities, deliverables, links, ownerName: name.trim() }
			await publishBoard(roomCode, keys, board)
			const hasTeam = cachedRoster !== null
			const state: SyncState = { roomCode, keys, role: 'owner', contributorName: name.trim(), hasTeam }
			syncState = state
			saveSyncState(state)
			saveLastOwner({ roomCode, name: name.trim() })
			previewBoard = null
			rosterNames = []
			ownerName = ''
			status = `Rejoined room as ${name.trim()}.`
			showPanel = false
		} catch (e) {
			status = `Reclaim failed: ${e instanceof Error ? e.message : 'unknown error'}`
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
			status = `Submitted ${contributorScores.length} score${contributorScores.length === 1 ? '' : 's'}. Your input has been sent to the PO.`
			submittedScores = [...submittedScores, ...contributorScores]
			contributorScores = []
			showPanel = false
		} catch (e) {
			status = `Submit failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	async function refreshBoard() {
		if (!syncState) return
		busy = true
		status = 'Refreshing board…'
		try {
			const board = await queryBoard(syncState.roomCode, ownerPubkeys)
			if (board) {
				remoteBoard = board
				submittedScores = []
				status = `Board refreshed — ${board.opportunities.length} opportunities.`
				showPanel = false
			} else {
				status = 'Could not fetch board.'
			}
		} catch (e) {
			status = `Refresh failed: ${e instanceof Error ? e.message : 'unknown error'}`
		}
		busy = false
	}

	function leaveRoom() {
		const previousCode = syncState?.roomCode ?? ''
		if (previousCode) clearCachedRoster(previousCode)
		syncState = null
		saveSyncState(null)
		contributorScores = []
		submittedScores = []
		remoteBoard = null
		cachedRoster = null
		rosterNames = []
		joinCode = previousCode
		status = 'Left room. Use the pre-filled code to rejoin.'
		onContributorChange?.(null)
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

	let containerEl: HTMLDivElement | undefined = $state()

	$effect(() => {
		if (!showPanel) return
		function handleClick(e: PointerEvent) {
			if (containerEl && !containerEl.contains(e.target as Node)) {
				showPanel = false
			}
		}
		document.addEventListener('pointerdown', handleClick)
		return () => document.removeEventListener('pointerdown', handleClick)
	})
</script>

<div class="sync-container" bind:this={containerEl}>
	{#if syncState?.role === 'owner'}
		<!-- Owner: direct buttons, no dropdown -->
		<div class="sync-owner-bar">
			<button class="sync-btn primary" onclick={publishUpdate} disabled={busy}>
				{busy ? 'Publishing…' : 'Publish'}
			</button>
			<button class="sync-toggle" onclick={() => onOpenRoomPanel?.()} title="Open room panel">
				🔗 Room
				{#if pendingSubmissionCount > 0}
					<span class="sync-badge">{pendingSubmissionCount}</span>
				{/if}
			</button>
		</div>
	{:else}
	<button class="sync-toggle" onclick={() => showPanel = !showPanel} title="Share & sync board via encrypted relay">
		{#if syncState}
			🔗 Contributor
		{:else}
			Share
		{/if}
	</button>
	{/if}

	{#if showPanel}
		<div class="sync-panel">
			{#if !syncState}
				<!-- Not connected -->
				<div class="sync-section">
					<h3>Create a room</h3>
					<p class="sync-hint">Publish your board so contributors can score cells.</p>
					<input class="sync-input" type="text" placeholder="Your name" bind:value={ownerName} />
					<button class="sync-btn primary" onclick={createRoom} disabled={busy || !ownerName.trim()}>Create Room</button>
				</div>
				<div class="sync-divider">or</div>
				<div class="sync-section">
					<h3>Join a room</h3>
					<input class="sync-input" type="text" placeholder="Room code" bind:value={joinCode} />
					{#if previewBoard}
						<MemberPicker
							knownNames={joinPickerNames}
							placeholder="Your name…"
							inputClass="sync-input"
							onPick={joinOrReclaim}
						/>
					{:else}
						<button class="sync-btn" onclick={lookupRoom} disabled={busy || !joinCode.trim()}>Look up</button>
					{/if}
				</div>

			{:else if syncState.role === 'contributor'}
				<!-- Contributor panel -->
				<div class="sync-section">
					<h3>Contributing as {syncState.contributorName}</h3>
					<p class="sync-hint">Score your assigned cells below, then submit.</p>
					<div class="sync-actions">
						<button class="sync-btn" onclick={refreshBoard} disabled={busy}>Refresh Board</button>
						{#if contributorScores.length > 0}
							<button class="sync-btn primary" onclick={submitScores} disabled={busy}>
								Submit {contributorScores.length} score{contributorScores.length === 1 ? '' : 's'}
							</button>
						{/if}
						<button class="sync-btn danger" onclick={leaveRoom}>Leave</button>
					</div>
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

	.sync-owner-bar {
		display: flex;
		gap: var(--sp-xs);
		align-items: center;
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

	.sync-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		margin-left: 4px;
		border-radius: 9px;
		background: var(--c-accent);
		color: white;
		font-size: 11px;
		font-weight: var(--fw-bold);
		line-height: 1;
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
