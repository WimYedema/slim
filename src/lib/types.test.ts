import { describe, expect, it } from 'vitest'
import {
	agingLevel,
	type CellSignal,
	canAdvanceToDeliver,
	cellHasSignal,
	certaintyFromEstimate,
	commitmentStatuses,
	commitmentUrgency,
	consentStatus,
	createDeliverable,
	createOpportunity,
	currentQuarter,
	currentStageScores,
	daysInStage,
	defaultHorizon,
	effectiveCertainty,
	effectiveSize,
	formatDaysLeft,
	inheritedPeople,
	isFutureHorizon,
	linksForDeliverable,
	linksForOpportunity,
	nextScore,
	nextStage,
	type Opportunity,
	type OpportunityDeliverableLink,
	opportunityEffort,
	originLabel,
	pacingSummary,
	perspectiveAssignment,
	perspectiveOwner,
	perspectiveWeight,
	prevStage,
	type Score,
	scoreClass,
	sizeFromEstimate,
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
		expect(nextStage('decompose')).toBe('deliver')
	})

	it('returns null at the end', () => {
		expect(nextStage('deliver')).toBeNull()
	})
})

describe('prevStage', () => {
	it('moves back through the pipeline', () => {
		expect(prevStage('deliver')).toBe('decompose')
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
	it('returns fresh for explore < 5 days', () => {
		const opp = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 3 * 86_400_000 })
		expect(agingLevel(opp)).toBe('fresh')
	})

	it('returns aging for explore 5-9 days', () => {
		const opp = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 7 * 86_400_000 })
		expect(agingLevel(opp)).toBe('aging')
	})

	it('returns stale for explore >= 10 days', () => {
		const opp = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 12 * 86_400_000 })
		expect(agingLevel(opp)).toBe('stale')
	})

	it('uses longer thresholds for validate (7/14)', () => {
		const opp6 = makeOpp({ stage: 'validate', stageEnteredAt: Date.now() - 6 * 86_400_000 })
		expect(agingLevel(opp6)).toBe('fresh')
		const opp10 = makeOpp({ stage: 'validate', stageEnteredAt: Date.now() - 10 * 86_400_000 })
		expect(agingLevel(opp10)).toBe('aging')
		const opp20 = makeOpp({ stage: 'validate', stageEnteredAt: Date.now() - 20 * 86_400_000 })
		expect(agingLevel(opp20)).toBe('stale')
	})

	it('uses longest thresholds for decompose (10/21)', () => {
		const opp8 = makeOpp({ stage: 'decompose', stageEnteredAt: Date.now() - 8 * 86_400_000 })
		expect(agingLevel(opp8)).toBe('fresh')
		const opp15 = makeOpp({ stage: 'decompose', stageEnteredAt: Date.now() - 15 * 86_400_000 })
		expect(agingLevel(opp15)).toBe('aging')
		const opp25 = makeOpp({ stage: 'decompose', stageEnteredAt: Date.now() - 25 * 86_400_000 })
		expect(agingLevel(opp25)).toBe('stale')
	})

	it('uses longest thresholds for deliver (14/28)', () => {
		const opp10 = makeOpp({ stage: 'deliver', stageEnteredAt: Date.now() - 10 * 86_400_000 })
		expect(agingLevel(opp10)).toBe('fresh')
		const opp20 = makeOpp({ stage: 'deliver', stageEnteredAt: Date.now() - 20 * 86_400_000 })
		expect(agingLevel(opp20)).toBe('aging')
		const opp30 = makeOpp({ stage: 'deliver', stageEnteredAt: Date.now() - 30 * 86_400_000 })
		expect(agingLevel(opp30)).toBe('stale')
	})

	it('tightens thresholds for "now" pressure (halved)', () => {
		// explore with "now": aging at 3, stale at 5
		const opp3 = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 3 * 86_400_000 })
		expect(agingLevel(opp3, 'now')).toBe('aging')
		expect(agingLevel(opp3, 'none')).toBe('fresh')

		const opp5 = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 5 * 86_400_000 })
		expect(agingLevel(opp5, 'now')).toBe('stale')
		expect(agingLevel(opp5, 'none')).toBe('aging')
	})

	it('uses standard thresholds for "next" pressure', () => {
		const opp = makeOpp({ stage: 'explore', stageEnteredAt: Date.now() - 6 * 86_400_000 })
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

	it('returns urgent when any perspective is negative', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'positive', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('urgent')
		expect(result.objections).toEqual(['feasibility'])
	})

	it('reports urgent even with unheard perspectives when there is an objection', () => {
		let opp = makeOpp({ stage: 'explore' })
		opp = setStageScores(opp, 'explore', 'none', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('urgent')
		expect(result.objections).toEqual(['feasibility'])
		expect(result.unheard).toEqual(['desirability'])
	})

	it('checks only the current stage signals', () => {
		let opp = makeOpp({ stage: 'sketch' })
		opp = setStageScores(opp, 'explore', 'positive', 'positive', 'positive')
		opp = setStageScores(opp, 'sketch', 'positive', 'negative', 'positive')
		const result = stageConsent(opp)
		expect(result.status).toBe('urgent')
	})

	it('returns ready at decompose if all decompose signals are positive', () => {
		let opp = makeOpp({ stage: 'decompose' })
		opp = setStageScores(opp, 'decompose', 'positive', 'positive', 'positive')
		expect(stageConsent(opp).status).toBe('ready')
	})

	it('always returns ready for deliver stage (no signal grid)', () => {
		const opp = makeOpp({ stage: 'deliver' })
		const result = stageConsent(opp)
		expect(result.status).toBe('ready')
		expect(result.objections).toHaveLength(0)
		expect(result.unheard).toHaveLength(0)
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

// ── Board names registry ──

import { boardNames, mergeNames } from './queries'

describe('boardNames', () => {
	it('collects names from people, commitments, signals, and deliverables', () => {
		const opp = createOpportunity('Test')
		opp.people = [
			{ id: '1', name: 'Alice', role: 'expert', perspectives: [] },
			{ id: '2', name: 'Bob', role: 'stakeholder', perspectives: [] },
		]
		opp.commitments = [{ id: 'c1', to: 'Carol', milestone: 'sketch', by: Date.now() }]
		opp.signals.explore.desirability = {
			score: 'positive',
			source: 'manual',
			verdict: '',
			evidence: '',
			owner: 'Dave',
		}
		const del = createDeliverable('Task')
		del.extraContributors = ['Eve']
		del.extraConsumers = ['Frank']
		const names = boardNames([opp], [del])
		expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'])
	})

	it('deduplicates case-insensitively, keeping first-seen casing', () => {
		const opp = createOpportunity('Test')
		opp.people = [
			{ id: '1', name: 'Alice', role: 'expert', perspectives: [] },
			{ id: '2', name: 'alice', role: 'stakeholder', perspectives: [] },
		]
		const names = boardNames([opp], [])
		expect(names).toEqual(['Alice'])
	})

	it('trims whitespace', () => {
		const opp = createOpportunity('Test')
		opp.people = [{ id: '1', name: '  Alice  ', role: 'expert', perspectives: [] }]
		const names = boardNames([opp], [])
		expect(names).toEqual(['Alice'])
	})

	it('returns empty for empty board', () => {
		expect(boardNames([], [])).toEqual([])
	})
})

describe('mergeNames', () => {
	it('roster names come first, then board-only names', () => {
		const result = mergeNames(['Alice', 'Bob'], ['Carol', 'Alice'])
		expect(result.names).toEqual(['Alice', 'Bob', 'Carol'])
	})

	it('annotates board-only names when roster is non-empty', () => {
		const result = mergeNames(['Alice'], ['Bob', 'Carol'])
		expect(result.annotations.get('bob')).toBe('board only')
		expect(result.annotations.get('carol')).toBe('board only')
		expect(result.annotations.has('alice')).toBe(false)
	})

	it('no annotations when roster is empty', () => {
		const result = mergeNames([], ['Alice', 'Bob'])
		expect(result.annotations.size).toBe(0)
	})

	it('deduplicates case-insensitively', () => {
		const result = mergeNames(['alice'], ['Alice', 'Bob'])
		expect(result.names).toEqual(['alice', 'Bob'])
	})
})

// ── Estimation display helpers ──

const mkEstimate = (mu: number, sigma: number) => ({
	mu,
	sigma,
	n: 3,
	unit: 'days' as const,
	snappedValue: '3d',
	estimatedAt: Date.now(),
})

describe('sizeFromEstimate', () => {
	it('maps median < 0.5 days to XS', () => {
		expect(sizeFromEstimate(mkEstimate(Math.log(0.3), 0.3))).toBe('XS')
	})
	it('maps median ~1 day to S', () => {
		expect(sizeFromEstimate(mkEstimate(Math.log(1), 0.3))).toBe('S')
	})
	it('maps median ~3 days to M', () => {
		expect(sizeFromEstimate(mkEstimate(Math.log(3), 0.3))).toBe('M')
	})
	it('maps median ~8 days to L', () => {
		expect(sizeFromEstimate(mkEstimate(Math.log(8), 0.3))).toBe('L')
	})
	it('maps median ~20 days to XL', () => {
		expect(sizeFromEstimate(mkEstimate(Math.log(20), 0.3))).toBe('XL')
	})
})

describe('certaintyFromEstimate', () => {
	it('maps very low sigma to certainty 5', () => {
		expect(certaintyFromEstimate(mkEstimate(1, 0.1))).toBe(5)
	})
	it('maps low sigma to certainty 4', () => {
		expect(certaintyFromEstimate(mkEstimate(1, 0.3))).toBe(4)
	})
	it('maps medium sigma to certainty 3', () => {
		expect(certaintyFromEstimate(mkEstimate(1, 0.5))).toBe(3)
	})
	it('maps high sigma to certainty 2', () => {
		expect(certaintyFromEstimate(mkEstimate(1, 0.8))).toBe(2)
	})
	it('maps very high sigma to certainty 1', () => {
		expect(certaintyFromEstimate(mkEstimate(1, 1.2))).toBe(1)
	})
})

describe('effectiveSize', () => {
	it('returns estimated size when estimate exists', () => {
		const del = createDeliverable('Test')
		del.size = 'XL'
		del.estimate = mkEstimate(Math.log(1), 0.3)
		expect(effectiveSize(del)).toBe('S') // estimate wins over manual XL
	})
	it('falls back to manual size when no estimate', () => {
		const del = createDeliverable('Test')
		del.size = 'M'
		expect(effectiveSize(del)).toBe('M')
	})
	it('returns null when neither exists', () => {
		const del = createDeliverable('Test')
		expect(effectiveSize(del)).toBeNull()
	})
})

describe('effectiveCertainty', () => {
	it('returns estimated certainty when estimate exists', () => {
		const del = createDeliverable('Test')
		del.certainty = 1
		del.estimate = mkEstimate(1, 0.3)
		expect(effectiveCertainty(del)).toBe(4) // estimate wins over manual 1
	})
	it('falls back to manual certainty when no estimate', () => {
		const del = createDeliverable('Test')
		del.certainty = 3
		expect(effectiveCertainty(del)).toBe(3)
	})
})

describe('opportunityEffort', () => {
	it('returns null when no linked deliverables', () => {
		const opp = createOpportunity('Test')
		expect(opportunityEffort(opp.id, [], [])).toBeNull()
	})

	it('returns null when linked deliverables have no estimates', () => {
		const opp = createOpportunity('Test')
		const del = createDeliverable('Work')
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: del.id, coverage: 'full' },
		]
		expect(opportunityEffort(opp.id, [del], links)).toBeNull()
	})

	it('sums full-coverage deliverable medians', () => {
		const opp = createOpportunity('Test')
		const del1 = createDeliverable('A')
		del1.estimate = mkEstimate(0, 0.5) // median = e^0 = 1
		const del2 = createDeliverable('B')
		del2.estimate = mkEstimate(Math.log(3), 0.3) // median = 3
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: del1.id, coverage: 'full' },
			{ opportunityId: opp.id, deliverableId: del2.id, coverage: 'full' },
		]
		expect(opportunityEffort(opp.id, [del1, del2], links)).toBeCloseTo(4)
	})

	it('halves partial-coverage median', () => {
		const opp = createOpportunity('Test')
		const del = createDeliverable('Shared')
		del.estimate = mkEstimate(Math.log(10), 0.3) // median = 10
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: del.id, coverage: 'partial' },
		]
		expect(opportunityEffort(opp.id, [del], links)).toBeCloseTo(5)
	})

	it('ignores deliverables without estimates', () => {
		const opp = createOpportunity('Test')
		const del1 = createDeliverable('Estimated')
		del1.estimate = mkEstimate(Math.log(2), 0.4) // median = 2
		const del2 = createDeliverable('Not estimated')
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: del1.id, coverage: 'full' },
			{ opportunityId: opp.id, deliverableId: del2.id, coverage: 'full' },
		]
		expect(opportunityEffort(opp.id, [del1, del2], links)).toBeCloseTo(2)
	})
})

