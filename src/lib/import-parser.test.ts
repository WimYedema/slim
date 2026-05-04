import { describe, expect, it } from 'vitest'
import { IMPORT_TEMPLATE, materialize, parseImportText, toPreview } from './import-parser'

describe('parseImportText', () => {
	it('parses headings as opportunities', () => {
		const result = parseImportText('## First idea\n## Second idea')
		expect(result.opportunities).toHaveLength(2)
		expect(result.opportunities[0].title).toBe('First idea')
		expect(result.opportunities[1].title).toBe('Second idea')
	})

	it('defaults to explore stage', () => {
		const result = parseImportText('## My idea')
		expect(result.opportunities[0].stage).toBe('explore')
	})

	it('parses #stage tags', () => {
		const result = parseImportText('## Checkout flow #sketch')
		expect(result.opportunities[0].stage).toBe('sketch')
		expect(result.opportunities[0].title).toBe('Checkout flow')
	})

	it('parses all stage tags', () => {
		const r1 = parseImportText('## A #validate')
		const r2 = parseImportText('## A #decompose')
		expect(r1.opportunities[0].stage).toBe('validate')
		expect(r2.opportunities[0].stage).toBe('decompose')
	})

	it('parses #origin tags', () => {
		const r1 = parseImportText('## Fix outage #incident')
		const r2 = parseImportText('## Clean up #debt')
		const r3 = parseImportText('## Feature #request')
		const r4 = parseImportText('## Improve perf #idea')
		expect(r1.opportunities[0].origin).toBe('incident')
		expect(r2.opportunities[0].origin).toBe('debt')
		expect(r3.opportunities[0].origin).toBe('demand')
		expect(r4.opportunities[0].origin).toBe('supply')
	})

	it('parses unknown tags as horizon', () => {
		const result = parseImportText('## My idea #2026Q3')
		expect(result.opportunities[0].horizon).toBe('2026Q3')
		expect(result.opportunities[0].stage).toBe('explore')
	})

	it('parses @person tags', () => {
		const result = parseImportText('## Checkout @Alice @Bob-Smith')
		expect(result.opportunities[0].people).toEqual(['Alice', 'Bob-Smith'])
		expect(result.opportunities[0].title).toBe('Checkout')
	})

	it('parses bullets as deliverables linked to preceding opportunity', () => {
		const result = parseImportText('## Checkout\n- Payment SDK\n- Cart widget')
		expect(result.deliverables).toHaveLength(2)
		expect(result.deliverables[0].title).toBe('Payment SDK')
		expect(result.deliverables[0].opportunityIndex).toBe(0)
		expect(result.deliverables[1].opportunityIndex).toBe(0)
	})

	it('handles * and • bullets', () => {
		const result = parseImportText('## Idea\n* Star bullet\n• Round bullet')
		expect(result.deliverables).toHaveLength(2)
		expect(result.deliverables[0].title).toBe('Star bullet')
		expect(result.deliverables[1].title).toBe('Round bullet')
	})

	it('treats orphan bullets (no heading above) with index -1', () => {
		const result = parseImportText('- Orphan item\n## Heading\n- Linked item')
		expect(result.deliverables[0].title).toBe('Orphan item')
		expect(result.deliverables[0].opportunityIndex).toBe(-1)
		expect(result.deliverables[1].opportunityIndex).toBe(0)
	})

	it('treats plain text lines as opportunities', () => {
		const result = parseImportText('Just a line\nAnother line')
		expect(result.opportunities).toHaveLength(2)
		expect(result.opportunities[0].title).toBe('Just a line')
	})

	it('plain text with tags works', () => {
		const result = parseImportText('Fix auth #incident #validate @Security')
		expect(result.opportunities[0].title).toBe('Fix auth')
		expect(result.opportunities[0].stage).toBe('validate')
		expect(result.opportunities[0].origin).toBe('incident')
		expect(result.opportunities[0].people).toEqual(['Security'])
	})

	it('skips empty lines', () => {
		const result = parseImportText('## A\n\n## B\n\n')
		expect(result.opportunities).toHaveLength(2)
	})

	it('skips lines that are only tags with no title', () => {
		const result = parseImportText('## #sketch')
		expect(result.opportunities).toHaveLength(0)
	})

	it('bullets under second heading link to second opportunity', () => {
		const result = parseImportText('## First\n- D1\n## Second\n- D2\n- D3')
		expect(result.deliverables[0].opportunityIndex).toBe(0)
		expect(result.deliverables[1].opportunityIndex).toBe(1)
		expect(result.deliverables[2].opportunityIndex).toBe(1)
	})

	it('combines stage + origin + horizon + people', () => {
		const result = parseImportText('## Big project #validate #request #2026Q4 @PM @Dev-lead')
		const opp = result.opportunities[0]
		expect(opp.title).toBe('Big project')
		expect(opp.stage).toBe('validate')
		expect(opp.origin).toBe('demand')
		expect(opp.horizon).toBe('2026Q4')
		expect(opp.people).toEqual(['PM', 'Dev-lead'])
	})

	it('treats first-line single # as board name, h3 as opportunity', () => {
		const result = parseImportText('# H1 title\n### H3 title')
		expect(result.boardName).toBe('H1 title')
		expect(result.opportunities).toHaveLength(1)
		expect(result.opportunities[0].title).toBe('H3 title')
	})

	it('treats mid-text single # as opportunity, not board name', () => {
		const result = parseImportText('## First opp\n# Second heading')
		expect(result.boardName).toBeUndefined()
		expect(result.opportunities).toHaveLength(2)
	})

	it('returns empty for empty input', () => {
		const result = parseImportText('')
		expect(result.opportunities).toHaveLength(0)
		expect(result.deliverables).toHaveLength(0)
	})

	it('normalizes whitespace in titles', () => {
		const result = parseImportText('##   Lots   of   spaces   #sketch  ')
		expect(result.opportunities[0].title).toBe('Lots of spaces')
	})

	it('handles indented bullets', () => {
		const result = parseImportText('## Idea\n  - Indented bullet\n    - Deep indent')
		expect(result.deliverables).toHaveLength(2)
	})

	it('parses the default template correctly', () => {
		const result = parseImportText(IMPORT_TEMPLATE)
		expect(result.boardName).toBe('My product')
		expect(result.opportunities).toHaveLength(3)
		expect(result.deliverables).toHaveLength(3)
		expect(result.opportunities[0].title).toBe('Reduce onboarding churn')
		expect(result.opportunities[1].stage).toBe('sketch')
		expect(result.opportunities[2].origin).toBe('incident')
	})
})

