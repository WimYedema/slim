import { describe, expect, it } from 'vitest'
import {
	buildMeetingAgenda,
	buildPersonSnapshot,
	collectPeople,
	completeMeeting,
	type MeetingData,
	personUrgency,
} from './meeting'
import {
	type CellSignal,
	createDeliverable,
	createOpportunity,
	type Deliverable,
	type Opportunity,
	type OpportunityDeliverableLink,
	type Score,
} from './types'

// ── Helpers ──

function makeSignal(score: Score): CellSignal {
	return { score, source: 'manual', verdict: '', evidence: '', owner: '' }
}

function makeOpp(overrides: Partial<Opportunity> = {}): Opportunity {
	const base = createOpportunity('Test')
	return { ...base, ...overrides }
}

function setStageScores(
	opp: Opportunity,
	stage: Opportunity['stage'],
	d: Score,
	f: Score,
	v: Score,
): Opportunity {
	return {
		...opp,
		signals: {
			...opp.signals,
			[stage]: {
				desirability: makeSignal(d),
				feasibility: makeSignal(f),
				viability: makeSignal(v),
			},
		},
	}
}

function emptyMeetingData(): MeetingData {
	return { lastDiscussed: {}, records: [], snapshots: {} }
}

// ── collectPeople ──

describe('collectPeople', () => {
	it('aggregates people from opportunity people and commitments', () => {
		const opp = makeOpp({
			people: [
				{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] },
				{ id: 'p2', name: 'Bob', role: 'stakeholder', perspectives: [] },
			],
			commitments: [{ id: 'c1', to: 'Carol', milestone: 'sketch', by: Date.now() }],
		})
		const people = collectPeople([opp], [])
		expect(people.size).toBe(3)
		expect(people.get('Alice')?.roles.has('expert')).toBe(true)
		expect(people.get('Carol')?.isCommitmentTarget).toBe(true)
	})

	it('aggregates people from deliverable extraContributors and extraConsumers', () => {
		const del = createDeliverable('Task')
		del.extraContributors = ['Dave']
		del.extraConsumers = ['Eve']
		const people = collectPeople([], [del])
		expect(people.size).toBe(2)
		expect(people.has('Dave')).toBe(true)
		expect(people.has('Eve')).toBe(true)
	})

	it('skips discontinued opportunities', () => {
		const opp = makeOpp({
			discontinuedAt: Date.now(),
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const people = collectPeople([opp], [])
		expect(people.size).toBe(0)
	})

	it('merges roles across multiple opportunities', () => {
		const opp1 = makeOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const opp2 = makeOpp({
			id: 'o2',
			people: [{ id: 'p2', name: 'Alice', role: 'stakeholder', perspectives: [] }],
		})
		const people = collectPeople([opp1, opp2], [])
		const alice = people.get('Alice')!
		expect(alice.roles.has('expert')).toBe(true)
		expect(alice.roles.has('stakeholder')).toBe(true)
		expect(alice.opportunityIds).toHaveLength(2)
	})
})

// ── personUrgency ──

describe('personUrgency', () => {
	it('returns zero urgency for a person with no links', () => {
		const result = personUrgency('Unknown', [])
		expect(result.overdueCommitments).toBe(0)
		expect(result.unscoredCells).toBe(0)
		expect(result.score).toBe(0)
	})

	it('counts overdue commitments', () => {
		const opp = makeOpp({
			stage: 'explore',
			commitments: [
				{ id: 'c1', to: 'Alice', milestone: 'sketch', by: Date.now() - 5 * 86_400_000 },
			],
		})
		const result = personUrgency('Alice', [opp])
		expect(result.overdueCommitments).toBe(1)
		expect(result.score).toBeLessThan(0)
	})

	it('counts unscored assigned cells', () => {
		const opp = makeOpp({
			stage: 'explore',
			people: [
				{
					id: 'p1',
					name: 'Bob',
					role: 'expert',
					perspectives: [
						{
							perspective: 'feasibility',
							stage: 'explore',
							assignedAt: Date.now() - 3 * 86_400_000,
						},
					],
				},
			],
		})
		const result = personUrgency('Bob', [opp])
		expect(result.unscoredCells).toBe(1)
		expect(result.oldestUnscoredDays).toBe(3)
	})

	it('does not count scored cells as unscored', () => {
		let opp = makeOpp({
			stage: 'explore',
			people: [
				{
					id: 'p1',
					name: 'Bob',
					role: 'expert',
					perspectives: [{ perspective: 'feasibility', stage: 'explore', assignedAt: Date.now() }],
				},
			],
		})
		opp = setStageScores(opp, 'explore', 'none', 'positive', 'none')
		const result = personUrgency('Bob', [opp])
		expect(result.unscoredCells).toBe(0)
	})

	it('is case-insensitive for name matching', () => {
		const opp = makeOpp({
			stage: 'explore',
			commitments: [{ id: 'c1', to: 'alice', milestone: 'sketch', by: Date.now() - 86_400_000 }],
		})
		const result = personUrgency('Alice', [opp])
		expect(result.overdueCommitments).toBe(1)
	})
})

// ── buildMeetingAgenda ──

describe('buildMeetingAgenda', () => {
	it('includes commitments made to the person', () => {
		const opp = makeOpp({
			stage: 'explore',
			commitments: [
				{ id: 'c1', to: 'Alice', milestone: 'sketch', by: Date.now() + 3 * 86_400_000 },
			],
		})
		const agenda = buildMeetingAgenda('Alice', [opp], [], [])
		expect(agenda.commitments).toHaveLength(1)
		expect(agenda.commitments[0].commitment.to).toBe('Alice')
	})

	it('includes unscored cells assigned to the person', () => {
		const opp = makeOpp({
			stage: 'explore',
			people: [
				{
					id: 'p1',
					name: 'Bob',
					role: 'expert',
					perspectives: [{ perspective: 'feasibility', stage: 'explore', assignedAt: Date.now() }],
				},
			],
		})
		const agenda = buildMeetingAgenda('Bob', [opp], [], [])
		expect(agenda.unscoredCells).toHaveLength(1)
		expect(agenda.unscoredCells[0].perspective).toBe('feasibility')
	})

	it('detects conflicts (positive vs negative at same stage)', () => {
		let opp = makeOpp({
			stage: 'explore',
			people: [
				{
					id: 'p1',
					name: 'Alice',
					role: 'expert',
					perspectives: [{ perspective: 'desirability', stage: 'explore', assignedAt: Date.now() }],
				},
			],
		})
		opp = setStageScores(opp, 'explore', 'positive', 'negative', 'none')
		const agenda = buildMeetingAgenda('Alice', [opp], [], [])
		expect(agenda.conflicts.length).toBeGreaterThanOrEqual(1)
	})

	it('includes deliverables the person contributes to', () => {
		const opp = makeOpp({ id: 'o1' })
		const del = createDeliverable('Task')
		del.extraContributors = ['Carol']
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: 'o1', deliverableId: del.id, coverage: 'full' },
		]
		const agenda = buildMeetingAgenda('Carol', [opp], [del], links)
		expect(agenda.deliverables).toHaveLength(1)
		expect(agenda.deliverables[0].role).toBe('contributor')
	})

	it('detects changes since last meeting', () => {
		const since = Date.now() - 86_400_000
		const opp = makeOpp({
			stage: 'explore',
			updatedAt: Date.now(),
			createdAt: since - 86_400_000,
			people: [
				{
					id: 'p1',
					name: 'Dave',
					role: 'expert',
					perspectives: [],
				},
			],
		})
		const agenda = buildMeetingAgenda('Dave', [opp], [], [], since)
		expect(agenda.changes.length).toBeGreaterThanOrEqual(1)
	})

	it('sorts commitments by urgency (most urgent first)', () => {
		const opp = makeOpp({
			stage: 'explore',
			commitments: [
				{ id: 'c1', to: 'Alice', milestone: 'sketch', by: Date.now() + 10 * 86_400_000 },
				{ id: 'c2', to: 'Alice', milestone: 'validate', by: Date.now() + 2 * 86_400_000 },
			],
		})
		const agenda = buildMeetingAgenda('Alice', [opp], [], [])
		expect(agenda.commitments[0].commitment.id).toBe('c2')
	})

	it('sets lastMet from since parameter', () => {
		const since = Date.now() - 86_400_000
		const agenda = buildMeetingAgenda('Nobody', [], [], [], since)
		expect(agenda.lastMet).toBe(since)
	})
})

