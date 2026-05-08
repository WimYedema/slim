import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteState } from './router'
import { onPopState, parseHash, pushRoute, replaceRoute, toHash } from './router'

describe('parseHash', () => {
	it('returns null for empty hash', () => {
		expect(parseHash('')).toBeNull()
		expect(parseHash('#')).toBeNull()
	})

	it('returns null for #welcome', () => {
		expect(parseHash('#welcome')).toBeNull()
	})

	it('parses simple view', () => {
		expect(parseHash('#briefing')).toEqual({ view: 'briefing' })
		expect(parseHash('#pipeline')).toEqual({ view: 'pipeline' })
		expect(parseHash('#deliverables')).toEqual({ view: 'deliverables' })
		expect(parseHash('#meetings')).toEqual({ view: 'meetings' })
		expect(parseHash('#team')).toEqual({ view: 'team' })
	})

	it('parses pipeline with horizon grouping', () => {
		expect(parseHash('#pipeline/horizon')).toEqual({
			view: 'pipeline',
			pipelineGrouping: 'horizon',
		})
	})

	it('ignores unknown grouping', () => {
		expect(parseHash('#pipeline/foo')).toEqual({ view: 'pipeline' })
	})

	it('parses pipeline with lens', () => {
		expect(parseHash('#pipeline/feasibility')).toEqual({
			view: 'pipeline',
			lens: 'feasibility',
		})
	})

	it('parses pipeline with grouping and lens', () => {
		expect(parseHash('#pipeline/horizon/viability')).toEqual({
			view: 'pipeline',
			pipelineGrouping: 'horizon',
			lens: 'viability',
		})
	})

	it('parses board with pipeline lens', () => {
		expect(parseHash('#board/b1/pipeline/desirability')).toEqual({
			view: 'pipeline',
			boardId: 'b1',
			lens: 'desirability',
		})
	})

	it('parses board ID with view', () => {
		expect(parseHash('#board/abc-123/briefing')).toEqual({
			view: 'briefing',
			boardId: 'abc-123',
		})
	})

	it('parses board ID with pipeline grouping', () => {
		expect(parseHash('#board/abc-123/pipeline/horizon')).toEqual({
			view: 'pipeline',
			boardId: 'abc-123',
			pipelineGrouping: 'horizon',
		})
	})

	it('returns null for unknown view', () => {
		expect(parseHash('#unknown')).toBeNull()
		expect(parseHash('#board/abc/unknown')).toBeNull()
	})

	it('returns null for incomplete board path', () => {
		expect(parseHash('#board/abc')).toBeNull()
		expect(parseHash('#board')).toBeNull()
	})

	it('handles hash with leading #', () => {
		expect(parseHash('#deliverables')).toEqual({ view: 'deliverables' })
	})

	it('handles hash without leading #', () => {
		expect(parseHash('meetings')).toEqual({ view: 'meetings' })
	})
})

describe('toHash', () => {
	it('serializes simple view', () => {
		expect(toHash({ view: 'briefing' })).toBe('#briefing')
		expect(toHash({ view: 'deliverables' })).toBe('#deliverables')
	})

	it('serializes pipeline with horizon grouping', () => {
		expect(toHash({ view: 'pipeline', pipelineGrouping: 'horizon' })).toBe('#pipeline/horizon')
	})

	it('omits stage grouping (default)', () => {
		expect(toHash({ view: 'pipeline' })).toBe('#pipeline')
		expect(toHash({ view: 'pipeline', pipelineGrouping: 'stage' })).toBe('#pipeline')
	})

	it('serializes board ID', () => {
		expect(toHash({ view: 'briefing', boardId: 'abc-123' })).toBe('#board/abc-123/briefing')
	})

	it('serializes board ID with pipeline grouping', () => {
		expect(toHash({ view: 'pipeline', boardId: 'x', pipelineGrouping: 'horizon' })).toBe(
			'#board/x/pipeline/horizon',
		)
	})

	it('serializes pipeline with lens', () => {
		expect(toHash({ view: 'pipeline', lens: 'feasibility' })).toBe('#pipeline/feasibility')
	})

	it('serializes pipeline with grouping and lens', () => {
		expect(toHash({ view: 'pipeline', pipelineGrouping: 'horizon', lens: 'viability' })).toBe(
			'#pipeline/horizon/viability',
		)
	})

	it('omits null lens', () => {
		expect(toHash({ view: 'pipeline', lens: null })).toBe('#pipeline')
	})
})

describe('parseHash ↔ toHash roundtrip', () => {
	const cases: RouteState[] = [
		{ view: 'briefing' },
		{ view: 'pipeline' },
		{ view: 'pipeline', pipelineGrouping: 'horizon' },
		{ view: 'deliverables' },
		{ view: 'meetings' },
		{ view: 'team' },
		{ view: 'briefing', boardId: 'board-1' },
		{ view: 'pipeline', boardId: 'board-1', pipelineGrouping: 'horizon' },
		{ view: 'pipeline', lens: 'feasibility' },
		{ view: 'pipeline', pipelineGrouping: 'horizon', lens: 'desirability' },
		{ view: 'pipeline', boardId: 'b1', lens: 'viability' },
	]

	for (const state of cases) {
		it(`roundtrips ${JSON.stringify(state)}`, () => {
			expect(parseHash(toHash(state))).toEqual(state)
		})
	}
})

describe('pushRoute', () => {
	beforeEach(() => {
		vi.spyOn(history, 'pushState').mockImplementation(() => {})
	})
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('calls pushState with hash', () => {
		// Set location.hash to something different
		Object.defineProperty(window, 'location', {
			value: { ...window.location, hash: '' },
			writable: true,
		})
		pushRoute({ view: 'pipeline' })
		expect(history.pushState).toHaveBeenCalledWith(null, '', '#pipeline')
	})
})

describe('replaceRoute', () => {
	beforeEach(() => {
		vi.spyOn(history, 'replaceState').mockImplementation(() => {})
	})
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('calls replaceState with hash', () => {
		Object.defineProperty(window, 'location', {
			value: { ...window.location, hash: '' },
			writable: true,
		})
		replaceRoute({ view: 'deliverables', boardId: 'b1' })
		expect(history.replaceState).toHaveBeenCalledWith(null, '', '#board/b1/deliverables')
	})
})

describe('onPopState', () => {
	it('registers and unregisters popstate listener', () => {
		const addSpy = vi.spyOn(window, 'addEventListener')
		const removeSpy = vi.spyOn(window, 'removeEventListener')

		const cb = vi.fn()
		const cleanup = onPopState(cb)

		expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function))

		cleanup()
		expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function))

		addSpy.mockRestore()
		removeSpy.mockRestore()
	})
})
