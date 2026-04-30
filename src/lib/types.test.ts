import { describe, expect, it } from 'vitest'
import {
	agingLevel,
	type CellSignal,
	cellHasSignal,
	commitmentUrgency,
	consentStatus,
	createDeliverable,
	createOpportunity,
	currentQuarter,
	currentStageScores,
	daysInStage,
	defaultHorizon,
	formatDaysLeft,
	inheritedPeople,
	isFutureHorizon,
	linksForDeliverable,
	linksForOpportunity,
	nextScore,
	nextStage,
	type Opportunity,
	type OpportunityDeliverableLink,
	originLabel,
	pacingSummary,
	perspectiveAssignment,
	perspectiveOwner,
	perspectiveWeight,
	prevStage,
	type Score,
	scoreClass,
	stageConsent,
	stageIndex,
	stageLabel,
	ternaryPosition,
	wipLevel,
	wipNudge,
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

// ── Stage navigation ──

describe('stageIndex', () => {
	it('returns increasing indices for each stage', () => {
		expect(stageIndex('explore')).toBeLessThan(stageIndex('sketch'))
		expect(stageIndex('sketch')).toBeLessThan(stageIndex('validate'))
		expect(stageIndex('validate')).toBeLessThan(stageIndex('decompose'))
	})
})

describe('nextStage', () => {
	it('advances through the pipeline', () => {
		expect(nextStage('explore')).toBe('sketch')
		expect(nextStage('sketch')).toBe('validate')
		expect(nextStage('validate')).toBe('decompose')
	})

	it('returns null at the end', () => {
		expect(nextStage('decompose')).toBeNull()
	})
})

describe('prevStage', () => {
	it('moves back through the pipeline', () => {
		expect(prevStage('decompose')).toBe('validate')
		expect(prevStage('validate')).toBe('sketch')
		expect(prevStage('sketch')).toBe('explore')
	})

	it('returns null at the start', () => {
		expect(prevStage('explore')).toBeNull()
	})
})

// ── Aging ──

describe('daysInStage', () => {
	it('returns 0 for a freshly created opportunity', () => {
		const opp = makeOpp()
		expect(daysInStage(opp)).toBe(0)
	})

	it('counts days since stageEnteredAt', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 10 * 86_400_000 })
		expect(daysInStage(opp)).toBe(10)
	})
})

describe('agingLevel', () => {
	it('returns fresh for < 7 days', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 3 * 86_400_000 })
		expect(agingLevel(opp)).toBe('fresh')
	})

	it('returns aging for 7-13 days', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 10 * 86_400_000 })
		expect(agingLevel(opp)).toBe('aging')
	})

	it('returns stale for >= 14 days', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 20 * 86_400_000 })
		expect(agingLevel(opp)).toBe('stale')
	})

	it('tightens thresholds for "now" pressure', () => {
		const opp5 = makeOpp({ stageEnteredAt: Date.now() - 5 * 86_400_000 })
		expect(agingLevel(opp5, 'now')).toBe('aging')
		expect(agingLevel(opp5, 'none')).toBe('fresh')

		const opp10 = makeOpp({ stageEnteredAt: Date.now() - 10 * 86_400_000 })
		expect(agingLevel(opp10, 'now')).toBe('stale')
		expect(agingLevel(opp10, 'none')).toBe('aging')
	})

	it('uses standard thresholds for "next" pressure', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 8 * 86_400_000 })
		expect(agingLevel(opp, 'next')).toBe('aging')
		expect(agingLevel(opp, 'none')).toBe('aging')
	})
})

describe('pacingSummary', () => {
	it('includes days, stage, and pace', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 3 * 86_400_000, horizon: '' })
		expect(pacingSummary(opp)).toBe('3d in Explore · on track')
	})

	it('includes horizon when set', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 3 * 86_400_000, horizon: '2026Q3' })
		expect(pacingSummary(opp)).toBe('3d in Explore · targeting 2026Q3 · on track')
	})

	it('reflects aging pace', () => {
		const opp = makeOpp({ stageEnteredAt: Date.now() - 10 * 86_400_000, horizon: '2026Q2' })
		expect(pacingSummary(opp, 'now')).toBe('10d in Explore · targeting 2026Q2 · behind pace')
	})
})