describe('canAdvanceToDeliver', () => {
	it('returns ok for non-decompose stages', () => {
		const opp = makeOpp({ stage: 'sketch' })
		expect(canAdvanceToDeliver(opp, []).ok).toBe(true)
	})

	it('blocks when decompose consent not ready', () => {
		const opp = makeOpp({ stage: 'decompose' })
		// no signals scored → consent not ready
		const result = canAdvanceToDeliver(opp, [])
		expect(result.ok).toBe(false)
		expect(result.reason).toBe('consent')
	})

	it('blocks when decompose has consent but no linked deliverables', () => {
		const opp = setStageScores(
			makeOpp({ stage: 'decompose' }),
			'decompose',
			'positive',
			'positive',
			'positive',
		)
		const result = canAdvanceToDeliver(opp, [])
		expect(result.ok).toBe(false)
		expect(result.reason).toContain('deliverable')
	})

	it('allows when decompose has consent and linked deliverables', () => {
		const opp = setStageScores(
			makeOpp({ stage: 'decompose' }),
			'decompose',
			'positive',
			'positive',
			'positive',
		)
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: opp.id, deliverableId: 'del-1', coverage: 'full' },
		]
		expect(canAdvanceToDeliver(opp, links).ok).toBe(true)
	})
})

describe('commitmentStatuses', () => {
	it('returns empty for opportunity with no commitments', () => {
		const opp = makeOpp()
		expect(commitmentStatuses(opp)).toEqual([])
	})

	it('computes daysLeft and met correctly', () => {
		const now = Date.now()
		const opp = makeOpp({ stage: 'deliver' })
		opp.commitments = [
			{ id: 'c1', to: 'Customer', milestone: 'validate', by: now + 7 * 86_400_000 },
			{ id: 'c2', to: 'Partner', milestone: 'deliver', by: now - 1 * 86_400_000 },
		]
		const statuses = commitmentStatuses(opp)
		expect(statuses).toHaveLength(2)
		// validate < deliver → met
		expect(statuses[0].met).toBe(true)
		expect(statuses[0].daysLeft).toBe(7)
		// deliver milestone at deliver stage → not met (same stage, not past)
		expect(statuses[1].met).toBe(false)
		expect(statuses[1].daysLeft).toBe(-1)
	})
})
