import { beforeEach, describe, expect, it } from 'vitest'
import {
	type BoardSnapshot,
	type BriefingItem,
	deduplicateItems,
	diffBoard,
	groupItems,
	isGrouped,
	snapshotBoard,
} from './briefing'
import type { MeetingData } from './meeting'
import type { BoardData } from './store'
import {
	createDeliverable,
	createOpportunity,
	currentQuarter,
	type Deliverable,
	defaultHorizon,
	type Opportunity,
	type OpportunityDeliverableLink,
} from './types'

function makeBoard(
	opportunities: Opportunity[] = [],
	deliverables: Deliverable[] = [],
	links: OpportunityDeliverableLink[] = [],
): BoardData {
	return { opportunities, deliverables, links }
}

describe('briefing', () => {
	describe('snapshotBoard', () => {
		it('creates a deep copy with timestamp', () => {
			const opp = createOpportunity('Test')
			const board = makeBoard([opp])
			const snap = snapshotBoard(board)

			expect(snap.opportunities).toHaveLength(1)
			expect(snap.opportunities[0].title).toBe('Test')
			expect(snap.takenAt).toBeGreaterThan(0)

			// Verify deep copy
			opp.title = 'Modified'
			expect(snap.opportunities[0].title).toBe('Test')
		})
	})

	describe('diffBoard — no snapshot', () => {
		it('returns current-state warnings for overdue commitments', () => {
			const opp = createOpportunity('Overdue thing')
			opp.commitments = [
				{
					id: crypto.randomUUID(),
					to: 'Boss',
					by: Date.now() - 2 * 86400000, // 2 days ago
					milestone: 'sketch',
				},
			]
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const overdue = items.find((i) => i.verb === 'commitment-overdue')
			expect(overdue).toBeDefined()
			expect(overdue!.targetTitle).toBe('Overdue thing')
			expect(overdue!.tier).toBe(1)
		})

		it('returns stale warnings', () => {
			const opp = createOpportunity('Stale thing')
			opp.stageEnteredAt = Date.now() - 31 * 86400000 // 31 days ago
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const stale = items.find((i) => i.verb === 'stale')
			expect(stale).toBeDefined()
			expect(stale!.tier).toBe(1)
		})

		it('returns revisit-due for parked opps with current parkUntil', () => {
			const opp = createOpportunity('Parked revisit')
			opp.exitState = 'parked'
			opp.discontinuedAt = Date.now() - 90 * 86400000
			opp.parkUntil = currentQuarter() // current quarter = not future
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const revisit = items.find((i) => i.verb === 'revisit-due')
			expect(revisit).toBeDefined()
			expect(revisit!.tier).toBe(1)
			expect(revisit!.targetTitle).toBe('Parked revisit')
		})

		it('does not return revisit-due for parked opps with future parkUntil', () => {
			const opp = createOpportunity('Parked future')
			opp.exitState = 'parked'
			opp.discontinuedAt = Date.now() - 90 * 86400000
			opp.parkUntil = defaultHorizon() // next quarter = future
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const revisit = items.find((i) => i.verb === 'revisit-due')
			expect(revisit).toBeUndefined()
		})
	})

	describe('diffBoard — with snapshot', () => {
		let snap: BoardSnapshot

		beforeEach(() => {
			snap = {
				opportunities: [],
				deliverables: [],
				links: [],
				takenAt: Date.now() - 3600000,
			}
		})

		it('detects new opportunities', () => {
			const opp = createOpportunity('Brand new')
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const added = items.find((i) => i.verb === 'added')
			expect(added).toBeDefined()
			expect(added!.targetTitle).toBe('Brand new')
			expect(added!.tier).toBe(2)
		})

		it('detects removed opportunities', () => {
			const opp = createOpportunity('Gone')
			snap.opportunities = [structuredClone(opp)]
			const board = makeBoard([])
			const items = diffBoard(snap, board)

			const removed = items.find((i) => i.verb === 'removed')
			expect(removed).toBeDefined()
			expect(removed!.targetTitle).toBe('Gone')
			expect(removed!.tier).toBe(3)
		})

		it('detects stage changes', () => {
			const opp = createOpportunity('Moving forward')
			const oldOpp = structuredClone(opp)
			oldOpp.stage = 'explore'
			snap.opportunities = [oldOpp]
			opp.stage = 'sketch'
			opp.stageEnteredAt = Date.now()
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const stageChange = items.find((i) => i.verb === 'stage-changed')
			expect(stageChange).toBeDefined()
			expect(stageChange!.description).toContain('Advanced to Sketch')
			expect(stageChange!.detail).toMatch(/Explore.*Sketch/)
			expect(stageChange!.tier).toBe(2)
		})

		it('detects objection added', () => {
			const opp = createOpportunity('Blocked')
			const oldOpp = structuredClone(opp)
			snap.opportunities = [oldOpp]
			opp.signals.explore.feasibility.score = 'negative'
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const objection = items.find((i) => i.verb === 'objection-added')
			expect(objection).toBeDefined()
			expect(objection!.tier).toBe(1)
			expect(objection!.description).toContain('Technical')
		})

		it('detects objection resolved', () => {
			const opp = createOpportunity('Unblocked')
			const oldOpp = structuredClone(opp)
			oldOpp.signals.explore.feasibility.score = 'negative'
			snap.opportunities = [oldOpp]
			opp.signals.explore.feasibility.score = 'positive'
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const resolved = items.find((i) => i.verb === 'objection-resolved')
			expect(resolved).toBeDefined()
			expect(resolved!.tier).toBe(2)
		})

		it('detects signal changes', () => {
			const opp = createOpportunity('Scored')
			const oldOpp = structuredClone(opp)
			snap.opportunities = [oldOpp]
			opp.signals.explore.desirability.score = 'positive'
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const signalChange = items.find((i) => i.verb === 'signal-changed')
			expect(signalChange).toBeDefined()
			expect(signalChange!.tier).toBe(2)
		})

		it('detects exit', () => {
			const opp = createOpportunity('Killed')
			const oldOpp = structuredClone(opp)
			snap.opportunities = [oldOpp]
			opp.discontinuedAt = Date.now()
			opp.exitState = 'killed'
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const exited = items.find((i) => i.verb === 'exited')
			expect(exited).toBeDefined()
			expect(exited!.tier).toBe(1)
		})

		it('detects reactivation', () => {
			const opp = createOpportunity('Back')
			const oldOpp = structuredClone(opp)
			oldOpp.discontinuedAt = Date.now() - 86400000
			snap.opportunities = [oldOpp]
			// opp has no discontinuedAt (reactivated)
			const board = makeBoard([opp])
			const items = diffBoard(snap, board)

			const reactivated = items.find((i) => i.verb === 'reactivated')
			expect(reactivated).toBeDefined()
			expect(reactivated!.tier).toBe(2)
		})

		it('detects new deliverables', () => {
			const del = createDeliverable('New work')
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const added = items.find((i) => i.verb === 'deliverable-added')
			expect(added).toBeDefined()
			expect(added!.targetTitle).toBe('New work')
			expect(added!.tier).toBe(2)
		})

		it('detects removed deliverables', () => {
			const del = createDeliverable('Old work')
			snap.deliverables = [structuredClone(del)]
			const board = makeBoard([], [])
			const items = diffBoard(snap, board)

			const removed = items.find((i) => i.verb === 'deliverable-removed')
			expect(removed).toBeDefined()
			expect(removed!.tier).toBe(3)
		})

		it('detects link additions', () => {
			const opp = createOpportunity('Connected')
			const del = createDeliverable('Work')
			const oldOpp = structuredClone(opp)
			snap.opportunities = [oldOpp]
			snap.deliverables = [structuredClone(del)]
			const link = { opportunityId: opp.id, deliverableId: del.id, coverage: 'full' as const }
			const board = makeBoard([opp], [del], [link])
			const items = diffBoard(snap, board)

			const linkAdded = items.find((i) => i.verb === 'link-added')
			expect(linkAdded).toBeDefined()
			expect(linkAdded!.tier).toBe(3)
		})

		it('sorts by tier then timestamp', () => {
			const opp1 = createOpportunity('Urgent')
			opp1.signals.explore.feasibility.score = 'negative' // objection = tier 1
			const opp2 = createOpportunity('New item') // added = tier 2

			snap.opportunities = [structuredClone(opp1)]
			// opp1 gets objection, opp2 is new
			const board = makeBoard([opp1, opp2])
			const items = diffBoard(snap, board)

			// Tier 1 items should come before tier 2
			const tier1Idx = items.findIndex((i) => i.tier === 1)
			const tier2Idx = items.findIndex((i) => i.tier === 2)
			if (tier1Idx >= 0 && tier2Idx >= 0) {
				expect(tier1Idx).toBeLessThan(tier2Idx)
			}
		})
	})

	describe('deduplicateItems', () => {
		it('keeps signal-changed items with different descriptions (different perspectives)', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'opp-1',
					targetTitle: 'Test',
					verb: 'signal-changed',
					description: 'D signal',
					tier: 2,
					timestamp: Date.now(),
				},
				{
					id: '2',
					targetType: 'opportunity',
					targetId: 'opp-1',
					targetTitle: 'Test',
					verb: 'signal-changed',
					description: 'F signal',
					tier: 2,
					timestamp: Date.now(),
				},
			]
			const deduped = deduplicateItems(items)
			expect(deduped).toHaveLength(2)
		})

		it('keeps items with different verbs for same target', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'opp-1',
					targetTitle: 'Test',
					verb: 'signal-changed',
					description: 'Signal',
					tier: 2,
					timestamp: Date.now(),
				},
				{
					id: '2',
					targetType: 'opportunity',
					targetId: 'opp-1',
					targetTitle: 'Test',
					verb: 'stage-changed',
					description: 'Stage',
					tier: 2,
					timestamp: Date.now(),
				},
			]
			const deduped = deduplicateItems(items)
			expect(deduped).toHaveLength(2)
		})
	})

	describe('people/meeting awareness', () => {
		it('detects unscored assignments as tier 1', () => {
			const opp = createOpportunity('SSO')
			opp.stage = 'validate'
			opp.people = [
				{
					id: 'p1',
					name: 'Sarah',
					role: 'expert',
					perspectives: [
						{
							perspective: 'feasibility',
							stage: 'validate',
							assignedAt: Date.now() - 3 * 86400000,
						},
					],
				},
			]
			// validate.feasibility is still 'none' (unscored)
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const unscored = items.find((i) => i.verb === 'unscored-assignment')
			expect(unscored).toBeDefined()
			expect(unscored!.tier).toBe(1)
			expect(unscored!.description).toContain('Sarah')
			expect(unscored!.description).toContain('Technical')
			expect(unscored!.description).toContain('Validate')
		})

		it('does not flag scored assignments', () => {
			const opp = createOpportunity('SSO')
			opp.stage = 'validate'
			opp.people = [
				{
					id: 'p1',
					name: 'Sarah',
					role: 'expert',
					perspectives: [
						{
							perspective: 'feasibility',
							stage: 'validate',
							assignedAt: Date.now() - 3 * 86400000,
						},
					],
				},
			]
			opp.signals.validate.feasibility = {
				score: 'positive',
				source: 'manual',
				verdict: 'OK',
				evidence: '',
				owner: 'Sarah',
			}
			const board = makeBoard([opp])
			const items = diffBoard(null, board)

			const unscored = items.find((i) => i.verb === 'unscored-assignment')
			expect(unscored).toBeUndefined()
		})

		it('detects meeting overdue as tier 2', () => {
			const opp = createOpportunity('SSO')
			opp.people = [
				{
					id: 'p1',
					name: 'Carol',
					role: 'expert',
					perspectives: [
						{
							perspective: 'desirability',
							stage: 'explore',
							assignedAt: Date.now() - 20 * 86400000,
						},
					],
				},
			]
			opp.signals.explore.desirability = {
				score: 'positive',
				source: 'manual',
				verdict: 'OK',
				evidence: '',
				owner: 'Carol',
			}
			const meetingData: MeetingData = {
				lastDiscussed: { Carol: Date.now() - 12 * 86400000 },
				records: [],
				snapshots: {},
			}
			const board = makeBoard([opp])
			const items = diffBoard(null, board, meetingData)

			const overdue = items.find((i) => i.verb === 'meeting-overdue')
			expect(overdue).toBeDefined()
			expect(overdue!.tier).toBe(2)
			expect(overdue!.targetTitle).toBe('Carol')
			expect(overdue!.description).toContain('12d ago')
		})

		it('does not flag recently met people', () => {
			const opp = createOpportunity('SSO')
			opp.people = [
				{
					id: 'p1',
					name: 'Alice',
					role: 'expert',
					perspectives: [
						{ perspective: 'feasibility', stage: 'explore', assignedAt: Date.now() - 5 * 86400000 },
					],
				},
			]
			opp.signals.explore.feasibility = {
				score: 'positive',
				source: 'manual',
				verdict: 'OK',
				evidence: '',
				owner: 'Alice',
			}
			const meetingData: MeetingData = {
				lastDiscussed: { Alice: Date.now() - 5 * 86400000 },
				records: [],
				snapshots: {},
			}
			const board = makeBoard([opp])
			const items = diffBoard(null, board, meetingData)

			const overdue = items.find((i) => i.verb === 'meeting-overdue')
			expect(overdue).toBeUndefined()
		})

		it('does not flag never-met people', () => {
			const opp = createOpportunity('SSO')
			opp.people = [
				{
					id: 'p1',
					name: 'NewPerson',
					role: 'expert',
					perspectives: [
						{ perspective: 'feasibility', stage: 'explore', assignedAt: Date.now() - 1 * 86400000 },
					],
				},
			]
			const meetingData: MeetingData = {
				lastDiscussed: {},
				records: [],
				snapshots: {},
			}
			const board = makeBoard([opp])
			const items = diffBoard(null, board, meetingData)

			const overdue = items.find((i) => i.verb === 'meeting-overdue')
			expect(overdue).toBeUndefined()
		})
	})

	describe('deliverable field diffs', () => {
		let snap: BoardSnapshot

		beforeEach(() => {
			snap = {
				opportunities: [],
				deliverables: [],
				links: [],
				takenAt: Date.now() - 3600000,
			}
		})

		it('detects size changes', () => {
			const del = createDeliverable('Work')
			const oldDel = structuredClone(del)
			oldDel.size = 'S'
			del.size = 'L'
			snap.deliverables = [oldDel]
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const changed = items.find((i) => i.verb === 'deliverable-changed')
			expect(changed).toBeDefined()
			expect(changed!.description).toContain('size')
			expect(changed!.description).toContain('L')
		})

		it('detects certainty changes', () => {
			const del = createDeliverable('Work')
			const oldDel = structuredClone(del)
			oldDel.certainty = 2
			del.certainty = 4
			snap.deliverables = [oldDel]
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const changed = items.find((i) => i.verb === 'deliverable-changed')
			expect(changed).toBeDefined()
			expect(changed!.description).toContain('certainty')
			expect(changed!.description).toContain('4')
		})

		it('detects contributor additions', () => {
			const del = createDeliverable('Work')
			const oldDel = structuredClone(del)
			oldDel.extraContributors = ['Alice']
			del.extraContributors = ['Alice', 'Bob']
			snap.deliverables = [oldDel]
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const changed = items.find((i) => i.verb === 'deliverable-changed')
			expect(changed).toBeDefined()
			expect(changed!.description).toContain('+Bob')
		})

		it('detects external dependency changes', () => {
			const del = createDeliverable('Work')
			const oldDel = structuredClone(del)
			del.externalDependency = 'Waiting on Acme API'
			snap.deliverables = [oldDel]
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const changed = items.find((i) => i.verb === 'deliverable-changed')
			expect(changed).toBeDefined()
			expect(changed!.description).toContain('external dependency')
		})

		it('ignores unchanged deliverables', () => {
			const del = createDeliverable('Work')
			del.size = 'M'
			del.certainty = 3
			snap.deliverables = [structuredClone(del)]
			const board = makeBoard([], [del])
			const items = diffBoard(snap, board)

			const changed = items.find((i) => i.verb === 'deliverable-changed')
			expect(changed).toBeUndefined()
		})
	})

	describe('groupItems', () => {
		it('groups multiple added opportunities with same description', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'a',
					targetTitle: 'Dark mode',
					verb: 'added',
					description: 'New opportunity in Sketch',
					tier: 2,
					timestamp: 100,
				},
				{
					id: '2',
					targetType: 'opportunity',
					targetId: 'b',
					targetTitle: 'AI reports',
					verb: 'added',
					description: 'New opportunity in Sketch',
					tier: 2,
					timestamp: 200,
				},
				{
					id: '3',
					targetType: 'opportunity',
					targetId: 'c',
					targetTitle: 'Multi-lang',
					verb: 'added',
					description: 'New opportunity in Sketch',
					tier: 2,
					timestamp: 150,
				},
			]
			const result = groupItems(items)
			expect(result).toHaveLength(1)
			expect(isGrouped(result[0])).toBe(true)
			if (isGrouped(result[0])) {
				expect(result[0].targets).toHaveLength(3)
				expect(result[0].description).toBe('New opportunity in Sketch')
			}
		})

		it('does not group single items', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'a',
					targetTitle: 'SSO',
					verb: 'added',
					description: 'New opportunity in Validate',
					tier: 2,
					timestamp: 100,
				},
			]
			const result = groupItems(items)
			expect(result).toHaveLength(1)
			expect(isGrouped(result[0])).toBe(false)
		})

		it('does not group non-groupable verbs', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'a',
					targetTitle: 'SSO',
					verb: 'stale',
					description: 'Stuck in Explore for 22d',
					tier: 1,
					timestamp: 100,
				},
				{
					id: '2',
					targetType: 'opportunity',
					targetId: 'b',
					targetTitle: 'CSV',
					verb: 'stale',
					description: 'Stuck in Explore for 22d',
					tier: 1,
					timestamp: 200,
				},
			]
			const result = groupItems(items)
			expect(result).toHaveLength(2)
			expect(result.every((i) => !isGrouped(i))).toBe(true)
		})

		it('preserves tier sorting after grouping', () => {
			const items: BriefingItem[] = [
				{
					id: '1',
					targetType: 'opportunity',
					targetId: 'a',
					targetTitle: 'SSO',
					verb: 'commitment-overdue',
					description: 'overdue',
					tier: 1,
					timestamp: 100,
				},
				{
					id: '2',
					targetType: 'opportunity',
					targetId: 'b',
					targetTitle: 'Dark mode',
					verb: 'added',
					description: 'New opportunity in Sketch',
					tier: 2,
					timestamp: 200,
				},
				{
					id: '3',
					targetType: 'opportunity',
					targetId: 'c',
					targetTitle: 'AI reports',
					verb: 'added',
					description: 'New opportunity in Sketch',
					tier: 2,
					timestamp: 150,
				},
			]
			const result = groupItems(items)
			expect(result[0].tier).toBe(1) // tier 1 first
			expect(result[1].tier).toBe(2) // grouped tier 2 second
		})
	})
})

