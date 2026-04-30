import { beforeEach, describe, expect, it } from 'vitest'
import type { MeetingData } from './meeting'
import {
	type BoardData,
	clearBoard,
	loadBoard,
	loadMeetingData,
	saveBoard,
	saveMeetingData,
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
		expect(loaded!.opportunities).toHaveLength(1)
		expect(loaded!.opportunities[0].title).toBe('Test')
		expect(loaded!.deliverables).toHaveLength(1)
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
		expect(loaded!.opportunities[0].horizon).toBeTruthy()
		expect(loaded!.opportunities[0].horizon).toMatch(/^\d{4}Q[1-4]$/)
	})

	it('backfills missing stageEnteredAt from updatedAt', () => {
		const data = makeBoardData()
		const raw = JSON.parse(JSON.stringify(data))
		delete raw.opportunities[0].stageEnteredAt
		raw.opportunities[0].updatedAt = 1700000000000
		localStorage.setItem('slim-board', JSON.stringify(raw))

		const loaded = loadBoard()
		expect(loaded!.opportunities[0].stageEnteredAt).toBe(1700000000000)
	})

	it('preserves customHorizons', () => {
		const data: BoardData = { ...makeBoardData(), customHorizons: ['2027Q1', '2027Q2'] }
		saveBoard(data)
		const loaded = loadBoard()
		expect(loaded!.customHorizons).toEqual(['2027Q1', '2027Q2'])
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
		expect(loaded.lastDiscussed['Alice']).toBeDefined()
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
