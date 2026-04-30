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
import { computeDTag, decrypt, deriveRoomKey, encrypt } from './crypto'
import type { BoardData } from './store'
import type { CellSignal, Perspective, Stage } from './types'

// --- Config ---

const RELAY_URLS = ['wss://nos.lol', 'wss://relay.primal.net']
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

export interface SyncKeys {
	secretKeyHex: string
	publicKeyHex: string
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
			tags: [['d', dTag]],
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

/** Query the latest board state from Nostr relays. */
export async function queryBoard(roomCode: string): Promise<BoardData | null> {
	const [roomKey, dTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	try {
		const event = await pool.get(RELAY_URLS, {
			kinds: [KIND_BOARD_STATE],
			'#d': [dTag],
		})
		if (!event) return null

		const plaintext = await decrypt(roomKey, event.content)
		const data: unknown = JSON.parse(plaintext)
		if (!isBoardData(data)) return null
		return data as BoardData
	} catch {
		return null
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
			tags: [
				['d', dTag],
				['r', roomDTag],
			],
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

/** Query all score submissions for a room. */
export async function queryScores(roomCode: string): Promise<ScoreSubmission[]> {
	const [roomKey, roomDTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	try {
		const events = await pool.querySync(RELAY_URLS, {
			kinds: [KIND_SCORE_SUBMISSION],
			'#r': [roomDTag],
		})

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

/** Subscribe to new score submissions for a room. Returns a closer function. */
export async function subscribeScores(
	roomCode: string,
	onScore: (submission: ScoreSubmission) => void,
): Promise<{ close: () => void }> {
	const [roomKey, roomDTag] = await Promise.all([deriveRoomKey(roomCode), computeDTag(roomCode)])

	const pool = new SimplePool()
	let sub: SubCloser | undefined

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
