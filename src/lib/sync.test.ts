import { describe, expect, it } from 'vitest'
import type { BoardData } from './store'
import {
	applyScores,
	applyVerdicts,
	generateEstimationRoom,
	isMigrationNotice,
	type ScoreSubmission,
	type VerdictResult,
} from './sync'
import { createDeliverable, createOpportunity } from './types'

function board(opps = [createOpportunity('Test')]): BoardData {
	return { opportunities: opps, deliverables: [], links: [] }
}

function submission(
	oppId: string,
	stage: 'explore' | 'sketch' | 'validate' | 'decompose' | 'deliver',
	perspective: 'desirability' | 'feasibility' | 'viability',
	score: 'positive' | 'uncertain' | 'negative',
	name = 'Sam',
): ScoreSubmission {
	return {
		name,
		timestamp: Date.now(),
		scores: [
			{
				opportunityId: oppId,
				stage,
				perspective,
				signal: { score, source: 'manual', verdict: '', evidence: '', owner: name },
			},
		],
	}
}

describe('applyScores', () => {
	it('applies a score to an unscored cell', () => {
		const opp = createOpportunity('Test')
		const b = board([opp])
		const sub = submission(opp.id, 'explore', 'desirability', 'positive')

		const count = applyScores(b, [sub])

		expect(count).toBe(1)
		expect(b.opportunities[0].signals.explore.desirability.score).toBe('positive')
		expect(b.opportunities[0].signals.explore.desirability.owner).toBe('Sam')
	})

	it('overwrites an existing score', () => {
		const opp = createOpportunity('Test')
		opp.signals.explore.desirability.score = 'uncertain'
		const b = board([opp])
		const sub = submission(opp.id, 'explore', 'desirability', 'positive')

		applyScores(b, [sub])

		expect(b.opportunities[0].signals.explore.desirability.score).toBe('positive')
	})

	it('skips unknown opportunity IDs', () => {
		const b = board()
		const sub = submission('nonexistent', 'explore', 'desirability', 'positive')

		const count = applyScores(b, [sub])

		expect(count).toBe(0)
	})

	it('applies multiple scores from one submission', () => {
		const opp = createOpportunity('Test')
		const b = board([opp])
		const sub: ScoreSubmission = {
			name: 'Sam',
			timestamp: Date.now(),
			scores: [
				{
					opportunityId: opp.id,
					stage: 'explore',
					perspective: 'desirability',
					signal: {
						score: 'positive',
						source: 'manual',
						verdict: 'Users love it',
						evidence: '',
						owner: 'Sam',
					},
				},
				{
					opportunityId: opp.id,
					stage: 'explore',
					perspective: 'feasibility',
					signal: {
						score: 'uncertain',
						source: 'manual',
						verdict: 'Need spike',
						evidence: '',
						owner: 'Sam',
					},
				},
			],
		}

		const count = applyScores(b, [sub])

		expect(count).toBe(2)
		expect(b.opportunities[0].signals.explore.desirability.score).toBe('positive')
		expect(b.opportunities[0].signals.explore.feasibility.score).toBe('uncertain')
	})

	it('applies scores from multiple submissions', () => {
		const opp = createOpportunity('Test')
		const b = board([opp])
		const sub1 = submission(opp.id, 'explore', 'desirability', 'positive', 'Sam')
		const sub2 = submission(opp.id, 'explore', 'feasibility', 'negative', 'Maria')

		const count = applyScores(b, [sub1, sub2])

		expect(count).toBe(2)
		expect(b.opportunities[0].signals.explore.desirability.owner).toBe('Sam')
		expect(b.opportunities[0].signals.explore.feasibility.owner).toBe('Maria')
	})

	it('preserves verdict and evidence from submission', () => {
		const opp = createOpportunity('Test')
		const b = board([opp])
		const sub: ScoreSubmission = {
			name: 'Sam',
			timestamp: Date.now(),
			scores: [
				{
					opportunityId: opp.id,
					stage: 'explore',
					perspective: 'desirability',
					signal: {
						score: 'positive',
						source: 'manual',
						verdict: 'Validated with 5 users',
						evidence: 'https://link.example',
						owner: 'Sam',
					},
				},
			],
		}

		applyScores(b, [sub])

		const cell = b.opportunities[0].signals.explore.desirability
		expect(cell.verdict).toBe('Validated with 5 users')
		expect(cell.evidence).toBe('https://link.example')
	})

	it('updates opportunity updatedAt timestamp', () => {
		const opp = createOpportunity('Test')
		const originalUpdatedAt = opp.updatedAt
		const b = board([opp])
		const sub = submission(opp.id, 'explore', 'desirability', 'positive')

		applyScores(b, [sub])

		expect(b.opportunities[0].updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
	})

	it('returns 0 for empty submissions', () => {
		const b = board()
		expect(applyScores(b, [])).toBe(0)
	})
})

describe('isMigrationNotice', () => {
	it('returns true for a valid migration notice', () => {
		expect(
			isMigrationNotice({
				migrated: true,
				newRoomCode: 'new-code-123',
				reason: 'Member removed',
				timestamp: Date.now(),
			}),
		).toBe(true)
	})

	it('returns false for board data', () => {
		expect(
			isMigrationNotice({
				opportunities: [],
				deliverables: [],
				links: [],
			}),
		).toBe(false)
	})

	it('returns false for null/undefined', () => {
		expect(isMigrationNotice(null)).toBe(false)
		expect(isMigrationNotice(undefined)).toBe(false)
	})

	it('returns false when migrated is not true', () => {
		expect(isMigrationNotice({ migrated: false, newRoomCode: 'x' })).toBe(false)
	})

	it('returns false when newRoomCode is missing', () => {
		expect(isMigrationNotice({ migrated: true })).toBe(false)
	})
})

// ── Estimation room ──

describe('generateEstimationRoom', () => {
	it('generates an 8-character string', () => {
		const room = generateEstimationRoom()
		expect(room).toHaveLength(8)
	})

	it('contains only consonant-vowel pairs', () => {
		const room = generateEstimationRoom()
		expect(room).toMatch(
			/^[bdfghjkmnprstvz][aeiou]{1}[bdfghjkmnprstvz][aeiou]{1}[bdfghjkmnprstvz][aeiou]{1}[bdfghjkmnprstvz][aeiou]{1}$/,
		)
	})

	it('generates different codes', () => {
		const codes = new Set(Array.from({ length: 20 }, () => generateEstimationRoom()))
		expect(codes.size).toBeGreaterThan(15)
	})
})

// ── Bridge: apply verdicts ──

describe('applyVerdicts', () => {
	const mkResult = (verdicts: VerdictResult['verdicts']): VerdictResult => ({
		type: 'verdict-result',
		verdicts,
		timestamp: Date.now(),
	})

	it('applies verdict to matching deliverable', () => {
		const del = createDeliverable('API endpoint')
		const result = mkResult([
			{
				externalId: del.id,
				title: 'API endpoint',
				mu: 1.1,
				sigma: 0.4,
				n: 4,
				snappedValue: '3d',
				unit: 'days',
				estimatedAt: Date.now(),
			},
		])
		const count = applyVerdicts([del], result)
		expect(count).toBe(1)
		expect(del.estimate).toBeDefined()
		expect(del.estimate!.mu).toBe(1.1)
		expect(del.estimate!.sigma).toBe(0.4)
		expect(del.estimate!.n).toBe(4)
		expect(del.estimate!.unit).toBe('days')
	})

	it('skips verdicts for unknown deliverable IDs', () => {
		const del = createDeliverable('Test')
		const result = mkResult([
			{
				externalId: 'unknown-id',
				title: 'Unknown',
				mu: 1,
				sigma: 0.5,
				n: 3,
				snappedValue: '3d',
				unit: 'days',
				estimatedAt: Date.now(),
			},
		])
		const count = applyVerdicts([del], result)
		expect(count).toBe(0)
		expect(del.estimate).toBeUndefined()
	})

	it('replaces older estimate with newer one', () => {
		const del = createDeliverable('Test')
		del.estimate = {
			mu: 0.5,
			sigma: 0.3,
			n: 2,
			unit: 'days',
			snappedValue: '2d',
			estimatedAt: 1000,
		}
		const result = mkResult([
			{
				externalId: del.id,
				title: 'Test',
				mu: 1.5,
				sigma: 0.6,
				n: 5,
				snappedValue: '5d',
				unit: 'days',
				estimatedAt: 2000,
			},
		])
		const count = applyVerdicts([del], result)
		expect(count).toBe(1)
		expect(del.estimate!.mu).toBe(1.5)
		expect(del.estimate!.n).toBe(5)
	})

	it('keeps newer existing estimate over older verdict', () => {
		const del = createDeliverable('Test')
		del.estimate = {
			mu: 0.5,
			sigma: 0.3,
			n: 2,
			unit: 'days',
			snappedValue: '2d',
			estimatedAt: 5000,
		}
		const result = mkResult([
			{
				externalId: del.id,
				title: 'Test',
				mu: 1.5,
				sigma: 0.6,
				n: 5,
				snappedValue: '5d',
				unit: 'days',
				estimatedAt: 2000,
			},
		])
		const count = applyVerdicts([del], result)
		expect(count).toBe(0)
		expect(del.estimate!.mu).toBe(0.5) // unchanged
	})
})
