/**
 * Nostr-based board sync for async collaboration.
 *
 * Flow:
 * 1. PO creates a room → generates a room code, publishes encrypted board state
 * 2. Contributor opens room → queries board state, sees assigned cells
 * 3. Contributor submits scores → publishes encrypted score event
 * 4. PO syncs → queries score events, merges into local board
 *
 * Uses kind 30078 (replaceable) for state persistence.
 * All content is AES-256-GCM encrypted with a key derived from the room code.
 */
import { finalizeEvent, generateSecretKey, getPublicKey, SimplePool } from 'nostr-tools'
import type { SubCloser } from 'nostr-tools/abstract-pool'
import { bytesToHex, hexToBytes } from 'nostr-tools/utils'
import {
	computeBridgeDTag,
	computeDTag,
	decrypt,
	deriveBridgeKey,
	deriveRoomKey,
	encrypt,
} from './crypto'
import { expirationTag, RELAY_URLS, type SyncKeys } from './samen/nostr-config'
import { compoundRoomCode } from './samen/types'
import type { BoardData } from './store'
import type { CellSignal, DeliverableEstimate, Perspective, Stage } from './types'

// Re-export SyncKeys so existing consumers don't break
export type { SyncKeys } from './samen/nostr-config'

// --- Config ---

const KIND_BOARD_STATE = 30078
const KIND_SCORE_SUBMISSION = 30079

// --- Types ---

/** A score submission from a contributor */
export interface ScoreSubmission {
	/** Contributor's display name */
	name: string
	/** Opportunity ID → stage → perspective → signal update */
	scores: ScoreEntry[]
	/** When the submission was created */
	timestamp: number
}

export interface ScoreEntry {
	opportunityId: string
	stage: Stage
	perspective: Perspective
	signal: CellSignal
}

/** Migration notice — published on the old room to redirect contributors */
export interface MigrationNotice {
	/** Signals this is a migration, not board data */
	migrated: true
	/** The new room code to join */
	newRoomCode: string
	/** Human-readable reason */
	reason: string
	/** When the migration happened */
	timestamp: number
}

// --- Key management ---

export function generateSyncKeys(): SyncKeys {
	const sk = generateSecretKey()
	return {
		secretKeyHex: bytesToHex(sk),
		publicKeyHex: getPublicKey(sk),
	}
}

// --- Room code generation ---

/** Generate a URL-safe room code (UUID v4) */
export function generateRoomCode(): string {
	return crypto.randomUUID()
}

// --- Board publishing (PO side) ---

/** Publish the full board state to Nostr relays, encrypted with the room key. */
export async function publishBoard(
	roomCode: string,
	keys: SyncKeys,
	board: BoardData,
): Promise<void> {
	const [roomKey, dTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])
	const ciphertext = await encrypt(roomKey, JSON.stringify(board))
	const sk = hexToBytes(keys.secretKeyHex)

	const event = finalizeEvent(
		{
			kind: KIND_BOARD_STATE,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', dTag], expirationTag()],
			content: ciphertext,
		},
		sk,
	)

	const pool = new SimplePool()
	try {
		await Promise.any(pool.publish(RELAY_URLS, event))
	} finally {
		pool.close(RELAY_URLS)
	}
}

/** Query the latest board state from Nostr relays.
 *  When trustedPubkeys is provided, only events signed by those keys are accepted.
 *  Returns a MigrationNotice if the room has been rotated.
 */
export async function queryBoard(
	roomCode: string,
	trustedPubkeys?: string[],
): Promise<BoardData | MigrationNotice | null> {
	const [roomKey, dTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	try {
		const filter: Record<string, unknown> = {
			kinds: [KIND_BOARD_STATE],
			'#d': [dTag],
		}
		if (trustedPubkeys?.length) {
			filter.authors = trustedPubkeys
		}
		const event = await pool.get(RELAY_URLS, filter as Parameters<SimplePool['get']>[1])
		if (!event) return null

		const plaintext = await decrypt(roomKey, event.content)
		const data: unknown = JSON.parse(plaintext)
		if (isMigrationNotice(data)) return data as MigrationNotice
		if (!isBoardData(data)) return null
		return data as BoardData
	} catch {
		return null
	} finally {
		pool.close(RELAY_URLS)
	}
}

// --- Room code rotation ---

/** Publish a migration notice on the old room, replacing the board state event.
 *  Contributors querying the old room will receive this instead of board data.
 */
export async function publishMigration(
	oldRoomCode: string,
	keys: SyncKeys,
	newRoomCode: string,
	reason: string,
): Promise<void> {
	const [roomKey, dTag] = await Promise.all([deriveRoomKey(oldRoomCode), computeDTag(oldRoomCode)])
	const notice: MigrationNotice = {
		migrated: true,
		newRoomCode,
		reason,
		timestamp: Date.now(),
	}
	const ciphertext = await encrypt(roomKey, JSON.stringify(notice))
	const sk = hexToBytes(keys.secretKeyHex)

	const event = finalizeEvent(
		{
			kind: KIND_BOARD_STATE,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', dTag], expirationTag()],
			content: ciphertext,
		},
		sk,
	)

	const pool = new SimplePool()
	try {
		await Promise.any(pool.publish(RELAY_URLS, event))
	} finally {
		pool.close(RELAY_URLS)
	}
}

// --- Score submission (contributor side) ---

/** Publish a score submission to Nostr relays. */
export async function publishScores(
	roomCode: string,
	keys: SyncKeys,
	submission: ScoreSubmission,
): Promise<void> {
	const [roomKey, roomDTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])
	// Per-contributor d-tag: room hash + pubkey prefix → replaces own previous submission
	const dTag = `${roomDTag}-${keys.publicKeyHex.slice(0, 8)}`
	const ciphertext = await encrypt(roomKey, JSON.stringify(submission))
	const sk = hexToBytes(keys.secretKeyHex)

	const event = finalizeEvent(
		{
			kind: KIND_SCORE_SUBMISSION,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', dTag], ['r', roomDTag], expirationTag()],
			content: ciphertext,
		},
		sk,
	)

	const pool = new SimplePool()
	try {
		await Promise.any(pool.publish(RELAY_URLS, event))
	} finally {
		pool.close(RELAY_URLS)
	}
}

