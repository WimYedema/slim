import { beforeEach, describe, expect, it } from 'vitest'
import type { MeetingData } from './meeting'
import {
	type BoardData,
	clearBoard,
	createBoardEntry,
	deleteBoardEntry,
	getActiveBoardId,
	loadBoard,
	loadBoardRegistry,
	loadMeetingData,
	migrateToMultiBoard,
	saveBoard,
	saveBoardRegistry,
	saveMeetingData,
	setActiveBoardId,
} from './store'
import { createDeliverable, createOpportunity } from './types'

// ── Setup ──

beforeEach(() => {
	localStorage.clear()
})

function makeBoardData(): BoardData {
	return {
		opportunities: [createOpportunity('Test')],
		deliverables: [createDeliverable('Task')],
		links: [],
	}
}

// ── Board persistence ──

describe('saveBoard / loadBoard', () => {
	it('round-trips board data', () => {
		const data = makeBoardData()
		saveBoard(data)
		const loaded = loadBoard()
		expect(loaded).not.toBeNull()
		expect(loaded?.opportunities).toHaveLength(1)
		expect(loaded?.opportunities[0].title).toBe('Test')
		expect(loaded?.deliverables).toHaveLength(1)
	})

	it('returns null when nothing is saved', () => {
		expect(loadBoard()).toBeNull()
	})

	it('returns null for corrupted data', () => {
		localStorage.setItem('slim-board', 'not json')
		expect(loadBoard()).toBeNull()
	})

	it('returns null for data missing required arrays', () => {
		localStorage.setItem('slim-board', JSON.stringify({ opportunities: 'not array' }))
		expect(loadBoard()).toBeNull()
	})

	it('backfills missing horizon field', () => {
		const data = makeBoardData()
		// Simulate old data without horizon
		const raw = JSON.parse(JSON.stringify(data))
		delete raw.opportunities[0].horizon
		localStorage.setItem('slim-board', JSON.stringify(raw))

		const loaded = loadBoard()
		expect(loaded?.opportunities[0].horizon).toBeTruthy()
		expect(loaded?.opportunities[0].horizon).toMatch(/^\d{4}Q[1-4]$/)
	})

	it('backfills missing stageEnteredAt from updatedAt', () => {
		const data = makeBoardData()
		const raw = JSON.parse(JSON.stringify(data))
		delete raw.opportunities[0].stageEnteredAt
		raw.opportunities[0].updatedAt = 1700000000000
		localStorage.setItem('slim-board', JSON.stringify(raw))

		const loaded = loadBoard()
		expect(loaded?.opportunities[0].stageEnteredAt).toBe(1700000000000)
	})

	it('preserves customHorizons', () => {
		const data: BoardData = { ...makeBoardData(), customHorizons: ['2027Q1', '2027Q2'] }
		saveBoard(data)
		const loaded = loadBoard()
		expect(loaded?.customHorizons).toEqual(['2027Q1', '2027Q2'])
	})
})

describe('clearBoard', () => {
	it('removes both board and meeting data', () => {
		saveBoard(makeBoardData())
		saveMeetingData({ lastDiscussed: {}, records: [], snapshots: {} })
		clearBoard()
		expect(loadBoard()).toBeNull()
		expect(loadMeetingData().records).toHaveLength(0)
	})
})

// ── Meeting persistence ──

describe('saveMeetingData / loadMeetingData', () => {
	it('round-trips meeting data', () => {
		const data: MeetingData = {
			lastDiscussed: { Alice: Date.now() },
			records: [{ personName: 'Alice', timestamp: Date.now(), summary: ['test'] }],
			snapshots: {},
		}
		saveMeetingData(data)
		const loaded = loadMeetingData()
		expect(loaded.lastDiscussed.Alice).toBeDefined()
		expect(loaded.records).toHaveLength(1)
	})

	it('returns empty data when nothing is saved', () => {
		const loaded = loadMeetingData()
		expect(loaded.lastDiscussed).toEqual({})
		expect(loaded.records).toEqual([])
		expect(loaded.snapshots).toEqual({})
	})

	it('returns empty data for corrupted storage', () => {
		localStorage.setItem('slim-meetings', '{bad json')
		const loaded = loadMeetingData()
		expect(loaded.records).toEqual([])
	})

	it('backfills missing snapshots field', () => {
		const raw = { lastDiscussed: {}, records: [] }
		localStorage.setItem('slim-meetings', JSON.stringify(raw))
		const loaded = loadMeetingData()
		expect(loaded.snapshots).toEqual({})
	})
})