// ── Score cycling ──

describe('nextScore', () => {
	it('cycles none → uncertain → positive → negative → none', () => {
		expect(nextScore('none')).toBe('uncertain')
		expect(nextScore('uncertain')).toBe('positive')
		expect(nextScore('positive')).toBe('negative')
		expect(nextScore('negative')).toBe('none')
	})
})

// ── Consent gating ──

describe('consentStatus', () => {
	it('maps scores to consent semantics', () => {
		expect(consentStatus('none')).toBe('unheard')
		expect(consentStatus('negative')).toBe('objection')
		expect(consentStatus('positive')).toBe('consent')
		expect(consentStatus('uncertain')).toBe('consent')
	})
})

describe('stageConsent', () => {
	it('returns ready when all perspectives are positive or uncertain', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'positive', 'positive', 'uncertain')
		const result = stageConsent(opp)
		expect(result.status).toBe('ready')
		expect(result.objections).toHaveLength(0)
		expect(result.unheard).toHaveLength(0)
	})

	it('returns incomplete when any perspective is none', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'positive', 'none', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('incomplete')
		expect(result.unheard).toEqual(['feasibility'])
	})

	it('returns blocked when any perspective is negative', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'positive', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('blocked')
		expect(result.objections).toEqual(['feasibility'])
	})

	it('reports blocked even with unheard perspectives when there is an objection', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'none', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('blocked')
		expect(result.objections).toEqual(['feasibility'])
		expect(result.unheard).toEqual(['desirability'])
	})

	it('checks only the current stage signals', () => {
		let opp = makeOpp({ stage: 'sketch' })
		opp = setStageScores(opp, 'explore', 'positive', 'positive', 'positive')
		opp = setStageScores(opp, 'sketch', 'positive', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('blocked')
	})

	it('returns ready at decompose if all decompose signals are positive', () => {
		let opp = makeOpp({ stage: 'decompose' })
		opp = setStageScores(opp, 'decompose', 'positive', 'positive', 'positive')
		expect(stageConsent(opp).status).toBe('ready')
	})
})

// ── Perspective weight ──

describe('perspectiveWeight', () => {
	it('returns 0 when no signals are set (all none)', () => {
		const opp = makeOpp({ stage: 'explore' })
		expect(perspectiveWeight(opp, 'desirability')).toBe(0)
	})

	it('returns 1 for all positive signals up to current stage', () => {
		let opp = makeOpp({ stage: 'sketch' })
		opp = setStageScores(opp, 'explore', 'positive', 'positive', 'positive')
		opp = setStageScores(opp, 'sketch', 'positive', 'positive', 'positive')
		expect(perspectiveWeight(opp, 'desirability')).toBe(1)
	})

	it('averages across stages up to current', () => {
		let opp = makeOpp({ stage: 'sketch' })
		// explore: positive (1.0), sketch: none (0.0) → avg 0.5
		opp = setStageScores(opp, 'explore', 'positive', 'none', 'none')
		opp = setStageScores(opp, 'sketch', 'none', 'none', 'none')
		expect(perspectiveWeight(opp, 'desirability')).toBe(0.5)
	})

	it('weights uncertain as 0.5', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'uncertain', 'none', 'none')
		expect(perspectiveWeight(opp, 'desirability')).toBe(0.5)
	})

	it('weights negative as 0.1', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'negative', 'none', 'none')
		expect(perspectiveWeight(opp, 'desirability')).toBeCloseTo(0.1)
	})
})

// ── Commitment urgency ──