/** Query all score submissions for a room.
 *  When trustedPubkeys is provided, events from unknown signers are silently dropped.
 */
export async function queryScores(
	roomCode: string,
	trustedPubkeys?: string[],
): Promise<ScoreSubmission[]> {
	const [roomKey, roomDTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	try {
		const filter: Record<string, unknown> = {
			kinds: [KIND_SCORE_SUBMISSION],
			'#r': [roomDTag],
		}
		if (trustedPubkeys?.length) {
			filter.authors = trustedPubkeys
		}
		const events = await pool.querySync(
			RELAY_URLS,
			filter as Parameters<SimplePool['querySync']>[1],
		)

		const submissions: ScoreSubmission[] = []
		for (const event of events) {
			try {
				const plaintext = await decrypt(roomKey, event.content)
				const data: unknown = JSON.parse(plaintext)
				if (isScoreSubmission(data)) {
					submissions.push(data as ScoreSubmission)
				}
			} catch {
				// Skip undecryptable events
			}
		}
		return submissions
	} catch {
		return []
	} finally {
		pool.close(RELAY_URLS)
	}
}

/** Apply score submissions to a board — mutates opportunities in place, returns count of applied scores. */
export function applyScores(board: BoardData, submissions: ScoreSubmission[]): number {
	let applied = 0
	const oppMap = new Map(board.opportunities.map((o) => [o.id, o]))

	for (const sub of submissions) {
		for (const entry of sub.scores) {
			const opp = oppMap.get(entry.opportunityId)
			if (!opp) continue
			const stageSignals = opp.signals[entry.stage]
			if (!stageSignals) continue
			const cell = stageSignals[entry.perspective]
			if (!cell) continue

			// Apply if current cell has no score or the submission is newer
			if (cell.score === 'none' || entry.signal.score !== 'none') {
				cell.score = entry.signal.score
				cell.source = entry.signal.source ?? 'manual'
				if (entry.signal.verdict) cell.verdict = entry.signal.verdict
				if (entry.signal.evidence) cell.evidence = entry.signal.evidence
				if (entry.signal.owner) cell.owner = entry.signal.owner
				else if (sub.name) cell.owner = sub.name
				opp.updatedAt = Date.now()
				applied++
			}
		}
	}

	return applied
}

// --- Live subscription (optional real-time score updates) ---

/** Subscribe to new score submissions for a room. Returns a closer function.
 *  When trustedPubkeys is provided, events from unknown signers are silently dropped.
 */
export async function subscribeScores(
	roomCode: string,
	onScore: (submission: ScoreSubmission) => void,
	trustedPubkeys?: string[],
): Promise<{ close: () => void }> {
	const [roomKey, roomDTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	let sub: SubCloser | undefined

	const trusted = trustedPubkeys?.length ? new Set(trustedPubkeys) : null

	try {
		sub = pool.subscribeMany(
			RELAY_URLS,
			{
				kinds: [KIND_SCORE_SUBMISSION],
				'#r': [roomDTag],
				since: Math.floor(Date.now() / 1000) - 5,
			},
			{
				onevent(event) {
					if (trusted && !trusted.has(event.pubkey)) return
					decrypt(roomKey, event.content)
						.then((plaintext) => {
							const data: unknown = JSON.parse(plaintext)
							if (isScoreSubmission(data)) {
								onScore(data as ScoreSubmission)
							}
						})
						.catch(() => {
							/* skip */
						})
				},
			},
		)
	} catch {
		pool.close(RELAY_URLS)
		return { close() {} }
	}

	return {
		close() {
			sub?.close()
			pool.close(RELAY_URLS)
		},
	}
}

// --- Estimation room (Slim ↔ Skatting bridge) ---

const CONSONANTS = 'bdfghjkmnprstvz'
const VOWELS = 'aeiou'

/** Generate a 4-syllable room code matching Skatting's format (~28 bits entropy).
 *  If teamCode is provided, returns a compound code: `teamCode-sessionCode`. */
export function generateEstimationRoom(teamCode?: string): string {
	let id = ''
	for (let i = 0; i < 4; i++) {
		id += CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]
		id += VOWELS[Math.floor(Math.random() * VOWELS.length)]
	}
	return teamCode ? compoundRoomCode(teamCode, id) : id
}

// --- Bridge types ---

/** Estimation request pushed from Slim → Skatting via bridge channel. */
export interface EstimationRequest {
	type: 'estimation-request'
	deliverables: {
		id: string
		title: string
		kind: 'delivery' | 'discovery'
	}[]
	unit: 'days' | 'points'
	boardName?: string
	timestamp: number
}

/** Verdict result published from Skatting → Slim via bridge channel. */
export interface VerdictResult {
	type: 'verdict-result'
	verdicts: {
		externalId: string
		title: string
		mu: number
		sigma: number
		n: number
		snappedValue: string
		unit: string
		estimatedAt: number
	}[]
	timestamp: number
}

/** Bridge expiration: 7 days (estimation sessions are transient). */
function bridgeExpirationTag(): [string, string] {
	return ['expiration', String(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)]
}

// --- Bridge publishing ---

/** Publish an estimation request to the bridge channel. */
export async function publishEstimationRequest(
	estimationRoom: string,
	keys: SyncKeys,
	request: EstimationRequest,
): Promise<void> {
	const [bridgeKey, dTag] = await Promise.all([
		deriveBridgeKey(estimationRoom),
		computeBridgeDTag(estimationRoom, 'request'),
	])
	const ciphertext = await encrypt(bridgeKey, JSON.stringify(request))
	const sk = hexToBytes(keys.secretKeyHex)

	const event = finalizeEvent(
		{
			kind: KIND_BOARD_STATE,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', dTag], bridgeExpirationTag()],
			content: ciphertext,
		},
		sk,
	)

	const pool = new SimplePool()
	try {
		await Promise.any(pool.publish(RELAY_URLS, event))
	} finally {
		pool.close(RELAY_URLS)
	}
}

// --- Bridge querying ---

/** Query verdict results from the bridge channel. */
export async function queryVerdicts(estimationRoom: string): Promise<VerdictResult | null> {
	const [bridgeKey, dTag] = await Promise.all([
		deriveBridgeKey(estimationRoom),
		computeBridgeDTag(estimationRoom, 'verdicts'),
	])

	const pool = new SimplePool()
	try {
		const event = await pool.get(RELAY_URLS, {
			kinds: [KIND_BOARD_STATE],
			'#d': [dTag],
		})
		if (!event) return null

		const plaintext = await decrypt(bridgeKey, event.content)
		const data: unknown = JSON.parse(plaintext)
		if (!isVerdictResult(data)) return null
		return data as VerdictResult
	} catch {
		return null
	} finally {
		pool.close(RELAY_URLS)
	}
}

/** Apply verdict results to deliverables — mutates in place, returns count of applied verdicts. */
export function applyVerdicts(
	deliverables: { id: string; estimate?: DeliverableEstimate }[],
	result: VerdictResult,
): number {
	let applied = 0
	const delMap = new Map(deliverables.map((d) => [d.id, d]))

	for (const v of result.verdicts) {
		const del = delMap.get(v.externalId)
		if (!del) continue
		// Apply if no existing estimate or new one is more recent
		if (!del.estimate || v.estimatedAt > del.estimate.estimatedAt) {
			del.estimate = {
				mu: v.mu,
				sigma: v.sigma,
				n: v.n,
				unit: v.unit === 'days' ? 'days' : 'points',
				snappedValue: v.snappedValue,
				estimatedAt: v.estimatedAt,
			}
			applied++
		}
	}

	return applied
}

// --- Validation ---

function isBoardData(v: unknown): v is BoardData {
	if (typeof v !== 'object' || v === null) return false
	const obj = v as Record<string, unknown>
	return (
		Array.isArray(obj.opportunities) && Array.isArray(obj.deliverables) && Array.isArray(obj.links)
	)
}

function isScoreSubmission(v: unknown): v is ScoreSubmission {
	if (typeof v !== 'object' || v === null) return false
	const obj = v as Record<string, unknown>
	return (
		typeof obj.name === 'string' && Array.isArray(obj.scores) && typeof obj.timestamp === 'number'
	)
}

export function isMigrationNotice(v: unknown): v is MigrationNotice {
	if (typeof v !== 'object' || v === null) return false
	const obj = v as Record<string, unknown>
	return obj.migrated === true && typeof obj.newRoomCode === 'string'
}

function isVerdictResult(v: unknown): v is VerdictResult {
	if (typeof v !== 'object' || v === null) return false
	const obj = v as Record<string, unknown>
	return (
		obj.type === 'verdict-result' &&
		Array.isArray(obj.verdicts) &&
		typeof obj.timestamp === 'number'
	)
}