// ── Multi-board registry ──

describe('board registry', () => {
	it('starts empty', () => {
		expect(loadBoardRegistry()).toEqual([])
	})

	it('round-trips entries', () => {
		const entry = createBoardEntry('Test board')
		saveBoardRegistry([entry])
		const loaded = loadBoardRegistry()
		expect(loaded).toHaveLength(1)
		expect(loaded[0].name).toBe('Test board')
		expect(loaded[0].id).toBeTruthy()
	})

	it('tracks active board ID', () => {
		expect(getActiveBoardId()).toBeNull()
		setActiveBoardId('abc-123')
		expect(getActiveBoardId()).toBe('abc-123')
	})
})

describe('per-board save/load', () => {
	it('saves and loads board by ID', () => {
		const data = makeBoardData()
		saveBoard(data, 'board-1')
		const loaded = loadBoard('board-1')
		expect(loaded).not.toBeNull()
		expect(loaded?.opportunities[0].title).toBe('Test')
	})

	it('isolates boards by ID', () => {
		saveBoard(makeBoardData(), 'board-1')
		saveBoard({ ...makeBoardData(), opportunities: [createOpportunity('Other')] }, 'board-2')
		expect(loadBoard('board-1')?.opportunities[0].title).toBe('Test')
		expect(loadBoard('board-2')?.opportunities[0].title).toBe('Other')
	})

	it('saves and loads meeting data by ID', () => {
		const data: MeetingData = {
			lastDiscussed: { Alice: Date.now() },
			records: [{ personName: 'Alice', timestamp: Date.now(), summary: ['test'] }],
			snapshots: {},
		}
		saveMeetingData(data, 'board-1')
		const loaded = loadMeetingData('board-1')
		expect(loaded.records).toHaveLength(1)
	})

	it('clears board by ID', () => {
		saveBoard(makeBoardData(), 'board-1')
		saveMeetingData({ lastDiscussed: {}, records: [], snapshots: {} }, 'board-1')
		clearBoard('board-1')
		expect(loadBoard('board-1')).toBeNull()
	})
})

describe('deleteBoardEntry', () => {
	it('removes entry and storage', () => {
		const entry = createBoardEntry('Doomed')
		saveBoardRegistry([entry])
		saveBoard(makeBoardData(), entry.id)
		deleteBoardEntry(entry.id)
		expect(loadBoardRegistry()).toHaveLength(0)
		expect(loadBoard(entry.id)).toBeNull()
	})
})

describe('migrateToMultiBoard', () => {
	it('returns empty when no data exists', () => {
		const result = migrateToMultiBoard()
		expect(result.entries).toHaveLength(0)
		expect(result.activeId).toBeNull()
	})

	it('migrates legacy single-board to multi-board', () => {
		// Write legacy data
		saveBoard(makeBoardData())
		const result = migrateToMultiBoard()
		expect(result.entries).toHaveLength(1)
		expect(result.entries[0].name).toBe('My board')
		expect(result.activeId).toBe(result.entries[0].id)
		// Legacy key should be removed
		expect(localStorage.getItem('slim-board')).toBeNull()
		// New key should exist
		expect(loadBoard(result.entries[0].id)).not.toBeNull()
	})

	it('skips migration if registry already exists', () => {
		const entry = createBoardEntry('Existing')
		saveBoardRegistry([entry])
		setActiveBoardId(entry.id)
		const result = migrateToMultiBoard()
		expect(result.entries).toHaveLength(1)
		expect(result.entries[0].name).toBe('Existing')
	})
})