describe('toPreview', () => {
	it('groups deliverables under their opportunity', () => {
		const parsed = parseImportText('## Feature\n- Task A\n- Task B')
		const preview = toPreview(parsed)
		expect(preview.opportunities).toHaveLength(1)
		expect(preview.opportunities[0].deliverables).toEqual(['Task A', 'Task B'])
	})

	it('collects orphan deliverables', () => {
		const parsed = parseImportText('- Orphan\n## Feature\n- Linked')
		const preview = toPreview(parsed)
		expect(preview.orphanDeliverables).toEqual(['Orphan'])
		expect(preview.opportunities[0].deliverables).toEqual(['Linked'])
	})

	it('preserves tags on preview opportunities', () => {
		const parsed = parseImportText('## Auth #validate #incident @Alice')
		const preview = toPreview(parsed)
		expect(preview.opportunities[0].stage).toBe('validate')
		expect(preview.opportunities[0].origin).toBe('incident')
		expect(preview.opportunities[0].people).toEqual(['Alice'])
	})
})

describe('materialize', () => {
	it('creates real entities from parsed board', () => {
		const parsed = parseImportText('## Feature #sketch @Alice\n- Task A\n- Task B')
		const { opportunities, deliverables, links } = materialize(parsed)

		expect(opportunities).toHaveLength(1)
		expect(opportunities[0].title).toBe('Feature')
		expect(opportunities[0].stage).toBe('sketch')
		expect(opportunities[0].people).toHaveLength(1)
		expect(opportunities[0].people[0].name).toBe('Alice')
		expect(opportunities[0].people[0].role).toBe('stakeholder')

		expect(deliverables).toHaveLength(2)
		expect(deliverables[0].title).toBe('Task A')

		expect(links).toHaveLength(2)
		expect(links[0].opportunityId).toBe(opportunities[0].id)
		expect(links[0].deliverableId).toBe(deliverables[0].id)
		expect(links[0].coverage).toBe('full')
	})

	it('creates orphan deliverables without links', () => {
		const parsed = parseImportText('- Orphan task')
		const { opportunities, deliverables, links } = materialize(parsed)

		expect(opportunities).toHaveLength(0)
		expect(deliverables).toHaveLength(1)
		expect(deliverables[0].title).toBe('Orphan task')
		expect(links).toHaveLength(0)
	})

	it('sets origin on opportunity', () => {
		const parsed = parseImportText('## Bug #debt')
		const { opportunities } = materialize(parsed)
		expect(opportunities[0].origin).toBe('debt')
	})

	it('sets horizon on opportunity', () => {
		const parsed = parseImportText('## Later #2027Q1')
		const { opportunities } = materialize(parsed)
		expect(opportunities[0].horizon).toBe('2027Q1')
	})

	it('generates unique IDs', () => {
		const parsed = parseImportText('## A\n## B')
		const { opportunities } = materialize(parsed)
		expect(opportunities[0].id).not.toBe(opportunities[1].id)
	})
})
