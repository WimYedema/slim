<script lang="ts">
	import {
		type Opportunity,
		type OpportunityDeliverableLink,
		type Perspective,
		type Stage,
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
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		selectedId?: string | null
		onSelect: (id: string) => void
		onAdvance: (id: string, toStage: Stage) => void
		onAdd: (title: string) => void
		compact?: boolean
		orderedIds?: string[]
		links?: OpportunityDeliverableLink[]
		allHorizons?: string[]
	}

	let { opportunities, selectedId = null, onSelect, onAdvance, onAdd, compact = false, orderedIds = $bindable([]), links = [], allHorizons = [] }: Props = $props()

	let newTitle = $state('')
	let hoveredStage = $state<string | null>(null)
	let addExpanded = $state(false)
	let lastAddedId = $state<string | null>(null)
	let addInputEl = $state<HTMLInputElement | null>(null)

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
		// Flash: find the new opportunity (it'll be at explore stage, newest)
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

	interface GapInfo {
		perspective: Perspective
		weight: number
	}

	type Bucket = 'blocked' | 'attention' | 'clear'

	interface ListItem {
		opp: Opportunity
		urgency: number
		gaps: GapInfo[]
		nudge: string
		bucket: Bucket
	}

	function classifyBucket(opp: Opportunity, gaps: GapInfo[], zeroCount: number): Bucket {
		const consent = stageConsent(opp)
		const urgency = commitmentUrgency(opp)

		// Blocked: objections or overdue commitments — can't advance
		if (consent.objections.length > 0) return 'blocked'
		if (urgency && urgency.daysLeft < 0) return 'blocked'
		// On track: consent achieved at current stage, no imminent deadlines
		if (consent.status === 'ready' && (!urgency || urgency.daysLeft > 14)) return 'clear'
		// Attention: everything else — deadlines, unheard voices, gaps
		return 'attention'
	}

	// Stage × perspective nudges — the question a PO would actually ask
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

		// Objections take top priority — they block everything
		if (consent.objections.length > 0) {
			const label = PERSPECTIVE_LABELS[consent.objections[0]].toLowerCase()
			return `${label} objection — resolve before advancing`
		}

		// Commitment deadline takes priority over gap nudges
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

	/** Roadmap-specific warnings not already covered by nudges/buckets */
	function roadmapWarnings(opp: Opportunity): { icon: string; label: string }[] {
		if (!opp.horizon) return []
		const warnings: { icon: string; label: string }[] = []
		const si = stageIndex(opp.stage)

		// Stage vs horizon mismatch: early stage in a near-term horizon
		if (allHorizons.length > 0) {
			const hi = allHorizons.indexOf(opp.horizon)
			if (hi === 0 && si <= 1) {
				warnings.push({ icon: '⚡', label: 'Early stage for nearest horizon' })
			} else if (hi <= 1 && si === 0) {
				warnings.push({ icon: '⚡', label: 'Still exploring, near horizon' })
			}
		}

		// No deliverables at decompose
		if (si >= 3 && linksForOpportunity(links, opp.id).length === 0) {
			warnings.push({ icon: '∅', label: 'No deliverables linked' })
		}

		return warnings
	}

	const activeOpps = $derived(opportunities.filter((o) => !o.discontinuedAt))
	const discontinuedOpps = $derived(opportunities.filter((o) => !!o.discontinuedAt))

	const buckets = $derived.by(() => {
		const items: ListItem[] = activeOpps
			.map((opp) => {
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

				// Commitment deadline boosts urgency
				const cu = commitmentUrgency(opp)
				if (cu) {
					const deadlineBoost = cu.daysLeft <= 0 ? 10 : cu.daysLeft <= 7 ? 5 : cu.daysLeft <= 14 ? 2 : 0
					gapSeverity += deadlineBoost
				}

				const nudge = buildNudge(opp, gaps, zeroCount)
				const bucket = classifyBucket(opp, gaps, zeroCount)

				return { opp, urgency: gapSeverity, gaps, nudge, bucket }
			})
			.sort((a, b) => b.urgency - a.urgency)

		return {
			blocked: items.filter((i) => i.bucket === 'blocked'),
			attention: items.filter((i) => i.bucket === 'attention'),
			clear: items.filter((i) => i.bucket === 'clear'),
		}
	})

	// Expose flat visual order to parent for keyboard navigation
	$effect(() => {
		orderedIds = [...buckets.blocked, ...buckets.attention, ...buckets.clear].map(i => i.opp.id)
	})

	const BUCKET_META: Record<Bucket, { label: string; action: string }> = {
		blocked: { label: 'Blocked', action: 'Resolve before advancing' },
		attention: { label: 'Needs input', action: 'Fill in to advance' },
		clear: { label: 'On track', action: 'Advance or monitor' },
	}

	// Scroll selected row into view on keyboard navigation
	$effect(() => {
		if (!selectedId) return
		// Small delay to let DOM update
		requestAnimationFrame(() => {
			const row = document.querySelector('.list-row.selected') as HTMLElement | null
			row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		})
	})
