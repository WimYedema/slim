import { describe, expect, it } from 'vitest'
import { formatMergeStats, mergeBoards } from './merge'
import type { BoardData } from './store'
import type { OpportunityDeliverableLink } from './types'
import { createDeliverable, createOpportunity } from './types'

function board(
	opps = [] as ReturnType<typeof createOpportunity>[],
	dels = [] as ReturnType<typeof createDeliverable>[],
	links = [] as OpportunityDeliverableLink[],
): BoardData {
	return { opportunities: opps, deliverables: dels, links }
}

describe('mergeBoards', () => {
	it('appends new opportunities from incoming', () => {
		const local = board([createOpportunity('A')])
		const incoming = board([createOpportunity('B')])
		const { opportunities, stats } = mergeBoards(local, incoming)

		expect(opportunities).toHaveLength(2)
		expect(opportunities[0].title).toBe('A')
		expect(opportunities[1].title).toBe('B')
		expect(stats.oppsAdded).toBe(1)
		expect(stats.oppsUpdated).toBe(0)
	})

	it('updates existing opportunity when incoming is newer', () => {
		const opp = createOpportunity('A')
		const localOpp = { ...opp, title: 'A old', updatedAt: 1000 }
		const incomingOpp = { ...opp, title: 'A new', updatedAt: 2000 }

		const { opportunities, stats } = mergeBoards(board([localOpp]), board([incomingOpp]))

		expect(opportunities).toHaveLength(1)
		expect(opportunities[0].title).toBe('A new')
		expect(stats.oppsUpdated).toBe(1)
	})

	it('keeps local opportunity when local is newer', () => {
		const opp = createOpportunity('A')
		const localOpp = { ...opp, title: 'A local', updatedAt: 3000 }
		const incomingOpp = { ...opp, title: 'A incoming', updatedAt: 1000 }

		const { opportunities } = mergeBoards(board([localOpp]), board([incomingOpp]))

		expect(opportunities[0].title).toBe('A local')
	})

	it('keeps local when timestamps are equal', () => {
		const opp = createOpportunity('A')
		const localOpp = { ...opp, title: 'A local', updatedAt: 1000 }
		const incomingOpp = { ...opp, title: 'A incoming', updatedAt: 1000 }

		const { opportunities } = mergeBoards(board([localOpp]), board([incomingOpp]))

		expect(opportunities[0].title).toBe('A local')
	})

	it('appends new deliverables from incoming', () => {
		const local = board([], [createDeliverable('D1')])
		const incoming = board([], [createDeliverable('D2')])
		const { deliverables, stats } = mergeBoards(local, incoming)

		expect(deliverables).toHaveLength(2)
		expect(stats.delsAdded).toBe(1)
	})

	it('updates deliverable when incoming is newer', () => {
		const del = createDeliverable('D')
		const localDel = { ...del, title: 'D old', updatedAt: 100 }
		const incomingDel = { ...del, title: 'D new', updatedAt: 200 }

		const { deliverables, stats } = mergeBoards(board([], [localDel]), board([], [incomingDel]))

		expect(deliverables[0].title).toBe('D new')
		expect(stats.delsUpdated).toBe(1)
	})

	it('appends new links', () => {
		const link1: OpportunityDeliverableLink = {
			opportunityId: 'o1',
			deliverableId: 'd1',
			coverage: 'full',
		}
		const link2: OpportunityDeliverableLink = {
			opportunityId: 'o2',
			deliverableId: 'd2',
			coverage: 'partial',
		}

		const { links, stats } = mergeBoards(board([], [], [link1]), board([], [], [link2]))

		expect(links).toHaveLength(2)
		expect(stats.linksAdded).toBe(1)
	})

	it('deduplicates links by (oppId, delId) — incoming wins', () => {
		const link1: OpportunityDeliverableLink = {
			opportunityId: 'o1',
			deliverableId: 'd1',
			coverage: 'full',
		}
		const link2: OpportunityDeliverableLink = {
			opportunityId: 'o1',
			deliverableId: 'd1',
			coverage: 'partial',
		}

		const { links, stats } = mergeBoards(board([], [], [link1]), board([], [], [link2]))

		expect(links).toHaveLength(1)
		expect(links[0].coverage).toBe('partial')
		expect(stats.linksAdded).toBe(0) // not new, just updated
	})

	it('preserves local ordering with new items appended', () => {
		const o1 = createOpportunity('First')
		const o2 = createOpportunity('Second')
		const o3 = createOpportunity('Third')

		const { opportunities } = mergeBoards(board([o1, o2]), board([o3]))

		expect(opportunities.map((o) => o.title)).toEqual(['First', 'Second', 'Third'])
	})

	it('handles empty local board', () => {
		const o = createOpportunity('New')
		const { opportunities, stats } = mergeBoards(board(), board([o]))

		expect(opportunities).toHaveLength(1)
		expect(stats.oppsAdded).toBe(1)
	})

	it('handles empty incoming board', () => {
		const o = createOpportunity('Existing')
		const { opportunities, stats } = mergeBoards(board([o]), board())

		expect(opportunities).toHaveLength(1)
		expect(stats.oppsAdded).toBe(0)
		expect(stats.oppsUpdated).toBe(0)
	})

	it('complex merge: adds, updates, and keeps simultaneously', () => {
		const shared = createOpportunity('Shared')
		const localOnly = createOpportunity('Local only')
		const incomingOnly = createOpportunity('Incoming only')

		const localShared = { ...shared, title: 'Shared local', updatedAt: 100 }
		const incomingShared = { ...shared, title: 'Shared updated', updatedAt: 200 }

		const { opportunities, stats } = mergeBoards(
			board([localShared, localOnly]),
			board([incomingShared, incomingOnly]),
		)

		expect(opportunities).toHaveLength(3)
		expect(opportunities[0].title).toBe('Shared updated') // updated
		expect(opportunities[1].title).toBe('Local only') // kept
		expect(opportunities[2].title).toBe('Incoming only') // added
		expect(stats.oppsAdded).toBe(1)
		expect(stats.oppsUpdated).toBe(1)
	})
})

describe('formatMergeStats', () => {
	it('returns identity message for no changes', () => {
		expect(
			formatMergeStats({
				oppsAdded: 0,
				oppsUpdated: 0,
				delsAdded: 0,
				delsUpdated: 0,
				linksAdded: 0,
			}),
		).toBe('No changes — boards are identical.')
	})

	it('formats singular and plural correctly', () => {
		expect(
			formatMergeStats({
				oppsAdded: 1,
				oppsUpdated: 0,
				delsAdded: 2,
				delsUpdated: 0,
				linksAdded: 0,
			}),
		).toBe('Merged: 1 new opportunity, 2 new deliverables.')
	})

	it('includes all non-zero stats', () => {
		const msg = formatMergeStats({
			oppsAdded: 1,
			oppsUpdated: 2,
			delsAdded: 3,
			delsUpdated: 4,
			linksAdded: 5,
		})
		expect(msg).toContain('1 new opportunity')
		expect(msg).toContain('2 opportunities updated')
		expect(msg).toContain('3 new deliverables')
		expect(msg).toContain('4 deliverables updated')
		expect(msg).toContain('5 new links')
	})
})
