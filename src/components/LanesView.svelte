<script lang="ts">
	import {
		type Opportunity,
		type Perspective,
		type Stage,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		STAGES,
		perspectiveWeight,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		onSelect: (id: string) => void
	}

	let { opportunities: allOpportunities, onSelect }: Props = $props()

	const opportunities = $derived(allOpportunities.filter((o) => !o.discontinuedAt))

	let hoveredId: string | null = $state(null)
	let selectedId: string | null = $state(null)

	const activeId = $derived(hoveredId ?? selectedId)
	const activeOpp = $derived(activeId ? opportunities.find((o) => o.id === activeId) ?? null : null)

	// SVG geometry
	const W = 700
	const LANE_H = 56
	const LANE_GAP = 12
	const PAD_L = 100
	const PAD_R = 40
	const PAD_T = 40
	const LANE_W = W - PAD_L - PAD_R
	const H = PAD_T + PERSPECTIVES.length * (LANE_H + LANE_GAP) + 60

	const STAGE_COLORS: Record<Stage, string> = {
		explore: 'var(--c-text-ghost)',
		sketch: 'var(--c-warm)',
		validate: 'var(--c-accent)',
		decompose: 'var(--c-green-signal)',
	}

	const LANE_FILLS: Record<Perspective, string> = {
		desirability: 'var(--c-accent-bg)',
		feasibility: 'var(--c-green-bg)',
		viability: 'var(--c-warm-bg)',
	}

	const LANE_BORDERS: Record<Perspective, string> = {
		desirability: 'var(--c-accent-border)',
		feasibility: 'var(--c-green-border)',
		viability: 'var(--c-warm-border)',
	}

	function laneY(pIdx: number): number {
		return PAD_T + pIdx * (LANE_H + LANE_GAP)
	}

	function dotX(opp: Opportunity, perspective: Perspective): number {
		const w = perspectiveWeight(opp, perspective)
		return PAD_L + w * LANE_W
	}

	function dotY(opp: Opportunity, pIdx: number): number {
		// Spread dots vertically within the lane using a hash
		const base = laneY(pIdx) + LANE_H / 2
		const jitter = (simpleHash(opp.id + pIdx) - 0.5) * (LANE_H - 20)
		return base + jitter
	}

	/** Target = the max weight across all 3 perspectives (where it "should" be) */
	function targetWeight(opp: Opportunity): number {
		return Math.max(
			perspectiveWeight(opp, 'desirability'),
			perspectiveWeight(opp, 'feasibility'),
			perspectiveWeight(opp, 'viability'),
		)
	}

	function targetX(): number {
		if (!activeOpp) return 0
		return PAD_L + targetWeight(activeOpp) * LANE_W
	}

	function gapLabel(opp: Opportunity, perspective: Perspective): string {
		const w = perspectiveWeight(opp, perspective)
		const t = targetWeight(opp)
		const gap = t - w
		if (gap <= 0.05) return ''
		return `${Math.round(gap * 100)}% gap`
	}

	/** 0..1 spread between max and min perspective weights — higher = more imbalanced */
	function imbalance(opp: Opportunity): number {
		const d = perspectiveWeight(opp, 'desirability')
		const f = perspectiveWeight(opp, 'feasibility')
		const v = perspectiveWeight(opp, 'viability')
		return Math.max(d, f, v) - Math.min(d, f, v)
	}

	function simpleHash(s: string): number {
		let h = 0
		for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
		return (h & 0xffff) / 0xffff
	}

	function summaryText(): string {
		if (opportunities.length === 0) return 'No opportunities yet'
		const gaps: string[] = []
		for (const p of PERSPECTIVES) {
			const neglected = opportunities.filter((o) => perspectiveWeight(o, p) === 0).length
			if (neglected > 0) {
				gaps.push(`${neglected} with no ${PERSPECTIVE_LABELS[p].toLowerCase()}`)
			}
		}
		if (gaps.length === 0) return 'All opportunities assessed across every perspective'
		return gaps.join(' · ')
	}

	const DOT_R = 7