describe('commitmentUrgency', () => {
	it('returns undefined when there are no commitments', () => {
		const opp = makeOpp()
		expect(commitmentUrgency(opp)).toBeUndefined()
	})

	it('returns the most urgent unmet commitment', () => {
		const soon = Date.now() + 3 * 86_400_000
		const later = Date.now() + 10 * 86_400_000
		const opp = makeOpp({
			stage: 'explore',
			commitments: [
				{ id: '1', to: 'Alice', milestone: 'sketch', by: later },
				{ id: '2', to: 'Bob', milestone: 'validate', by: soon },
			],
		})
		const result = commitmentUrgency(opp)
		expect(result).toBeDefined()
		expect(result?.commitment.to).toBe('Bob')
		expect(result?.daysLeft).toBe(3)
	})

	it('ignores already-met commitments', () => {
		const opp = makeOpp({
			stage: 'validate',
			commitments: [{ id: '1', to: 'Alice', milestone: 'sketch', by: Date.now() - 86_400_000 }],
		})
		// Milestone 'sketch' < current 'validate', so it's met
		expect(commitmentUrgency(opp)).toBeUndefined()
	})

	it('returns negative daysLeft for overdue commitments', () => {
		const opp = makeOpp({
			stage: 'explore',
			commitments: [{ id: '1', to: 'Alice', milestone: 'sketch', by: Date.now() - 5 * 86_400_000 }],
		})
		const result = commitmentUrgency(opp)
		expect(result).toBeDefined()
		expect(result?.daysLeft).toBeLessThan(0)
	})
})

// ── Ternary position ──

describe('ternaryPosition', () => {
	it('returns center when all signals are none', () => {
		const opp = makeOpp()
		const pos = ternaryPosition(opp)
		expect(pos.x).toBeCloseTo(0.5, 1)
	})

	it('returns different positions for different signal profiles', () => {
		let oppD = makeOpp({ stage: 'explore' })
		oppD = setStageScores(oppD, 'explore', 'positive', 'none', 'none')

		let oppF = makeOpp({ stage: 'explore' })
		oppF = setStageScores(oppF, 'explore', 'none', 'positive', 'none')

		const posD = ternaryPosition(oppD)
		const posF = ternaryPosition(oppF)

		// They should be in different parts of the triangle
		expect(posD.x).not.toBeCloseTo(posF.x, 1)
	})
})

// ── Factories ──

describe('createOpportunity', () => {
	it('creates an explore-stage opportunity with empty signals', () => {
		const opp = createOpportunity('My feature')
		expect(opp.title).toBe('My feature')
		expect(opp.stage).toBe('explore')
		expect(opp.signals.explore.desirability.score).toBe('none')
		expect(opp.signals.decompose.viability.score).toBe('none')
		expect(opp.people).toEqual([])
		expect(opp.commitments).toEqual([])
		expect(opp.id).toBeTruthy()
	})

	it('sets stageEnteredAt equal to createdAt', () => {
		const opp = createOpportunity('Test')
		expect(opp.stageEnteredAt).toBe(opp.createdAt)
	})
})

describe('createDeliverable', () => {
	it('creates a deliverable with null size and certainty', () => {
		const d = createDeliverable('API endpoint')
		expect(d.title).toBe('API endpoint')
		expect(d.size).toBeNull()
		expect(d.certainty).toBeNull()
		expect(d.extraContributors).toEqual([])
		expect(d.extraConsumers).toEqual([])
	})
})

// ── Link queries ──

describe('linksForOpportunity / linksForDeliverable', () => {
	const links: OpportunityDeliverableLink[] = [
		{ opportunityId: 'o1', deliverableId: 'd1', coverage: 'full' },
		{ opportunityId: 'o1', deliverableId: 'd2', coverage: 'partial' },
		{ opportunityId: 'o2', deliverableId: 'd1', coverage: 'partial' },
	]

	it('finds all links for an opportunity', () => {
		const result = linksForOpportunity(links, 'o1')
		expect(result).toHaveLength(2)
	})

	it('finds all links for a deliverable', () => {
		const result = linksForDeliverable(links, 'd1')
		expect(result).toHaveLength(2)
	})

	it('returns empty for unlinked entities', () => {
		expect(linksForOpportunity(links, 'o99')).toHaveLength(0)
		expect(linksForDeliverable(links, 'd99')).toHaveLength(0)
	})
})

