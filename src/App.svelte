<script lang="ts">
	import ListView from './components/ListView.svelte'
	import DetailPane from './components/DetailPane.svelte'
	import DeliverablesView from './components/DeliverablesView.svelte'
	import DeliverableDetailPane from './components/DeliverableDetailPane.svelte'
	import MeetingView from './components/MeetingView.svelte'
	import RoadmapView from './components/RoadmapView.svelte'
	import KeyboardHelp from './components/KeyboardHelp.svelte'
	import QuickAdd from './components/QuickAdd.svelte'
	import {
		type Opportunity,
		type Stage,
		type Deliverable,
		type OpportunityDeliverableLink,
		createOpportunity,
		createDeliverable,
		nextStage,
		stageConsent,
	} from './lib/types'
	import { saveBoard, loadBoard, clearBoard, saveMeetingData, loadMeetingData, type BoardData } from './lib/store'
	import type { MeetingData } from './lib/meeting'

	type ViewMode = 'opportunities' | 'deliverables' | 'roadmap' | 'meetings'

	/** Pre-populated sample data for the PoC */
	function createSampleData(): Opportunity[] {
		const opp1 = createOpportunity('SSO login for enterprise')
		opp1.stage = 'validate'
		opp1.horizon = '2026Q2'
		opp1.origin = 'demand'
		opp1.stageEnteredAt = Date.now() - 10 * 86_400_000
		opp1.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Top request from enterprise prospects', evidence: '', owner: '' }
		opp1.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'Standard SAML/OIDC integration', evidence: '', owner: '' }
		opp1.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Unlocks enterprise tier', evidence: '', owner: '' }
		opp1.signals.sketch.desirability = { score: 'positive', source: 'manual', verdict: '12 enterprise accounts waiting', evidence: 'Sales pipeline', owner: '' }
		opp1.signals.sketch.feasibility = { score: 'uncertain', source: 'manual', verdict: 'Need to support both SAML and OIDC', evidence: '', owner: '' }
		opp1.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'ARR increase projected at 40%', evidence: '', owner: '' }
		opp1.people = [
			{ id: 'p1', name: 'Sarah', role: 'expert', perspectives: [{ perspective: 'feasibility', stage: 'validate', assignedAt: Date.now() - 3 * 86_400_000 }] },
			{ id: 'p2', name: 'Marcus', role: 'stakeholder', perspectives: [{ perspective: 'viability', stage: 'validate', assignedAt: Date.now() - 5 * 86_400_000 }] },
		]
		opp1.commitments = [
			{ id: 'c1', to: 'CEO', milestone: 'validate', by: Date.now() + 5 * 86_400_000 },
		]

		const opp2 = createOpportunity('Dark mode')
		opp2.stage = 'sketch'
		opp2.horizon = '2026Q3'
		opp2.origin = 'demand'
		opp2.stageEnteredAt = Date.now() - 3 * 86_400_000
		opp2.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Community votes #2 request', evidence: 'User forum', owner: '' }
		opp2.signals.explore.feasibility = { score: 'uncertain', source: 'manual', verdict: 'CSS vars mostly ready', evidence: '', owner: '' }
		opp2.signals.explore.viability = { score: 'none', source: 'manual', verdict: '', evidence: '', owner: '' }

		const opp3 = createOpportunity('Offline mode')
		opp3.stage = 'explore'
		opp3.horizon = '2026Q4'
		opp3.origin = 'demand'
		opp3.signals.explore.desirability = { score: 'uncertain', source: 'manual', verdict: 'Field workers mentioned it', evidence: '', owner: '' }

		const opp4 = createOpportunity('AI-generated reports')
		opp4.stage = 'sketch'
		opp4.horizon = '2026Q3'
		opp4.origin = 'supply'
		opp4.stageEnteredAt = Date.now() - 18 * 86_400_000
		opp4.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Managers want automated insights', evidence: 'Interview notes', owner: '' }
		opp4.signals.explore.feasibility = { score: 'negative', source: 'manual', verdict: 'LLM costs too high at scale', evidence: '', owner: '' }
		opp4.signals.explore.viability = { score: 'uncertain', source: 'manual', verdict: 'Could be premium add-on', evidence: '', owner: '' }
		opp4.signals.sketch.feasibility = { score: 'uncertain', source: 'manual', verdict: 'Local models might work', evidence: '', owner: '' }
		opp4.people = [
			{ id: 'p3', name: 'Alex', role: 'expert', perspectives: [{ perspective: 'feasibility', stage: 'sketch', assignedAt: Date.now() - 1 * 86_400_000 }] },
		]

		const opp5 = createOpportunity('Mobile app')
		opp5.stage = 'explore'
		opp5.horizon = '2026Q4'
		opp5.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: '60% of users on mobile browser', evidence: 'Analytics', owner: '' }
		opp5.signals.explore.feasibility = { score: 'none', source: 'manual', verdict: '', evidence: '', owner: '' }
		opp5.signals.explore.viability = { score: 'none', source: 'manual', verdict: '', evidence: '', owner: '' }

		const opp6 = createOpportunity('Webhooks API')
		opp6.stage = 'decompose'
		opp6.horizon = '2026Q2'
		opp6.origin = 'demand'
		opp6.stageEnteredAt = Date.now() - 2 * 86_400_000
		opp6.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Integration partners need it', evidence: '', owner: '' }
		opp6.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'Event system already exists', evidence: '', owner: '' }
		opp6.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Drives platform stickiness', evidence: '', owner: '' }
		opp6.signals.sketch.desirability = { score: 'positive', source: 'manual', verdict: 'Top 5 partners committed', evidence: '', owner: '' }
		opp6.signals.sketch.feasibility = { score: 'positive', source: 'manual', verdict: 'REST + retry pattern defined', evidence: '', owner: '' }
		opp6.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'Partners pay for API tier', evidence: '', owner: '' }
		opp6.signals.validate.desirability = { score: 'positive', source: 'manual', verdict: 'Beta partners integrated successfully', evidence: '', owner: '' }
		opp6.signals.validate.feasibility = { score: 'positive', source: 'manual', verdict: 'Spike completed, 99.9% delivery rate', evidence: '', owner: '' }
		opp6.signals.validate.viability = { score: 'positive', source: 'manual', verdict: '3 partners upgraded to API tier', evidence: '', owner: '' }
		opp6.signals.decompose.desirability = { score: 'positive', source: 'manual', verdict: 'Acceptance criteria signed off', evidence: '', owner: '' }
		opp6.signals.decompose.feasibility = { score: 'positive', source: 'manual', verdict: '3 sprints, 2 devs', evidence: '', owner: '' }
		opp6.signals.decompose.viability = { score: 'positive', source: 'manual', verdict: 'Budget allocated Q3', evidence: '', owner: '' }
		opp6.decompositionComplete = true

		const opp7 = createOpportunity('CSV export revamp')
		opp7.stage = 'explore'
		opp7.horizon = '2026Q4'
		opp7.origin = 'debt'
		opp7.stageEnteredAt = Date.now() - 22 * 86_400_000

		const opp8 = createOpportunity('Multi-language support')
		opp8.stage = 'sketch'
		opp8.horizon = '2026Q3'
		opp8.signals.explore.desirability = { score: 'uncertain', source: 'manual', verdict: 'DACH market expansion', evidence: '', owner: '' }
		opp8.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'i18n framework ready', evidence: '', owner: '' }
		opp8.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Opens 3 new markets', evidence: '', owner: '' }
		opp8.signals.sketch.feasibility = { score: 'positive', source: 'manual', verdict: '80% strings already extracted', evidence: '', owner: '' }
		opp8.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'Translation budget approved', evidence: '', owner: '' }
		opp8.commitments = [
			{ id: 'c2', to: 'DACH partner', milestone: 'sketch', by: Date.now() - 3 * 86_400_000 },
		]

		return [opp1, opp2, opp3, opp4, opp5, opp6, opp7, opp8]
	}

	function createSampleDeliverables(opps: Opportunity[]): { deliverables: Deliverable[]; links: OpportunityDeliverableLink[] } {
		const webhooks = opps.find((o) => o.title === 'Webhooks API')!
		const sso = opps.find((o) => o.title === 'SSO login for enterprise')!

		const d1 = createDeliverable('Webhook event bus')
		d1.externalUrl = 'https://jira.example.com/PROD-142'
		d1.size = 'L'
		d1.certainty = 4
		d1.extraContributors = ['Alice', 'Bob']
		const d2 = createDeliverable('Webhook retry & DLQ')
		d2.extraContributors = ['DevOps team', 'Bob']
		d2.size = 'M'
		d2.certainty = 3
		const d3 = createDeliverable('Partner dashboard')
		d3.size = 'XL'
		d3.certainty = 2
		d3.extraContributors = ['Carol']
		d3.externalDependency = 'Partner API access from Acme Corp'
		const d4 = createDeliverable('SAML integration')
		d4.size = 'S'
		d4.certainty = 5
		d4.extraContributors = ['Alice']
		const d5 = createDeliverable('OIDC integration')
		d5.size = 'S'
		d5.certainty = 4
		d5.extraContributors = ['Alice']
		const d6 = createDeliverable('Webhook docs & SDK examples')
		d6.size = 'XS'
		d6.certainty = 5
		d6.extraContributors = ['Carol']

		const deliverables = [d1, d2, d3, d4, d5, d6]
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: webhooks.id, deliverableId: d1.id, coverage: 'full' },
			{ opportunityId: webhooks.id, deliverableId: d2.id, coverage: 'full' },
			{ opportunityId: webhooks.id, deliverableId: d3.id, coverage: 'partial' },
			{ opportunityId: sso.id, deliverableId: d4.id, coverage: 'partial' },
			{ opportunityId: sso.id, deliverableId: d5.id, coverage: 'partial' },
			// d3 (Partner dashboard) also serves SSO — many-to-many!
			{ opportunityId: sso.id, deliverableId: d3.id, coverage: 'partial' },
			{ opportunityId: webhooks.id, deliverableId: d6.id, coverage: 'full' },
		]
		return { deliverables, links }
	}

	const saved = loadBoard()
	const savedMeetings = loadMeetingData()
	const sampleOpps = createSampleData()
	const sampleDL = createSampleDeliverables(sampleOpps)

	let opportunities: Opportunity[] = $state(saved?.opportunities ?? sampleOpps)
	let deliverables: Deliverable[] = $state(saved?.deliverables ?? sampleDL.deliverables)
	let links: OpportunityDeliverableLink[] = $state(saved?.links ?? sampleDL.links)
	let customHorizons: string[] = $state(saved?.customHorizons ?? [])
	let meetingData: MeetingData = $state(savedMeetings)
	let selectedId: string | null = $state(null)
	let selectedDeliverableId: string | null = $state(null)
	let view: ViewMode = $state('opportunities')
	let showHelp = $state(false)
	let showQuickAdd = $state(false)

	// ── Undo stack (snapshot-based) ──
	interface UndoSnapshot {
		label: string
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
	}

	let undoStack: UndoSnapshot[] = $state([])
	let undoMessage: string = $state('')

	function pushUndo(label: string) {
		undoStack = [...undoStack.slice(-19), {
			label,
			opportunities: structuredClone($state.snapshot(opportunities)),
			deliverables: structuredClone($state.snapshot(deliverables)),
			links: structuredClone($state.snapshot(links)),
		}]
	}

	function undo() {
		const snap = undoStack.at(-1)
		if (!snap) return
		undoStack = undoStack.slice(0, -1)
		opportunities = snap.opportunities
		deliverables = snap.deliverables
		links = snap.links
		undoMessage = `Undid: ${snap.label}`
		setTimeout(() => undoMessage = '', 2500)
	}

	$effect(() => {
		saveBoard({ opportunities, deliverables, links, customHorizons })
	})

	$effect(() => {
		saveMeetingData(meetingData)
	})

	/** Flat ordered list of opportunity IDs — synced from ListView's bucket sort */
	let listViewOrderedIds: string[] = $state([])

	/** Flat ordered list of deliverable IDs — synced from DeliverablesView's visual order */
	let delViewOrderedIds: string[] = $state([])

	function isTyping(): boolean {
		const el = document.activeElement
		return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
	}

	function navigateList(direction: 1 | -1) {
		if (view === 'opportunities') {
			const ids = listViewOrderedIds
			if (ids.length === 0) return
			if (!selectedId || !ids.includes(selectedId)) {
				selectedId = direction === 1 ? ids[0] : ids[ids.length - 1]
			} else {
				const idx = ids.indexOf(selectedId)
				const next = idx + direction
				if (next >= 0 && next < ids.length) selectedId = ids[next]
			}
		} else if (view === 'deliverables') {
			const ids = delViewOrderedIds
			if (ids.length === 0) return
			if (!selectedDeliverableId || !ids.includes(selectedDeliverableId)) {
				selectedDeliverableId = direction === 1 ? ids[0] : ids[ids.length - 1]
			} else {
				const idx = ids.indexOf(selectedDeliverableId)
				const next = idx + direction
				if (next >= 0 && next < ids.length) selectedDeliverableId = ids[next]
			}
		}
	}

	function focusAddInput() {
		// Focus the add input in the current view (ListView or DeliverablesView)
		const input = (document.querySelector('.add-input') ?? document.querySelector('.dv-add-input')) as HTMLInputElement | null
		input?.focus()
	}

	function focusEditTitle() {
		// Focus the title input in the open detail pane (opportunity or deliverable)
		const input = (document.querySelector('.pane-title-input') ?? document.querySelector('.ddp-input')) as HTMLInputElement | null
		input?.focus()
		input?.select()
	}

	function advanceSelected() {
		if (view !== 'opportunities' || !selectedId) return
		const opp = opportunities.find(o => o.id === selectedId)
		if (!opp || opp.discontinuedAt) return
		const next = nextStage(opp.stage)
		if (!next) return
		const consent = stageConsent(opp)
		if (consent.status !== 'ready') return
		moveOpportunity(opp.id, next)
	}

	function exitSelected() {
		if (view !== 'opportunities' || !selectedId) return
		const opp = opportunities.find(o => o.id === selectedId)
		if (!opp || opp.discontinuedAt) return
		// Open detail pane first if not open, the exit menu is there
		if (!selectedOpportunity) {
			selectedId = opp.id
		}
		// Dispatch a custom event that DetailPane can listen to
		window.dispatchEvent(new CustomEvent('upstream:open-exit-menu'))
	}

	const VIEW_KEYS: Record<string, ViewMode> = { '1': 'opportunities', '2': 'deliverables', '3': 'roadmap', '4': 'meetings' }

	$effect(() => {
		function onKeydown(e: KeyboardEvent) {
			// Ctrl+Z always available (except in inputs)
			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				if (isTyping()) return
				e.preventDefault()
				undo()
				return
			}

			// All other shortcuts blocked while typing
			if (isTyping()) return

			// Help toggle
			if (e.key === '?') {
				e.preventDefault()
				showHelp = !showHelp
				return
			}

			// Close dialogs / panes (layered)
			if (e.key === 'Escape') {
				if (showHelp) { showHelp = false; return }
				if (showQuickAdd) { showQuickAdd = false; return }
				if (selectedId) { selectedId = null; return }
				if (selectedDeliverableId) { selectedDeliverableId = null; return }
				return
			}

			// View switching: 1-4
			if (e.key in VIEW_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault()
				switchView(VIEW_KEYS[e.key])
				return
			}

			// List navigation: j/k or arrows
			if (e.key === 'j' || e.key === 'ArrowDown') {
				e.preventDefault()
				navigateList(1)
				return
			}
			if (e.key === 'k' || e.key === 'ArrowUp') {
				e.preventDefault()
				navigateList(-1)
				return
			}

			// Open detail / confirm selection
			if (e.key === 'Enter') {
				e.preventDefault()
				if (view === 'opportunities' && selectedId) {
					// Detail pane is already shown when selectedId is set
					// Focus the title for immediate editing
					requestAnimationFrame(() => focusEditTitle())
				} else if (view === 'deliverables' && selectedDeliverableId) {
					requestAnimationFrame(() => focusEditTitle())
				}
				return
			}

			// New item — open quick-add from any view
			if (e.key === 'n') {
				e.preventDefault()
				showQuickAdd = true
				return
			}

			// Focus in-view add input
			if (e.key === '/') {
				e.preventDefault()
				focusAddInput()
				return
			}

			// Edit title — opens detail pane if not already open
			if (e.key === 'e') {
				e.preventDefault()
				if (view === 'opportunities' && selectedId) {
					// Pane is already open (selectedId triggers it), just focus
					requestAnimationFrame(() => focusEditTitle())
				} else if (view === 'deliverables' && selectedDeliverableId) {
					requestAnimationFrame(() => focusEditTitle())
				}
				return
			}

			// Advance
			if (e.key === 'a') {
				e.preventDefault()
				advanceSelected()
				return
			}

			// Exit / discontinue
			if (e.key === 'x') {
				e.preventDefault()
				exitSelected()
				return
			}
		}
		window.addEventListener('keydown', onKeydown)
		return () => window.removeEventListener('keydown', onKeydown)
	})

	const selectedOpportunity = $derived(
		selectedId ? opportunities.find((o) => o.id === selectedId) ?? null : null,
	)

	/** All known horizons: from opportunities + custom empty ones, sorted naturally */
	const allHorizons = $derived(() => {
		const set = new Set<string>()
		for (const opp of opportunities) {
			if (!opp.discontinuedAt && opp.horizon) set.add(opp.horizon)
		}
		for (const h of customHorizons) set.add(h)
		return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	})

	const selectedDeliverable = $derived(
		selectedDeliverableId ? deliverables.find((d) => d.id === selectedDeliverableId) ?? null : null,
	)

	function addOpportunity(title: string) {
		opportunities = [...opportunities, createOpportunity(title)]
	}

	function moveOpportunity(id: string, stage: Stage) {
		const now = Date.now()
		opportunities = opportunities.map((o) =>
			o.id === id ? { ...o, stage, updatedAt: now, stageEnteredAt: now } : o
		)
	}

	function updateOpportunity(updated: Opportunity) {
		const prev = opportunities.find(o => o.id === updated.id)
		if (prev && !prev.discontinuedAt && updated.discontinuedAt) {
			pushUndo(`Exit: ${prev.title}`)
		}
		opportunities = opportunities.map((o) => (o.id === updated.id ? { ...updated, updatedAt: Date.now() } : o))
	}

	function selectOpportunity(id: string) {
		selectedId = id
	}

	// ── Deliverable management ──

	function addDeliverable(title: string): Deliverable {
		const d = createDeliverable(title)
		deliverables = [...deliverables, d]
		return d
	}

	function updateDeliverable(updated: Deliverable) {
		deliverables = deliverables.map((d) => (d.id === updated.id ? { ...updated, updatedAt: Date.now() } : d))
	}

	function removeDeliverable(id: string) {
		pushUndo('Remove deliverable')
		deliverables = deliverables.filter((d) => d.id !== id)
		links = links.filter((l) => l.deliverableId !== id)
	}

	function linkDeliverable(opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') {
		// Prevent duplicates
		if (links.some((l) => l.opportunityId === opportunityId && l.deliverableId === deliverableId)) return
		links = [...links, { opportunityId, deliverableId, coverage }]
	}

	function unlinkDeliverable(opportunityId: string, deliverableId: string) {
		links = links.filter((l) => !(l.opportunityId === opportunityId && l.deliverableId === deliverableId))
	}

	function updateLinkCoverage(opportunityId: string, deliverableId: string, coverage: 'full' | 'partial') {
		links = links.map((l) =>
			l.opportunityId === opportunityId && l.deliverableId === deliverableId
				? { ...l, coverage }
				: l
		)
	}

	function switchView(v: ViewMode) {
		view = v
		selectedId = null
		selectedDeliverableId = null
	}

	function resetBoard() {
		pushUndo('Reset board')
		clearBoard()
		const freshOpps = createSampleData()
		const freshDL = createSampleDeliverables(freshOpps)
		opportunities = freshOpps
		deliverables = freshDL.deliverables
		links = freshDL.links
		customHorizons = []
		meetingData = { lastDiscussed: {}, records: [], snapshots: {} }
		selectedId = null
		selectedDeliverableId = null
	}

	// ── Import / Export ──

	function exportJSON() {
		const data: BoardData = { opportunities, deliverables, links, customHorizons }
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `upstream-${new Date().toISOString().slice(0, 10)}.json`
		a.click()
		URL.revokeObjectURL(url)
	}

	function exportCSV() {
		const header = 'Title,Stage,Origin,Horizon,Desirability,Feasibility,Viability,Created'
		const rows = opportunities.map((o) => {
			const scores = o.signals[o.stage]
			return [
				csvEscape(o.title),
				o.stage,
				o.origin ?? '',
				o.horizon,
				scores.desirability.score,
				scores.feasibility.score,
				scores.viability.score,
				new Date(o.createdAt).toISOString().slice(0, 10),
			].join(',')
		})
		const csv = [header, ...rows].join('\n')
		const blob = new Blob([csv], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `upstream-${new Date().toISOString().slice(0, 10)}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	function csvEscape(s: string): string {
		if (s.includes(',') || s.includes('"') || s.includes('\n')) {
			return `"${s.replace(/"/g, '""')}"`
		}
		return s
	}

	function importJSON() {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json'
		input.onchange = () => {
			const file = input.files?.[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = () => {
				try {
					const data = JSON.parse(reader.result as string) as BoardData
					if (!Array.isArray(data.opportunities) || !Array.isArray(data.deliverables) || !Array.isArray(data.links)) {
						alert('Invalid file format — expected Upstream JSON export.')
						return
					}
					opportunities = data.opportunities
					deliverables = data.deliverables
					links = data.links
					customHorizons = data.customHorizons ?? []
					selectedId = null
					selectedDeliverableId = null
				} catch {
					alert('Could not parse file — expected valid JSON.')
				}
			}
			reader.readAsText(file)
		}
		input.click()
	}
</script>

<main class="app">
	<header class="app-header">
		<h1>Upstream</h1>
		<nav class="view-tabs">
			<button class="view-tab" class:active={view === 'opportunities'} onclick={() => switchView('opportunities')}>Opportunities</button>
			<button class="view-tab" class:active={view === 'deliverables'} onclick={() => switchView('deliverables')}>Deliverables</button>
			<button class="view-tab" class:active={view === 'roadmap'} onclick={() => switchView('roadmap')}>Roadmap</button>
			<button class="view-tab" class:active={view === 'meetings'} onclick={() => switchView('meetings')}>Meetings</button>
		</nav>
		<div class="header-actions">
			<button class="action-btn" onclick={importJSON} title="Import board from JSON file">Import</button>
			<button class="action-btn" onclick={exportJSON} title="Export full board as JSON">JSON</button>
			<button class="action-btn" onclick={exportCSV} title="Export opportunities as CSV">CSV</button>
			<button class="reset-btn" onclick={resetBoard} title="Clears all data and reloads sample dataset">Reset</button>
			<button class="help-btn" onclick={() => showHelp = true} title="Keyboard shortcuts (?)">?</button>
		</div>
	</header>
	{#if view === 'opportunities'}
	<div class="split-layout">
		<div class="split-list">
			<ListView {opportunities} {selectedId} {links} allHorizons={allHorizons()} onSelect={selectOpportunity} onAdvance={moveOpportunity} onAdd={addOpportunity} compact={!!selectedId} bind:orderedIds={listViewOrderedIds} />
		</div>
		{#if selectedOpportunity}
			<div class="split-detail">
				<DetailPane
					opportunity={selectedOpportunity}
					{deliverables}
					{links}
					allHorizons={allHorizons()}
					onUpdate={updateOpportunity}
					onClose={() => (selectedId = null)}
					onAddDeliverable={addDeliverable}
					onUpdateDeliverable={updateDeliverable}
					onLinkDeliverable={linkDeliverable}
					onUnlinkDeliverable={unlinkDeliverable}
					onUpdateLinkCoverage={updateLinkCoverage}
				/>
			</div>
		{/if}
	</div>
	{:else if view === 'deliverables'}
	<div class="split-layout">
		<div class="split-list">
			<DeliverablesView
				{deliverables}
				{links}
				{opportunities}
				selectedId={selectedDeliverableId}
				onAdd={addDeliverable}
				onUpdate={updateDeliverable}
				onRemove={removeDeliverable}
				onLink={linkDeliverable}
				onUnlink={unlinkDeliverable}
				onUpdateCoverage={updateLinkCoverage}
				onSelectOpportunity={(id) => { selectedDeliverableId = null; selectedId = selectedId === id ? null : id }}
				onSelectDeliverable={(id) => { selectedId = null; selectedDeliverableId = selectedDeliverableId === id ? null : id }}
				bind:orderedIds={delViewOrderedIds}
			/>
		</div>
		{#if selectedOpportunity}
			<div class="split-detail">
				<DetailPane
					opportunity={selectedOpportunity}
					{deliverables}
					{links}
					allHorizons={allHorizons()}
					onUpdate={updateOpportunity}
					onClose={() => (selectedId = null)}
					onAddDeliverable={addDeliverable}
					onUpdateDeliverable={updateDeliverable}
					onLinkDeliverable={linkDeliverable}
					onUnlinkDeliverable={unlinkDeliverable}
					onUpdateLinkCoverage={updateLinkCoverage}
				/>
			</div>
		{:else if selectedDeliverable}
			<div class="split-detail">
				<DeliverableDetailPane
					deliverable={selectedDeliverable}
					{links}
					{opportunities}
					onUpdate={updateDeliverable}
					onRemove={removeDeliverable}
					onLink={linkDeliverable}
					onUnlink={unlinkDeliverable}
					onUpdateCoverage={updateLinkCoverage}
					onClose={() => (selectedDeliverableId = null)}
					onSelectOpportunity={(id) => { selectedDeliverableId = null; selectedId = id }}
				/>
			</div>
		{/if}
	</div>
	{:else if view === 'roadmap'}
	<div class="split-layout">
		<div class="split-list">
			<RoadmapView
				{opportunities}
				{deliverables}
				{links}
				{customHorizons}
				onSelect={(id) => { selectedId = selectedId === id ? null : id }}
				onUpdateOpportunity={updateOpportunity}
				onAddHorizon={(h) => { if (!customHorizons.includes(h)) customHorizons = [...customHorizons, h] }}
				onRemoveHorizon={(h) => { customHorizons = customHorizons.filter((c) => c !== h) }}
			/>
		</div>
		{#if selectedOpportunity}
			<div class="split-detail">
				<DetailPane
					opportunity={selectedOpportunity}
					{deliverables}
					{links}
					allHorizons={allHorizons()}
					onUpdate={updateOpportunity}
					onClose={() => (selectedId = null)}
					onAddDeliverable={addDeliverable}
					onUpdateDeliverable={updateDeliverable}
					onLinkDeliverable={linkDeliverable}
					onUnlinkDeliverable={unlinkDeliverable}
					onUpdateLinkCoverage={updateLinkCoverage}
				/>
			</div>
		{/if}
	</div>
	{:else if view === 'meetings'}
	<div class="split-layout">
		<div class="split-list">
			<MeetingView
				{opportunities}
				{deliverables}
				{links}
				{meetingData}
				onSelectOpportunity={(id) => { selectedId = selectedId === id ? null : id }}
				onUpdateOpportunity={updateOpportunity}
				onUpdateMeetingData={(data) => { meetingData = data }}
			/>
		</div>
		{#if selectedOpportunity}
			<div class="split-detail">
				<DetailPane
					opportunity={selectedOpportunity}
					{deliverables}
					{links}
					allHorizons={allHorizons()}
					onUpdate={updateOpportunity}
					onClose={() => (selectedId = null)}
					onAddDeliverable={addDeliverable}
					onUpdateDeliverable={updateDeliverable}
					onLinkDeliverable={linkDeliverable}
					onUnlinkDeliverable={unlinkDeliverable}
					onUpdateLinkCoverage={updateLinkCoverage}
				/>
			</div>
		{/if}
	</div>
	{/if}
</main>

{#if undoMessage}
	<div class="undo-toast">{undoMessage}</div>
{/if}

{#if showHelp}
	<KeyboardHelp onClose={() => showHelp = false} />
{/if}

{#if showQuickAdd}
	<QuickAdd
		onAddOpportunity={(title) => addOpportunity(title)}
		onAddDeliverable={(title) => { addDeliverable(title) }}
		onClose={() => showQuickAdd = false}
	/>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
		background: var(--c-bg);
		font-family: var(--font);
		color: var(--c-text);
	}

	.split-layout {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.split-list {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.split-detail {
		width: clamp(420px, 45vw, 680px);
		flex-shrink: 0;
		border-left: 1px solid var(--c-border-soft);
		background: var(--c-surface);
		min-height: 0;
		overflow: hidden;
	}

	.app-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-md);
		padding: var(--sp-md) var(--sp-lg);
		border-bottom: 1px solid var(--c-border-soft);
	}

	.app-header h1 {
		margin: 0;
		font-size: var(--fs-2xl);
		font-weight: 700;
	}

	.view-tabs {
		display: flex;
		gap: var(--sp-xs);
		margin-left: var(--sp-md);
	}

	.view-tab {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.view-tab:hover {
		background: var(--c-hover);
	}

	.view-tab.active {
		color: var(--c-text);
		font-weight: 600;
		background: var(--c-hover);
	}

	.reset-btn {
		background: none;
		border: 1px solid var(--c-border-soft);
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.reset-btn:hover {
		background: var(--c-hover);
		color: var(--c-text);
	}

	.header-actions {
		display: flex;
		gap: var(--sp-xs);
		margin-left: auto;
		align-items: center;
	}

	.action-btn {
		background: none;
		border: 1px solid var(--c-border-soft);
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.action-btn:hover {
		background: var(--c-hover);
		color: var(--c-text);
	}

	.help-btn {
		background: none;
		border: 1px solid var(--c-border-soft);
		font-family: var(--font);
		font-size: var(--fs-sm);
		font-weight: 700;
		color: var(--c-text-muted);
		cursor: pointer;
		width: 26px;
		height: 26px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.help-btn:hover {
		background: var(--c-hover);
		color: var(--c-text);
	}

	.undo-toast {
		position: fixed;
		bottom: var(--sp-md);
		left: 50%;
		transform: translateX(-50%);
		background: var(--c-surface-alt);
		color: var(--c-text);
		padding: var(--sp-xs) var(--sp-md);
		border-radius: var(--radius-md);
		font-size: var(--fs-sm);
		font-family: var(--font);
		box-shadow: var(--shadow-md);
		z-index: 1000;
		pointer-events: none;
	}
</style>
