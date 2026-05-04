import { describe, expect, it } from 'vitest'
import { createOpportunity, createDeliverable } from './types'
import type { Opportunity, OpportunityDeliverableLink } from './types'
import {
	collectStakeholders,
	buildStakeholderProfile,
	buildStakeholderSummaries,
	buildTalkingPoints,
} from './stakeholders'

function oppWithStakeholder(title: string, name: string): Opportunity {
	const opp = createOpportunity(title)
	opp.people.push({
		id: crypto.randomUUID(),
		name,
		role: 'stakeholder',
		perspectives: [],
	})
	return opp
}

function oppWithCommitmentTo(title: string, name: string, daysLeft: number): Opportunity {
	const opp = createOpportunity(title)
	opp.commitments.push({
		id: crypto.randomUUID(),
		to: name,
		milestone: 'sketch',
		by: Date.now() + daysLeft * 86_400_000,
	})
	return opp
}

describe('collectStakeholders', () => {
	it('returns empty map when no stakeholders', () => {
		const opp = createOpportunity('Test')
		opp.people.push({ id: '1', name: 'Dev', role: 'expert', perspectives: [] })
		expect(collectStakeholders([opp], []).size).toBe(0)
	})

	it('finds stakeholders from opportunity people', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		const result = collectStakeholders([opp], [])
		expect(result.has('Alice')).toBe(true)
	})

	it('finds stakeholders from commitment targets', () => {
		const opp = oppWithCommitmentTo('Feature', 'Bob', 10)
		const result = collectStakeholders([opp], [])
		expect(result.has('Bob')).toBe(true)
	})

	it('finds stakeholders from deliverable consumers', () => {
		const del = createDeliverable('Widget')
		del.extraConsumers = ['Carol']
		const result = collectStakeholders([], [del])
		expect(result.has('Carol')).toBe(true)
	})

	it('excludes pure experts', () => {
		const opp = createOpportunity('Test')
		opp.people.push({ id: '1', name: 'DevOnly', role: 'expert', perspectives: [] })
		const result = collectStakeholders([opp], [])
		expect(result.has('DevOnly')).toBe(false)
	})
})

describe('buildStakeholderProfile', () => {
	it('collects opportunities for stakeholder', () => {
		const opp = oppWithStakeholder('Feature A', 'Alice')
		const profile = buildStakeholderProfile('Alice', [opp], [], [], null)
		expect(profile.opportunities).toHaveLength(1)
		expect(profile.opportunities[0].title).toBe('Feature A')
	})

	it('collects commitments made to stakeholder', () => {
		const opp = oppWithCommitmentTo('Feature B', 'Bob', 5)
		const profile = buildStakeholderProfile('Bob', [opp], [], [], null)
		expect(profile.commitments).toHaveLength(1)
		expect(profile.commitments[0].daysLeft).toBeGreaterThan(0)
	})

	it('detects overdue commitments', () => {
		const opp = oppWithCommitmentTo('Feature C', 'Carol', -3)
		const profile = buildStakeholderProfile('Carol', [opp], [], [], null)
		expect(profile.commitments[0].overdue).toBe(true)
	})

	it('collects consumed deliverables', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		const del = createDeliverable('Widget')
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: del.id, coverage: 'full' },
		]
		const profile = buildStakeholderProfile('Alice', [opp], [del], links, null)
		expect(profile.deliverables).toHaveLength(1)
	})

	it('detects unscored desirability as input needed', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		opp.people[0].perspectives = [
			{ perspective: 'desirability', stage: 'explore', assignedAt: Date.now() },
		]
		const profile = buildStakeholderProfile('Alice', [opp], [], [], null)
		expect(profile.inputNeeded).toHaveLength(1)
	})

	it('counts changes since last talk', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		opp.updatedAt = Date.now()
		const lastDiscussed = Date.now() - 86_400_000 * 7
		const profile = buildStakeholderProfile('Alice', [opp], [], [], lastDiscussed)
		expect(profile.changesSinceLastTalk).toBe(1)
	})

	it('excludes discontinued opportunities', () => {
		const opp = oppWithStakeholder('Dead', 'Alice')
		opp.discontinuedAt = Date.now()
		const profile = buildStakeholderProfile('Alice', [opp], [], [], null)
		expect(profile.opportunities).toHaveLength(0)
	})
})

describe('buildStakeholderSummaries', () => {
	it('returns empty array when no stakeholders', () => {
		const result = buildStakeholderSummaries([], [], [], {})
		expect(result).toEqual([])
	})

	it('builds summaries sorted by urgency', () => {
		const oppA = oppWithCommitmentTo('Feature', 'Urgent', -5) // overdue
		const oppB = oppWithStakeholder('Other', 'Relaxed')
		const result = buildStakeholderSummaries([oppA, oppB], [], [], {})
		expect(result.length).toBe(2)
		expect(result[0].name).toBe('Urgent')
		expect(result[0].attention).toBe(true)
	})

	it('marks attention when input is needed', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		opp.people[0].perspectives = [
			{ perspective: 'desirability', stage: 'explore', assignedAt: Date.now() },
		]
		const result = buildStakeholderSummaries([opp], [], [], {})
		expect(result[0].inputNeededCount).toBe(1)
		expect(result[0].attention).toBe(true)
	})
})

describe('buildTalkingPoints', () => {
	it('generates points for overdue commitments', () => {
		const opp = oppWithCommitmentTo('Feature', 'Bob', -3)
		const profile = buildStakeholderProfile('Bob', [opp], [], [], null)
		const points = buildTalkingPoints(profile)
		expect(points.some(p => p.includes('overdue'))).toBe(true)
	})

	it('generates points for input needed', () => {
		const opp = oppWithStakeholder('Feature', 'Alice')
		opp.people[0].perspectives = [
			{ perspective: 'desirability', stage: 'explore', assignedAt: Date.now() },
		]
		const profile = buildStakeholderProfile('Alice', [opp], [], [], null)
		const points = buildTalkingPoints(profile)
		expect(points.some(p => p.includes('Input needed'))).toBe(true)
	})

	it('lists opportunity status', () => {
		const opp = oppWithStakeholder('Feature X', 'Alice')
		const profile = buildStakeholderProfile('Alice', [opp], [], [], null)
		const points = buildTalkingPoints(profile)
		expect(points.some(p => p.includes('Feature X'))).toBe(true)
	})
})