// ── Cell queries ──

describe('cellHasSignal', () => {
	it('returns false for none', () => {
		expect(cellHasSignal(makeSignal('none'))).toBe(false)
	})

	it('returns true for any other score', () => {
		expect(cellHasSignal(makeSignal('positive'))).toBe(true)
		expect(cellHasSignal(makeSignal('uncertain'))).toBe(true)
		expect(cellHasSignal(makeSignal('negative'))).toBe(true)
	})
})

describe('originLabel', () => {
	it('maps origin keys to display labels', () => {
		expect(originLabel('demand')).toBe('Request')
		expect(originLabel('supply')).toBe('Idea')
		expect(originLabel('incident')).toBe('Incident')
		expect(originLabel('debt')).toBe('Debt')
	})
})

// ── Perspective queries ──

describe('perspectiveOwner', () => {
	it('finds the person assigned to a perspective at a stage', () => {
		const opp = makeOpp({
			people: [
				{
					id: 'p1',
					name: 'Sarah',
					role: 'expert',
					perspectives: [{ perspective: 'feasibility', stage: 'validate', assignedAt: Date.now() }],
				},
			],
		})
		const owner = perspectiveOwner(opp, 'feasibility', 'validate')
		expect(owner?.name).toBe('Sarah')
	})

	it('returns undefined when no one is assigned', () => {
		const opp = makeOpp()
		expect(perspectiveOwner(opp, 'desirability', 'explore')).toBeUndefined()
	})
})

describe('perspectiveAssignment', () => {
	it('returns person and assignment details', () => {
		const now = Date.now()
		const opp = makeOpp({
			people: [
				{
					id: 'p1',
					name: 'Alice',
					role: 'expert',
					perspectives: [{ perspective: 'viability', stage: 'sketch', assignedAt: now }],
				},
			],
		})
		const result = perspectiveAssignment(opp, 'viability', 'sketch')
		expect(result?.person.name).toBe('Alice')
		expect(result?.assignment.assignedAt).toBe(now)
	})
})

describe('currentStageScores', () => {
	it('returns scores for the current stage', () => {
		let opp = makeOpp({ stage: 'sketch' })
		opp = setStageScores(opp, 'sketch', 'positive', 'uncertain', 'negative')
		const scores = currentStageScores(opp)
		expect(scores.desirability).toBe('positive')
		expect(scores.feasibility).toBe('uncertain')
		expect(scores.viability).toBe('negative')
	})
})

// ── Default horizon ──

describe('defaultHorizon', () => {
	it('returns a string in YYYYQ[1-4] format', () => {
		const h = defaultHorizon()
		expect(h).toMatch(/^\d{4}Q[1-4]$/)
	})
})

describe('currentQuarter', () => {
	it('returns a string in YYYYQ[1-4] format', () => {
		const q = currentQuarter()
		expect(q).toMatch(/^\d{4}Q[1-4]$/)
	})
})

describe('isFutureHorizon', () => {
	it('returns true for a horizon after the current quarter', () => {
		expect(isFutureHorizon(defaultHorizon())).toBe(true)
	})

	it('returns false for the current quarter', () => {
		expect(isFutureHorizon(currentQuarter())).toBe(false)
	})

	it('returns false for a past quarter', () => {
		expect(isFutureHorizon('2020Q1')).toBe(false)
	})
})

// ── Extracted display helpers ──

describe('scoreClass', () => {
	it('prefixes score with score-', () => {
		expect(scoreClass('positive')).toBe('score-positive')
		expect(scoreClass('none')).toBe('score-none')
	})
})