</script>

<div class="list-container" class:compact>
	{#if opportunities.length === 0}
		<div class="add-row">
			<input
				type="text"
				class="add-input"
				placeholder="Type a title and press Enter to add your first opportunity"
				bind:value={newTitle}
				onkeydown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
			/>
		</div>
	{:else}
		{@const stageCounts = STAGES.map((s) => ({ key: s.key, label: s.label, count: activeOpps.filter((o) => o.stage === s.key).length }))}
		{@const total = activeOpps.length}
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
		{#each (['blocked', 'attention', 'clear'] as const) as bucket}
			{@const items = buckets[bucket]}
			{#if items.length > 0}
				<section class="bucket bucket-{bucket}">
					<header class="bucket-header">
						<span class="bucket-label">{BUCKET_META[bucket].label}</span>
						<span class="bucket-count">{items.length}</span>
						<span class="bucket-action">{BUCKET_META[bucket].action}</span>
					</header>
					<div class="bucket-rows">
						{#each items as item (item.opp.id)}
							{@const si = stageIndex(item.opp.stage)}
						{@const next = nextStage(item.opp.stage)}
						{@const consent = stageConsent(item.opp)}
						{@const days = daysInStage(item.opp)}
						{@const aging = agingLevel(item.opp)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="list-row row-aging-{aging}" role="button" tabindex="0" class:selected={item.opp.id === selectedId} class:stage-dimmed={hoveredStage && item.opp.stage !== hoveredStage} class:stage-highlighted={hoveredStage === item.opp.stage} class:just-added={item.opp.id === lastAddedId} onclick={() => onSelect(item.opp.id)}>
							{#if !compact}
							<span class="col-stage">
								{#each STAGES as stage, i}
									<span class="stage-pip" class:active={i === si} class:past={i < si}>{stage.label.charAt(0)}</span>
								{/each}
							</span>
							{/if}
							<span class="col-title">{item.opp.title}{#if compact}<span class="col-title-stage">{STAGES.find((s) => s.key === item.opp.stage)?.label.charAt(0)}</span>{/if}{#if !compact}{#if days > 0}<span class="aging-badge aging-{aging}">{days}d</span>{/if}{/if}</span>
							{#if !compact}
							<span class="col-health">
								{#each PERSPECTIVES as p}
									{@const score = item.opp.signals[item.opp.stage][p].score}
									<span class="dot score-{score}" title="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[score].label}">{SCORE_SYMBOL[score]}</span>
								{/each}
							</span>
							<span class="col-nudge">
								{item.nudge}
								{#each roadmapWarnings(item.opp) as warn}
									<span class="roadmap-warn" title={warn.label}>{warn.icon}</span>
								{/each}
							</span>
							<span class="col-meta">
								{#if horizonLabel(item.opp.horizon)}<span class="horizon-tag horizon-{horizonLabel(item.opp.horizon)}">{horizonLabel(item.opp.horizon)}</span>{/if}
								{#if item.opp.origin}<span class="origin-tag">{originLabel(item.opp.origin)}</span>{/if}
							</span>
							<span class="col-advance">
								{#if consent.status === 'ready' && next}
									<button class="advance-btn" onclick={(e) => { e.stopPropagation(); onAdvance(item.opp.id, next) }} title="Advance to {STAGES.find((s) => s.key === next)?.label}">→</button>
								{/if}
							</span>
							{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
		{#if discontinuedOpps.length > 0}
			<details class="discontinued-section">
				<summary class="discontinued-header">Exited <span class="bucket-count">{discontinuedOpps.length}</span></summary>
				<div class="bucket-rows">
					{#each discontinuedOpps as opp (opp.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div class="list-row discontinued-row" role="button" tabindex="0" class:selected={opp.id === selectedId} onclick={() => onSelect(opp.id)}>
							<span class="col-stage"></span>
							<span class="col-title">{opp.title}{#if opp.exitState}<span class="exit-tag">{EXIT_STATES.find(e => e.key === opp.exitState)?.label ?? 'Exited'}</span>{/if}</span>
							{#if !compact}
							<span class="col-health"></span>
							<span class="col-nudge">{EXIT_STATES.find(e => e.key === opp.exitState)?.icon ?? '✗'} at {STAGES.find((s) => s.key === opp.stage)?.label}</span>
							<span class="col-meta"></span>
							<span class="col-advance"></span>
							{/if}
						</div>
					{/each}
				</div>
			</details>
		{/if}
	{/if}
</div>

<style>
	.list-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--sp-sm) var(--sp-md);
		min-height: 0;
		overflow: auto;
		gap: var(--sp-sm);
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.empty-state {
		font-size: var(--fs-sm);
		color: var(--c-text-ghost);
		text-align: center;
		padding: var(--sp-xl) 0;
	}

	/* --- Add opportunity input --- */

	.add-row {
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

	/* --- Funnel strip --- */

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
		font-size: 1.1rem;
		font-weight: 700;
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
		background: color-mix(in srgb, var(--c-accent) 8%, transparent);
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
	.funnel-group.funnel-dimmed {
		opacity: 0.4;
	}
	.funnel-group.funnel-active .funnel-segment {
		fill: color-mix(in srgb, var(--c-accent) 25%, transparent);
	}

	.funnel-segment {
		fill: color-mix(in srgb, var(--c-text-muted) 15%, transparent);
	}

	.funnel-segment.funnel-empty {
		fill: color-mix(in srgb, var(--c-border) 20%, transparent);
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
		font-size: 10px;
		font-weight: 600;
		fill: var(--c-text-soft);
	}

	.funnel-text-count {
		font-size: 11px;
		font-weight: 700;
		fill: var(--c-text);
	}

	/* --- Bucket sections --- */

	.bucket {
		border-radius: var(--radius-md);
		padding: var(--sp-xs) var(--sp-sm) var(--sp-sm);
	}

	.bucket-blocked { background: color-mix(in srgb, var(--c-red) 5%, transparent); }
	.bucket-attention { background: color-mix(in srgb, var(--c-warm) 6%, transparent); }
	.bucket-clear { background: color-mix(in srgb, var(--c-green-signal) 5%, transparent); }

	.bucket-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: var(--sp-xs);
		margin-bottom: 2px;
	}

	.bucket-label {
		font-size: var(--fs-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.bucket-blocked .bucket-label { color: var(--c-red); }
	.bucket-attention .bucket-label { color: var(--c-warm); }
	.bucket-clear .bucket-label { color: var(--c-green-signal); }

	.bucket-count {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-surface) 50%, transparent);
		border-radius: var(--radius-sm);
		padding: 0 6px;
		min-width: 1.4em;
		text-align: center;
	}

	.bucket-action {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	/* --- Row grid: fixed columns for vertical alignment --- */

	.bucket-rows {
		display: flex;
		flex-direction: column;
	}

	.list-row {
		display: grid;
		grid-template-columns: 50px minmax(100px, 1.5fr) 66px minmax(120px, 1fr) 100px 28px;
		align-items: center;
		gap: var(--sp-sm);
		padding: 5px var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
	}

	.compact .list-row {
		grid-template-columns: 1fr;
	}

	.list-row:hover {
		background: color-mix(in srgb, var(--c-surface) 60%, transparent);
	}

	/* Off-theme aging: cool tint that feels foreign against the warm palette */

	.list-row.stage-dimmed {
		opacity: 0.3;
	}
	.list-row.stage-highlighted {
		background: color-mix(in srgb, var(--c-accent) 6%, transparent);
	}

	.list-row.just-added {
		animation: flash-new 1.2s ease-out;
	}

	@keyframes flash-new {
		0% { background: color-mix(in srgb, var(--c-accent) 30%, transparent); }
		100% { background: transparent; }
	}

	.list-row.selected {
		background: color-mix(in srgb, var(--c-accent) 10%, transparent);
		border-left: 3px solid var(--c-accent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	.bucket-blocked .list-row.selected {
		border-left-color: var(--c-accent);
	}

	/* Blocked rows: left accent for visual urgency */
	.bucket-blocked .list-row {
		border-left: 3px solid color-mix(in srgb, var(--c-red) 40%, transparent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	/* --- Column: horizon --- */

	.col-meta {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: flex-end;
		white-space: nowrap;
	}

	/* --- Column: health indicators (D F V) --- */

	.col-health {
		display: flex;
		gap: 4px;
	}

	.dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 17px;
		height: 17px;
		border-radius: 50%;
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.dot.score-positive {
		background: var(--c-green-signal);
		color: var(--c-surface);
	}

	.dot.score-uncertain {
		background: var(--c-warm);
		color: var(--c-surface);
	}

	.dot.score-negative {
		background: var(--c-red);
		color: var(--c-surface);
	}

	.dot.score-none {
		background: none;
		border: 2px dashed color-mix(in srgb, var(--c-text-ghost) 50%, transparent);
		color: var(--c-text-ghost);
	}

	/* --- Column: title --- */

	.col-title {
		font-size: var(--fs-sm);
		font-weight: 600;
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.bucket-blocked .col-title {
		font-weight: 700;
	}

	.col-title-stage {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--c-text-ghost);
		margin-left: var(--sp-xs);
		vertical-align: middle;
	}

	.origin-tag, .exit-tag {
		font-size: 0.65rem;
		font-weight: 600;
		margin-left: var(--sp-xs);
		padding: 0 4px;
		border-radius: var(--radius-sm);
		vertical-align: middle;
	}

	.origin-tag {
		color: var(--c-accent);
		background: color-mix(in srgb, var(--c-accent) 10%, transparent);
	}

	.horizon-tag {
		font-size: 0.65rem;
		font-weight: 600;
		margin-left: 4px;
		padding: 0 3px;
		border-radius: var(--radius-sm);
		color: var(--c-text-soft);
	}
	.horizon-now { color: var(--c-green-signal); }
	.horizon-next { color: var(--c-warm); }

	.exit-tag {
		color: var(--c-red);
		background: color-mix(in srgb, var(--c-red) 10%, transparent);
	}

	.aging-badge {
		font-size: 0.65rem;
		font-weight: 600;
		margin-left: 4px;
		padding: 0 3px;
		border-radius: var(--radius-sm);
	}

	.aging-fresh { color: var(--c-green-signal); }
	.aging-aging {
		color: var(--c-warm);
		border: 1px solid color-mix(in srgb, var(--c-warm) 30%, transparent);
		padding: 0 5px;
		border-radius: 9px;
	}
	.aging-stale {
		color: var(--c-surface);
		background: var(--c-red);
		padding: 1px 6px;
		border-radius: 9px;
		font-size: 0.7rem;
	}

	/* --- Column: stage progression --- */

	.col-stage {
		display: flex;
		gap: 2px;
	}

	.stage-pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 600;
		width: 16px;
		height: 16px;
		border-radius: 3px;
		color: var(--c-text-ghost);
		background: transparent;
	}

	.stage-pip.past {
		color: var(--c-text-muted);
		background: color-mix(in srgb, var(--c-text-muted) 15%, transparent);
	}

	.stage-pip.active {
		color: var(--c-surface);
		background: var(--c-text);
		font-weight: 700;
	}

	/* --- Column: nudge action --- */

	.col-nudge {
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
	}

	.roadmap-warn {
		font-style: normal;
		color: var(--c-warm);
		cursor: default;
		flex-shrink: 0;
	}

	.bucket-blocked .col-nudge {
		color: var(--c-text-muted);
	}

	/* --- Column: advance action --- */

	.col-advance {
		display: flex;
		justify-content: center;
	}

	.advance-btn {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--c-green-signal) 40%, transparent);
		background: color-mix(in srgb, var(--c-green-signal) 10%, transparent);
		color: var(--c-green-signal);
		font-size: 11px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--tr-fast), border-color var(--tr-fast);
		padding: 0;
	}

	.advance-btn:hover {
		background: color-mix(in srgb, var(--c-green-signal) 25%, transparent);
		border-color: var(--c-green-signal);
	}

	/* --- Discontinued section --- */

	.discontinued-section {
		border-radius: var(--radius-md);
		padding: var(--sp-xs) var(--sp-sm);
	}

	.discontinued-header {
		font-size: var(--fs-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--c-text-ghost);
		cursor: pointer;
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: var(--sp-xs);
	}

	.discontinued-row {
		opacity: 0.5;
	}

	.discontinued-row .col-title {
		text-decoration: line-through;
	}
</style>
