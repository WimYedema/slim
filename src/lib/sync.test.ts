import { describe, expect, it } from 'vitest'
import type { BoardData } from './store'
import { applyScores, isMigrationNotice, type ScoreSubmission } from './sync'
import { createOpportunity } from './types'

function board(opps = [createOpportunity('Test')]): BoardData {
	return { opportunities: opps, deliverables: [], links: [] }
}

function submission(
	oppId: string,
	stage: 'explore' | 'sketch' | 'validate' | 'decompose',
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
		expect(isMigrationNotice({
			migrated: true,
			newRoomCode: 'new-code-123',
			reason: 'Member removed',
			timestamp: Date.now(),
		})).toBe(true)
	})

	it('returns false for board data', () => {
		expect(isMigrationNotice({
			opportunities: [],
			deliverables: [],
			links: [],
		})).toBe(false)
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