describe('stageLabel', () => {
	it('returns human-readable labels', () => {
		expect(stageLabel('explore')).toBe('Explore')
		expect(stageLabel('decompose')).toBe('Decompose')
	})
})

describe('formatDaysLeft', () => {
	it('formats overdue', () => {
		expect(formatDaysLeft(-3)).toBe('3d overdue')
	})

	it('formats due today', () => {
		expect(formatDaysLeft(0)).toBe('due today')
	})

	it('formats upcoming', () => {
		expect(formatDaysLeft(5)).toBe('5d left')
	})
})

describe('inheritedPeople', () => {
	it('returns experts as contributors from linked opportunities', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [
				{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] },
				{ id: 'p2', name: 'Bob', role: 'stakeholder', perspectives: [] },
			],
		})
		const del = createDeliverable('Task')
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: 'o1', deliverableId: del.id, coverage: 'full' },
		]
		const result = inheritedPeople(del.id, 'contributors', links, [opp])
		expect(result).toEqual(['Alice'])
	})

	it('returns stakeholders and approvers as consumers', () => {
		const opp = makeOpp({
			id: 'o1',
			people: [
				{ id: 'p1', name: 'Alice', role: 'expert', perspectives: [] },
				{ id: 'p2', name: 'Bob', role: 'stakeholder', perspectives: [] },
				{ id: 'p3', name: 'Carol', role: 'approver', perspectives: [] },
			],
		})
		const del = createDeliverable('Task')
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: 'o1', deliverableId: del.id, coverage: 'full' },
		]
		const result = inheritedPeople(del.id, 'consumers', links, [opp])
		expect(result).toEqual(['Bob', 'Carol'])
	})

	it('returns empty for unlinked deliverables', () => {
		const result = inheritedPeople('unknown', 'contributors', [], [])
		expect(result).toEqual([])
	})
})

// ── WIP limits ──

describe('wipLevel', () => {
	it('returns "ok" when count is within thresholds', () => {
		expect(wipLevel('explore', 5)).toBe('ok')
		expect(wipLevel('sketch', 4)).toBe('ok')
		expect(wipLevel('validate', 3)).toBe('ok')
		expect(wipLevel('decompose', 2)).toBe('ok')
	})

	it('returns "over" when count exceeds ceiling', () => {
		expect(wipLevel('explore', 16)).toBe('over')
		expect(wipLevel('sketch', 9)).toBe('over')
		expect(wipLevel('validate', 6)).toBe('over')
		expect(wipLevel('decompose', 4)).toBe('over')
	})

	it('returns "under" when count is below floor', () => {
		expect(wipLevel('explore', 2)).toBe('under')
		expect(wipLevel('sketch', 0)).toBe('under')
		expect(wipLevel('validate', 0)).toBe('under')
		expect(wipLevel('decompose', 0)).toBe('under')
	})

	it('returns "ok" at exact boundary values', () => {
		expect(wipLevel('explore', 3)).toBe('ok')
		expect(wipLevel('explore', 15)).toBe('ok')
		expect(wipLevel('decompose', 1)).toBe('ok')
		expect(wipLevel('decompose', 3)).toBe('ok')
	})
})

describe('wipNudge', () => {
	it('returns null when count is healthy', () => {
		expect(wipNudge('explore', 5)).toBeNull()
		expect(wipNudge('sketch', 4)).toBeNull()
	})

	it('returns a message when over ceiling', () => {
		const msg = wipNudge('sketch', 10)
		expect(msg).toContain('crowded')
		expect(msg).toContain('10')
	})

	it('returns a message when under floor', () => {
		const msg = wipNudge('explore', 1)
		expect(msg).toContain('quiet')
	})

	it('gives specific advice for empty validate', () => {
		const msg = wipNudge('validate', 0)
		expect(msg).toContain('tested')
	})

	it('gives specific advice for empty decompose', () => {
		const msg = wipNudge('decompose', 0)
		expect(msg).toContain('sprints')
	})
})