// ── WIP warnings ──

describe('WIP warnings in diffBoard', () => {
	it('surfaces wip-over when a stage exceeds its ceiling', () => {
		// Create 16 explore opportunities (ceiling is 15)
		const opps = Array.from({ length: 16 }, (_, i) => createOpportunity(`Opp ${i}`))
		const current = { opportunities: opps, deliverables: [], links: [], customHorizons: [] }
		const items = diffBoard(null, current)
		const wipItems = items.filter((i) => i.verb === 'wip-over')
		expect(wipItems.length).toBeGreaterThanOrEqual(1)
		expect(wipItems[0].description).toContain('crowded')
	})

	it('surfaces wip-under when explore has too few items', () => {
		// Create only 1 explore opportunity (floor is 3)
		const opp = createOpportunity('Lonely')
		const current = { opportunities: [opp], deliverables: [], links: [], customHorizons: [] }
		const items = diffBoard(null, current)
		const wipItems = items.filter((i) => i.verb === 'wip-under')
		expect(wipItems.some((i) => i.targetTitle === 'Explore')).toBe(true)
	})

	it('does not surface WIP warnings for healthy counts', () => {
		const opps = Array.from({ length: 5 }, (_, i) => createOpportunity(`Opp ${i}`))
		const current = { opportunities: opps, deliverables: [], links: [], customHorizons: [] }
		const items = diffBoard(null, current)
		const wipItems = items.filter((i) => i.verb === 'wip-over' || i.verb === 'wip-under')
		// Explore has 5 (healthy), but other stages have 0 (under floor)
		const exploreWip = wipItems.filter((i) => i.targetTitle === 'Explore')
		expect(exploreWip).toHaveLength(0)
	})

	describe('pulled score scenario (P2P sync)', () => {
		it('shows signal-changed with owner name when score goes from none to positive', () => {
			const opp = createOpportunity('SSO')
			const snap = snapshotBoard(makeBoard([opp]))

			// Simulate pulled score: Marcus scored feasibility positive
			const updated = structuredClone(opp)
			updated.signals.explore.feasibility = {
				score: 'positive',
				source: 'manual',
				verdict: 'Looks good technically',
				evidence: '',
				owner: 'Marcus',
			}
			updated.updatedAt = Date.now()
			const board = makeBoard([updated])
			const items = diffBoard(snap, board)

			const signalItem = items.find((i) => i.verb === 'signal-changed')
			expect(signalItem).toBeDefined()
			expect(signalItem!.description).toContain('Marcus')
			expect(signalItem!.description).toContain('verdict in')
			expect(signalItem!.tier).toBe(2)
		})

		it('shows objection-added with owner name when score goes to negative', () => {
			const opp = createOpportunity('SSO')
			const snap = snapshotBoard(makeBoard([opp]))

			const updated = structuredClone(opp)
			updated.signals.explore.desirability = {
				score: 'negative',
				source: 'manual',
				verdict: 'No market demand',
				evidence: '',
				owner: 'Marcus',
			}
			updated.updatedAt = Date.now()
			const board = makeBoard([updated])
			const items = diffBoard(snap, board)

			const objection = items.find((i) => i.verb === 'objection-added')
			expect(objection).toBeDefined()
			expect(objection!.description).toContain('Marcus')
			expect(objection!.tier).toBe(1)
		})

		it('suppresses stale warning when opportunity has fresh signal activity', () => {
			const opp = createOpportunity('Stale but scored')
			opp.stageEnteredAt = Date.now() - 31 * 86400000 // stale
			const snap = snapshotBoard(makeBoard([opp]))

			const updated = structuredClone(opp)
			updated.signals.explore.feasibility = {
				score: 'positive',
				source: 'manual',
				verdict: 'OK',
				evidence: '',
				owner: 'Marcus',
			}
			updated.updatedAt = Date.now()
			const board = makeBoard([updated])
			const items = diffBoard(snap, board)

			const stale = items.find((i) => i.verb === 'stale')
			expect(stale).toBeUndefined()
			const signal = items.find((i) => i.verb === 'signal-changed')
			expect(signal).toBeDefined()
		})

		it('keeps stale warning when no signal activity', () => {
			const opp = createOpportunity('Just stale')
			const snap = snapshotBoard(makeBoard([opp]))

			const updated = structuredClone(opp)
			updated.stageEnteredAt = Date.now() - 31 * 86400000
			const board = makeBoard([updated])
			const items = diffBoard(snap, board)

			const stale = items.find((i) => i.verb === 'stale')
			expect(stale).toBeDefined()
		})

		it('shows multiple signal-changed items for different perspectives before dedup', () => {
			const opp = createOpportunity('Multi-score')
			const snap = snapshotBoard(makeBoard([opp]))

			const updated = structuredClone(opp)
			updated.signals.explore.feasibility = {
				score: 'positive',
				source: 'manual',
				verdict: 'OK',
				evidence: '',
				owner: 'Marcus',
			}
			updated.signals.explore.desirability = {
				score: 'positive',
				source: 'manual',
				verdict: 'Yes!',
				evidence: '',
				owner: 'Sarah',
			}
			updated.updatedAt = Date.now()
			const board = makeBoard([updated])
			const rawItems = diffBoard(snap, board)

			// Before dedup, both signal-changed items should exist
			const signals = rawItems.filter((i) => i.verb === 'signal-changed')
			expect(signals).toHaveLength(2)
			expect(signals.some((i) => i.description.includes('Marcus'))).toBe(true)
			expect(signals.some((i) => i.description.includes('Sarah'))).toBe(true)

			// After dedup, both survive (each perspective is distinct)
			const deduped = deduplicateItems(rawItems)
			const dedupedSignals = deduped.filter((i) => i.verb === 'signal-changed')
			expect(dedupedSignals).toHaveLength(2)
		})
	})
})