// ── buildPersonSnapshot ──

describe('buildPersonSnapshot', () => {
	it('captures opportunity snapshots for linked people', () => {
		let opp = makeOpp({
			id: 'o1',
			stage: 'sketch',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		opp = setStageScores(opp, 'explore', 'positive', 'none', 'none')
		const snap = buildPersonSnapshot('Alice', [opp], [], [])
		expect(snap.opportunities['o1']).toBeDefined()
		expect(snap.opportunities['o1'].stage).toBe('sketch')
	})

	it('captures deliverable snapshots for contributors', () => {
		const del = createDeliverable('Task')
		del.extraContributors = ['Bob']
		del.size = 'M'
		del.certainty = 3
		const snap = buildPersonSnapshot('Bob', [], [del], [])
		expect(snap.deliverables[del.id]).toBeDefined()
		expect(snap.deliverables[del.id].size).toBe('M')
	})

	it('skips discontinued opportunities', () => {
		const opp = makeOpp({
			id: 'o1',
			discontinuedAt: Date.now(),
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const snap = buildPersonSnapshot('Alice', [opp], [], [])
		expect(snap.opportunities['o1']).toBeUndefined()
	})
})

// ── completeMeeting ──

describe('completeMeeting', () => {
	it('records the meeting and updates lastDiscussed', () => {
		const opp = makeOpp({
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const agenda = buildMeetingAgenda('Alice', [opp], [], [])
		const data = emptyMeetingData()
		const result = completeMeeting('Alice', agenda, data, [opp], [], [])
		expect(result.lastDiscussed['Alice']).toBeGreaterThan(0)
		expect(result.records).toHaveLength(1)
		expect(result.records[0].personName).toBe('Alice')
	})

	it('creates a snapshot for the person', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Bob', role: 'expert', perspectives: [] }],
		})
		const agenda = buildMeetingAgenda('Bob', [opp], [], [])
		const data = emptyMeetingData()
		const result = completeMeeting('Bob', agenda, data, [opp], [], [])
		expect(result.snapshots['Bob']).toBeDefined()
		expect(result.snapshots['Bob'].opportunities['o1']).toBeDefined()
	})

	it('preserves existing meeting records', () => {
		const data: MeetingData = {
			lastDiscussed: { Old: Date.now() - 86_400_000 },
			records: [{ personName: 'Old', timestamp: Date.now() - 86_400_000, summary: ['test'] }],
			snapshots: {},
		}
		const agenda = buildMeetingAgenda('New', [], [], [])
		const result = completeMeeting('New', agenda, data, [], [], [])
		expect(result.records).toHaveLength(2)
		expect(result.lastDiscussed['Old']).toBeDefined()
		expect(result.lastDiscussed['New']).toBeDefined()
	})

	it('scoped: only snapshots discussed entities', () => {
		const opp1 = makeOpp({
			id: 'o1',
			title: 'Discussed',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const opp2 = makeOpp({
			id: 'o2',
			title: 'Skipped',
			people: [{ id: 'p2', name: 'Alice', role: 'stakeholder', perspectives: [] }],
		})
		const agenda = buildMeetingAgenda('Alice', [opp1, opp2], [], [])
		const data = emptyMeetingData()

		const discussed = new Set(['o1'])
		const result = completeMeeting('Alice', agenda, data, [opp1, opp2], [], [], discussed)

		expect(result.snapshots['Alice'].opportunities['o1']).toBeDefined()
		expect(result.snapshots['Alice'].opportunities['o2']).toBeUndefined()
	})

	it('scoped: preserves existing snapshots for undiscussed entities', () => {
		const opp1 = makeOpp({
			id: 'o1',
			title: 'Will discuss',
			stage: 'sketch',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const opp2 = makeOpp({
			id: 'o2',
			title: 'Will skip',
			stage: 'explore',
			people: [{ id: 'p2', name: 'Alice', role: 'stakeholder', perspectives: [] }],
		})

		// First meeting: full stamp
		const agenda1 = buildMeetingAgenda('Alice', [opp1, opp2], [], [])
		const data = emptyMeetingData()
		const after1 = completeMeeting('Alice', agenda1, data, [opp1, opp2], [], [])
		expect(after1.snapshots['Alice'].opportunities['o2'].stage).toBe('explore')

		// opp2 changes stage — but we only discuss opp1
		const opp2changed = { ...opp2, stage: 'sketch' as const }
		const agenda2 = buildMeetingAgenda('Alice', [opp1, opp2changed], [], [])
		const after2 = completeMeeting(
			'Alice', agenda2, after1, [opp1, opp2changed], [], [], new Set(['o1']),
		)

		// opp1 was updated, opp2 keeps old snapshot
		expect(after2.snapshots['Alice'].opportunities['o1']).toBeDefined()
		expect(after2.snapshots['Alice'].opportunities['o2'].stage).toBe('explore')
	})

	it('scoped: summary only counts in-scope items', () => {
		const opp1 = makeOpp({
			id: 'o1',
			stage: 'explore',
			people: [
				{
					id: 'p1',
					name: 'Alice',
					role: 'expert',
					perspectives: [
						{ perspective: 'feasibility', stage: 'explore', assignedAt: Date.now() },
					],
				},
			],
			commitments: [
				{ id: 'c1', to: 'Alice', milestone: 'sketch', by: Date.now() + 86_400_000 },
			],
		})
		const opp2 = makeOpp({
			id: 'o2',
			stage: 'explore',
			people: [
				{
					id: 'p2',
					name: 'Alice',
					role: 'expert',
					perspectives: [
						{ perspective: 'desirability', stage: 'explore', assignedAt: Date.now() },
					],
				},
			],
		})
		const agenda = buildMeetingAgenda('Alice', [opp1, opp2], [], [])
		// Only discuss opp1
		const result = completeMeeting(
			'Alice', agenda, emptyMeetingData(), [opp1, opp2], [], [], new Set(['o1']),
		)
		const summary = result.records[0].summary.join(', ')
		expect(summary).toContain('1 cells to score')
		expect(summary).toContain('1 commitments reviewed')
	})

	it('scoped: empty discussedEntityIds yields "No items" summary', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const agenda = buildMeetingAgenda('Alice', [opp], [], [])
		const result = completeMeeting(
			'Alice', agenda, emptyMeetingData(), [opp], [], [], new Set<string>(),
		)
		expect(result.records[0].summary).toEqual(['No items'])
	})
})

// ── Enriched diff detection via buildMeetingAgenda ──

describe('buildMeetingAgenda — snapshot diff detection', () => {
	function makeMeetingDataWithSnapshot(
		personName: string,
		opps: Opportunity[],
		dels: Deliverable[],
		links: OpportunityDeliverableLink[],
	): { data: MeetingData; since: number } {
		const since = Date.now() - 86_400_000
		const snap = buildPersonSnapshot(personName, opps, dels, links)
		return {
			data: {
				lastDiscussed: { [personName]: since },
				records: [],
				snapshots: { [personName]: snap },
			},
			since,
		}
	}

	/** Create an opp with createdAt safely before "since" so it doesn't hit the "New opportunity" branch */
	function oldOpp(overrides: Partial<Opportunity> = {}): Opportunity {
		return makeOpp({ createdAt: Date.now() - 5 * 86_400_000, ...overrides })
	}

	it('detects opportunity title rename', () => {
		const opp = oldOpp({
			id: 'o1',
			title: 'Old Title',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const changed = { ...opp, title: 'New Title', updatedAt: Date.now() }
		const agenda = buildMeetingAgenda('Alice', [changed], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('Renamed'))
	})

	it('detects opportunity stage change', () => {
		const opp = oldOpp({
			id: 'o1',
			stage: 'explore',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const changed = { ...opp, stage: 'sketch' as const, updatedAt: Date.now() }
		const agenda = buildMeetingAgenda('Alice', [changed], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('Stage'))
	})

	it('detects opportunity horizon change', () => {
		const opp = oldOpp({
			id: 'o1',
			horizon: '2025Q3',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const changed = { ...opp, horizon: '2025Q4', updatedAt: Date.now() }
		const agenda = buildMeetingAgenda('Alice', [changed], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('Horizon'))
	})

	it('detects opportunity people count change', () => {
		const opp = oldOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const changed = {
			...opp,
			people: [
				...opp.people,
				{ id: 'p2', name: 'Bob', role: 'stakeholder' as const, perspectives: [] },
			],
			updatedAt: Date.now(),
		}
		const agenda = buildMeetingAgenda('Alice', [changed], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('People'))
	})

	it('detects opportunity score change', () => {
		let opp = oldOpp({
			id: 'o1',
			stage: 'explore',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		opp = setStageScores(opp, 'explore', 'positive', 'none', 'none')
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const changed = setStageScores(opp, 'explore', 'negative', 'none', 'none')
		;(changed as Opportunity & { updatedAt: number }).updatedAt = Date.now()
		const agenda = buildMeetingAgenda('Alice', [changed], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('desirability@explore'))
	})

	it('detects deliverable size change', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const del = createDeliverable('Task')
		del.size = 'S'
		del.extraContributors = ['Alice']
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: 'o1', deliverableId: del.id, coverage: 'full' },
		]
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [del], links)

		const changedDel = { ...del, size: 'L' as const, updatedAt: Date.now() }
		const agenda = buildMeetingAgenda(
			'Alice', [opp], [changedDel], links, since, data.snapshots['Alice'],
		)
		const descs = agenda.changes.filter((c) => c.entityType === 'deliverable').map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('Size'))
	})

	it('detects deliverable certainty change', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const del = createDeliverable('Task')
		del.certainty = 2
		del.extraContributors = ['Alice']
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: 'o1', deliverableId: del.id, coverage: 'full' },
		]
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [del], links)

		const changedDel = { ...del, certainty: 4 as const, updatedAt: Date.now() }
		const agenda = buildMeetingAgenda(
			'Alice', [opp], [changedDel], links, since, data.snapshots['Alice'],
		)
		const descs = agenda.changes.filter((c) => c.entityType === 'deliverable').map((c) => c.description)
		expect(descs).toContainEqual(expect.stringContaining('Certainty'))
	})

	it('shows "New to agenda" for entity without prior snapshot', () => {
		const since = Date.now() - 86_400_000
		const opp = makeOpp({
			id: 'o1',
			title: 'Brand New',
			createdAt: since - 2 * 86_400_000, // Not new by createdAt
			updatedAt: Date.now(), // But updated recently
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		// Snapshot exists but does NOT contain o1
		const snapshot = { opportunities: {}, deliverables: {} }
		const agenda = buildMeetingAgenda('Alice', [opp], [], [], since, snapshot)
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContain('New to agenda')
	})

	it('shows "Description or notes edited" when updatedAt changed but no diff fields changed', () => {
		const opp = oldOpp({
			id: 'o1',
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		// Same fields, but updatedAt is newer — triggers changedByTime
		const same = { ...opp, updatedAt: Date.now() }
		const agenda = buildMeetingAgenda('Alice', [same], [], [], since, data.snapshots['Alice'])
		const descs = agenda.changes.map((c) => c.description)
		expect(descs).toContain('Description or notes edited')
	})

	it('no changes surfaced when nothing changed', () => {
		const opp = makeOpp({
			id: 'o1',
			updatedAt: Date.now() - 2 * 86_400_000, // older than since
			people: [{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] }],
		})
		const { data, since } = makeMeetingDataWithSnapshot('Alice', [opp], [], [])

		const agenda = buildMeetingAgenda('Alice', [opp], [], [], since, data.snapshots['Alice'])
		expect(agenda.changes).toHaveLength(0)
	})
})
