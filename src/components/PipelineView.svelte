<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Perspective,
		type Stage,
		type TShirtSize,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		CELL_QUESTIONS,
		STAGES,
		commitmentUrgency,
		daysInStage,
		agingLevel,
		EXIT_STATES,
		isFutureHorizon,
		linksForOpportunity,
		nextStage,
		perspectiveWeight,
		stageConsent,
		stageIndex,
		stageLabel,
		wipLevel,
		wipNudge,
	} from '../lib/types'
	import PipelineFunnel from './PipelineFunnel.svelte'
	import OpportunityRow from './OpportunityRow.svelte'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		selectedId?: string | null
		onSelect: (id: string) => void
		onSelectDeliverable?: (id: string) => void
		onAdvance: (id: string, toStage: Stage) => void
		onAdd: (title: string) => void
		orderedIds?: string[]
		allHorizons?: string[]
		grouping?: 'stage' | 'horizon'
		customHorizons?: string[]
		onUpdateOpportunity?: (opp: Opportunity) => void
		onAddHorizon?: (name: string) => void
		onRemoveHorizon?: (name: string) => void
		firstVisit?: boolean
		lens?: Perspective | null
		onLensChange?: (lens: Perspective | null) => void
	}

	let {
		opportunities,
		deliverables,
		links,
		selectedId = null,
		onSelect,
		onSelectDeliverable,
		onAdvance,
		onAdd,
		orderedIds = $bindable([]),
		allHorizons = [],
		grouping = $bindable('stage'),
		customHorizons = [],
		onUpdateOpportunity,
		onAddHorizon,
		onRemoveHorizon,
		firstVisit = false,
		lens = null,
		onLensChange,
	}: Props = $props()

	let newTitle = $state('')
	let hoveredStage = $state<string | null>(null)
	let filteredStage = $state<string | null>(null)
	let addExpanded = $state(false)
	let lastAddedId = $state<string | null>(null)
	let addInputEl = $state<HTMLInputElement | null>(null)
	let inlineTitle = $state('')

	/** Sort priority for perspective lens: objection first, then unheard, then concern, then consent */
	const LENS_SCORE_ORDER: Record<string, number> = { negative: 0, none: 1, uncertain: 2, positive: 3 }

	function toggleLens(p: Perspective) {
		const next = lens === p ? null : p
		if (onLensChange) onLensChange(next)
	}

	const lensSummary = $derived.by(() => {
		if (!lens) return null
		let consent = 0, concern = 0, objection = 0, unheard = 0
		for (const opp of activeOpps) {
			const score = opp.signals[opp.stage][lens].score
			if (score === 'positive') consent++
			else if (score === 'uncertain') concern++
			else if (score === 'negative') objection++
			else unheard++
		}
		return { consent, concern, objection, unheard, total: activeOpps.length }
	})

	// ── Zoom state ──
	let zoomedGroup = $state<string | null>(null)

	// ── Horizon editing & drag-drop state ──
	let editingHorizon = $state<string | null>(null)
	let editValue = $state('')
	let newHorizonName = $state('')
	let draggedOppId = $state<string | null>(null)
	let dropTargetHorizon = $state<string | null>(null)

	function horizonLabel(horizon: string): string {
		if (!allHorizons.length) return ''
		const idx = allHorizons.indexOf(horizon)
		if (idx === 0) return 'now'
		if (idx === 1) return 'next'
		return ''
	}

	function handleAdd() {
		const trimmed = newTitle.trim()
		if (!trimmed) return
		onAdd(trimmed)
		newTitle = ''
		addExpanded = false
		setTimeout(() => {
			const newOpp = opportunities.find(o => o.title === trimmed && o.stage === 'explore')
			if (newOpp) {
				lastAddedId = newOpp.id
				setTimeout(() => lastAddedId = null, 1200)
			}
		}, 50)
	}

	function handlePark(id: string) {
		const opp = opportunities.find(o => o.id === id)
		if (!opp || !onUpdateOpportunity) return
		onUpdateOpportunity({ ...opp, exitState: 'parked', discontinuedAt: Date.now() })
	}

	function expandAdd() {
		addExpanded = true
		setTimeout(() => addInputEl?.focus(), 0)
	}

	function collapseAdd() {
		if (!newTitle.trim()) {
			addExpanded = false
			newTitle = ''
		}
	}

	function inlineAdd() {
		const trimmed = inlineTitle.trim()
		if (!trimmed) return
		onAdd(trimmed)
		inlineTitle = ''
		setTimeout(() => {
			const newOpp = opportunities.find(o => o.title === trimmed && o.stage === 'explore')
			if (newOpp) {
				lastAddedId = newOpp.id
				setTimeout(() => (lastAddedId = null), 1200)
			}
		}, 50)
	}

	// ── Triage classification ──

	interface GapInfo {
		perspective: Perspective
		weight: number
	}

	type Bucket = 'urgent' | 'attention' | 'clear'

	interface PipelineItem {
		opp: Opportunity
		urgency: number
		gaps: GapInfo[]
		nudge: string
		bucket: Bucket
	}

	function classifyBucket(opp: Opportunity, gaps: GapInfo[], _zeroCount: number): Bucket {
		const consent = stageConsent(opp)
		const urgency = commitmentUrgency(opp)
		if (consent.objections.length > 0) return 'urgent'
		if (urgency && urgency.daysLeft < 0) return 'urgent'
		if (consent.status === 'ready' && (!urgency || urgency.daysLeft > 14)) return 'clear'
		return 'attention'
	}

	const STAGE_NUDGE: Record<Stage, Record<Perspective, { zero: string; weak: string }>> = {
		explore: {
			desirability: { zero: 'Who has this problem?', weak: 'Sharpen the user need' },
			feasibility: { zero: 'Could we even build this?', weak: 'Sketch a rough approach' },
			viability: { zero: 'Why would we do this?', weak: 'Clarify the strategic fit' },
		},
		sketch: {
			desirability: { zero: 'Talk to actual users', weak: 'Get clearer user evidence' },
			feasibility: { zero: 'Get engineering input', weak: 'Nail down technical risks' },
			viability: { zero: 'Check the business case', weak: 'Tighten the numbers' },
		},
		validate: {
			desirability: { zero: 'Run a user test', weak: 'More user validation needed' },
			feasibility: { zero: 'Do a technical spike', weak: 'Confirm the architecture' },
			viability: { zero: 'Validate the ROI', weak: 'Verify cost assumptions' },
		},
		decompose: {
			desirability: { zero: 'Define acceptance criteria', weak: 'Sharpen the user stories' },
			feasibility: { zero: 'Break down the work', weak: 'Refine the estimates' },
			viability: { zero: 'Final cost check', weak: 'Confirm it\'s worth it' },
		},
	}

	const NEXT_STAGE: Record<Stage, string> = {
		explore: 'Ready to sketch',
		sketch: 'Ready to validate',
		validate: 'Ready to decompose',
		decompose: 'Fully assessed — ship it',
	}

	function buildNudge(opp: Opportunity, gaps: GapInfo[], zeroCount: number, skipCommitment = false): string {
		const consent = stageConsent(opp)
		const urgency = commitmentUrgency(opp)

		if (gaps.length === 3 && zeroCount === 3) return 'Fresh — pick any angle to start'

		if (consent.objections.length > 0) {
			const label = PERSPECTIVE_LABELS[consent.objections[0]].toLowerCase()
			return `${label} objection — resolve before advancing`
		}

		if (!skipCommitment && urgency && urgency.daysLeft <= 14) {
			const daysText = urgency.daysLeft < 0 ? `${Math.abs(urgency.daysLeft)}d overdue` : urgency.daysLeft === 0 ? 'due today' : `${urgency.daysLeft}d left`
			return `Promised ${urgency.commitment.to}: ${daysText}`
		}

		if (gaps.length === 0) return NEXT_STAGE[opp.stage]

		const sorted = [...gaps].sort((a, b) => a.weight - b.weight)
		const worst = sorted[0]
		const nudges = STAGE_NUDGE[opp.stage][worst.perspective]
		const primary = worst.weight === 0 ? nudges.zero : nudges.weak

		if (sorted.length === 1) return primary
		const second = sorted[1]
		const secondLabel = PERSPECTIVE_LABELS[second.perspective].toLowerCase()
		return `${primary}, then ${secondLabel}`
	}

	// ── Horizon mode helpers ──

	const SIZE_ORDER: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL']

	interface SizeBreakdown {
		sizes: { size: TShirtSize; count: number }[]
		unsized: number
	}

	function deliverablesForOpps(oppIds: Set<string>): Deliverable[] {
		const delIds = new Set<string>()
		for (const link of links) {
			if (oppIds.has(link.opportunityId)) delIds.add(link.deliverableId)
		}
		return deliverables.filter((d) => delIds.has(d.id))
	}

	function horizonBreakdown(opps: Opportunity[]): SizeBreakdown {
		const oppIds = new Set(opps.map((o) => o.id))
		const dels = deliverablesForOpps(oppIds)
		const counts = new Map<TShirtSize, number>()
		let unsized = 0

		for (const d of dels) {
			if (d.size) {
				counts.set(d.size, (counts.get(d.size) ?? 0) + 1)
			} else {
				unsized++
			}
		}

		const sizes = SIZE_ORDER
			.filter((s) => counts.has(s))
			.map((s) => ({ size: s, count: counts.get(s)! }))

		return { sizes, unsized }
	}

	function isEmptyCustom(horizon: string): boolean {
		return customHorizons.includes(horizon) && !activeOpps.some(o => o.horizon === horizon)
	}

	// ── Horizon drag-drop ──

	function handleDragStart(e: DragEvent, oppId: string) {
		draggedOppId = oppId
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', oppId)
		}
	}

	function handleDragEnd() {
		draggedOppId = null
		dropTargetHorizon = null
	}

	function handleDragOver(e: DragEvent, horizon: string) {
		if (!draggedOppId) return
		e.preventDefault()
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
		dropTargetHorizon = horizon
	}

	function handleDragLeave(e: DragEvent, horizon: string) {
		if (dropTargetHorizon === horizon) dropTargetHorizon = null
	}

	function handleDrop(e: DragEvent, horizon: string) {
		e.preventDefault()
		if (!draggedOppId || !onUpdateOpportunity) return
		const opp = opportunities.find(o => o.id === draggedOppId)
		if (opp && opp.horizon !== horizon) {
			const targetHorizon = horizon === '(no horizon)' ? '' : horizon
			onUpdateOpportunity({ ...opp, horizon: targetHorizon })
		}
		draggedOppId = null
		dropTargetHorizon = null
	}

	// ── Horizon rename ──

	function startRenameHorizon(horizon: string) {
		editingHorizon = horizon
		editValue = horizon
	}

	function commitRenameHorizon(oldName: string) {
		const newName = editValue.trim()
		editingHorizon = null
		if (!newName || newName === oldName || !onUpdateOpportunity) return
		for (const opp of opportunities) {
			if (opp.horizon === oldName) {
				onUpdateOpportunity({ ...opp, horizon: newName })
			}
		}
		if (customHorizons.includes(oldName) && onRemoveHorizon && onAddHorizon) {
			onRemoveHorizon(oldName)
			onAddHorizon(newName)
		}
	}

	function handleAddHorizon() {
		const name = newHorizonName.trim()
		if (!name || !onAddHorizon) return
		onAddHorizon(name)
		newHorizonName = ''
	}

	// ── Zoom ──

	function zoomIn(group: string) {
		zoomedGroup = group
	}

	function zoomOut() {
		zoomedGroup = null
	}

	function handleFunnelClick(stage: string) {
		if (zoomedGroup) {
			// Navigate between stages while zoomed
			const target = STAGES.find(s => s.key === stage)
			if (target) {
				zoomedGroup = target.label
				filteredStage = null
			}
		} else {
			// Toggle click-to-filter
			filteredStage = filteredStage === stage ? null : stage
		}
	}

	const STAGE_PURPOSE: Record<Stage, string> = {
		explore: 'Diverge — discover the problem space',
		sketch: 'Converge — define the shape of a solution',
		validate: 'Test — gather evidence for or against',
		decompose: 'Structure — break into deliverable work',
	}

	function oldestDays(items: PipelineItem[]): number {
		if (items.length === 0) return 0
		return Math.max(...items.map(i => daysInStage(i.opp)))
	}

	/** Specific header badge text for a single bucket item */
	function specificBadge(items: PipelineItem[], bucket: Bucket): string | null {
		const bucketItems = items.filter(i => i.bucket === bucket)
		if (bucketItems.length !== 1) return null
		if (bucket === 'urgent') {
			const consent = stageConsent(bucketItems[0].opp)
			if (consent.objections.length > 0) {
				const label = PERSPECTIVE_LABELS[consent.objections[0]].toLowerCase()
				return `1 ${label} objection`
			}
		}
		if (bucket === 'attention') {
			const gaps = bucketItems[0].gaps
			if (gaps.length > 0) {
				const worst = [...gaps].sort((a, b) => a.weight - b.weight)[0]
				return `1 needs ${PERSPECTIVE_LABELS[worst.perspective].toLowerCase()}`
			}
		}
		return null
	}

	/** Get parked opportunities due for revisit */
	const revisitDueOpps = $derived.by(() => {
		return opportunities.filter(o => {
			if (!o.discontinuedAt || o.exitState !== 'parked' || !o.parkUntil) return false
			return !isFutureHorizon(o.parkUntil)
		})
	})

	// ── Build items ──

	const activeOpps = $derived(opportunities.filter((o) => !o.discontinuedAt))
	const discontinuedOpps = $derived(opportunities.filter((o) => !!o.discontinuedAt))

	function buildItem(opp: Opportunity): PipelineItem {
		const weights = PERSPECTIVES.map((p) => ({
			perspective: p,
			weight: perspectiveWeight(opp, p),
		}))
		const maxWeight = Math.max(...weights.map((w) => w.weight))
		const gaps = weights.filter((w) => w.weight < maxWeight - 0.05 || w.weight === 0)
		const stageMultiplier = 1 + stageIndex(opp.stage)
		const zeroCount = weights.filter((w) => w.weight === 0).length

		let gapSeverity = 0
		for (const g of gaps) {
			gapSeverity += (maxWeight - g.weight) * stageMultiplier
		}
		gapSeverity += zeroCount * stageMultiplier * 0.5

		const cu = commitmentUrgency(opp)
		if (cu) {
			const deadlineBoost = cu.daysLeft <= 0 ? 10 : cu.daysLeft <= 7 ? 5 : cu.daysLeft <= 14 ? 2 : 0
			gapSeverity += deadlineBoost
		}

		const nudge = buildNudge(opp, gaps, zeroCount, density === 'zoomed')
		const bucket = classifyBucket(opp, gaps, zeroCount)

		return { opp, urgency: gapSeverity, gaps, nudge, bucket }
	}

	const BUCKET_ORDER: Record<Bucket, number> = { urgent: 0, attention: 1, clear: 2 }

	const stageCounts = $derived(STAGES.map((s) => ({
		key: s.key,
		label: s.label,
		count: activeOpps.filter((o) => o.stage === s.key).length,
	})))

	const triageByStage = $derived.by(() => {
		const result: Record<string, { urgent: number; attention: number }> = {}
		for (const group of stageGroups) {
			result[group.stage.key] = {
				urgent: group.items.filter(i => i.bucket === 'urgent').length,
				attention: group.items.filter(i => i.bucket === 'attention').length,
			}
		}
		return result
	})

	function lensSort(a: PipelineItem, b: PipelineItem): number {
		if (!lens) return 0
		const sa = a.opp.signals[a.opp.stage][lens].score
		const sb = b.opp.signals[b.opp.stage][lens].score
		return LENS_SCORE_ORDER[sa] - LENS_SCORE_ORDER[sb]
	}

	const stageGroups = $derived.by(() => {
		return STAGES.map((stage) => {
			const items = activeOpps
				.filter((o) => o.stage === stage.key)
				.map(buildItem)
				.sort((a, b) => lensSort(a, b) || BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || b.urgency - a.urgency)
			return { stage, items }
		})
	})

	const horizons = $derived.by(() => {
		const set = new Set<string>()
		for (const opp of activeOpps) {
			if (opp.horizon) set.add(opp.horizon)
		}
		for (const h of customHorizons) set.add(h)
		return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	})

	interface HorizonGroup {
		horizon: string
		items: PipelineItem[]
	}

	const horizonGroups = $derived.by(() => {
		const unassigned = activeOpps.filter(o => !o.horizon)
		const groups: HorizonGroup[] = horizons.map(horizon => {
			const items = activeOpps
				.filter(o => o.horizon === horizon)
				.map(buildItem)
				.sort((a, b) => lensSort(a, b) || stageIndex(b.opp.stage) - stageIndex(a.opp.stage) || b.urgency - a.urgency)
			return { horizon, items }
		})
		if (unassigned.length > 0) {
			groups.push({
				horizon: '(no horizon)',
				items: unassigned.map(buildItem).sort((a, b) => lensSort(a, b) || stageIndex(b.opp.stage) - stageIndex(a.opp.stage) || b.urgency - a.urgency),
			})
		}
		return groups
	})

	// Expose flat visual order to parent for keyboard navigation
	$effect(() => {
		if (grouping === 'stage') {
			orderedIds = stageGroups.flatMap(g => g.items.map(i => i.opp.id))
		} else {
			orderedIds = horizonGroups.flatMap(g => g.items.map(i => i.opp.id))
		}
	})

	// Scroll selected row into view
	$effect(() => {
		if (!selectedId) return
		requestAnimationFrame(() => {
			const row = document.querySelector('.pl-row.selected') as HTMLElement | null
			row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		})
	})

	function getLinkedDeliverables(oppId: string) {
		const oppLinks = linksForOpportunity(links, oppId)
		return oppLinks.map((link) => {
			const del = deliverables.find((d) => d.id === link.deliverableId)
			return del ? { link, deliverable: del } : null
		}).filter((x): x is NonNullable<typeof x> => x !== null)
	}

	const density = $derived<'overview' | 'zoomed'>(
		zoomedGroup ? 'zoomed' : 'overview'
	)

	/** The active stage used for row dimming (filter takes precedence over hover) */
	const activeStage = $derived(filteredStage ?? hoveredStage)
