// ── Hash-based router for Slim ──
//
// Scheme:
//   (empty) / #welcome          → welcome page
//   #briefing                   → briefing (active board from localStorage)
//   #pipeline                   → pipeline, default grouping
//   #pipeline/horizon           → pipeline, grouped by horizon
//   #deliverables               → deliverables
//   #meetings                   → meetings
//   #team                       → team
//   #board/{id}/pipeline        → specific board + view
//   #board/{id}/pipeline/horizon → specific board + view + grouping
//   #pipeline/feasibility         → pipeline with perspective lens
//   #pipeline/horizon/feasibility → pipeline, horizon grouping + lens
//
// Push on navigation (view switch, board switch).
// Replace on refinement (grouping, lens).

export type ViewMode = 'briefing' | 'pipeline' | 'deliverables' | 'meetings' | 'team'
export type Lens = 'desirability' | 'feasibility' | 'viability'

export interface RouteState {
	view: ViewMode
	boardId?: string
	pipelineGrouping?: 'stage' | 'horizon'
	lens?: Lens | null
}

const VALID_VIEWS = new Set<ViewMode>(['briefing', 'pipeline', 'deliverables', 'meetings', 'team'])
const VALID_LENSES = new Set<Lens>(['desirability', 'feasibility', 'viability'])

export function parseHash(hash: string): RouteState | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash
	if (!raw || raw === 'welcome') return null

	const parts = raw.split('/')

	let boardId: string | undefined
	let offset = 0

	// #board/{id}/...
	if (parts[0] === 'board' && parts.length >= 3) {
		boardId = parts[1]
		offset = 2
	}

	const viewPart = parts[offset] as ViewMode
	if (!VALID_VIEWS.has(viewPart)) return null

	const result: RouteState = { view: viewPart }
	if (boardId) result.boardId = boardId

	// Pipeline suffixes: grouping and/or lens (unambiguous — values don't overlap)
	if (viewPart === 'pipeline') {
		for (let i = offset + 1; i < parts.length; i++) {
			if (parts[i] === 'horizon') result.pipelineGrouping = 'horizon'
			else if (VALID_LENSES.has(parts[i] as Lens)) result.lens = parts[i] as Lens
		}
	}

	return result
}

export function toHash(state: RouteState): string {
	const parts: string[] = []

	if (state.boardId) {
		parts.push('board', state.boardId)
	}

	parts.push(state.view)

	if (state.view === 'pipeline') {
		if (state.pipelineGrouping === 'horizon') parts.push('horizon')
		if (state.lens) parts.push(state.lens)
	}

	return `#${parts.join('/')}`
}

export function pushRoute(state: RouteState): void {
	const hash = toHash(state)
	if (location.hash !== hash) {
		history.pushState(null, '', hash)
	}
}

export function replaceRoute(state: RouteState): void {
	const hash = toHash(state)
	if (location.hash !== hash) {
		history.replaceState(null, '', hash)
	}
}

export function onPopState(callback: (state: RouteState | null) => void): () => void {
	function handler() {
		callback(parseHash(location.hash))
	}
	window.addEventListener('popstate', handler)
	return () => window.removeEventListener('popstate', handler)
}