</script>

<div class="lanes-container">
	<div class="lanes-toolbar">
		<p class="neglect-summary">{summaryText()}</p>
	</div>

	<svg viewBox="0 0 {W} {H}" class="lanes-svg">
		<!-- Scale markers -->
		{#each [0, 0.25, 0.5, 0.75, 1] as tick}
			{@const x = PAD_L + tick * LANE_W}
			<line x1={x} y1={PAD_T - 8} x2={x} y2={PAD_T + PERSPECTIVES.length * (LANE_H + LANE_GAP) - LANE_GAP} stroke="var(--c-border-soft)" stroke-width="0.5" stroke-dasharray="3 3" />
			<text x={x} y={PAD_T - 14} text-anchor="middle" class="tick-label">{Math.round(tick * 100)}%</text>
		{/each}

		<!-- Lanes -->
		{#each PERSPECTIVES as p, pIdx}
			{@const y = laneY(pIdx)}

			<!-- Lane background -->
			<rect
				x={PAD_L} y={y}
				width={LANE_W} height={LANE_H}
				rx="6"
				fill={LANE_FILLS[p]}
				stroke={LANE_BORDERS[p]}
				stroke-width="1"
				opacity="0.6"
			/>

			<!-- Lane label -->
			<text x={PAD_L - 12} y={y + LANE_H / 2 + 1} text-anchor="end" dominant-baseline="central" class="lane-label">
				{PERSPECTIVE_LABELS[p]}
			</text>

			<!-- Target line (only when a ticket is active) -->
			{#if activeOpp}
				{@const tx = targetX()}
				{@const w = perspectiveWeight(activeOpp, p)}
				{@const t = targetWeight(activeOpp)}
				{#if t > 0.05 && t - w > 0.05}
					<!-- Gap band -->
					{@const wx = PAD_L + w * LANE_W}
					<rect
						x={wx} y={y + 2}
						width={tx - wx} height={LANE_H - 4}
						rx="4"
						fill="var(--c-red-bg)" opacity="0.35"
					/>
					<!-- Target marker -->
					<line
						x1={tx} y1={y + 4} x2={tx} y2={y + LANE_H - 4}
						stroke="var(--c-red)" stroke-width="1.5" stroke-dasharray="3 2"
					/>
				{/if}
			{/if}

			<!-- Opportunity dots -->
			{#each opportunities as opp (opp.id)}
				{@const cx = dotX(opp, p)}
				{@const cy = dotY(opp, pIdx)}
				{@const isActive = opp.id === activeId}
				{@const isInactive = activeId !== null && opp.id !== activeId}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class="dot-group"
					onpointerenter={() => (hoveredId = opp.id)}
					onpointerleave={() => (hoveredId = null)}
					onclick={() => { selectedId = selectedId === opp.id ? null : opp.id; onSelect(opp.id) }}
					style="cursor: pointer"
				>
					<circle
						cx={cx} cy={cy}
						r={isActive ? DOT_R + 2 : DOT_R}
						fill={STAGE_COLORS[opp.stage]}
						opacity={isInactive ? 0.2 : isActive ? 0.95 : 0.6}
						stroke={isActive ? 'var(--c-text)' : 'var(--c-surface)'}
						stroke-width={isActive ? 2 : 1}
					/>
					{#if !isInactive}
						<text
							x={cx} y={cy + 1}
							text-anchor="middle"
							dominant-baseline="central"
							class="dot-label"
							opacity={isInactive ? 0.2 : 1}
						>
							{opp.title.slice(0, 2).toUpperCase()}
						</text>
					{/if}
				</g>
			{/each}
		{/each}

		<!-- Connecting lines between dots across lanes (always visible) -->
		{#each opportunities as opp (opp.id)}
			{@const isActive = opp.id === activeId}
			{@const isInactive = activeId !== null && opp.id !== activeId}
			{@const imb = imbalance(opp)}
			{@const lineWidth = 0.5 + imb * 4}
			{#each PERSPECTIVES as p, pIdx}
				{#if pIdx > 0}
					{@const prevP = PERSPECTIVES[pIdx - 1]}
					<line
						x1={dotX(opp, prevP)} y1={dotY(opp, pIdx - 1)}
						x2={dotX(opp, p)} y2={dotY(opp, pIdx)}
						stroke={isActive ? STAGE_COLORS[opp.stage] : STAGE_COLORS[opp.stage]}
						stroke-width={isActive ? lineWidth + 1 : lineWidth}
						opacity={isInactive ? 0.08 : isActive ? 0.8 : 0.3}
					/>
				{/if}
			{/each}
		{/each}

		<!-- Active ticket info -->
		{#if activeOpp}
			{@const infoY = PAD_T + PERSPECTIVES.length * (LANE_H + LANE_GAP) + 8}
			<text x={PAD_L} y={infoY} class="active-title">{activeOpp.title}</text>
			<text x={PAD_L} y={infoY + 16} class="active-meta">
				{STAGES.find((s) => s.key === activeOpp.stage)?.label}
				{#each PERSPECTIVES as p}
					 · {PERSPECTIVE_LABELS[p].slice(0, 1)}:{Math.round(perspectiveWeight(activeOpp, p) * 100)}%
				{/each}
				{#each PERSPECTIVES as p}
					{@const gap = gapLabel(activeOpp, p)}
					{#if gap}
						 · {PERSPECTIVE_LABELS[p]}: {gap}
					{/if}
				{/each}
			</text>
		{:else}
			{@const infoY = PAD_T + PERSPECTIVES.length * (LANE_H + LANE_GAP) + 8}
			<text x={PAD_L} y={infoY} class="active-meta">Hover or click a dot to see gaps</text>
		{/if}
	</svg>

	<div class="stage-legend">
		{#each STAGES as stage}
			<span class="legend-item">
				<span class="legend-dot" style="background: {STAGE_COLORS[stage.key]}"></span>
				{stage.label}
			</span>
		{/each}
		<span class="legend-separator">|</span>
		<span class="legend-item">
			<span class="legend-target"></span>
			Target (best perspective)
		</span>
		<span class="legend-item">
			<span class="legend-gap"></span>
			Gap
		</span>
	</div>
</div>

<style>
	.lanes-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--sp-sm) var(--sp-lg);
		min-height: 0;
		overflow: auto;
	}

	.lanes-toolbar {
		margin-bottom: var(--sp-xs);
	}

	.neglect-summary {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-warm);
		font-style: italic;
	}

	.lanes-svg {
		width: 100%;
		max-width: 800px;
		height: auto;
		align-self: center;
	}

	.tick-label {
		fill: var(--c-text-ghost);
		font-family: var(--font);
		font-size: 9px;
	}

	.lane-label {
		fill: var(--c-text);
		font-family: var(--font);
		font-size: 12px;
		font-weight: 700;
	}

	.dot-group circle {
		transition: r 0.15s ease, opacity 0.2s ease, stroke-width 0.15s ease;
	}

	.dot-label {
		fill: var(--c-surface);
		font-family: var(--font);
		font-size: 7px;
		font-weight: 700;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.active-title {
		fill: var(--c-text);
		font-family: var(--font);
		font-size: 13px;
		font-weight: 700;
	}

	.active-meta {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: 10px;
	}

	.stage-legend {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		justify-content: center;
		padding: var(--sp-sm) 0;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
	}

	.legend-target {
		width: 12px;
		height: 0;
		border-top: 2px dashed var(--c-red);
	}

	.legend-gap {
		width: 12px;
		height: 10px;
		background: var(--c-red-bg);
		border-radius: 2px;
		opacity: 0.5;
	}

	.legend-separator {
		color: var(--c-border);
		font-size: var(--fs-xs);
	}
</style>
