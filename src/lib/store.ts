import type { BoardSnapshot } from './briefing'
import type { MeetingData } from './meeting'
import type { Deliverable, Opportunity, OpportunityDeliverableLink } from './types'
import { defaultHorizon } from './types'

// ── Legacy single-board keys (used for migration) ──

const LEGACY_BOARD_KEY = 'slim-board'
const LEGACY_MEETING_KEY = 'slim-meetings'

// ── Multi-board registry ──

const REGISTRY_KEY = 'slim-boards'
const ACTIVE_KEY = 'slim-active-board'

export interface BoardEntry {
	id: string
	name: string
	description?: string
	createdAt: number
	updatedAt: number
}

function boardKey(id: string): string {
	return `slim-board:${id}`
}
function meetingKey(id: string): string {
	return `slim-meetings:${id}`
}

export function loadBoardRegistry(): BoardEntry[] {
	try {
		const raw = localStorage.getItem(REGISTRY_KEY)
		if (!raw) return []
		const entries = JSON.parse(raw)
		return Array.isArray(entries) ? entries : []
	} catch {
		return []
	}
}

export function saveBoardRegistry(entries: BoardEntry[]): void {
	try {
		localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries))
	} catch {
		// Storage full or unavailable
	}
}

export function getActiveBoardId(): string | null {
	return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveBoardId(id: string): void {
	localStorage.setItem(ACTIVE_KEY, id)
}

export function createBoardEntry(name: string): BoardEntry {
	return {
		id: crypto.randomUUID(),
		name,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}
}

export function deleteBoardEntry(id: string): void {
	const entries = loadBoardRegistry().filter((e) => e.id !== id)
	saveBoardRegistry(entries)
	localStorage.removeItem(boardKey(id))
	localStorage.removeItem(meetingKey(id))
}

// ── Board data ──

export interface BoardData {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
	/** Horizons with no opportunities yet (user-created empty buckets) */
	customHorizons?: string[]
	/** Last-seen snapshot for the briefing diff engine */
	briefingSnapshot?: BoardSnapshot
	/** Name of the room owner (included in published board for rejoin detection) */
	ownerName?: string
}

export function saveBoard(data: BoardData, id?: string): void {
	const key = id ? boardKey(id) : LEGACY_BOARD_KEY
	try {
		localStorage.setItem(key, JSON.stringify(data))
	} catch {
		// Storage full or unavailable — silently ignore
	}
}

function backfillBoard(data: BoardData): BoardData {
	const fallback = defaultHorizon()
	for (const opp of data.opportunities) {
		if (!opp.horizon) opp.horizon = fallback
		if (!opp.stageEnteredAt) opp.stageEnteredAt = opp.updatedAt ?? opp.createdAt
		// Backfill stageHistory from current state
		if (!opp.stageHistory || opp.stageHistory.length === 0) {
			opp.stageHistory = [{ stage: opp.stage, enteredAt: opp.stageEnteredAt }]
		}
		// Migrate incubating → parked (no parkUntil)
		if ((opp.exitState as string) === 'incubating') opp.exitState = 'parked'
		// Migrate blocker → approver role rename
		for (const p of opp.people) {
			if ((p.role as string) === 'blocker') p.role = 'approver'
		}
	}
	for (const del of data.deliverables) {
		if (!del.kind) del.kind = 'delivery'
		if (!del.status) del.status = 'active'
		if (del.notes == null) del.notes = ''
	}
	return data
}

function loadBoardFromKey(key: string): BoardData | null {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return null
		const data = JSON.parse(raw) as BoardData
		if (
			!Array.isArray(data.opportunities) ||
			!Array.isArray(data.deliverables) ||
			!Array.isArray(data.links)
		) {
			return null
		}
		return backfillBoard(data)
	} catch {
		return null
	}
}

export function loadBoard(id?: string): BoardData | null {
	return loadBoardFromKey(id ? boardKey(id) : LEGACY_BOARD_KEY)
}

export function clearBoard(id?: string): void {
	if (id) {
		localStorage.removeItem(boardKey(id))
		localStorage.removeItem(meetingKey(id))
	} else {
		localStorage.removeItem(LEGACY_BOARD_KEY)
		localStorage.removeItem(LEGACY_MEETING_KEY)
	}
}

export function saveMeetingData(data: MeetingData, id?: string): void {
	const key = id ? meetingKey(id) : LEGACY_MEETING_KEY
	try {
		localStorage.setItem(key, JSON.stringify(data))
	} catch {
		// Storage full or unavailable
	}
}

export function loadMeetingData(id?: string): MeetingData {
	const key = id ? meetingKey(id) : LEGACY_MEETING_KEY
	const empty: MeetingData = { lastDiscussed: {}, records: [], snapshots: {} }
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return empty
		const data = JSON.parse(raw) as MeetingData
		if (!data.lastDiscussed || !Array.isArray(data.records)) {
			return empty
		}
		// Backfill missing fields
		if (!data.snapshots) data.snapshots = {}
		if (!data.inProgress) data.inProgress = {}
		return data
	} catch {
		return empty
	}
}

// ── Migration: single-board → multi-board ──

export function migrateToMultiBoard(): { entries: BoardEntry[]; activeId: string | null } {
	const existing = loadBoardRegistry()
	if (existing.length > 0) {
		// Already migrated
		return { entries: existing, activeId: getActiveBoardId() }
	}

	// Check for legacy single-board data
	const legacyBoard = loadBoardFromKey(LEGACY_BOARD_KEY)
	if (!legacyBoard) {
		return { entries: [], activeId: null }
	}

	// Create a board entry for the legacy data
	const entry = createBoardEntry('My board')
	saveBoardRegistry([entry])
	setActiveBoardId(entry.id)

	// Copy data to new key
	saveBoard(legacyBoard, entry.id)
	const legacyMeetings = loadMeetingData()
	if (legacyMeetings.records.length > 0 || Object.keys(legacyMeetings.lastDiscussed).length > 0) {
		saveMeetingData(legacyMeetings, entry.id)
	}

	// Remove legacy keys
	localStorage.removeItem(LEGACY_BOARD_KEY)
	localStorage.removeItem(LEGACY_MEETING_KEY)

	return { entries: [entry], activeId: entry.id }
}
