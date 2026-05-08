<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Perspective,
		type Score,
		type Stage,
		type HorizonPressure,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		SCORE_DISPLAY,
		SCORE_SYMBOL,
		STAGES,
		CELL_QUESTIONS,
		agingLevel,
		cellHasSignal,
		commitmentUrgency,
		daysInStage,
		nextStage,
		originLabel,
		pacingSummary,
		stageConsent,
		stageIndex,
		stageLabel,
	} from '../lib/types'

	type Bucket = 'urgent' | 'attention' | 'clear'
	type Density = 'overview' | 'zoomed'

	interface LinkedDeliverable {
		link: OpportunityDeliverableLink
		deliverable: Deliverable
	}

	interface Props {
		opp: Opportunity
		bucket: Bucket
		nudge: string
		density: Density
		selected?: boolean
		dimmed?: boolean
		highlighted?: boolean
		justAdded?: boolean
		dragging?: boolean
		showStageBadge?: boolean
		draggable?: boolean
		linkedDeliverables: LinkedDeliverable[]
		horizonTag?: string
		onSelect: (id: string) => void
		onAdvance: (id: string, stage: Stage) => void
		onSelectDeliverable?: (id: string) => void
		onPark?: (id: string) => void
		lens?: Perspective | null
	}

	let {
		opp,
		bucket,
		nudge,
		density,
		selected = false,
		dimmed = false,
		highlighted = false,
		justAdded = false,
		dragging = false,
		showStageBadge = false,
		draggable = false,
		linkedDeliverables,
		horizonTag,
		onSelect,
		onAdvance,
		onSelectDeliverable,
		onPark,
		lens = null,
	}: Props = $props()

	const next = $derived(nextStage(opp.stage))
	const consent = $derived(stageConsent(opp))
	const days = $derived(daysInStage(opp))
	const pressure = $derived((horizonTag === 'now' ? 'now' : horizonTag === 'next' ? 'next' : 'none') as HorizonPressure)
	const aging = $derived(agingLevel(opp, pressure))
	const pacing = $derived(pacingSummary(opp, pressure))
	const urgency = $derived(commitmentUrgency(opp))

	const lensNudge = $derived.by(() => {
		if (!lens) return null
		const cell = opp.signals[opp.stage][lens]
		if (cell.verdict) return { text: cell.verdict, prompt: false }
		if (cell.score === 'none') return { text: CELL_QUESTIONS[opp.stage][lens], prompt: true }
		return { text: SCORE_DISPLAY[cell.score].label, prompt: true }
	})

	let expanded = $state(false)

	function toggleExpand(e: Event) {
		e.stopPropagation()
		expanded = !expanded
	}

	$effect(() => {
		if (density === 'zoomed') expanded = true
	})

	const delCount = $derived(linkedDeliverables.length)
	const showExpander = $derived(density !== 'zoomed')

	/** Signal verdicts for zoomed display — best available evidence model */
	interface VerdictSnippet {
		perspective: Perspective
		label: string
		score: Score
		verdict: string
		question: string
		fromStage?: string
	}

	/** Funnel mode: all past verdicts grouped by stage (one line per stage) */
	interface PastStageLine {
		stageLabel: string
		signals: { label: string; score: string; symbol: string; verdict: string }[]
	}

	const funnelPastStages = $derived.by((): PastStageLine[] => {
		if (density !== 'zoomed' || showStageBadge) return []
		const si = stageIndex(opp.stage)
		const lines: PastStageLine[] = []
		for (let i = 0; i < si; i++) {
			const stage = STAGES[i].key
			const signals = PERSPECTIVES
				.filter(p => cellHasSignal(opp.signals[stage][p]))
				.map(p => ({
					label: PERSPECTIVE_LABELS[p],
					score: opp.signals[stage][p].score,
					symbol: SCORE_SYMBOL[opp.signals[stage][p].score],
					verdict: opp.signals[stage][p].verdict,
				}))
			if (signals.length > 0) {
				lines.push({ stageLabel: stageLabel(stage), signals })
			}
		}
		return lines
	})

	/** Horizon mode: gap-fill from most recent past stage per unscored perspective */
	const pastEvidence = $derived.by((): VerdictSnippet[] => {
		if (density !== 'zoomed' || !showStageBadge) return []
		const si = stageIndex(opp.stage)
		const result: VerdictSnippet[] = []
		for (const p of PERSPECTIVES) {
			if (opp.signals[opp.stage][p].score !== 'none') continue
			for (let i = si - 1; i >= 0; i--) {
				const stage = STAGES[i].key
				const sig = opp.signals[stage][p]
				if (cellHasSignal(sig)) {
					result.push({
						perspective: p,
						label: PERSPECTIVE_LABELS[p],
						score: sig.score,
						verdict: sig.verdict,
						fromStage: stageLabel(stage),
						question: '',
					})
					break
				}
			}
		}
		return result
	})

	const currentVerdicts = $derived.by((): VerdictSnippet[] => {
		if (density !== 'zoomed') return []
		const signals = opp.signals[opp.stage]
		return PERSPECTIVES
			.filter(p => cellHasSignal(signals[p]))
			.map(p => ({
				perspective: p,
				label: PERSPECTIVE_LABELS[p],
				score: signals[p].score,
				verdict: signals[p].verdict,
				question: CELL_QUESTIONS[opp.stage][p],
			}))
	})

	const currentGaps = $derived.by((): VerdictSnippet[] => {
		if (density !== 'zoomed') return []
		const signals = opp.signals[opp.stage]
		return PERSPECTIVES
			.filter(p => !cellHasSignal(signals[p]))
			.map(p => ({
				perspective: p,
				label: PERSPECTIVE_LABELS[p],
				score: 'none',
				verdict: '',
				question: CELL_QUESTIONS[opp.stage][p],
			}))
	})

	/** Deliverable summary for funnel zoomed mode */
	const delSummary = $derived.by(() => {
		if (density !== 'zoomed' || showStageBadge || delCount === 0) return ''
		const sizes = new Map<string, number>()
		let unsized = 0
		let full = 0
		for (const { link, deliverable } of linkedDeliverables) {
			if (deliverable.size) sizes.set(deliverable.size, (sizes.get(deliverable.size) ?? 0) + 1)
			else unsized++
			if (link.coverage === 'full') full++
		}
		const parts: string[] = [`${delCount} deliverable${delCount === 1 ? '' : 's'}`]
		const sizeOrder = ['XS', 'S', 'M', 'L', 'XL']
		const sizeStrs = sizeOrder.filter(s => sizes.has(s)).map(s => `${sizes.get(s)}×${s}`)
		if (sizeStrs.length > 0) parts.push(sizeStrs.join(' '))
		if (unsized > 0) parts.push(`${unsized} unsized`)
		parts.push(`${full} full, ${delCount - full} partial`)
		return parts.join(' · ')
	})
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="pl-row pl-bucket-{bucket} row-aging-{aging} density-{density}"
	class:pl-row-horizon={showStageBadge}
	role="button"
	tabindex="0"
	class:selected
	class:stage-dimmed={dimmed}
	class:stage-highlighted={highlighted}
	class:just-added={justAdded}
	class:dragging
	onclick={() => onSelect(opp.id)}
	{...(draggable ? { draggable: true } : {})}
