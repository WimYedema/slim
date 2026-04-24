<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Perspective,
		type Stage,
		type TShirtSize,
		type Score,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		STAGES,
		commitmentUrgency,
		daysInStage,
		agingLevel,
		originLabel,
		EXIT_STATES,
		linksForOpportunity,
		nextStage,
		perspectiveWeight,
		stageConsent,
		stageIndex,
		stageLabel,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		selectedId?: string | null
		onSelect: (id: string) => void
		onSelectDeliverable?: (id: string) => void
		onAdvance: (id: string, toStage: Stage) => void
		onAdd: (title: string) => void
		compact?: boolean
		orderedIds?: string[]
		allHorizons?: string[]
		grouping?: 'stage' | 'horizon'
		customHorizons?: string[]
		onUpdateOpportunity?: (opp: Opportunity) => void
		onAddHorizon?: (name: string) => void
		onRemoveHorizon?: (name: string) => void
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
		compact = false,
		orderedIds = $bindable([]),
		allHorizons = [],
		grouping = 'stage',
		customHorizons = [],
		onUpdateOpportunity,
		onAddHorizon,
		onRemoveHorizon,
	}: Props = $props()

	let newTitle = $state('')
	let hoveredStage = $state<string | null>(null)
	let addExpanded = $state(false)
	let lastAddedId = $state<string | null>(null)
	let addInputEl = $state<HTMLInputElement | null>(null)
	let expandedOpps = $state<Set<string>>(new Set())

	// ── Zoom state ──
	let zoomedGroup = $state<string | null>(null)

	// ── Horizon editing & drag-drop state ──
	let editingHorizon = $state<string | null>(null)
	let editValue = $state('')
	let newHorizonName = $state('')
	let draggedOppId = $state<string | null>(null)
	let dropTargetHorizon = $state<string | null>(null)

	function toggleExpanded(id: string) {
		const next = new Set(expandedOpps)
		if (next.has(id)) next.delete(id)
		else next.add(id)
		expandedOpps = next
	}

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

	// ── Triage classification (reused from ListView) ──

	interface GapInfo {
		perspective: Perspective
		weight: number
	}

	type Bucket = 'blocked' | 'attention' | 'clear'

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
		if (consent.objections.length > 0) return 'blocked'
		if (urgency && urgency.daysLeft < 0) return 'blocked'
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

	function buildNudge(opp: Opportunity, gaps: GapInfo[], zeroCount: number): string {
		const consent = stageConsent(opp)
		const urgency = commitmentUrgency(opp)

		if (gaps.length === 3 && zeroCount === 3) return 'Fresh — pick any angle to start'

		if (consent.objections.length > 0) {
			const label = PERSPECTIVE_LABELS[consent.objections[0]].toLowerCase()
			return `${label} objection — resolve before advancing`
		}

		if (urgency && urgency.daysLeft <= 14) {
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

	function roadmapWarnings(opp: Opportunity): { icon: string; label: string }[] {
		if (!opp.horizon) return []
		const warnings: { icon: string; label: string }[] = []
		const si = stageIndex(opp.stage)

		if (allHorizons.length > 0) {
			const hi = allHorizons.indexOf(opp.horizon)
			if (hi === 0 && si <= 1) {
				warnings.push({ icon: '⚡', label: 'Early stage for nearest horizon' })
			} else if (hi <= 1 && si === 0) {
				warnings.push({ icon: '⚡', label: 'Still exploring, near horizon' })
			}
		}

		if (si >= 3 && linksForOpportunity(links, opp.id).length === 0) {
			warnings.push({ icon: '∅', label: 'No deliverables linked' })
		}

		return warnings
	}

	// ── Horizon mode helpers ──

	const SIZE_ORDER: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL']

	interface SizeBreakdown {
		sizes: { size: TShirtSize; count: number }[]
		unsized: number
		avgCertainty: number | null
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
		let certSum = 0
		let certCount = 0

		for (const d of dels) {
			if (d.size) {
				counts.set(d.size, (counts.get(d.size) ?? 0) + 1)
			} else {
				unsized++
			}
			if (d.certainty) {
				certSum += d.certainty
				certCount++
			}
		}

		const sizes = SIZE_ORDER
			.filter((s) => counts.has(s))
			.map((s) => ({ size: s, count: counts.get(s)! }))

		return {
			sizes,
			unsized,
			avgCertainty: certCount > 0 ? Math.round((certSum / certCount) * 10) / 10 : null,
		}
	}

	interface RiskFlag {
		icon: string
		label: string
		level: 'warn' | 'danger'
	}

	function riskFlags(opp: Opportunity): RiskFlag[] {
		const flags: RiskFlag[] = []
		const consent = stageConsent(opp)
		const si = stageIndex(opp.stage)
		const days = daysInStage(opp)
		const aging = agingLevel(opp)
		const signals = opp.signals[opp.stage]
		const noneCount = PERSPECTIVES.filter(p => signals[p].score === 'none').length
		const hasDeliverables = linksForOpportunity(links, opp.id).length > 0

		if (consent.objections.length > 0) {
			const labels = consent.objections.map(p => PERSPECTIVE_LABELS[p].charAt(0)).join('')
			flags.push({ icon: '⊘', label: `${labels} objection`, level: 'danger' })
		}

		if (aging === 'stale') {
			flags.push({ icon: '⏳', label: `${days}d stuck`, level: 'danger' })
		} else if (aging === 'aging') {
			flags.push({ icon: '⏳', label: `${days}d in stage`, level: 'warn' })
		}

		if (noneCount > 0 && si > 0) {
			flags.push({ icon: '○', label: `${noneCount} unscored`, level: noneCount >= 2 ? 'danger' : 'warn' })
		}

		if (si >= 3 && !hasDeliverables) {
			flags.push({ icon: '∅', label: 'no deliverables', level: 'warn' })
		}

		const horizonIdx = allHorizons.indexOf(opp.horizon)
		if (horizonIdx === 0 && si <= 1) {
			flags.push({ icon: '⚡', label: 'early stage, near horizon', level: 'danger' })
		} else if (horizonIdx <= 1 && si === 0) {
			flags.push({ icon: '⚡', label: 'still exploring', level: 'warn' })
		}

		return flags
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

	// ── Build stage-grouped items ──

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

		const nudge = buildNudge(opp, gaps, zeroCount)
		const bucket = classifyBucket(opp, gaps, zeroCount)

		return { opp, urgency: gapSeverity, gaps, nudge, bucket }
	}

	const BUCKET_ORDER: Record<Bucket, number> = { blocked: 0, attention: 1, clear: 2 }

	/** Opportunities grouped by stage, sorted within each group by triage bucket + urgency */
	const stageGroups = $derived.by(() => {
		return STAGES.map((stage) => {
			const items = activeOpps
				.filter((o) => o.stage === stage.key)
				.map(buildItem)
				.sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || b.urgency - a.urgency)
			return { stage, items }
		})
	})

	/** Computed horizon list from opportunities + custom horizons */
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

	/** Opportunities grouped by horizon, sorted by stage within each */
	const horizonGroups = $derived.by(() => {
		const unassigned = activeOpps.filter(o => !o.horizon)
		const groups: HorizonGroup[] = horizons.map(horizon => {
			const items = activeOpps
				.filter(o => o.horizon === horizon)
				.map(buildItem)
				.sort((a, b) => stageIndex(a.opp.stage) - stageIndex(b.opp.stage) || b.urgency - a.urgency)
			return { horizon, items }
		})
		if (unassigned.length > 0) {
			groups.push({
				horizon: '(no horizon)',
				items: unassigned.map(buildItem).sort((a, b) => stageIndex(a.opp.stage) - stageIndex(b.opp.stage) || b.urgency - a.urgency),
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

	function linkedDeliverables(oppId: string) {
		const oppLinks = linksForOpportunity(links, oppId)
		return oppLinks.map((link) => {
			const del = deliverables.find((d) => d.id === link.deliverableId)
			return del ? { link, deliverable: del } : null
		}).filter((x): x is NonNullable<typeof x> => x !== null)
	}
</script>

<div class="pl-container" class:compact>
	{#if opportunities.length === 0}
		<div class="pl-add-row">
			<input
				type="text"
				class="add-input"
				placeholder="Type a title and press Enter to add your first opportunity"
				bind:value={newTitle}
				onkeydown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
			/>
		</div>
	{:else}
		{#snippet oppRowSnippet(item: PipelineItem, showStageBadge: boolean, draggable: boolean)}
			{@const next = nextStage(item.opp.stage)}
			{@const consent = stageConsent(item.opp)}
			{@const days = daysInStage(item.opp)}
			{@const aging = agingLevel(item.opp)}
			{@const isExpanded = expandedOpps.has(item.opp.id)}
			{@const oppDeliverables = linkedDeliverables(item.opp.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				class="pl-row pl-bucket-{item.bucket} row-aging-{aging}"
				class:pl-row-horizon={showStageBadge}
				role="button"
				tabindex="0"
				class:selected={item.opp.id === selectedId}
				class:stage-dimmed={!showStageBadge && hoveredStage !== null && item.opp.stage !== hoveredStage}
				class:stage-highlighted={!showStageBadge && hoveredStage === item.opp.stage}
				class:just-added={item.opp.id === lastAddedId}
				class:dragging={draggedOppId === item.opp.id}
				onclick={() => onSelect(item.opp.id)}
				{...(draggable ? { draggable: true } : {})}
			>
				{#if draggable && !compact}
					<span class="drag-handle" title="Drag to move between horizons">⠿</span>
				{/if}
				{#if !compact}
				<button class="pl-expand-toggle" onclick={(e) => { e.stopPropagation(); toggleExpanded(item.opp.id) }} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
					{isExpanded ? '▾' : '▸'}
				</button>
				{/if}
				<span class="pl-title">{item.opp.title}{#if compact}{#if showStageBadge}<span class="pl-title-stage">{stageLabel(item.opp.stage).charAt(0)}</span>{/if}{/if}{#if !compact}{#if days > 0}<span class="aging-badge aging-{aging}">{days}d</span>{/if}{/if}</span>
				{#if !compact}
				{#if showStageBadge}
					<span class="stage-badge stage-{item.opp.stage}">{stageLabel(item.opp.stage)}</span>
				{/if}
				<span class="pl-health" role="group" aria-label="Signal scores">
					{#each PERSPECTIVES as p}
						{@const score = item.opp.signals[item.opp.stage][p].score}
						<span class="dot score-{score}" title="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[score].label}" role="img" aria-label="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[score].label}">{SCORE_SYMBOL[score]}</span>
					{/each}
				</span>
				<span class="pl-nudge">
					{item.nudge}
					{#each roadmapWarnings(item.opp) as warn}
						<span class="roadmap-warn" title={warn.label}>{warn.icon}</span>
					{/each}
					{#if showStageBadge}
						{#each riskFlags(item.opp) as flag}
							<span class="risk-flag risk-{flag.level}" title={flag.label}>{flag.icon}</span>
						{/each}
					{/if}
				</span>
				<span class="pl-meta">
					{#if !showStageBadge && horizonLabel(item.opp.horizon)}<span class="horizon-tag horizon-{horizonLabel(item.opp.horizon)}">{horizonLabel(item.opp.horizon)}</span>{/if}
					{#if item.opp.origin}<span class="origin-tag">{originLabel(item.opp.origin)}</span>{/if}
				</span>
				<span class="pl-advance">
					{#if consent.status === 'ready' && next}
						<button class="advance-btn" onclick={(e) => { e.stopPropagation(); onAdvance(item.opp.id, next) }} title="Advance to {STAGES.find((s) => s.key === next)?.label}">→</button>
					{/if}
				</span>
				{/if}
			</div>
			{#if isExpanded && !compact && oppDeliverables.length > 0}
				<div class="pl-deliverables">
					{#each oppDeliverables as { link, deliverable } (deliverable.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="pl-del-row"
							role="button"
							tabindex="0"
							onclick={(e) => { e.stopPropagation(); onSelectDeliverable?.(deliverable.id) }}
						>
							<span
								class="pl-del-coverage"
								class:full={link.coverage === 'full'}
								title={link.coverage === 'full' ? 'Full coverage' : 'Partial coverage'}
							>{link.coverage === 'full' ? '●' : '◐'}</span>
							<span class="pl-del-title">{deliverable.title}</span>
							{#if deliverable.size}
								<span class="pl-del-size">{deliverable.size}</span>
							{/if}
							{#if deliverable.certainty != null}
								<span class="pl-del-certainty" title="Certainty {deliverable.certainty}/5">{'●'.repeat(deliverable.certainty)}{'○'.repeat(5 - deliverable.certainty)}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}

		{#if zoomedGroup}
			<div class="pl-breadcrumb">
				<button class="btn-ghost pl-breadcrumb-btn" onclick={zoomOut}>← All {grouping === 'stage' ? 'stages' : 'horizons'}</button>
				<span class="pl-breadcrumb-label">{zoomedGroup}</span>
			</div>
		{/if}

		{#if grouping === 'stage'}
			{#if !zoomedGroup}
				{@const stageCounts = STAGES.map((s) => ({ key: s.key, label: s.label, count: activeOpps.filter((o) => o.stage === s.key).length }))}
				{@const funnelW = 480}
				{@const funnelH = 48}
				{@const segW = funnelW / 4}
				{@const hMax = funnelH * 0.95}
				{@const hMin = funnelH * 0.15}
				{@const refCount = Math.max(...stageCounts.map((s) => s.count), 1)}
				{@const stageH = stageCounts.map((s) => Math.max(s.count / refCount * hMax, hMin))}
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
					<div class="funnel-strip" onpointerleave={() => hoveredStage = null}>
					<svg viewBox="0 0 {funnelW} {funnelH}" class="funnel-svg" role="img" aria-label="Pipeline funnel">
						{#each stageCounts as stage, i}
							{@const leftH = stageH[i]}
							{@const rightH = i < 3 ? stageH[i + 1] : hMin}
							{@const x = i * segW}
							{@const leftY = (funnelH - leftH) / 2}
							{@const rightY = (funnelH - rightH) / 2}
							{@const hasItems = stage.count > 0}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<g class="funnel-group" class:funnel-active={hoveredStage === stage.key} class:funnel-dimmed={hoveredStage && hoveredStage !== stage.key} onpointerenter={() => hoveredStage = stage.key}>
								<polygon
									points="{x},{leftY} {x + segW},{rightY} {x + segW},{rightY + rightH} {x},{leftY + leftH}"
									class="funnel-segment"
									class:funnel-empty={!hasItems}
									style="--stage-color: var(--c-stage-{stage.key})"
								/>
								{#if i > 0}
									<line x1={x} y1={leftY} x2={x} y2={leftY + leftH} class="funnel-divider" />
								{/if}
								<text x={x + 8} y={funnelH / 2 - 4} class="funnel-text funnel-text-label">{stage.label}</text>
								<text x={x + 8} y={funnelH / 2 + 10} class="funnel-text funnel-text-count">{stage.count}</text>
							</g>
						{/each}
					</svg>
					</div>
				</div>
			{/if}

			{#each stageGroups as group}
				{#if !zoomedGroup || zoomedGroup === group.stage.label}
					{@const blockedCount = group.items.filter(i => i.bucket === 'blocked').length}
					{@const attentionCount = group.items.filter(i => i.bucket === 'attention').length}
					<section class="pl-stage-group">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<header class="pl-stage-header pl-zoomable" role="button" tabindex="0" style="--stage-color: var(--c-stage-{group.stage.key})" onclick={() => zoomedGroup ? zoomOut() : zoomIn(group.stage.label)}>
							<span class="pl-stage-name">{group.stage.label}</span>
							<span class="pl-stage-count">{group.items.length}</span>
							{#if blockedCount > 0}
								<span class="pl-stage-badge pl-badge-blocked">{blockedCount} blocked</span>
							{/if}
							{#if attentionCount > 0}
								<span class="pl-stage-badge pl-badge-attention">{attentionCount} needs input</span>
							{/if}
							{#if !zoomedGroup}
								<span class="pl-zoom-hint" aria-hidden="true">⤢</span>
							{/if}
						</header>
						{#if group.items.length === 0}
							<div class="pl-empty">No opportunities at this stage</div>
						{:else}
							<div class="pl-rows">
								{#each group.items as item (item.opp.id)}
									{@render oppRowSnippet(item, false, false)}
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			{/each}
		{:else}
			{#if !zoomedGroup}
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
				</div>
			{/if}

			{#each horizonGroups as group}
				{#if !zoomedGroup || zoomedGroup === group.horizon}
					{@const breakdown = horizonBreakdown(group.items.map(i => i.opp))}
					{@const blockedCount = group.items.filter(i => riskFlags(i.opp).some(f => f.level === 'danger')).length}
					{@const atRisk = group.items.filter(i => riskFlags(i.opp).length > 0).length}
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
								<span class="pl-stage-count">{group.items.length}</span>
								{#if group.items.length > 0}
									<span class="horizon-health">
										{#if blockedCount > 0}
											<span class="health-danger">{blockedCount} blocked</span>
										{/if}
										{#if atRisk > blockedCount}
											<span class="health-warn">{atRisk - blockedCount} at risk</span>
										{/if}
										{#if atRisk === 0}
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
										{#if breakdown.avgCertainty !== null}
											{@const filled = Math.round(breakdown.avgCertainty)}
											<span class="certainty-indicator" title="Avg certainty: {breakdown.avgCertainty.toFixed(1)}/5">
												{#each Array(5) as _, i}
													<span class="cert-dot" class:filled={i < filled}>●</span>
												{/each}
											</span>
										{/if}
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
										{@render oppRowSnippet(item, true, true)}
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			{/each}

			{#if grouping === 'horizon' && !zoomedGroup}
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
							{#if !compact}
							<span class="pl-nudge">{EXIT_STATES.find(e => e.key === opp.exitState)?.icon ?? '✗'} at {STAGES.find((s) => s.key === opp.stage)?.label}</span>
							{/if}
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
		gap: var(--sp-sm);
		box-sizing: border-box;
	}

	/* --- Add input --- */
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

	/* --- Funnel (same as ListView) --- */
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

	.funnel-strip {
		flex: 1;
		min-width: 0;
	}

	.funnel-svg {
		width: 100%;
		max-width: 520px;
		height: auto;
		display: block;
	}

	.funnel-group {
		cursor: pointer;
		transition: opacity var(--tr-fast);
	}
	.funnel-group.funnel-dimmed { opacity: 0.4; }
	.funnel-group.funnel-active .funnel-segment {
		fill: color-mix(in srgb, var(--stage-color) var(--opacity-emphasis), transparent);
	}

	.funnel-segment {
		fill: color-mix(in srgb, var(--stage-color) var(--opacity-moderate), transparent);
	}
	.funnel-segment.funnel-empty {
		fill: color-mix(in srgb, var(--c-border) var(--opacity-moderate), transparent);
	}

	.funnel-divider {
		stroke: var(--c-bg);
		stroke-width: 1.5;
	}

	.funnel-text {
		text-anchor: start;
		font-family: var(--font);
	}
	.funnel-text-label {
		font-size: var(--fs-3xs);
		font-weight: var(--fw-medium);
		fill: var(--c-text-soft);
	}
	.funnel-text-count {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		fill: var(--c-text);
	}

	/* --- Stage groups --- */
	.pl-stage-group {
		border-radius: var(--radius-md);
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

	.pl-badge-blocked {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) var(--opacity-subtle), transparent);
	}

	.pl-badge-attention {
		color: var(--c-warm);
		background: color-mix(in srgb, var(--c-warm) var(--opacity-subtle), transparent);
	}

	.pl-empty {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		padding: var(--sp-xs) var(--sp-md);
	}

	/* --- Opportunity rows --- */
	.pl-rows {
		display: flex;
		flex-direction: column;
	}

	.pl-row {
		display: grid;
		grid-template-columns: 20px minmax(100px, 1.5fr) 66px minmax(120px, 1fr) 100px 28px;
		align-items: center;
		gap: var(--sp-sm);
		padding: 5px var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.compact .pl-row {
		grid-template-columns: 1fr;
	}

	.pl-row:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.pl-row.stage-dimmed { opacity: 0.3; }
	.pl-row.stage-highlighted {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), transparent);
	}

	.pl-row.just-added {
		animation: flash-new 1.2s ease-out;
	}

	@keyframes flash-new {
		0% { background: color-mix(in srgb, var(--c-accent) var(--opacity-emphasis), transparent); }
		100% { background: transparent; }
	}

	.pl-row.selected {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
		border-left: 3px solid var(--c-accent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	.pl-row.pl-bucket-blocked {
		border-left: 3px solid color-mix(in srgb, var(--c-red) var(--opacity-strong), transparent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	.pl-row.pl-bucket-blocked.selected {
		border-left-color: var(--c-accent);
	}

	/* --- Expand toggle --- */
	.pl-expand-toggle {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--c-text-ghost);
		font-size: var(--fs-2xs);
		padding: 0;
		width: 16px;
		text-align: center;
		flex-shrink: 0;
		font-family: var(--font);
	}

	.pl-expand-toggle:hover {
		color: var(--c-text);
	}

	/* --- Row cells --- */
	.pl-title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.pl-bucket-blocked .pl-title {
		font-weight: var(--fw-bold);
	}

	.pl-title-stage {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-ghost);
		margin-left: var(--sp-xs);
		vertical-align: middle;
	}

	.pl-health {
		display: flex;
		gap: 4px;
	}

	.dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--dot-size);
		height: var(--dot-size);
		border-radius: 50%;
		font-size: var(--fs-3xs);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.dot.score-positive { background: var(--c-green-signal); color: var(--c-surface); }
	.dot.score-uncertain { background: var(--c-warm); color: var(--c-surface); }
	.dot.score-negative { background: var(--c-red); color: var(--c-surface); }
	.dot.score-none {
		background: none;
		border: 2px dashed color-mix(in srgb, var(--c-text-ghost) var(--opacity-strong), transparent);
		color: var(--c-text-ghost);
	}

	.pl-nudge {
		font-size: var(--fs-sm);
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
	}

	.roadmap-warn {
		color: var(--c-warm);
		cursor: default;
		flex-shrink: 0;
	}

	.pl-bucket-blocked .pl-nudge {
		color: var(--c-text-soft);
	}

	.pl-meta {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: flex-end;
		white-space: nowrap;
	}

	.pl-advance {
		display: flex;
		justify-content: center;
	}

	.advance-btn {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--c-green-signal) var(--opacity-strong), transparent);
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-moderate), transparent);
		color: var(--c-green-signal);
		font-size: var(--fs-2xs);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--tr-fast), border-color var(--tr-fast);
		padding: 0;
	}

	.advance-btn:hover {
		background: color-mix(in srgb, var(--c-green-signal) var(--opacity-emphasis), transparent);
		border-color: var(--c-green-signal);
	}

	/* --- Tags (shared with ListView styles) --- */
	.origin-tag, .exit-tag {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		margin-left: var(--sp-xs);
		padding: 0 4px;
		border-radius: var(--radius-sm);
		vertical-align: middle;
	}

	.origin-tag {
		color: var(--c-accent);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
	}

	.horizon-tag {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		margin-left: 4px;
		padding: 0 3px;
		border-radius: var(--radius-sm);
		color: var(--c-text-soft);
	}
	.horizon-now { color: var(--c-green-signal); }
	.horizon-next { color: var(--c-warm); }

	.exit-tag {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) var(--opacity-moderate), transparent);
	}

	.aging-badge {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		margin-left: 4px;
		padding: 0 3px;
		border-radius: var(--radius-sm);
	}
	.aging-fresh { color: var(--c-green-signal); }
	.aging-aging {
		color: var(--c-warm);
		border: 1px solid color-mix(in srgb, var(--c-warm) var(--opacity-emphasis), transparent);
		padding: 0 5px;
		border-radius: 9px;
	}
	.aging-stale {
		color: var(--c-surface);
		background: var(--c-red);
		padding: 1px 6px;
		border-radius: 9px;
		font-size: var(--fs-2xs);
	}

	/* --- Nested deliverables --- */
	.pl-deliverables {
		margin-left: 36px;
		padding: 2px 0 var(--sp-xs);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.pl-del-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: 2px var(--sp-xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.pl-del-row:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.pl-del-coverage {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		width: 1.2em;
		text-align: center;
		flex-shrink: 0;
	}
	.pl-del-coverage.full { color: var(--c-green); }

	.pl-del-title {
		font-size: var(--fs-xs);
		color: var(--c-text);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pl-del-size {
		font-size: var(--fs-2xs);
		font-family: var(--font);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-border) 40%, transparent);
		padding: 0 var(--sp-2xs);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.pl-del-certainty {
		font-size: 6px;
		letter-spacing: -1px;
		color: var(--c-text-ghost);
		flex-shrink: 0;
	}

	/* --- Exited section --- */
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
		grid-template-columns: 1fr minmax(120px, 1fr);
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

	/* --- Zoomable headers --- */
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

	.certainty-indicator {
		display: inline-flex;
		gap: 2px;
		align-items: center;
	}

	.cert-dot {
		font-size: 7px;
		color: var(--c-border-soft);
		line-height: var(--lh-tight);
	}

	.cert-dot.filled {
		color: var(--c-green);
	}

	.effort-gap {
		color: var(--c-warm);
		font-style: italic;
	}

	/* --- Drag-drop --- */
	.drag-handle {
		cursor: grab;
		color: var(--c-text-ghost);
		font-size: var(--fs-xs);
		user-select: none;
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.pl-row.dragging {
		opacity: 0.4;
	}

	.pl-row-horizon {
		grid-template-columns: 16px 20px minmax(100px, 1.5fr) auto 66px minmax(120px, 1fr) 100px 28px;
	}

	.compact .pl-row-horizon {
		grid-template-columns: 1fr;
	}

	.drop-target {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), transparent);
	}

	.drop-zone {
		border: 2px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		text-align: center;
		padding: var(--sp-sm);
	}

	/* --- Stage badge (horizon mode) --- */
	.stage-badge {
		display: inline-block;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		flex-shrink: 0;
	}

	.stage-explore {
		background: color-mix(in srgb, var(--c-stage-explore) var(--opacity-moderate), transparent);
		color: var(--c-stage-explore);
	}

	.stage-sketch {
		background: color-mix(in srgb, var(--c-stage-sketch) var(--opacity-moderate), transparent);
		color: var(--c-stage-sketch);
	}

	.stage-validate {
		background: color-mix(in srgb, var(--c-stage-validate) var(--opacity-moderate), transparent);
		color: var(--c-stage-validate);
	}

	.stage-decompose {
		background: color-mix(in srgb, var(--c-stage-decompose) var(--opacity-moderate), transparent);
		color: var(--c-stage-decompose);
	}

	/* --- Risk flags (horizon mode) --- */
	.risk-flag {
		font-size: var(--fs-xs);
		cursor: default;
	}

	.risk-warn {
		color: var(--c-warm);
	}

	.risk-danger {
		color: var(--c-red);
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
