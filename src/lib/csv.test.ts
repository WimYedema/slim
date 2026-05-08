import { describe, expect, it } from 'vitest'
import { csvEscape, csvToOpportunities, opportunitiesToCsv, parseCsvRow } from './csv'
import type { Opportunity } from './types'
import { createOpportunity } from './types'

describe('csvEscape', () => {
	it('returns plain strings unchanged', () => {
		expect(csvEscape('hello')).toBe('hello')
	})

	it('wraps strings with commas in quotes', () => {
		expect(csvEscape('a,b')).toBe('"a,b"')
	})

	it('escapes double quotes', () => {
		expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
	})

	it('wraps strings with newlines', () => {
		expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
	})
})

describe('parseCsvRow', () => {
	it('splits simple fields', () => {
		expect(parseCsvRow('a,b,c')).toEqual(['a', 'b', 'c'])
	})

	it('handles quoted fields with commas', () => {
		expect(parseCsvRow('"a,b",c,d')).toEqual(['a,b', 'c', 'd'])
	})

	it('handles escaped quotes inside quoted fields', () => {
		expect(parseCsvRow('"say ""hi""",b')).toEqual(['say "hi"', 'b'])
	})

	it('handles empty fields', () => {
		expect(parseCsvRow('a,,c')).toEqual(['a', '', 'c'])
	})

	it('trims whitespace from fields', () => {
		expect(parseCsvRow(' a , b , c ')).toEqual(['a', 'b', 'c'])
	})
})

describe('round-trip: opportunitiesToCsv → csvToOpportunities', () => {
	function makeOpp(overrides: Partial<Opportunity> & { title: string }): Opportunity {
		const opp = createOpportunity(overrides.title)
		Object.assign(opp, overrides)
		return opp
	}

	it('preserves title, stage, origin, horizon, and scores', () => {
		const opp = makeOpp({ title: 'Auth flow' })
		opp.stage = 'sketch'
		opp.stageEnteredAt = Date.now()
		opp.origin = 'demand'
		opp.horizon = '2026Q3'
		opp.signals.sketch.desirability.score = 'positive'
		opp.signals.sketch.feasibility.score = 'uncertain'
		opp.signals.sketch.viability.score = 'negative'

		const csv = opportunitiesToCsv([opp])
		const { imported, skipped } = csvToOpportunities(csv)

		expect(skipped).toHaveLength(0)
		expect(imported).toHaveLength(1)
		const result = imported[0]
		expect(result.title).toBe('Auth flow')
		expect(result.stage).toBe('sketch')
		expect(result.origin).toBe('demand')
		expect(result.horizon).toBe('2026Q3')
		expect(result.signals.sketch.desirability.score).toBe('positive')
		expect(result.signals.sketch.feasibility.score).toBe('uncertain')
		expect(result.signals.sketch.viability.score).toBe('negative')
	})

	it('handles title with commas and quotes', () => {
		const opp = makeOpp({ title: 'Build "auth", login' })
		const csv = opportunitiesToCsv([opp])
		const { imported } = csvToOpportunities(csv)

		expect(imported).toHaveLength(1)
		expect(imported[0].title).toBe('Build "auth", login')
	})

	it('handles horizon with commas', () => {
		const opp = makeOpp({ title: 'Feature X' })
		opp.horizon = 'Q3, maybe Q4'

		const csv = opportunitiesToCsv([opp])
		const { imported } = csvToOpportunities(csv)

		expect(imported).toHaveLength(1)
		expect(imported[0].horizon).toBe('Q3, maybe Q4')
	})

	it('round-trips multiple opportunities', () => {
		const opps = [
			makeOpp({ title: 'Alpha' }),
			makeOpp({ title: 'Beta' }),
			makeOpp({ title: 'Gamma' }),
		]
		opps[1].stage = 'validate'
		opps[1].origin = 'incident'

		const csv = opportunitiesToCsv(opps)
		const { imported } = csvToOpportunities(csv)

		expect(imported).toHaveLength(3)
		expect(imported.map((o) => o.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
		expect(imported[1].stage).toBe('validate')
		expect(imported[1].origin).toBe('incident')
	})

	it('preserves none scores (default)', () => {
		const opp = makeOpp({ title: 'Blank' })
		const csv = opportunitiesToCsv([opp])
		const { imported } = csvToOpportunities(csv)

		expect(imported[0].signals.explore.desirability.score).toBe('none')
		expect(imported[0].signals.explore.feasibility.score).toBe('none')
		expect(imported[0].signals.explore.viability.score).toBe('none')
	})

	it('handles all five stages', () => {
		const stages = ['explore', 'sketch', 'validate', 'decompose', 'deliver'] as const
		for (const stage of stages) {
			const opp = makeOpp({ title: `Test ${stage}` })
			opp.stage = stage
			opp.stageEnteredAt = Date.now()
			opp.signals[stage].desirability.score = 'positive'

			const csv = opportunitiesToCsv([opp])
			const { imported } = csvToOpportunities(csv)

			expect(imported[0].stage).toBe(stage)
			expect(imported[0].signals[stage].desirability.score).toBe('positive')
		}
	})
})

describe('csvToOpportunities edge cases', () => {
	it('skips rows with empty title', () => {
		const csv = 'Title,Stage\n,explore\nReal item,sketch'
		const { imported, skipped } = csvToOpportunities(csv)
		expect(imported).toHaveLength(1)
		expect(imported[0].title).toBe('Real item')
		expect(skipped).toHaveLength(1)
	})

	it('ignores invalid stage values', () => {
		const csv = 'Title,Stage\nItem,bogus'
		const { imported } = csvToOpportunities(csv)
		expect(imported[0].stage).toBe('explore') // default
	})

	it('ignores invalid score values', () => {
		const csv = 'Title,Desirability\nItem,maybe'
		const { imported } = csvToOpportunities(csv)
		expect(imported[0].signals.explore.desirability.score).toBe('none')
	})

	it('works with only a Title column', () => {
		const csv = 'Title\nAlpha\nBeta'
		const { imported } = csvToOpportunities(csv)
		expect(imported).toHaveLength(2)
	})

	it('returns skip reason for empty file', () => {
		const { imported, skipped } = csvToOpportunities('')
		expect(imported).toHaveLength(0)
		expect(skipped).toHaveLength(1)
	})

	it('returns skip reason for missing Title header', () => {
		const csv = 'Name,Stage\nFoo,explore'
		const { imported, skipped } = csvToOpportunities(csv)
		expect(imported).toHaveLength(0)
		expect(skipped[0]).toContain('Title')
	})

	it('handles Windows-style line endings', () => {
		const csv = 'Title,Stage\r\nItem,sketch\r\n'
		const { imported } = csvToOpportunities(csv)
		expect(imported).toHaveLength(1)
		expect(imported[0].stage).toBe('sketch')
	})

	it('case-insensitive headers', () => {
		const csv = 'TITLE,STAGE,DESIRABILITY\nItem,validate,positive'
		const { imported } = csvToOpportunities(csv)
		expect(imported[0].title).toBe('Item')
		expect(imported[0].stage).toBe('validate')
		expect(imported[0].signals.validate.desirability.score).toBe('positive')
	})
})