>
	<!-- LINE 1: expander, title, meta, health dots, aging -->
	<div class="row-line1">
			{#if draggable}
				<span class="drag-handle" title="Drag to move between horizons">⠿</span>
			{/if}
			{#if showExpander}
			<button class="pl-expand-toggle" onclick={toggleExpand} aria-label={expanded ? 'Collapse' : 'Expand'}>
				{#if delCount > 0}
					<span class="del-count">{delCount}</span>{expanded ? '▾' : '▸'}
				{:else}
					<span class="del-count-empty">—</span>
				{/if}
			</button>
			{/if}
			<span class="pl-title">{#if opp.ticketId}<span class="ticket-id-prefix">{opp.ticketId}</span> {/if}{opp.title}</span>
			{#if showStageBadge}
				<span class="stage-badge stage-{opp.stage}">{stageLabel(opp.stage)}</span>
			{/if}
			{#if !lens}
				<span class="pl-meta">
					{#if opp.origin}<span class="origin-tag">{originLabel(opp.origin)}</span>{/if}
				</span>
			{/if}
			{#if opp.stage !== 'deliver'}
			<span class="pl-health" role="group" aria-label="Signal scores">
				{#each PERSPECTIVES as p}
					{#if !lens || lens === p}
						{@const score = opp.signals[opp.stage][p].score}
						<span class="dot score-{score}" title="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[score].label}" role="img" aria-label="{PERSPECTIVE_LABELS[p]}: {SCORE_DISPLAY[score].label}">{SCORE_SYMBOL[score]}</span>
					{/if}
				{/each}
			</span>
			{/if}
			{#if days > 0}<span class="aging-badge aging-{aging}" title={pacing}>{days}d</span>{/if}
			<span class="pl-advance">
				{#if aging === 'stale' && onPark}
					<button class="park-btn" onclick={(e) => { e.stopPropagation(); onPark(opp.id) }} title="Park this stale opportunity">⏸</button>
				{/if}
				{#if consent.status === 'ready' && next}
					<button class="advance-btn" onclick={(e) => { e.stopPropagation(); onAdvance(opp.id, next) }} title="Advance to {STAGES.find((s) => s.key === next)?.label}">→</button>
				{/if}
			</span>
		</div>
		<!-- LINE 2: nudge -->
		<div class="row-line2">
			<span class="pl-nudge">
				{#if lensNudge}
					<span class:lens-prompt={lensNudge.prompt}>{lensNudge.text}</span>
				{:else}
					{#if density === 'zoomed'}<span class="nudge-prefix">Suggestion:</span> {/if}{nudge}
				{/if}
			</span>
		</div>
		<!-- ZOOMED: verdicts differ by funnel vs horizon mode -->
		{#if density === 'zoomed'}
			<div class="row-zoom-details">
				<div class="pacing-line pacing-{aging}">{pacing}</div>
				{#if urgency}
					<div class="commitment-line">
						<span class="commitment-label">Urgent:</span>
						<span class="commitment-to">{urgency.commitment.to}</span>
						<span class="commitment-milestone">reach {stageLabel(urgency.commitment.milestone)}</span>
						<span class="commitment-deadline" class:overdue={urgency.daysLeft < 0} class:urgent={urgency.daysLeft >= 0 && urgency.daysLeft <= 14}>
							{#if urgency.daysLeft < 0}{Math.abs(urgency.daysLeft)}d overdue{:else if urgency.daysLeft === 0}due today{:else}{urgency.daysLeft}d left{/if}
						</span>
					</div>
				{/if}
				{#if showStageBadge}
					<!-- Horizon mode: gap-fill past evidence -->
					{#if pastEvidence.length > 0}
						{#each pastEvidence as v}
							<div class="verdict-line verdict-past">
								<span class="verdict-dot score-{v.score}">{SCORE_SYMBOL[v.score]}</span>
								<span class="verdict-label">{v.label}</span>
								<span class="verdict-text">{v.verdict}</span>
								<span class="verdict-provenance">· {v.fromStage}</span>
							</div>
						{/each}
						<div class="verdict-stage-sep">
							<span class="verdict-stage-name">{stageLabel(opp.stage)}</span>
						</div>
					{/if}
				{:else}
					<!-- Funnel mode: all past verdicts grouped by stage -->
					{#each funnelPastStages as pastStage}
						<div class="verdict-stage-line verdict-past">
							<span class="verdict-stage-inline">{pastStage.stageLabel}</span>
							{#each pastStage.signals as sig}
								<span class="verdict-dot score-{sig.score}">{sig.symbol}</span>
								<span class="verdict-inline-text">{sig.label}: {sig.verdict || '—'}</span>
							{/each}
						</div>
					{/each}
					{#if funnelPastStages.length > 0}
						<div class="verdict-stage-sep">
							<span class="verdict-stage-name">{stageLabel(opp.stage)}</span>
						</div>
					{/if}
				{/if}
				{#if currentVerdicts.length > 0}
					{#each currentVerdicts as v}
						<div class="verdict-line">
							<span class="verdict-dot score-{v.score}">{SCORE_SYMBOL[v.score]}</span>
							<span class="verdict-label">{v.label}</span>
							<span class="verdict-text">{v.verdict}</span>
						</div>
					{/each}
				{:else if currentGaps.length === PERSPECTIVES.length}
					<div class="verdict-empty">awaiting input</div>
				{/if}
				{#if delSummary}
					<div class="del-summary">{delSummary}</div>
				{/if}
			</div>
		{/if}
</div>
{#if expanded && delCount > 0 && !delSummary}
	<div class="pl-deliverables">
		<span class="pl-del-label">Deliverables{#if density === 'zoomed'} ({delCount}){/if}</span>
		{#each linkedDeliverables as { link, deliverable } (deliverable.id)}
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
				<span class="pl-del-size">{deliverable.size ?? ''}</span>
				<span class="pl-del-certainty" title={deliverable.certainty != null ? `Confidence: ~${deliverable.certainty * 20}%` : ''}>{deliverable.certainty != null ? `~${deliverable.certainty * 20}%` : ''}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* --- Opportunity rows --- */
	.pl-row {
		display: flex;
		flex-direction: column;
		padding: 5px var(--sp-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--tr-fast);
		border-top: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-subtle), transparent);
	}

	.pl-row:first-child {
		border-top: none;
	}

	.row-line1 {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		min-width: 0;
	}

	.row-line2 {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding-left: calc(20px + var(--sp-sm));
		min-width: 0;
	}

	.density-zoomed .row-line2 {
		padding-left: var(--sp-md);
	}

	.pl-row-horizon .row-line2 {
		padding-left: calc(16px + 20px + 2 * var(--sp-sm));
	}

	.pl-row-horizon.density-zoomed .row-line2 {
		padding-left: calc(16px + var(--sp-md));
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

	.pl-row.pl-bucket-urgent {
		border-left: 3px solid color-mix(in srgb, var(--c-red) var(--opacity-strong), transparent);
		padding-left: calc(var(--sp-sm) - 3px);
	}

	.pl-row.pl-bucket-urgent.selected {
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
		width: 20px;
		text-align: center;
		flex-shrink: 0;
		font-family: var(--font);
		display: inline-flex;
		align-items: center;
		gap: 1px;
	}

	.pl-expand-toggle:hover {
		color: var(--c-text);
	}

	.del-count {
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}

	.del-count-empty {
		font-size: var(--fs-3xs);
		color: var(--c-text-ghost);
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

	.ticket-id-prefix {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-normal);
	}

	.pl-bucket-urgent .pl-title {
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

	.nudge-prefix {
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
		flex-shrink: 0;
	}

	.pl-bucket-urgent .pl-nudge {
		color: var(--c-text-soft);
	}

	.lens-prompt {
		font-style: italic;
		color: var(--c-text-ghost);
	}

	.pl-meta {
		display: flex;
		gap: var(--sp-sm);
		align-items: baseline;
		white-space: nowrap;
		flex-shrink: 0;
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

	.park-btn {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1px solid var(--c-warm-border);
		background: var(--c-warm-bg);
		color: var(--c-warm);
		font-size: var(--fs-2xs);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--tr-fast), border-color var(--tr-fast);
		padding: 0;
	}

	.park-btn:hover {
		background: color-mix(in srgb, var(--c-warm) 30%, transparent);
		border-color: var(--c-warm);
	}

	/* --- Tags (pill-border style) --- */
	.origin-tag {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-accent);
		background: color-mix(in srgb, var(--c-accent) var(--opacity-moderate), transparent);
		padding: 0 4px;
		border-radius: var(--radius-sm);
	}

	.aging-badge {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		flex-shrink: 0;
		line-height: 1;
	}
	.aging-fresh { color: var(--c-text-ghost); }
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
	}

	/* --- Stage badge (horizon mode, plain text) --- */
	.stage-badge {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		text-transform: lowercase;
		flex-shrink: 0;
	}

	.stage-explore { color: var(--c-stage-explore); }
	.stage-sketch { color: var(--c-stage-sketch); }
	.stage-validate { color: var(--c-stage-validate); }
	.stage-decompose { color: var(--c-stage-decompose); }
	.stage-deliver { color: var(--c-stage-deliver); }

	/* --- Drag --- */
	.drag-handle {
		cursor: grab;
		color: var(--c-text-ghost);
		font-size: var(--fs-xs);
		user-select: none;
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}
	.drag-handle:active { cursor: grabbing; }
	.pl-row.dragging { opacity: 0.4; }

	/* --- Zoomed details --- */
	.row-zoom-details {
		padding: var(--sp-xs) 0 var(--sp-xs) var(--sp-md);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pl-row-horizon .row-zoom-details {
		padding-left: calc(16px + var(--sp-md));
	}

	.verdict-line {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		min-width: 0;
	}

	.verdict-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		font-size: 8px;
		font-weight: var(--fw-bold);
		flex-shrink: 0;
		line-height: 1;
	}

	.verdict-dot.score-positive { background: var(--c-green-signal); color: var(--c-surface); }
	.verdict-dot.score-uncertain { background: var(--c-warm); color: var(--c-surface); }
	.verdict-dot.score-negative { background: var(--c-red); color: var(--c-surface); }
	.verdict-dot.score-none {
		background: none;
		border: 1.5px dashed color-mix(in srgb, var(--c-text-ghost) var(--opacity-strong), transparent);
		color: var(--c-text-ghost);
	}

	.verdict-label {
		font-weight: var(--fw-medium);
		color: var(--c-text-soft);
		flex-shrink: 0;
		width: 60px;
	}

	.verdict-text {
		color: var(--c-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.verdict-past {
		opacity: 0.75;
	}

	.verdict-provenance {
		color: var(--c-text-ghost);
		font-size: var(--fs-2xs);
		flex-shrink: 0;
	}

	.verdict-stage-sep {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		padding: 2px 0 1px;
	}

	.verdict-stage-name {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.verdict-stage-sep::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--c-border);
	}

	.verdict-empty {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.verdict-stage-line {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		min-width: 0;
		flex-wrap: wrap;
	}

	.verdict-stage-inline {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
		width: 60px;
	}

	.verdict-inline-text {
		color: var(--c-text-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.del-summary {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		padding-top: 2px;
	}

	.pacing-line {
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
		padding-top: 2px;
	}
	.pacing-aging { color: var(--c-warm); }
	.pacing-stale { color: var(--c-red); font-weight: var(--fw-medium); }

	.commitment-line {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		padding-top: 2px;
	}

	.commitment-label {
		flex-shrink: 0;
		font-weight: var(--fw-bold);
		color: var(--c-red);
	}

	.commitment-to {
		font-weight: var(--fw-medium);
		color: var(--c-text);
	}

	.commitment-milestone {
		color: var(--c-text-muted);
	}

	.commitment-deadline {
		color: var(--c-text-soft);
	}

	.commitment-deadline.overdue {
		color: var(--c-red);
		font-weight: var(--fw-bold);
	}

	.commitment-deadline.urgent {
		color: var(--c-warm);
		font-weight: var(--fw-medium);
	}

	/* --- Nested deliverables --- */
	.pl-deliverables {
		margin-left: 36px;
		padding: var(--sp-xs) 0 var(--sp-xs);
		margin-top: var(--sp-2xs);
		border-top: 1px solid color-mix(in srgb, var(--c-border) var(--opacity-moderate), transparent);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.pl-del-label {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-ghost);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 var(--sp-xs);
		margin-bottom: 2px;
	}

	.pl-del-row {
		display: grid;
		grid-template-columns: 1.2em 1fr auto auto;
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
		text-align: center;
		min-width: 2em;
	}

	.pl-del-certainty {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		text-align: right;
		min-width: 3.5em;
	}
</style>
