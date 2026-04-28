<script lang="ts">
	import PipelineView from './components/PipelineView.svelte'
	import BriefingView from './components/BriefingView.svelte'
	import DetailPane from './components/DetailPane.svelte'
	import DeliverablesView from './components/DeliverablesView.svelte'
	import DeliverableDetailPane from './components/DeliverableDetailPane.svelte'
	import MeetingView from './components/MeetingView.svelte'
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
	import type { BoardSnapshot } from './lib/briefing'

	type ViewMode = 'briefing' | 'pipeline' | 'deliverables' | 'meetings'

	/**
	 * Sample data based on SAMPLE-SCENARIO.md
	 * Alex Torres, PO at Relay (B2B SaaS integration middleware).
	 * 8 opportunities across 3 horizons, representing the classic
	 * "build for existing vs. future customers" tension.
	 */
	function createSampleData(): Opportunity[] {
		const DAY = 86_400_000
		const now = Date.now()
		const threeWeeksAgo = now - 21 * DAY

		// --- 2026Q2: shipping soon ---

		const sso = createOpportunity('SSO login for enterprise')
		sso.stage = 'validate'
		sso.horizon = '2026Q2'
		sso.origin = 'demand'
		sso.createdAt = threeWeeksAgo
		sso.stageEnteredAt = now - 10 * DAY
		sso.description = 'Strategic bet: 12 enterprise accounts waiting for SSO before signing. Unlocks a completely different price tier.'
		sso.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Top request from enterprise prospects', evidence: 'Sales pipeline', owner: 'Marcus' }
		sso.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'Standard SAML/OIDC integration', evidence: '', owner: 'Alice' }
		sso.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Unlocks enterprise tier pricing', evidence: '', owner: 'Marcus' }
		sso.signals.sketch.desirability = { score: 'positive', source: 'manual', verdict: '12 enterprise accounts waiting', evidence: 'Sales pipeline', owner: 'Marcus' }
		sso.signals.sketch.feasibility = { score: 'uncertain', source: 'manual', verdict: 'Need to support both SAML and OIDC', evidence: '', owner: 'Alice' }
		sso.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'ARR increase projected at 40%', evidence: 'Revenue model', owner: 'Marcus' }
		// validate stage: Sarah (feasibility) and Marcus (viability) assigned but NOT yet scored
		sso.people = [
			{ id: 'p-sarah', name: 'Sarah', role: 'expert', perspectives: [{ perspective: 'feasibility', stage: 'validate', assignedAt: now - 3 * DAY }] },
			{ id: 'p-marcus', name: 'Marcus', role: 'stakeholder', perspectives: [{ perspective: 'viability', stage: 'validate', assignedAt: now - 5 * DAY }] },
		]
		sso.commitments = [
			{ id: 'c-ceo', to: 'CEO', milestone: 'validate', by: now + 5 * DAY },
		]

		const webhooks = createOpportunity('Webhooks API')
		webhooks.stage = 'decompose'
		webhooks.horizon = '2026Q2'
		webhooks.origin = 'demand'
		webhooks.createdAt = threeWeeksAgo
		webhooks.stageEnteredAt = now - 2 * DAY
		webhooks.description = 'Flagship feature this quarter. Fully validated, three integration partners beta-tested. Now decomposing into sprint-ready work.'
		webhooks.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Integration partners need it', evidence: 'Partner interviews', owner: 'Alex' }
		webhooks.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'Event system already exists internally', evidence: 'Architecture doc', owner: 'Alice' }
		webhooks.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Drives platform stickiness', evidence: '', owner: 'Alex' }
		webhooks.signals.sketch.desirability = { score: 'positive', source: 'manual', verdict: 'Top 5 partners committed to beta', evidence: 'Partner agreements', owner: 'Alex' }
		webhooks.signals.sketch.feasibility = { score: 'positive', source: 'manual', verdict: 'REST + retry pattern defined', evidence: 'RFC doc', owner: 'Alice' }
		webhooks.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'Partners pay for API tier', evidence: 'Pricing model', owner: 'Marcus' }
		webhooks.signals.validate.desirability = { score: 'positive', source: 'manual', verdict: 'Beta partners integrated successfully', evidence: 'Beta feedback', owner: 'Alex' }
		webhooks.signals.validate.feasibility = { score: 'positive', source: 'manual', verdict: 'Spike completed, 99.9% delivery rate', evidence: 'Load test results', owner: 'Alice' }
		webhooks.signals.validate.viability = { score: 'positive', source: 'manual', verdict: '3 partners upgraded to API tier', evidence: 'Billing data', owner: 'Marcus' }
		webhooks.signals.decompose.desirability = { score: 'positive', source: 'manual', verdict: 'Acceptance criteria signed off', evidence: '', owner: 'Alex' }
		webhooks.signals.decompose.feasibility = { score: 'positive', source: 'manual', verdict: '3 sprints, 2 devs', evidence: 'Sprint plan', owner: 'Alice' }
		webhooks.signals.decompose.viability = { score: 'positive', source: 'manual', verdict: 'Budget allocated', evidence: 'Finance approval', owner: 'Alex' }
		webhooks.decompositionComplete = true

		// --- 2026Q3: next quarter ---

		const darkMode = createOpportunity('Dark mode')
		darkMode.stage = 'sketch'
		darkMode.horizon = '2026Q3'
		darkMode.origin = 'demand'
		darkMode.createdAt = threeWeeksAgo
		darkMode.stageEnteredAt = now - 3 * DAY
		darkMode.description = 'Community crowd-pleaser, #2 most requested. Important for retention, low technical risk, not strategically critical.'
		darkMode.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: '#2 most requested feature', evidence: 'User forum votes', owner: 'Alex' }
		darkMode.signals.explore.feasibility = { score: 'uncertain', source: 'manual', verdict: 'CSS variables are mostly ready', evidence: '', owner: 'Alice' }
		darkMode.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Retention play, low cost', evidence: '', owner: 'Alex' }

		const aiReports = createOpportunity('AI-generated reports')
		aiReports.stage = 'sketch'
		aiReports.horizon = '2026Q3'
		aiReports.origin = 'supply'
		aiReports.createdAt = threeWeeksAgo
		aiReports.stageEnteredAt = now - 18 * DAY
		aiReports.description = 'Moonshot: automated insights for managers. Feasibility objection at explore (LLM costs). Investigating local models at sketch.'
		aiReports.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'Managers want automated insights', evidence: 'Interview notes', owner: 'Alex' }
		aiReports.signals.explore.feasibility = { score: 'negative', source: 'manual', verdict: 'LLM costs too high at scale', evidence: 'Cost projection', owner: 'Alice' }
		aiReports.signals.explore.viability = { score: 'uncertain', source: 'manual', verdict: 'Could be premium add-on', evidence: '', owner: 'Alex' }
		aiReports.signals.sketch.feasibility = { score: 'uncertain', source: 'manual', verdict: 'Local models might work — investigating', evidence: '', owner: 'Alex' }
		aiReports.people = [
			{ id: 'p-alex', name: 'Alex', role: 'expert', perspectives: [{ perspective: 'feasibility', stage: 'sketch', assignedAt: now - 1 * DAY }] },
		]

		const multiLang = createOpportunity('Multi-language support')
		multiLang.stage = 'sketch'
		multiLang.horizon = '2026Q3'
		multiLang.origin = 'demand'
		multiLang.createdAt = threeWeeksAgo
		multiLang.stageEnteredAt = now - 14 * DAY
		multiLang.description = 'Driven by DACH market expansion. i18n framework ready, translation budget approved. Commitment to DACH partner is overdue.'
		multiLang.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: 'DACH market expansion opportunity', evidence: 'Market research', owner: 'Marcus' }
		multiLang.signals.explore.feasibility = { score: 'positive', source: 'manual', verdict: 'i18n framework ready', evidence: 'Tech spike', owner: 'Alice' }
		multiLang.signals.explore.viability = { score: 'positive', source: 'manual', verdict: 'Opens 3 new markets', evidence: 'Revenue projection', owner: 'Marcus' }
		multiLang.signals.sketch.feasibility = { score: 'positive', source: 'manual', verdict: '80% of strings already extracted', evidence: 'Codebase audit', owner: 'Alice' }
		multiLang.signals.sketch.viability = { score: 'positive', source: 'manual', verdict: 'Translation budget approved', evidence: 'Finance sign-off', owner: 'Alex' }
		multiLang.commitments = [
			{ id: 'c-dach', to: 'DACH partner', milestone: 'sketch', by: now - 3 * DAY },
		]

		// --- 2026Q4: future ---

		const offline = createOpportunity('Offline mode')
		offline.stage = 'explore'
		offline.horizon = '2026Q4'
		offline.origin = 'demand'
		offline.createdAt = threeWeeksAgo
		offline.description = 'Seed item from field workers. Might grow, might not.'
		offline.signals.explore.desirability = { score: 'uncertain', source: 'manual', verdict: 'Field workers mentioned wanting it', evidence: 'Support tickets', owner: 'Alex' }

		const mobileApp = createOpportunity('Mobile app')
		mobileApp.stage = 'explore'
		mobileApp.horizon = '2026Q4'
		mobileApp.origin = 'demand'
		mobileApp.createdAt = threeWeeksAgo
		mobileApp.description = '60% of users access via mobile browser. No decision yet on native, PWA, or responsive — that belongs at sketch.'
		mobileApp.signals.explore.desirability = { score: 'positive', source: 'manual', verdict: '60% of users on mobile browser', evidence: 'Analytics dashboard', owner: 'Alex' }

		const csvRevamp = createOpportunity('CSV export revamp')
		csvRevamp.stage = 'explore'
		csvRevamp.horizon = '2026Q4'
		csvRevamp.origin = 'debt'
		csvRevamp.createdAt = threeWeeksAgo
		csvRevamp.stageEnteredAt = now - 22 * DAY
		csvRevamp.description = 'Tech debt: current CSV export is clunky. Sitting with zero signals for 22 days — stale.'

		return [sso, webhooks, darkMode, aiReports, multiLang, offline, mobileApp, csvRevamp]
	}

	/** Sample deliverables per SAMPLE-SCENARIO.md — 6 work items linked to Webhooks and SSO */
	function createSampleDeliverables(opps: Opportunity[]): { deliverables: Deliverable[]; links: OpportunityDeliverableLink[] } {
		const webhooks = opps.find((o) => o.title === 'Webhooks API')!
		const sso = opps.find((o) => o.title === 'SSO login for enterprise')!

		const eventBus = createDeliverable('Webhook event bus')
		eventBus.externalUrl = 'https://jira.example.com/PROD-142'
		eventBus.size = 'L'
		eventBus.certainty = 4
		eventBus.extraContributors = ['Alice', 'Bob']

		const retryDlq = createDeliverable('Webhook retry & DLQ')
		retryDlq.externalUrl = 'https://jira.example.com/PROD-143'
		retryDlq.size = 'M'
		retryDlq.certainty = 3
		retryDlq.extraContributors = ['DevOps team', 'Bob']

		const partnerDash = createDeliverable('Partner dashboard')
		partnerDash.size = 'XL'
		partnerDash.certainty = 2
		partnerDash.extraContributors = ['Carol']
		partnerDash.externalDependency = 'Partner API access from Acme Corp — keeps slipping'

		const saml = createDeliverable('SAML integration')
		saml.size = 'S'
		saml.certainty = 5
		saml.extraContributors = ['Alice']

		const oidc = createDeliverable('OIDC integration')
		oidc.size = 'S'
		oidc.certainty = 4
		oidc.extraContributors = ['Alice']

		const webhookDocs = createDeliverable('Webhook docs & SDK examples')
		webhookDocs.size = 'XS'
		webhookDocs.certainty = 5
		webhookDocs.extraContributors = ['Carol']

		const retrySpike = createDeliverable('Spike: retry as separate service vs event bus')
		retrySpike.kind = 'discovery'
		retrySpike.size = 'S'
		retrySpike.certainty = 3
		retrySpike.extraContributors = ['Alice']

		const deliverables = [eventBus, retryDlq, partnerDash, saml, oidc, webhookDocs, retrySpike]
		const links: OpportunityDeliverableLink[] = [
			{ opportunityId: webhooks.id, deliverableId: eventBus.id, coverage: 'full' },
			{ opportunityId: webhooks.id, deliverableId: retryDlq.id, coverage: 'full' },
			{ opportunityId: webhooks.id, deliverableId: partnerDash.id, coverage: 'partial' },
			{ opportunityId: webhooks.id, deliverableId: webhookDocs.id, coverage: 'full' },
			{ opportunityId: webhooks.id, deliverableId: retrySpike.id, coverage: 'full' },
			{ opportunityId: sso.id, deliverableId: saml.id, coverage: 'partial' },
			{ opportunityId: sso.id, deliverableId: oidc.id, coverage: 'partial' },
			{ opportunityId: sso.id, deliverableId: partnerDash.id, coverage: 'partial' }, // many-to-many: enterprise admin section
		]
		return { deliverables, links }
	}

	/** Sample meeting history per SAMPLE-SCENARIO.md — 4 past meetings, 2 never-met */
	function createSampleMeetingData(): MeetingData {
		const DAY = 86_400_000
		const now = Date.now()
		return {
			lastDiscussed: {
				Alice: now - 5 * DAY,
				Marcus: now - 5 * DAY,
				Bob: now - 8 * DAY,
				Carol: now - 12 * DAY,
			},
			records: [
				{
					personName: 'Alice',
					timestamp: now - 5 * DAY,
					summary: [
						'4 deliverables reviewed',
						'Event bus: confirmed pub/sub pattern, certainty → 4/5',
						'SAML: straightforward, certainty 5/5',
						'OIDC: newer spec revision, certainty 4/5',
						'Asked to spike retry & DLQ service vs event bus piggyback',
					],
				},
				{
					personName: 'Marcus',
					timestamp: now - 5 * DAY,
					summary: [
						'SSO viability at validate: briefed on enterprise pipeline numbers',
						'Asked for updated ARR projections by end of week',
						'CEO commitment April 29 discussed — 5 days remaining',
						'1 unscored cell: viability@validate',
					],
				},
				{
					personName: 'Bob',
					timestamp: now - 8 * DAY,
					summary: [
						'Event bus: confirmed availability for next 2 sprints',
						'Retry & DLQ: DevOps stretched with another project',
						'Capacity concern flagged — check DevOps bandwidth',
					],
				},
				{
					personName: 'Carol',
					timestamp: now - 12 * DAY,
					summary: [
						'Partner dashboard: Acme Corp API access timeline slipping',
						'Cannot start admin UI design until partner API shape finalized',
						'Webhook docs: 80% drafted, waiting for final API surface',
						'Agreed to sketch wireframe even without final API',
						'Risk escalated: partner dashboard is biggest risk item',
					],
				},
			],
			snapshots: {},
		}
	}

	const saved = loadBoard()
	const savedMeetings = loadMeetingData()
	const sampleOpps = createSampleData()
	const sampleDL = createSampleDeliverables(sampleOpps)

	let opportunities: Opportunity[] = $state(saved?.opportunities ?? sampleOpps)
	let deliverables: Deliverable[] = $state(saved?.deliverables ?? sampleDL.deliverables)
	let links: OpportunityDeliverableLink[] = $state(saved?.links ?? sampleDL.links)
	let customHorizons: string[] = $state(saved?.customHorizons ?? [])
	let meetingData: MeetingData = $state(
		savedMeetings.records.length > 0 ? savedMeetings : createSampleMeetingData(),
	)
	let briefingSnapshot: BoardSnapshot | null = $state(saved?.briefingSnapshot ?? null)
	let selectedId: string | null = $state(null)
	let selectedDeliverableId: string | null = $state(null)
	let view: ViewMode = $state('briefing')
	let pipelineGrouping: 'stage' | 'horizon' = $state('stage')
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
		saveBoard({ opportunities, deliverables, links, customHorizons, briefingSnapshot: briefingSnapshot ?? undefined })
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
		if (view === 'pipeline') {
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
		if (view !== 'pipeline' || !selectedId) return
		const opp = opportunities.find(o => o.id === selectedId)
		if (!opp || opp.discontinuedAt) return
		const next = nextStage(opp.stage)
		if (!next) return
		const consent = stageConsent(opp)
		if (consent.status !== 'ready') return
		moveOpportunity(opp.id, next)
	}

	function exitSelected() {
		if (view !== 'pipeline' || !selectedId) return
		const opp = opportunities.find(o => o.id === selectedId)
		if (!opp || opp.discontinuedAt) return
		// Open detail pane first if not open, the exit menu is there
		if (!selectedOpportunity) {
			selectedId = opp.id
		}
		// Dispatch a custom event that DetailPane can listen to
		window.dispatchEvent(new CustomEvent('upstream:open-exit-menu'))
	}

	const VIEW_KEYS: Record<string, ViewMode> = { '1': 'briefing', '2': 'pipeline', '3': 'deliverables', '4': 'meetings' }

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

			// Tab toggles pipeline grouping when on pipeline view
			if (e.key === 'Tab' && view === 'pipeline' && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				pipelineGrouping = pipelineGrouping === 'stage' ? 'horizon' : 'stage'
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
				if (view === 'pipeline' && selectedId) {
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
				if (view === 'pipeline' && selectedId) {
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
		meetingData = createSampleMeetingData()
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
			<button class="view-tab" class:active={view === 'briefing'} onclick={() => switchView('briefing')}>Briefing</button>
			<button class="view-tab" class:active={view === 'pipeline'} onclick={() => switchView('pipeline')}>Pipeline</button>
			<button class="view-tab" class:active={view === 'deliverables'} onclick={() => switchView('deliverables')}>Deliverables</button>
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
	{#if view === 'briefing'}
	<div class="split-layout">
		<div class="split-list">
			<BriefingView
				{opportunities} {deliverables} {links}
				snapshot={briefingSnapshot}
				{meetingData}
				onMarkSeen={(snap) => { briefingSnapshot = snap }}
				onSelectOpportunity={(id) => { selectedDeliverableId = null; selectedId = selectedId === id ? null : id }}
				onSelectDeliverable={(id) => { selectedId = null; selectedDeliverableId = selectedDeliverableId === id ? null : id }}
				onParkOpportunity={(id, parkUntil) => {
					const opp = opportunities.find(o => o.id === id)
					if (opp) {
						pushUndo(`Park: ${opp.title}`)
						const reason = parkUntil
							? `Parked until ${parkUntil}`
							: `Parked: no activity for ${Math.floor((Date.now() - opp.stageEnteredAt) / 86_400_000)}d`
						updateOpportunity({
							...opp,
							exitState: 'parked',
							exitReason: reason,
							parkUntil,
							discontinuedAt: Date.now(),
						})
					}
				}}
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
	{:else if view === 'pipeline'}
	<div class="split-layout">
		<div class="split-list">
			<PipelineView {opportunities} {deliverables} {links} {selectedId}
				allHorizons={allHorizons()} onSelect={selectOpportunity}
				onSelectDeliverable={(id) => { selectedId = null; selectedDeliverableId = selectedDeliverableId === id ? null : id }}
				onAdvance={moveOpportunity} onAdd={addOpportunity} compact={!!selectedId}
				bind:orderedIds={listViewOrderedIds}
				bind:grouping={pipelineGrouping} {customHorizons}
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
		display: flex;
		flex-direction: column;
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
