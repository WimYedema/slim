<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		CELL_QUESTIONS,
		PERSPECTIVES,
		STAGES,
		ORIGIN_TYPES,
		PERSPECTIVE_LABELS,
		defaultHorizon,
		stageLabel,
	} from '../lib/types'
	import { agingLevel, daysInStage, boardHealth, buildCfd, leadTimeStats } from '../lib/queries'
	import uPlot from 'uplot'
	import 'uplot/dist/uPlot.min.css'
	import type { BoardData } from '../lib/store'
	import type { MeetingData } from '../lib/meeting'
	import {
		diffBoard,
		deduplicateItems,
		groupItems,
		isGrouped,
		snapshotBoard,
		briefingKey,
		buildReturnSummary,
		reconcileFeed,
		buildReadItems,
		CONDITION_VERBS,
		type GroupedBriefingItem,
		type AnyBriefingItem,
		type BoardSnapshot,
		type ImportanceTier,
	} from '../lib/briefing'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		snapshot: BoardSnapshot | null
		meetingData: MeetingData
		boardName: string
		boardDescription: string
		onUpdateDescription: (description: string) => void
		onMarkSeen: (snapshot: BoardSnapshot) => void
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
		onSwitchView: (view: 'pipeline' | 'deliverables') => void
		onParkOpportunity: (id: string, parkUntil?: string) => void
	}

	let {
		opportunities,
		deliverables,
		links,
		snapshot,
		meetingData,
		boardName,
		boardDescription,
		onUpdateDescription,
		onMarkSeen,
		onSelectOpportunity,
		onSelectDeliverable,
		onSwitchView,
		onParkOpportunity,
	}: Props = $props()

	const currentBoard = $derived<BoardData>({ opportunities, deliverables, links })
	const rawItems = $derived(diffBoard(snapshot, currentBoard, meetingData))
	const feed = $derived(reconcileFeed(rawItems, snapshot, meetingData))

	const returnSummary = $derived(buildReturnSummary(snapshot, rawItems))
	let returnDismissed = $state(false)
	// Reset dismissed state when snapshot changes (new session)
	let lastSnapshotAt = $state(snapshot?.takenAt ?? 0)
	$effect(() => {
		const snapAt = snapshot?.takenAt ?? 0
		if (snapAt !== lastSnapshotAt) {
			lastSnapshotAt = snapAt
			returnDismissed = true
		}
	})

	// Persist updated activeConditions back to snapshot (side effect)
	$effect(() => {
		const conds = feed.activeConditions
		if (!snapshot) return
		const prev = snapshot.activeConditions
		// Only update if conditions actually changed
		const prevKeys = Object.keys(prev ?? {}).sort().join(',')
		const newKeys = Object.keys(conds).sort().join(',')
		if (prevKeys !== newKeys) {
			onMarkSeen({ ...snapshot, activeConditions: conds })
		}
	})

	let parkingId = $state<string | null>(null)
	let parkUntilInput = $state(defaultHorizon())
	let editDesc = $state(boardDescription)
	let subView: 'news' | 'overview' = $state('news')

	// ── Board health dashboard ──
	const health = $derived(boardHealth(opportunities, deliverables, links))
	const consentPct = $derived(health.totalCells > 0 ? Math.round((health.scoredCells / health.totalCells) * 100) : 0)
	const cfd = $derived(buildCfd(opportunities))
	const leadTime = $derived(leadTimeStats(opportunities))

	interface CfdInsight { icon: string; text: string; tone: 'neutral' | 'good' | 'warn' }

	const cfdInsights = $derived.by((): CfdInsight[] => {
		if (cfd.length < 2) return []
		const insights: CfdInsight[] = []
		const first = cfd[0]
		const last = cfd[cfd.length - 1]

		// WIP = items that entered explore but haven't reached decompose
		const wipStart = first.explore - first.decompose
		const wipEnd = last.explore - last.decompose
		if (wipEnd > wipStart + 1) {
			insights.push({ icon: '▲', text: `Work in progress grew from ${wipStart} to ${wipEnd}`, tone: 'warn' })
		} else if (wipEnd < wipStart - 1) {
			insights.push({ icon: '▼', text: `Work in progress shrank from ${wipStart} to ${wipEnd}`, tone: 'good' })
		} else if (wipEnd > 0) {
			insights.push({ icon: '─', text: `Work in progress is stable at ${wipEnd}`, tone: 'neutral' })
		}

		// Throughput: items that reached decompose in the period
		const throughput = last.decompose - first.decompose
		if (throughput > 0) {
			insights.push({ icon: '✓', text: `${throughput} item${throughput !== 1 ? 's' : ''} reached Decompose`, tone: 'good' })
		} else if (last.explore > 0) {
			insights.push({ icon: '⏸', text: 'No items reached Decompose in this period', tone: 'warn' })
		}

		// Arrival rate: new items entering explore
		const arrivals = last.explore - first.explore
		if (arrivals > 0 && throughput >= 0) {
			if (arrivals > throughput + 2) {
				insights.push({ icon: '⚠', text: `Intake (${arrivals}) outpaces output (${throughput}) — pipeline is widening`, tone: 'warn' })
			} else if (throughput > arrivals + 2) {
				insights.push({ icon: '✓', text: `Output (${throughput}) exceeds intake (${arrivals}) — pipeline is draining`, tone: 'good' })
			}
		}

		// Bottleneck: which stage band is thickest at the end?
		const bands = [
			{ stage: 'Explore', count: last.explore - last.sketch },
			{ stage: 'Sketch', count: last.sketch - last.validate },
			{ stage: 'Validate', count: last.validate - last.decompose },
		].filter(b => b.count > 0)
		if (bands.length > 0) {
			const biggest = bands.reduce((a, b) => b.count > a.count ? b : a)
			const total = last.explore - last.decompose
			if (total > 2 && biggest.count >= total * 0.5) {
				insights.push({ icon: '◉', text: `${biggest.stage} holds ${biggest.count} of ${total} in-progress — potential bottleneck`, tone: 'warn' })
			}
		}

		return insights
	})

	let cfdEl = $state<HTMLDivElement | null>(null)
	let cfdChart: uPlot | null = null

	/** Resolve a CSS custom property to its computed value */
	function resolveColor(prop: string): string {
		return getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
	}

	$effect(() => {
		const data = cfd
		const el = cfdEl
		if (!el || data.length < 2) {
			cfdChart?.destroy()
			cfdChart = null
			return
		}

		// uPlot data: cumulative series (explore >= sketch >= validate >= decompose)
		const xs = data.map(p => p.ts / 1000) // uPlot uses seconds
		const exploreVals = data.map(p => p.explore)
		const sketchVals = data.map(p => p.sketch)
		const validateVals = data.map(p => p.validate)
		const decomposeVals = data.map(p => p.decompose)

		const colors = {
			explore: resolveColor('--c-stage-explore'),
			sketch: resolveColor('--c-stage-sketch'),
			validate: resolveColor('--c-stage-validate'),
			decompose: resolveColor('--c-stage-decompose'),
		}

		const ghostColor = resolveColor('--c-text-ghost')
		const borderColor = resolveColor('--c-border')

		function areaSeries(label: string, color: string): uPlot.Series {
			return {
				label,
				stroke: color,
				width: 1.5,
				fill: color + 'cc',
				points: { show: false },
			}
		}

		// Tooltip plugin: shows date + per-stage counts on hover
		const tooltipEl = document.createElement('div')
		tooltipEl.className = 'bh-cfd-tooltip'
		tooltipEl.style.display = 'none'
		el.appendChild(tooltipEl)

		const stageNames = ['Explore', 'Sketch', 'Validate', 'Decompose']
		const stageColorValues = [colors.explore, colors.sketch, colors.validate, colors.decompose]

		const tooltipPlugin: uPlot.Plugin = {
			hooks: {
				setCursor(u) {
					const idx = u.cursor.idx
					if (idx == null || idx < 0 || idx >= data.length) {
						tooltipEl.style.display = 'none'
						return
					}
					const pt = data[idx]
					const d = new Date(pt.ts)
					const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
					const counts = [pt.explore, pt.sketch, pt.validate, pt.decompose]
					const rows = stageNames.map((name, i) => {
						const band = i === 0 ? counts[i] - counts[1] :
							i < 3 ? counts[i] - counts[i + 1] : counts[i]
						return `<span style="color:${stageColorValues[i]}">●</span> ${name}: ${band}`
					}).join('<br>')
					tooltipEl.innerHTML = `<strong>${dateStr}</strong> · ${pt.explore} total<br>${rows}`
					tooltipEl.style.display = 'block'

					// Position near cursor
					const left = u.cursor.left! + u.over.offsetLeft
					const chartW = u.over.clientWidth
					const flip = left > chartW * 0.65
					tooltipEl.style.top = '4px'
					tooltipEl.style.left = flip ? '' : `${left + 12}px`
					tooltipEl.style.right = flip ? `${chartW - left + 12}px` : ''
				},
			},
		}

		const opts: uPlot.Options = {
			width: el.clientWidth,
			height: 160,
			plugins: [tooltipPlugin],
			cursor: { show: true, x: true, y: false },
			legend: { show: false },
			axes: [
				{
					stroke: ghostColor,
					grid: { show: false },
					ticks: { show: false },
					values: (_u, vals) => vals.map(v => {
						const d = new Date(v * 1000)
						return `${d.getMonth() + 1}/${d.getDate()}`
					}),
					font: '10px sans-serif',
				},
				{
					stroke: ghostColor,
					grid: { stroke: borderColor, width: 0.5 },
					ticks: { show: false },
					size: 32,
					font: '10px sans-serif',
				},
			],
			series: [
				{},
				areaSeries('Explore', colors.explore),
				areaSeries('Sketch', colors.sketch),
				areaSeries('Validate', colors.validate),
				areaSeries('Decompose', colors.decompose),
			],
			bands: [
				{ series: [1, 2], fill: colors.explore + 'cc' },
				{ series: [2, 3], fill: colors.sketch + 'cc' },
				{ series: [3, 4], fill: colors.validate + 'cc' },
			],
		}

		// Destroy previous instance before creating new
		cfdChart?.destroy()
		cfdChart = new uPlot(opts, [xs, exploreVals, sketchVals, validateVals, decomposeVals], el)

		const ro = new ResizeObserver(() => {
			if (cfdChart && el.clientWidth > 0) {
				cfdChart.setSize({ width: el.clientWidth, height: 160 })
			}
		})
		ro.observe(el)

		return () => {
			ro.disconnect()
			cfdChart?.destroy()
			cfdChart = null
		}
	})

	function handleClick(item: AnyBriefingItem) {
		if (isGrouped(item)) return
		if (item.targetType === 'opportunity') {
			onSelectOpportunity(item.targetId)
		} else {
			onSelectDeliverable(item.targetId)
		}
	}

	function unscoredQuestions(item: AnyBriefingItem): string[] {
		if (isGrouped(item) || item.targetType !== 'opportunity') return []
		if (item.verb !== 'stale') return []
		const opp = opportunities.find(o => o.id === item.targetId)
		if (!opp) return []
		const questions: string[] = []
		for (const p of PERSPECTIVES) {
			if (opp.signals[opp.stage][p].score === 'none') {
				questions.push(CELL_QUESTIONS[opp.stage][p])
			}
		}
		return questions
	}

	function handleTargetClick(target: GroupedBriefingItem['targets'][number]) {
		if (target.type === 'opportunity') {
			onSelectOpportunity(target.id)
		} else {
			onSelectDeliverable(target.id)
		}
	}

	function handleMarkRead() {
		const freshSnap = snapshotBoard(currentBoard)
		// Store current visible events as read items (conditions are recomputed, not stored)
		const allVisible = [...feed.fresh, ...feed.read]
		const storedReadItems = buildReadItems(allVisible, snapshot?.readItems ?? [])
		onMarkSeen({
			...freshSnap,
			readItems: storedReadItems,
			activeConditions: feed.activeConditions,
		})
	}

	function handleDismiss(e: Event, item: AnyBriefingItem) {
		e.stopPropagation()
		// Conditions cannot be dismissed (they demand action)
		if (!isGrouped(item) && CONDITION_VERBS.has(item.verb)) return
		const key = briefingKey(item)
		const current = snapshot ?? snapshotBoard(currentBoard)
		const keys = [...new Set([...(current.readKeys ?? []), ...(current.dismissedKeys ?? []), key])]
		onMarkSeen({ ...current, readKeys: keys })
	}

	function handleParkPrompt(e: Event, item: AnyBriefingItem) {
		e.stopPropagation()
		if (!isGrouped(item) && item.targetType === 'opportunity') {
			parkingId = item.targetId
			parkUntilInput = defaultHorizon()
		}
	}

	function confirmPark(e: Event) {
		e.stopPropagation()
		if (parkingId) {
			const until = parkUntilInput.trim() || undefined
			onParkOpportunity(parkingId, until)
			parkingId = null
		}
	}

	function cancelPark(e: Event) {
		e.stopPropagation()
		parkingId = null
	}

	function timeAgo(ts: number): string {
		const diff = Date.now() - ts
		const mins = Math.floor(diff / 60000)
		if (mins < 1) return 'just now'
		if (mins < 60) return `${mins}m ago`
		const hours = Math.floor(mins / 60)
		if (hours < 24) return `${hours}h ago`
		const days = Math.floor(hours / 24)
		return `${days}d ago`
	}
