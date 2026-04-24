import type { BoardSnapshot } from './briefing'
import type { MeetingData } from './meeting'
import type { Deliverable, Opportunity, OpportunityDeliverableLink } from './types'
import { defaultHorizon } from './types'

const STORAGE_KEY = 'upstream-board'
const MEETING_KEY = 'upstream-meetings'

export interface BoardData {
	opportunities: Opportunity[]
	deliverables: Deliverable[]
	links: OpportunityDeliverableLink[]
	/** Horizons with no opportunities yet (user-created empty buckets) */
	customHorizons?: string[]
	/** Last-seen snapshot for the briefing diff engine */
	briefingSnapshot?: BoardSnapshot
}

export function saveBoard(data: BoardData): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
	} catch {
		// Storage full or unavailable — silently ignore
	}
}

export function loadBoard(): BoardData | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const data = JSON.parse(raw) as BoardData
		// Basic shape validation
		if (
			!Array.isArray(data.opportunities) ||
			!Array.isArray(data.deliverables) ||
			!Array.isArray(data.links)
		) {
			return null
		}
		// Backfill fields for data saved before these features
		const fallback = defaultHorizon()
		for (const opp of data.opportunities) {
			if (!opp.horizon) opp.horizon = fallback
			if (!opp.stageEnteredAt) opp.stageEnteredAt = opp.updatedAt ?? opp.createdAt
			// Migrate incubating → parked (no parkUntil)
			if ((opp.exitState as string) === 'incubating') opp.exitState = 'parked'
		}
		return data
	} catch {
		return null
	}
}

export function clearBoard(): void {
	localStorage.removeItem(STORAGE_KEY)
	localStorage.removeItem(MEETING_KEY)
}

export function saveMeetingData(data: MeetingData): void {
	try {
		localStorage.setItem(MEETING_KEY, JSON.stringify(data))
	} catch {
		// Storage full or unavailable
	}
}

export function loadMeetingData(): MeetingData {
	const empty: MeetingData = { lastDiscussed: {}, records: [], snapshots: {} }
	try {
		const raw = localStorage.getItem(MEETING_KEY)
		if (!raw) return empty
		const data = JSON.parse(raw) as MeetingData
		if (!data.lastDiscussed || !Array.isArray(data.records)) {
			return empty
		}
		// Backfill missing snapshots field
		if (!data.snapshots) data.snapshots = {}
		return data
	} catch {
		return empty
	}
}