</script>

<div class="pl-container">
	{#if opportunities.length === 0}
		<div class="pl-onboarding-hint">
			Opportunities flow from Explore → Decompose. Start by adding one below.
		</div>
		{#each STAGES as stage, i}
			<section class="pl-stage-group" style="min-height: {stage.key === 'explore' ? 'auto' : stage.key === 'sketch' ? '4rem' : stage.key === 'validate' ? '3rem' : '2rem'}">
				<header class="pl-stage-header" style="--stage-color: var(--c-stage-{stage.key})">
					<span class="pl-stage-name">{stage.label}</span>
					<span class="pl-stage-count">0</span>
				</header>
				{#if stage.key === 'explore'}
					<div class="pl-ghost-card" aria-hidden="true">
						<span class="pl-ghost-title">e.g. Reduce onboarding churn</span>
						<span class="pl-ghost-dots">
							<span class="dot score-none">·</span>
							<span class="dot score-none">·</span>
							<span class="dot score-none">·</span>
						</span>
					</div>
					<div class="pl-empty-invite">
						<input
							type="text"
							class="add-input"
							placeholder="What's an opportunity you're considering?"
							bind:value={newTitle}
							onkeydown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
						/>
					</div>
				{:else}
					<div class="pl-empty pl-empty-ghost">{STAGE_PURPOSE[stage.key]}</div>
				{/if}
			</section>
		{/each}
	{:else}
		{#if zoomedGroup}
			<div class="pl-breadcrumb" class:sticky-breadcrumb={true}>
				<button class="btn-ghost pl-breadcrumb-btn" onclick={zoomOut}>← All {grouping === 'stage' ? 'stages' : 'horizons'}</button>
				<span class="pl-breadcrumb-label">{zoomedGroup}</span>
			</div>
		{/if}

		<div class="funnel-row">
			{#if addExpanded}
				<input
					type="text"
					class="funnel-add-input"
					placeholder="Opportunity title…"
					bind:value={newTitle}
					bind:this={addInputEl}
					onkeydown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { collapseAdd(); (e.target as HTMLInputElement).blur() } }}
					onblur={collapseAdd}
				/>
			{:else}
				<button class="funnel-add-btn" onclick={expandAdd} title="Add opportunity (n)">+</button>
			{/if}
			<PipelineFunnel {stageCounts} {hoveredStage} {filteredStage} {triageByStage} onHover={(s) => hoveredStage = s} onClick={handleFunnelClick} />
			<span class="grouping-toggle">
				<button class="grouping-btn" class:active={grouping === 'stage'} onclick={() => { zoomedGroup = null; filteredStage = null; grouping = 'stage' }}>Funnel</button>
				<button class="grouping-btn" class:active={grouping === 'horizon'} onclick={() => { zoomedGroup = null; filteredStage = null; grouping = 'horizon' }}>Horizon</button>
			</span>
			<span class="lens-toggle">
				{#each PERSPECTIVES as p}
					<button class="lens-btn" class:active={lens === p} onclick={() => toggleLens(p)}>{PERSPECTIVE_LABELS[p]}</button>
				{/each}
			</span>
		</div>

		{#if lensSummary}
			<div class="lens-summary">
				<span class="lens-summary-label">{PERSPECTIVE_LABELS[lens!]}:</span>
				{#if lensSummary.objection > 0}<span class="lens-stat lens-stat-negative">{lensSummary.objection} objection{lensSummary.objection !== 1 ? 's' : ''}</span>{/if}
				{#if lensSummary.unheard > 0}<span class="lens-stat lens-stat-none">{lensSummary.unheard} unheard</span>{/if}
				{#if lensSummary.concern > 0}<span class="lens-stat lens-stat-uncertain">{lensSummary.concern} concern{lensSummary.concern !== 1 ? 's' : ''}</span>{/if}
				{#if lensSummary.consent > 0}<span class="lens-stat lens-stat-positive">{lensSummary.consent} consent{lensSummary.consent !== 1 ? 's' : ''}</span>{/if}
				<span class="lens-stat-total">across {lensSummary.total} opportunit{lensSummary.total !== 1 ? 'ies' : 'y'}</span>
			</div>
		{/if}

		{#if revisitDueOpps.length > 0}
			<div class="revisit-prompt">
				<span class="revisit-icon">↩</span>
				{revisitDueOpps.length} parked {revisitDueOpps.length === 1 ? 'opportunity' : 'opportunities'} due for revisit:
				{#each revisitDueOpps as opp, i}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<button class="revisit-link" onclick={() => onSelect(opp.id)}>{opp.title}</button>{#if i < revisitDueOpps.length - 1},{/if}
				{/each}
			</div>
		{/if}

		{#if grouping === 'stage'}
			{#each stageGroups as group}
				{#if !zoomedGroup || zoomedGroup === group.stage.label}
					{@const urgentCount = group.items.filter(i => i.bucket === 'urgent').length}
					{@const attentionCount = group.items.filter(i => i.bucket === 'attention').length}
					{@const oldest = oldestDays(group.items)}
					{@const urgentText = specificBadge(group.items, 'urgent')}
					{@const attentionText = specificBadge(group.items, 'attention')}
					{@const wip = wipLevel(group.stage.key, group.items.length)}
					{@const wipMsg = wipNudge(group.stage.key, group.items.length)}
					<section class="pl-stage-group" class:pl-stage-collapsed={filteredStage !== null && filteredStage !== group.stage.key}>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<header class="pl-stage-header pl-zoomable" role="button" tabindex="0" style="--stage-color: var(--c-stage-{group.stage.key})" onclick={() => zoomedGroup ? zoomOut() : zoomIn(group.stage.label)}>
							<span class="pl-stage-name">{group.stage.label}</span>
							<span class="pl-stage-count">{group.items.length}</span>
							{#if wip === 'over'}
								<span class="pl-stage-badge pl-badge-wip-over" title={wipMsg}>crowded</span>
							{:else if wip === 'under'}
								<span class="pl-stage-badge pl-badge-wip-under" title={wipMsg}>quiet</span>
							{/if}
							{#if urgentCount > 0}
								<span class="pl-stage-badge pl-badge-urgent">{urgentText ?? `${urgentCount} urgent`}</span>
							{/if}
							{#if attentionCount > 0}
								<span class="pl-stage-badge pl-badge-attention">{attentionText ?? `${attentionCount} needs input`}</span>
							{/if}
							{#if oldest > 0 && group.items.length > 0}
								<span class="pl-stage-age">oldest {oldest}d</span>
							{/if}
							{#if !zoomedGroup}
								<span class="pl-zoom-hint" aria-hidden="true">⤢</span>
							{/if}
						</header>
						{#if zoomedGroup === group.stage.label}
							<div class="pl-stage-purpose">
								<span class="purpose-thinking">{STAGES.find(s => s.key === group.stage.key)?.thinking}</span>
								{STAGE_PURPOSE[group.stage.key]}
							</div>
							{#if wipMsg}
								<div class="pl-wip-nudge" class:wip-over={wip === 'over'} class:wip-under={wip === 'under'}>
									{wipMsg}
								</div>
							{/if}
						{/if}
						{#if group.items.length === 0}
							<div class="pl-empty">No opportunities at this stage</div>
						{:else if filteredStage === null || filteredStage === group.stage.key}
							{@const urgent = group.items.filter(i => i.bucket === 'urgent')}
							{@const attention = group.items.filter(i => i.bucket === 'attention')}
							{@const clear = group.items.filter(i => i.bucket === 'clear')}
							<div class="pl-rows">
								{#each urgent as item (item.opp.id)}
									<OpportunityRow
										opp={item.opp}
										bucket={item.bucket}
										nudge={item.nudge}
										{density}
										selected={item.opp.id === selectedId}
										dimmed={activeStage !== null && item.opp.stage !== activeStage}
										highlighted={activeStage === item.opp.stage}
										justAdded={item.opp.id === lastAddedId}
										linkedDeliverables={getLinkedDeliverables(item.opp.id)}
										horizonTag={horizonLabel(item.opp.horizon)}
										{onSelect}
										{onAdvance}
										{onSelectDeliverable}
										onPark={handlePark}
										{lens}
									/>
								{/each}
								{#if urgent.length > 0 && (attention.length > 0 || clear.length > 0)}
									<div class="bucket-separator"></div>
								{/if}
								{#each attention as item (item.opp.id)}
									<OpportunityRow
										opp={item.opp}
										bucket={item.bucket}
										nudge={item.nudge}
										{density}
										selected={item.opp.id === selectedId}
										dimmed={activeStage !== null && item.opp.stage !== activeStage}
										highlighted={activeStage === item.opp.stage}
										justAdded={item.opp.id === lastAddedId}
										linkedDeliverables={getLinkedDeliverables(item.opp.id)}
										horizonTag={horizonLabel(item.opp.horizon)}
										{onSelect}
										{onAdvance}
										{onSelectDeliverable}
										onPark={handlePark}
										{lens}
									/>
								{/each}
								{#if attention.length > 0 && clear.length > 0}
									<div class="bucket-separator"></div>
								{/if}
								{#each clear as item (item.opp.id)}
									<OpportunityRow
										opp={item.opp}
										bucket={item.bucket}
										nudge={item.nudge}
										{density}
										selected={item.opp.id === selectedId}
										dimmed={activeStage !== null && item.opp.stage !== activeStage}
										highlighted={activeStage === item.opp.stage}
										justAdded={item.opp.id === lastAddedId}
										linkedDeliverables={getLinkedDeliverables(item.opp.id)}
										horizonTag={horizonLabel(item.opp.horizon)}
										{onSelect}
										{onAdvance}
										{onSelectDeliverable}
										onPark={handlePark}
										{lens}
									/>
								{/each}
							</div>
						{/if}
						{#if group.stage.key === 'explore' && ((opportunities.length === 1 && !selectedId) || (firstVisit && !selectedId))}
							<div class="pl-first-add-nudge">Click any opportunity to open the detail pane — add perspectives and score signals</div>
						{/if}
						{#if group.stage.key === 'explore'}
							<div class="pl-inline-add">
								<input
									type="text"
									class="inline-add-input"
									placeholder="+ Add opportunity…"
									bind:value={inlineTitle}
									onkeydown={(e) => { if (e.key === 'Enter') inlineAdd(); if (e.key === 'Escape') { inlineTitle = ''; (e.target as HTMLInputElement).blur() } }}
								/>
							</div>
						{/if}
					</section>
				{/if}
			{/each}
		{:else}
			{#each horizonGroups as group}
				{#if !zoomedGroup || zoomedGroup === group.horizon}
					{@const breakdown = horizonBreakdown(group.items.map(i => i.opp))}
					{@const urgentCount = group.items.filter(i => i.bucket === 'urgent').length}
					{@const attentionCount = group.items.filter(i => i.bucket === 'attention').length}
					<section
						class="pl-stage-group"
						class:drop-target={dropTargetHorizon === group.horizon}
						ondragover={(e) => handleDragOver(e, group.horizon)}
						ondragleave={(e) => handleDragLeave(e, group.horizon)}
						ondrop={(e) => handleDrop(e, group.horizon)}
					>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<header class="pl-horizon-header pl-zoomable" role="button" tabindex="0" onclick={() => zoomedGroup ? zoomOut() : zoomIn(group.horizon)}>
							{#if editingHorizon === group.horizon}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									class="horizon-edit-input"
									type="text"
									bind:value={editValue}
									autofocus
									onkeydown={(e) => { if (e.key === 'Enter') commitRenameHorizon(group.horizon); if (e.key === 'Escape') { editingHorizon = null } }}
									onblur={() => commitRenameHorizon(group.horizon)}
									onclick={(e) => e.stopPropagation()}
								/>
							{:else}
								<button class="pl-horizon-label" ondblclick={(e) => { e.stopPropagation(); startRenameHorizon(group.horizon) }}>
									{group.horizon}
								</button>
								{@const hTag = horizonLabel(group.horizon)}
								{#if hTag}<span class="horizon-timing horizon-{hTag}">{hTag === 'now' ? '◆ now' : '◇ next'}</span>{/if}
								<span class="pl-stage-count">{group.items.length}</span>
								{#if group.items.length > 0}
									<span class="horizon-health">
										{#if urgentCount > 0}
											<span class="health-danger">{urgentCount} urgent</span>
										{/if}
										{#if attentionCount > 0}
											<span class="health-warn">{attentionCount} needs input</span>
										{/if}
										{#if urgentCount === 0 && attentionCount === 0}
											<span class="health-clear">all clear</span>
										{/if}
									</span>
								{/if}
								{#if isEmptyCustom(group.horizon)}
									<button class="btn-icon remove-horizon-btn" onclick={(e) => { e.stopPropagation(); onRemoveHorizon?.(group.horizon) }} title="Remove empty horizon">×</button>
								{/if}
								{#if breakdown.sizes.length > 0 || breakdown.unsized > 0}
									<span class="effort-summary">
										{#each breakdown.sizes as s}
											<span class="effort-size" title="{s.count} deliverable{s.count === 1 ? '' : 's'} sized {s.size}">{s.count}×{s.size}</span>
										{/each}
										{#if breakdown.unsized > 0}
											<span class="effort-gap" title="{breakdown.unsized} deliverable{breakdown.unsized === 1 ? '' : 's'} not yet sized">{breakdown.unsized} unsized</span>
										{/if}
									</span>
								{/if}
								{#if !zoomedGroup}
									<span class="pl-zoom-hint" aria-hidden="true">⤢</span>
								{/if}
							{/if}
						</header>
						{#if group.items.length === 0}
							<div class="pl-empty drop-zone" ondragover={(e) => handleDragOver(e, group.horizon)} ondrop={(e) => handleDrop(e, group.horizon)}>Drop opportunities here</div>
						{:else}
							<div class="pl-rows">
								{#each group.items as item (item.opp.id)}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										ondragstart={(e) => handleDragStart(e, item.opp.id)}
										ondragend={handleDragEnd}
										ondragover={(e) => handleDragOver(e, group.horizon)}
										ondrop={(e) => handleDrop(e, group.horizon)}
									>
										<OpportunityRow
											opp={item.opp}
											bucket={item.bucket}
											nudge={item.nudge}
											{density}
											selected={item.opp.id === selectedId}
											dimmed={activeStage !== null && item.opp.stage !== activeStage}
											highlighted={activeStage === item.opp.stage}
											dragging={draggedOppId === item.opp.id}
											showStageBadge
											draggable
											linkedDeliverables={getLinkedDeliverables(item.opp.id)}
											{onSelect}
											{onAdvance}
											{onSelectDeliverable}
											onPark={handlePark}
											{lens}
										/>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			{/each}

			{#if !zoomedGroup}
				<div class="add-horizon-row">
					<input
						class="add-horizon-input"
						type="text"
						placeholder="New horizon (e.g. 2026Q4, LATER)…"
						bind:value={newHorizonName}
						onkeydown={(e) => { if (e.key === 'Enter') handleAddHorizon() }}
					/>
					<button class="btn-ghost add-horizon-btn" onclick={handleAddHorizon} disabled={!newHorizonName.trim()}>+ Add horizon</button>
				</div>
			{/if}
		{/if}

		{#if discontinuedOpps.length > 0}
			<details class="pl-exited-section">
				<summary class="pl-exited-header">Exited <span class="pl-exited-count">{discontinuedOpps.length}</span></summary>
				<div class="pl-rows">
					{#each discontinuedOpps as opp (opp.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="pl-row pl-exited-row" role="button" tabindex="0" class:selected={opp.id === selectedId} onclick={() => onSelect(opp.id)}>
							<span class="pl-title">{opp.title}{#if opp.exitState}<span class="exit-tag">{EXIT_STATES.find(e => e.key === opp.exitState)?.label ?? 'Exited'}</span>{/if}</span>
							<span class="pl-nudge">{EXIT_STATES.find(e => e.key === opp.exitState)?.icon ?? '✗'} at {STAGES.find((s) => s.key === opp.stage)?.label}</span>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	{/if}
</div>

<style>
	.pl-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-sm) var(--sp-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-sm);
		box-sizing: border-box;
	}

	.pl-container > * {
		width: 100%;
		max-width: 56rem;
	}

	/* --- Add input --- */
	.pl-onboarding-hint {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		text-align: center;
		padding: var(--sp-sm) var(--sp-md);
	}

	.pl-empty-invite {
		padding: var(--sp-sm) var(--sp-md) var(--sp-md);
	}

	.pl-empty-ghost {
		font-style: italic;
	}

	.pl-ghost-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-xs) var(--sp-md);
		opacity: 0.3;
		pointer-events: none;
		border-bottom: 1px solid var(--c-border-soft);
	}

	.pl-ghost-title {
		font-size: var(--fs-sm);
		color: var(--c-text);
		font-style: italic;
	}

	.pl-ghost-dots {
		display: flex;
		gap: 3px;
	}

	.pl-ghost-dots .dot {
		font-size: var(--fs-lg);
		color: var(--c-text-ghost);
	}

	.pl-first-add-nudge {
		font-size: var(--fs-xs);
		color: var(--c-accent);
		padding: var(--sp-xs) var(--sp-md);
		padding-left: calc(var(--sp-sm) + 20px + var(--sp-sm));
	}

	.pl-add-row {
		padding: 0 var(--sp-sm);
	}

	.add-input {
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px dashed var(--c-border);
		padding: var(--sp-xs) 0;
		width: 100%;
		transition: border-color var(--tr-fast);
	}

	.add-input:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
	}

	.add-input::placeholder {
		color: var(--c-text-ghost);
	}

	/* --- Inline add (bottom of Explore) --- */
	.pl-inline-add {
		padding: var(--sp-xs) var(--sp-sm) var(--sp-sm);
		/* align with title: row padding (--sp-sm) + expand toggle (20px) + row-line1 gap (--sp-sm) */
		padding-left: calc(var(--sp-sm) + 20px + var(--sp-sm));
	}

	.inline-add-input {
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: color-mix(in srgb, var(--c-text) 3%, transparent);
		border: none;
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		width: 100%;
		transition: background var(--tr-fast), box-shadow var(--tr-fast);
	}

	.inline-add-input:focus {
		outline: none;
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
		box-shadow: 0 0 0 1px var(--c-accent);
	}

	.inline-add-input::placeholder {
		color: var(--c-text-ghost);
	}

	/* --- Funnel bar --- */
	.funnel-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.funnel-add-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1.5px dashed var(--c-border);
		background: transparent;
		color: var(--c-text-soft);
		font-family: system-ui, sans-serif;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		line-height: 0;
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		transition: border-color var(--tr-fast), color var(--tr-fast), background var(--tr-fast);
	}

	.funnel-add-btn:hover {
		border-color: var(--c-accent);
		color: var(--c-accent);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), transparent);
	}

	.funnel-add-input {
		font-family: var(--font);
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1.5px solid var(--c-accent);
		padding: var(--sp-xs) 0;
		width: 180px;
		flex-shrink: 0;
		outline: none;
	}

	.funnel-add-input::placeholder {
		color: var(--c-text-ghost);
	}

	/* --- Grouping toggle --- */
	.grouping-toggle {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}

	.grouping-btn {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 2px var(--sp-sm);
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.grouping-btn:hover {
		color: var(--c-text);
	}

	.grouping-btn.active {
		background: var(--c-accent);
		color: var(--c-surface);
	}

	/* --- Perspective lens --- */
	.lens-toggle {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
		margin-inline-start: auto;
	}

	.lens-btn {
		font-family: var(--font);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 2px var(--sp-sm);
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.lens-btn:hover {
		color: var(--c-text);
	}

	.lens-btn.active {
		background: var(--c-accent);
		color: var(--c-surface);
	}

	.lens-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.lens-summary-label {
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.lens-stat { font-weight: var(--fw-medium); }
	.lens-stat-negative { color: var(--c-red); }
	.lens-stat-none { color: var(--c-text-ghost); }
	.lens-stat-uncertain { color: var(--c-warm); }
	.lens-stat-positive { color: var(--c-green-signal); }
	.lens-stat-total { color: var(--c-text-ghost); }

	/* --- Stage groups --- */
	.pl-stage-group {
		border-radius: var(--radius-md);
		transition: max-height var(--tr-normal), opacity var(--tr-normal);
	}

	.pl-stage-collapsed {
		max-height: 0;
		opacity: 0;
		margin: 0;
		padding: 0;
		overflow: clip;
	}

	.pl-stage-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-bottom: 2px solid var(--stage-color);
	}

	.pl-stage-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.pl-stage-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
		border-radius: var(--radius-sm);
		padding: 0 6px;
		min-width: 1.4em;
		text-align: center;
	}

	.pl-stage-badge {
		font-size: var(--fs-2xs);
		padding: 0 var(--sp-xs);
		border-radius: var(--radius-sm);
	}

	.pl-badge-urgent {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) var(--opacity-subtle), transparent);
	}

	.pl-badge-attention {
		color: var(--c-warm);
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
	}

	.pl-badge-wip-over {
		color: var(--c-warm);
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
	}

	.pl-badge-wip-under {
		color: var(--c-blue);
		background: color-mix(in srgb, var(--c-blue) var(--opacity-subtle), transparent);
	}

	.pl-wip-nudge {
		font-size: var(--fs-xs);
		padding: var(--sp-xs) var(--sp-md);
		border-radius: var(--radius-sm);
		margin-bottom: var(--sp-xs);
	}
	.pl-wip-nudge.wip-over {
		color: var(--c-warm);
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
	}
	.pl-wip-nudge.wip-under {
		color: var(--c-blue);
		background: color-mix(in srgb, var(--c-blue) var(--opacity-subtle), transparent);
	}

	.pl-empty {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		padding: var(--sp-xs) var(--sp-md);
	}

	.pl-rows {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
		padding-bottom: var(--sp-xs);
	}

	/* --- Bucket separators --- */
	.bucket-separator {
		height: 0;
		margin: var(--sp-xs) var(--sp-md);
		border-top: 1px dashed color-mix(in srgb, var(--c-border) var(--opacity-strong), transparent);
	}

	/* --- Stage age --- */
	.pl-stage-age {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	/* --- Stage purpose (zoomed) --- */
	.pl-stage-purpose {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding: var(--sp-xs) var(--sp-sm);
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
	}

	.purpose-thinking {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--c-text-ghost);
		flex-shrink: 0;
	}

	/* --- Revisit-due prompt --- */
	.revisit-prompt {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		flex-wrap: wrap;
		padding: var(--sp-xs) var(--sp-sm);
		font-size: var(--fs-xs);
		color: var(--c-warm);
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
		border-radius: var(--radius-sm);
	}

	.revisit-icon {
		font-size: var(--fs-sm);
	}

	.revisit-link {
		background: none;
		border: none;
		font: inherit;
		color: var(--c-accent);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
	}

	.revisit-link:hover {
		text-decoration-color: var(--c-accent);
	}

	/* --- Sticky breadcrumb --- */
	.sticky-breadcrumb {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--c-bg);
	}

	/* --- Exited rows (kept inline — too simple for a component) --- */
	.pl-row {
		display: grid;
		grid-template-columns: 1fr minmax(120px, 1fr);
		align-items: center;
		gap: var(--sp-sm);
		padding: 5px var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.pl-row:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.pl-row.selected {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
		border-left: 3px solid var(--c-accent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	.pl-title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.pl-nudge {
		font-size: var(--fs-sm);
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.exit-tag {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		margin-left: var(--sp-xs);
		padding: 0 4px;
		border-radius: var(--radius-sm);
		vertical-align: middle;
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) var(--opacity-moderate), transparent);
	}

	.pl-exited-section {
		border-radius: var(--radius-md);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.pl-exited-header {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--c-text-ghost);
		cursor: pointer;
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: var(--sp-xs);
	}

	.pl-exited-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
		border-radius: var(--radius-sm);
		padding: 0 6px;
	}

	.pl-exited-row {
		opacity: 0.5;
	}

	.pl-exited-row .pl-title {
		text-decoration: line-through;
	}

	/* --- Zoom breadcrumb --- */
	.pl-breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.pl-breadcrumb-btn {
		font-size: var(--fs-sm);
		color: var(--c-accent);
		padding: var(--sp-2xs) var(--sp-xs);
	}

	.pl-breadcrumb-label {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}

	.pl-zoomable {
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.pl-zoomable:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.pl-zoom-hint {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		margin-left: auto;
		opacity: 0;
		transition: opacity var(--tr-fast);
	}

	.pl-zoomable:hover .pl-zoom-hint {
		opacity: 1;
	}

	/* --- Horizon mode --- */
	.pl-horizon-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-bottom: 2px solid var(--c-border);
		flex-wrap: wrap;
	}

	.pl-horizon-label {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-sm);
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		cursor: default;
		padding: 0;
	}

	.horizon-timing {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 0 var(--sp-xs);
		border-radius: var(--radius-sm);
	}
	.horizon-now { color: var(--c-green-signal); }
	.horizon-next { color: var(--c-warm); }

	.horizon-edit-input {
		font: inherit;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-accent);
		border-radius: var(--radius-sm);
		padding: 0 var(--sp-xs);
		outline: none;
		width: 160px;
	}

	.horizon-health {
		display: inline-flex;
		gap: var(--sp-sm);
		font-size: var(--fs-2xs);
		margin-left: var(--sp-sm);
	}

	.health-danger {
		color: var(--c-red);
		font-weight: var(--fw-medium);
	}

	.health-warn {
		color: var(--c-warm);
	}

	.health-clear {
		color: var(--c-green-signal);
	}

	.remove-horizon-btn {
		color: var(--c-text-ghost);
		padding: 0 var(--sp-xs);
		margin-left: var(--sp-xs);
	}

	.remove-horizon-btn:hover {
		color: var(--c-red);
	}

	.effort-summary {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-sm);
		margin-left: auto;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.effort-size {
		font-weight: var(--fw-bold);
		color: var(--c-text-soft);
		background: color-mix(in srgb, var(--c-border) 40%, transparent);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
	}

	.effort-gap {
		color: var(--c-warm);
		font-style: italic;
	}

	/* --- Drag-drop --- */
	.drop-target {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), transparent);
	}

	.drop-zone {
		border: 2px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		text-align: center;
		padding: var(--sp-sm);
	}

	/* --- Add horizon --- */
	.add-horizon-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-md) var(--sp-sm);
		border-top: 1px dashed var(--c-border-soft);
		margin-top: var(--sp-sm);
	}

	.add-horizon-input {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text);
		background: transparent;
		border: 1px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		width: 220px;
		outline: none;
		transition: border-color var(--tr-fast);
	}

	.add-horizon-input:focus {
		border-color: var(--c-accent);
		border-style: solid;
	}

	.add-horizon-input::placeholder {
		color: var(--c-text-ghost);
	}

	.add-horizon-btn {
		border: 1px solid var(--c-border-soft);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.add-horizon-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
		color: var(--c-text);
	}

	.add-horizon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