</script>

<div class="bf-container">
	<div class="bf-product-header">
		<div class="bf-product-top">
			<h2 class="bf-product-name">{boardName}</h2>
			<span class="bf-toggle">
				<button class="bf-toggle-btn" class:active={subView === 'news'} onclick={() => subView = 'news'}>News</button>
				<button class="bf-toggle-btn" class:active={subView === 'overview'} onclick={() => subView = 'overview'}>Board health</button>
			</span>
		</div>
		<input
			type="text"
			class="bf-product-desc"
			placeholder="What is this product about?"
			value={editDesc}
			oninput={(e) => { editDesc = (e.target as HTMLInputElement).value }}
			onblur={() => { if (editDesc !== boardDescription) onUpdateDescription(editDesc) }}
		/>
	</div>

	{#snippet healthDashboard()}
		<div class="bh-grid">
			<button class="bh-card bh-card-nav" onclick={() => onSwitchView('pipeline')}>
				<span class="bh-label">Pipeline</span>
				<span class="bh-value">{health.totalOpps}</span>
				{#if health.totalOpps > 0}
					<div class="bh-bar">
						{#each STAGES as s}
							{@const count = health.stageCounts.find(sc => sc.stage === s.key)?.count ?? 0}
							{#if count > 0}
								<span class="bh-bar-seg bh-stage-{s.key}" style="flex:{count}" title="{count} {s.label}">{count} {s.label[0]}</span>
							{/if}
						{/each}
					</div>
				{/if}
				{#if health.totalOpps > 0}
					<span class="bh-aging-row">
						{#if health.freshCount > 0}<span class="bh-aging-badge bh-aging-fresh">{health.freshCount} fresh</span>{/if}
						{#if health.agingCount > 0}<span class="bh-aging-badge bh-aging-aging">{health.agingCount} aging</span>{/if}
						{#if health.staleCount > 0}<span class="bh-aging-badge bh-aging-stale">{health.staleCount} stale</span>{/if}
					</span>
				{/if}
			</button>
			<div class="bh-card">
				<span class="bh-label">Consent coverage</span>
				<div class="bh-arc-row">
					<svg class="bh-arc" viewBox="0 0 36 36">
						<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--c-border)" stroke-width="3" />
						{#if consentPct > 0}
							<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--c-accent)" stroke-width="3"
								stroke-dasharray="{consentPct} {100 - consentPct}"
								stroke-dashoffset="25" stroke-linecap="round" />
						{/if}
						<text x="18" y="20.5" text-anchor="middle" font-size="10" font-weight="bold" fill="var(--c-text)">{consentPct}%</text>
					</svg>
					<div class="bh-arc-detail">
						{#if health.readyCount > 0}
							<button class="bh-nav bh-flag" style="color:var(--c-green)" onclick={() => onSwitchView('pipeline')}>{health.readyCount} ready</button>
						{/if}
						{#if health.incompleteCount > 0}
							<button class="bh-nav bh-flag bh-flag-warn" onclick={() => onSwitchView('pipeline')}>{health.incompleteCount} need input</button>
						{/if}
						{#if health.urgentCount > 0}
							<button class="bh-nav bh-flag bh-flag-alert" onclick={() => onSwitchView('pipeline')}>{health.urgentCount} objection{health.urgentCount !== 1 ? 's' : ''}</button>
						{/if}
					</div>
				</div>
				{#if health.totalOpps > 0}
					<div class="bh-persp-rows">
						{#each health.perspectiveBreakdown as pb}
							<div class="bh-persp-row">
								<span class="bh-persp-label">{PERSPECTIVE_LABELS[pb.perspective]}</span>
								<span class="bh-persp-bar">
									{#if pb.scored > 0}<span class="bh-persp-seg bh-persp-scored" style="flex:{pb.scored}" title="{pb.scored} scored">{pb.scored}</span>{/if}
									{#if pb.unheard > 0}<span class="bh-persp-seg bh-persp-unheard" style="flex:{pb.unheard}" title="{pb.unheard} unheard">{pb.unheard}</span>{/if}
								</span>
								{#if pb.objections > 0}
									<span class="bh-persp-flag">✗{pb.objections}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<div class="bh-card">
				<span class="bh-label">Commitments</span>
				<span class="bh-value">{health.totalCommitments}</span>
				{#if health.overdueCommitments > 0}
					<button class="bh-nav bh-flag bh-flag-alert" onclick={() => onSwitchView('pipeline')}>{health.overdueCommitments} overdue</button>
				{/if}
				{#if health.dueSoonCommitments > 0}
					<button class="bh-nav bh-flag bh-flag-warn" onclick={() => onSwitchView('pipeline')}>{health.dueSoonCommitments} due this week</button>
				{/if}
				{#if health.totalCommitments > 0 && health.overdueCommitments === 0 && health.dueSoonCommitments === 0}
					<span class="bh-detail">all on track</span>
				{/if}
			</div>
			<button class="bh-card bh-card-nav" onclick={() => onSwitchView('deliverables')}>
				<span class="bh-label">Deliverables</span>
				<span class="bh-value">{health.totalDeliverables}</span>
				<span class="bh-detail">avg {health.avgLinksPerDeliverable} links each</span>
				{#if health.estimatedDeliverables > 0}
					<span class="bh-flag bh-flag-ok">⚡ {health.estimatedDeliverables} estimated</span>
				{/if}
				{#if health.orphanDeliverables > 0}
					<span class="bh-flag bh-flag-warn">{health.orphanDeliverables} orphan{health.orphanDeliverables !== 1 ? 's' : ''}</span>
				{/if}
			</button>
			{#if health.originCounts.length > 0}
				<div class="bh-card bh-card-wide">
					<span class="bh-label">Origin balance</span>
					<div class="bh-bar">
						{#each health.originCounts as o}
							{@const label = ORIGIN_TYPES.find(t => t.key === o.origin)?.label ?? o.origin}
							<span class="bh-bar-seg bh-origin-{o.origin}" style="flex:{o.count}" title="{o.count} {label}">{o.count} {label}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if leadTime.stageAvg.length > 0}
				{@const maxDays = Math.max(...leadTime.stageAvg.map(x => x.avgDays), 1)}
				<div class="bh-card bh-card-wide">
					<span class="bh-label">Lead time</span>
					<span class="bh-detail">avg days per stage from entry to now</span>
					<div class="bh-lead-row">
						<span class="bh-lead-stat">
							<span class="bh-lead-num">{leadTime.medianTotalDays}d</span>
							<span class="bh-detail">median</span>
						</span>
						<div class="bh-lead-bars">
							{#each leadTime.stageAvg as s}
								<div class="bh-lead-bar-row" title="{s.avgDays}d avg in {stageLabel(s.stage)} ({s.count} opps)">
									<span class="bh-lead-label">{stageLabel(s.stage)[0]}</span>
									<div class="bh-lead-track">
										<div class="bh-lead-fill bh-stage-{s.stage}" style="width:{Math.round((s.avgDays / maxDays) * 100)}%"></div>
									</div>
									<span class="bh-lead-days">{s.avgDays}d</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
			{#if cfd.length > 1}
				<div class="bh-card bh-card-wide">
					<span class="bh-label">Flow</span>
					<div class="bh-cfd" bind:this={cfdEl}></div>
					<div class="bh-cfd-legend">
						{#each STAGES as s}
							<span class="bh-cfd-key"><span class="bh-cfd-dot bh-stage-{s.key}"></span>{s.label}</span>
						{/each}
					</div>
					{#if cfdInsights.length > 0}
						<div class="bh-cfd-insights">
							{#each cfdInsights as insight}
								<span class="bh-cfd-insight bh-cfd-insight-{insight.tone}">
									<span class="bh-cfd-insight-icon">{insight.icon}</span>
									{insight.text}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#if subView === 'overview'}
		{@render healthDashboard()}
	{:else}
	<!-- News feed with age bands -->
	{#snippet wireItem(item: AnyBriefingItem, muted: boolean)}
		{#if isGrouped(item)}
			<div class="bf-wire-item bf-wire-grouped" class:bf-wire-muted={muted}>
				<span class="bf-dot" class:bf-dot-muted={muted}></span>
				<span class="bf-wire-text">{item.description}:
					{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
				</span>
				<span class="bf-time">{timeAgo(item.timestamp)}</span>
				{#if !CONDITION_VERBS.has(item.verb)}
					<button class="bf-dismiss-wire" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
				{/if}
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="bf-wire-item" class:bf-wire-muted={muted} role="button" tabindex="0" onclick={() => handleClick(item)}>
				<span class="bf-dot" class:bf-dot-muted={muted}></span>
				<span class="bf-wire-text">
					{#if item.verb === 'resolved'}
						<span class="bf-resolved-icon">✓</span>
					{/if}
					{item.description} — <span class="bf-entity">{item.targetTitle}</span>{#if item.detail}. <span class="bf-detail">{item.detail}</span>{/if}
				</span>
				<span class="bf-time">{timeAgo(item.timestamp)}</span>
				{#if !CONDITION_VERBS.has(item.verb)}
					<button class="bf-dismiss-wire" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
				{/if}
			</div>
		{/if}
	{/snippet}

	{#if feed.total === 0}
		<div class="bf-empty">
			<span class="bf-empty-icon">✓</span>
			<p class="bf-empty-text">All caught up — nothing new since your last check.</p>
			{#if !snapshot}
				<p class="bf-empty-hint">This is your first visit. Changes will show up here next time.</p>
			{/if}
		</div>
		{#if health.totalOpps > 0 || health.totalDeliverables > 0}
			{@render healthDashboard()}
		{/if}
	{:else}
		<div class="bf-header">
			<span class="bf-summary">{feed.total} item{feed.total === 1 ? '' : 's'} since {snapshot ? timeAgo(snapshot.takenAt) : 'first visit'}</span>
			{#if feed.fresh.length > 0}
				<button class="btn-ghost bf-mark-btn" onclick={handleMarkRead}>Mark all read</button>
			{/if}
		</div>

		{#if returnSummary && !returnDismissed}
			<div class="bf-return">
				<span class="bf-return-text">{returnSummary.text}</span>
				<button class="bf-return-dismiss" title="Dismiss" onclick={() => returnDismissed = true}>×</button>
			</div>
		{/if}

		{#if feed.fresh.length > 0}
			{@const freshT1 = feed.fresh.filter(i => i.tier === 1)}
			{@const freshRest = feed.fresh.filter(i => i.tier !== 1)}

			{#if freshT1.length > 0}
				<section class="bf-tier bf-tier-1">
					<div class="bf-headlines">
						{#each freshT1 as item (item.id)}
							{#if isGrouped(item)}
								<div class="bf-headline">
									{#if !CONDITION_VERBS.has(item.verb)}
										<button class="bf-dismiss" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
									{/if}
									<span class="bf-headline-desc">{item.description}:
										{#each item.targets as target, i}<button class="bf-target-link" onclick={() => handleTargetClick(target)}>{target.title}</button>{#if i < item.targets.length - 1}, {/if}{/each}
									</span>
									{#if item.detail}<span class="bf-detail">{item.detail}</span>{/if}
									<span class="bf-time">{timeAgo(item.timestamp)}</span>
								</div>
							{:else}
								{@const questions = unscoredQuestions(item)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div class="bf-headline" role="button" tabindex="0" onclick={() => handleClick(item)}>
									{#if !CONDITION_VERBS.has(item.verb)}
										<button class="bf-dismiss" title="Mark read" onclick={(e) => handleDismiss(e, item)}>×</button>
									{/if}
									<span class="bf-headline-desc">{item.description}</span>
									<span class="bf-headline-subject">{item.targetTitle}</span>
									{#if item.detail}<span class="bf-detail">{item.detail}</span>{/if}
									{#if questions.length > 0}
										<ul class="bf-questions">
											{#each questions as q}
												<li>{q}</li>
											{/each}
										</ul>
									{/if}
									<div class="bf-headline-footer">
										{#if !isGrouped(item) && (item.verb === 'stale' || item.verb === 'revisit-due')}
											{#if parkingId === item.targetId}
												<span class="bf-park-inline">
													<input class="bf-park-input" type="text" placeholder="e.g. 2026Q3" bind:value={parkUntilInput} onclick={(e) => e.stopPropagation()} />
													<button class="bf-park-btn" onclick={confirmPark}>Park</button>
													<button class="bf-park-cancel" onclick={cancelPark}>×</button>
												</span>
											{:else}
												<button class="bf-park-btn" onclick={(e) => handleParkPrompt(e, item)}>Park it</button>
											{/if}
										{/if}
										<span class="bf-time">{timeAgo(item.timestamp)}</span>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{/if}

			{#if freshRest.length > 0}
				<section class="bf-tier bf-tier-2">
					<div class="bf-wire">
						{#each freshRest as item (item.id)}
							{@render wireItem(item, false)}
						{/each}
					</div>
				</section>
			{/if}
		{/if}

		{#if feed.read.length > 0}
			<section class="bf-tier bf-tier-read">
				<h3 class="bf-tier-label bf-tier-label-read">Read</h3>
				<div class="bf-wire">
					{#each feed.read as item (item.id)}
						{@render wireItem(item, true)}
					{/each}
				</div>
			</section>
		{/if}

		{#if feed.older.length > 0}
			<details class="bf-tier bf-tier-3">
				<summary class="bf-tier-label bf-tier-toggle">Older <span class="bf-tier-count">{feed.older.length}</span></summary>
				<div class="bf-wire">
					{#each feed.older as item (item.id)}
						{@render wireItem(item, true)}
					{/each}
				</div>
			</details>
		{/if}
	{/if}
	{/if}
</div>

<style>
	.bf-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--sp-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-md);
	}

	.bf-container > * {
		width: 100%;
		max-width: 720px;
	}

	/* --- Product header --- */
	.bf-product-header {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2xs);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--c-border);
	}

	.bf-product-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-sm);
	}

	.bf-product-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		margin: 0;
	}

	.bf-product-desc {
		font: inherit;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		background: transparent;
		border: none;
		border-bottom: 1px dashed transparent;
		padding: 2px 0;
		transition: border-color var(--tr-fast);
	}

	.bf-product-desc:hover {
		border-bottom-color: var(--c-border);
	}

	.bf-product-desc:focus {
		outline: none;
		border-bottom-color: var(--c-accent);
		color: var(--c-text);
	}

	.bf-product-desc::placeholder {
		color: var(--c-text-ghost);
		font-style: italic;
	}

	/* --- Sub-view toggle --- */
	.bf-toggle {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}

	.bf-toggle-btn {
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

	.bf-toggle-btn:hover {
		color: var(--c-text);
	}

	.bf-toggle-btn.active {
		background: var(--c-accent);
		color: var(--c-bg);
	}

	/* --- Board health dashboard --- */
	.bh-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--sp-sm);
	}

	.bh-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3xs);
		background: var(--c-surface);
		border-radius: var(--radius-md);
		padding: var(--sp-sm) var(--sp-md);
		box-shadow: var(--shadow-sm);
	}

	.bh-card-wide {
		grid-column: 1 / -1;
	}

	.bh-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
	}

	.bh-value {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		line-height: 1;
	}

	.bh-detail {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	/* Clickable card that navigates to another view */
	.bh-card-nav {
		cursor: pointer;
		border: 1px solid transparent;
		font: inherit;
		text-align: left;
		transition: border-color var(--tr-fast);
	}
	.bh-card-nav:hover {
		border-color: var(--c-border-strong);
	}
	.bh-card-nav:focus-visible {
		outline: 2px solid var(--c-accent);
		outline-offset: 2px;
	}

	/* Inline navigable flags (commitment overdue, etc.) */
	.bh-nav {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-decoration: none;
	}
	.bh-nav:hover {
		text-decoration: underline;
		text-decoration-color: var(--c-text-ghost);
		text-underline-offset: 2px;
	}
	.bh-nav:focus-visible {
		outline: 2px solid var(--c-accent);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.bh-flag {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
	}

	.bh-flag-warn {
		color: var(--c-warm);
	}

	.bh-flag-alert {
		color: var(--c-red);
	}

	.bh-aging-row {
		display: flex;
		gap: var(--sp-sm);
		flex-wrap: wrap;
	}
	.bh-aging-badge {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
	}
	.bh-aging-fresh { color: var(--c-green-signal); }
	.bh-aging-aging { color: var(--c-warm); }
	.bh-aging-stale { color: var(--c-red); }

	.bh-bar {
		display: flex;
		gap: 2px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		font-size: var(--fs-xs);
		margin-top: var(--sp-3xs);
	}

	.bh-bar-seg {
		padding: var(--sp-3xs) var(--sp-xs);
		color: white;
		text-align: center;
		white-space: nowrap;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bh-origin-demand { background: var(--c-stage-validate); }
	.bh-origin-supply { background: var(--c-stage-sketch); }
	.bh-origin-incident { background: var(--c-red); }
	.bh-origin-debt { background: var(--c-warm); }

	/* Stage colors for bars and fills */
	.bh-stage-explore { background: var(--c-stage-explore); }
	.bh-stage-sketch { background: var(--c-stage-sketch); }
	.bh-stage-validate { background: var(--c-stage-validate); }
	.bh-stage-decompose { background: var(--c-stage-decompose); }

	/* Consent arc */
	.bh-arc-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}
	.bh-arc {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
	}
	.bh-arc-detail {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3xs);
	}

	/* Per-perspective breakdown rows */
	.bh-persp-rows {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3xs);
		margin-top: var(--sp-xs);
	}
	.bh-persp-row {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}
	.bh-persp-label {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		width: 5.5em;
		flex-shrink: 0;
	}
	.bh-persp-bar {
		display: flex;
		flex: 1;
		gap: 1px;
		border-radius: var(--radius-xs);
		overflow: hidden;
		height: 14px;
	}
	.bh-persp-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: var(--fw-medium);
		color: white;
		min-width: 14px;
	}
	.bh-persp-scored { background: var(--c-accent); }
	.bh-persp-unheard { background: var(--c-border); color: var(--c-text-muted); }
	.bh-persp-flag {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-red);
		flex-shrink: 0;
	}

	/* Lead time */
	.bh-lead-row {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
	}
	.bh-lead-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
	}
	.bh-lead-num {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--c-text);
		line-height: 1;
	}
	.bh-lead-bars {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.bh-lead-bar-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2xs);
		font-size: var(--fs-xs);
	}
	.bh-lead-label {
		width: 1em;
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}
	.bh-lead-track {
		flex: 1;
		height: 6px;
		background: var(--c-border);
		border-radius: 3px;
		overflow: hidden;
	}
	.bh-lead-fill {
		height: 100%;
		border-radius: 3px;
		transition: width var(--tr-normal);
	}
	.bh-lead-days {
		color: var(--c-text-ghost);
		min-width: 2.5em;
		text-align: right;
	}

	/* CFD chart */
	.bh-cfd {
		width: 100%;
		border-radius: var(--radius-sm);
		position: relative;
	}
	.bh-cfd :global(.uplot) {
		width: 100% !important;
	}
	.bh-cfd :global(.u-wrap) {
		width: 100% !important;
	}
	.bh-cfd :global(.bh-cfd-tooltip) {
		position: absolute;
		z-index: 10;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		padding: var(--sp-3xs) var(--sp-2xs);
		font-size: var(--fs-xs);
		line-height: 1.5;
		color: var(--c-text);
		box-shadow: var(--shadow-sm);
		pointer-events: none;
		white-space: nowrap;
	}
	.bh-cfd-legend {
		display: flex;
		gap: var(--sp-sm);
		justify-content: center;
		margin-top: var(--sp-3xs);
	}
	.bh-cfd-key {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}
	.bh-cfd-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		display: inline-block;
	}
	.bh-cfd-insights {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: var(--sp-3xs);
	}
	.bh-cfd-insight {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		line-height: 1.4;
	}
	.bh-cfd-insight-icon {
		flex-shrink: 0;
		width: 1.1em;
		text-align: center;
	}
	.bh-cfd-insight-warn { color: var(--c-warm); }
	.bh-cfd-insight-good { color: var(--c-green-signal); }

	/* --- Empty state --- */
	.bf-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xl) var(--sp-md);
		text-align: center;
	}

	.bf-empty-icon {
		font-size: var(--fs-3xl);
		color: var(--c-green-signal);
	}

	.bf-empty-text {
		font-size: var(--fs-md);
		color: var(--c-text-muted);
		margin: 0;
	}

	.bf-empty-hint {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		margin: 0;
	}

	/* --- Header --- */
	.bf-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-xs) 0;
	}

	.bf-summary {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.bf-mark-btn {
		font-size: var(--fs-sm);
		padding: var(--sp-xs) var(--sp-sm);
	}

	/* --- Return summary --- */
	.bf-return {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-sm) var(--sp-md);
		background: var(--c-surface-alt);
		border-left: 3px solid var(--c-accent);
		border-radius: var(--radius-sm);
		font-size: var(--fs-sm);
	}

	.bf-return-text {
		flex: 1;
		font-weight: var(--fw-medium);
		color: var(--c-text);
	}

	.bf-return-dismiss {
		background: none;
		border: none;
		color: var(--c-text-muted);
		cursor: pointer;
		font-size: var(--fs-md);
		padding: 0 var(--sp-2xs);
		line-height: 1;
	}

	.bf-return-dismiss:hover {
		color: var(--c-text);
	}

	/* --- Tiers --- */
	.bf-tier {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.bf-tier-label {
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
		padding: var(--sp-xs) 0;
		min-height: 0;
	}

	.bf-tier-label:empty {
		display: none;
	}

	.bf-tier-3 .bf-tier-label {
		color: var(--c-text-ghost);
		cursor: pointer;
	}

	.bf-tier-toggle {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
	}

	.bf-tier-count {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-normal);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
		padding: 0 6px;
		border-radius: var(--radius-sm);
	}

	/* --- Headlines (tier 1) --- */
	.bf-headlines {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--sp-sm);
		max-width: 900px;
	}

	.bf-headline {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-sm);
		border-left: 3px solid var(--c-red);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c-red) 4%, var(--c-surface));
		cursor: pointer;
		transition: background var(--tr-fast);
		position: relative;
	}

	.bf-headline:hover {
		background: color-mix(in srgb, var(--c-red) 8%, var(--c-surface));
	}

	.bf-dismiss {
		position: absolute;
		top: var(--sp-xs);
		right: var(--sp-xs);
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
		border-radius: var(--radius-xs);
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.bf-headline:hover .bf-dismiss {
		opacity: 1;
	}

	.bf-dismiss:hover {
		color: var(--c-text);
		background: color-mix(in srgb, var(--c-text) 8%, transparent);
	}

	.bf-headline-desc {
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--c-text);
		line-height: 1.4;
	}

	.bf-headline-subject {
		font-size: var(--fs-sm);
		color: var(--c-text-soft);
	}

	.bf-questions {
		margin: 0;
		padding: 0 0 0 var(--sp-md);
		list-style: disc;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		line-height: 1.5;
	}

	.bf-headline .bf-time {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		align-self: flex-end;
	}

	.bf-headline-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-sm);
	}

	.bf-park-btn {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-text) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--c-text) 10%, transparent);
		border-radius: var(--radius-sm);
		padding: 1px var(--sp-sm);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.bf-park-btn:hover {
		background: color-mix(in srgb, var(--c-text) 12%, transparent);
		color: var(--c-text);
	}

	.bf-park-inline {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.bf-park-input {
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--c-border);
		padding: 1px 0;
		width: 80px;
		outline: none;
	}

	.bf-park-input:focus {
		border-bottom-color: var(--c-accent);
	}

	.bf-park-cancel {
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
	}

	.bf-park-cancel:hover {
		color: var(--c-text);
	}

	/* --- Wire feed (tier 2 + 3) --- */
	.bf-wire {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.bf-wire-item {
		display: grid;
		grid-template-columns: 8px 1fr auto auto;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.bf-wire-item:hover {
		background: color-mix(in srgb, var(--c-surface) var(--opacity-strong), transparent);
	}

	.bf-dismiss-wire {
		background: none;
		border: none;
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		cursor: pointer;
		padding: 0 2px;
		line-height: 1;
		border-radius: var(--radius-xs);
		opacity: 0;
		transition: opacity var(--tr-fast), color var(--tr-fast);
	}

	.bf-wire-item:hover .bf-dismiss-wire {
		opacity: 1;
	}

	.bf-dismiss-wire:hover {
		color: var(--c-text);
	}

	.bf-wire-grouped {
		cursor: default;
	}

	.bf-wire-muted {
		opacity: 0.7;
	}

	.bf-resolved-icon {
		color: var(--c-green-signal);
		font-weight: var(--fw-bold);
		margin-right: 2px;
	}

	.bf-tier-label-read {
		color: var(--c-text-ghost);
	}

	.bf-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--c-text-soft);
		flex-shrink: 0;
	}

	.bf-dot-muted {
		background: var(--c-text-ghost);
	}

	.bf-wire-text {
		font-size: var(--fs-sm);
		color: var(--c-text-soft);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bf-entity {
		color: var(--c-text);
		font-weight: var(--fw-medium);
	}

	.bf-detail {
		color: var(--c-text-muted);
		font-style: italic;
	}

	.bf-time {
		font-size: var(--fs-2xs);
		color: var(--c-text-ghost);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* --- Target links (grouped items) --- */
	.bf-target-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: var(--fw-medium);
		color: var(--c-text);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--c-text-ghost);
		text-underline-offset: 2px;
	}

	.bf-target-link:hover {
		color: var(--c-link);
		text-decoration-color: var(--c-link);
	}
</style>
