<script lang="ts">
	import {
		type Opportunity,
		type Perspective,
		type Stage,
		STAGES,
		PERSPECTIVE_LABELS,
		perspectiveWeight,
		stageIndex,
	} from '../lib/types'
	import { untrack } from 'svelte'

	interface Props {
		opportunities: Opportunity[]
		onSelect: (id: string) => void
	}

	let { opportunities: allOpportunities, onSelect }: Props = $props()

	const opportunities = $derived(allOpportunities.filter((o) => !o.discontinuedAt))

	let hoveredId: string | null = $state(null)

	/** Which 2D lens we're viewing */
	type Lens = 'market-fit' | 'build-ready' | 'business-case'

	interface QuadrantInfo {
		name: string
		action: string
	}

	interface LensConfig {
		key: Lens
		label: string
		xAxis: Perspective
		yAxis: Perspective
		sizeAxis: Perspective
		quadrants: { topLeft: QuadrantInfo; topRight: QuadrantInfo; bottomLeft: QuadrantInfo; bottomRight: QuadrantInfo }
	}

	const LENSES: LensConfig[] = [
		{
			key: 'market-fit',
			label: 'Market Fit',
			xAxis: 'desirability',
			yAxis: 'viability',
			sizeAxis: 'feasibility',
			quadrants: {
				topLeft: { name: 'Pet project', action: 'Find real users' },
				topRight: { name: 'Gold mine', action: 'Prioritize and staff it' },
				bottomLeft: { name: 'Blind spot', action: 'Talk to users AND business' },
				bottomRight: { name: 'Fan favorite', action: 'Build the business case' },
			},
		},
		{
			key: 'build-ready',
			label: 'Build Readiness',
			xAxis: 'desirability',
			yAxis: 'feasibility',
			sizeAxis: 'viability',
			quadrants: {
				topLeft: { name: 'Wishful thinking', action: 'Spike the unknowns' },
				topRight: { name: 'Ready to build', action: 'Ship it' },
				bottomLeft: { name: 'Blind spot', action: 'Validate need AND feasibility' },
				bottomRight: { name: 'Wanted but hard', action: 'De-risk the build' },
			},
		},
		{
			key: 'business-case',
			label: 'Business Case',
			xAxis: 'viability',
			yAxis: 'feasibility',
			sizeAxis: 'desirability',
			quadrants: {
				topLeft: { name: 'Easy but pointless', action: 'Find the business value' },
				topRight: { name: 'Low-hanging fruit', action: 'Just do it' },
				bottomLeft: { name: 'Blind spot', action: 'Assess cost AND value' },
				bottomRight: { name: 'Expensive bet', action: 'De-risk the build first' },
			},
		},
	]

	let activeLens: Lens = $state('market-fit')
	const lens = $derived(LENSES.find((l) => l.key === activeLens)!)

	// SVG viewport
	const W = 600
	const H = 500
	const PAD = 64
	const PLOT_L = PAD
	const PLOT_R = W - PAD
	const PLOT_T = PAD
	const PLOT_B = H - PAD
	const MID_X = (PLOT_L + PLOT_R) / 2
	const MID_Y = (PLOT_T + PLOT_B) / 2

	const STAGE_COLORS: Record<Stage, string> = {
		explore: 'var(--c-stage-explore)',
		sketch: 'var(--c-stage-sketch)',
		validate: 'var(--c-stage-validate)',
		decompose: 'var(--c-stage-decompose)',
	}

	function targetPos(opp: Opportunity, l: LensConfig): { cx: number; cy: number } {
		const xWeight = perspectiveWeight(opp, l.xAxis)
		const yWeight = perspectiveWeight(opp, l.yAxis)
		const jitter = simpleHash(opp.id) * 12 - 6
		return {
			cx: PLOT_L + xWeight * (PLOT_R - PLOT_L) + (xWeight === 0 && yWeight === 0 ? jitter : 0),
			cy: PLOT_B - yWeight * (PLOT_B - PLOT_T) + (xWeight === 0 && yWeight === 0 ? jitter * 0.7 : 0),
		}
	}

	// Animation state: current interpolated positions per opportunity id
	let animPositions: Map<string, { cx: number; cy: number; fromCx: number; fromCy: number; toCx: number; toCy: number }> = $state(new Map())
	let animProgress = $state(1) // 0..1, 1 = settled
	let animRunning = $state(false)
	const ANIM_DURATION = 600 // ms

	function initPositions(l: LensConfig) {
		const map = new Map<string, { cx: number; cy: number; fromCx: number; fromCy: number; toCx: number; toCy: number }>()
		for (const opp of opportunities) {
			const t = targetPos(opp, l)
			map.set(opp.id, { cx: t.cx, cy: t.cy, fromCx: t.cx, fromCy: t.cy, toCx: t.cx, toCy: t.cy })
		}
		return map
	}

	// On lens change, start animation
	$effect(() => {
		const l = lens // track reactivity on lens only
		const currentPositions = untrack(() => animPositions)
		const newMap = new Map(currentPositions)
		let needsAnim = false
		for (const opp of opportunities) {
			const t = targetPos(opp, l)
			const existing = newMap.get(opp.id)
			if (existing) {
				const dist = Math.abs(existing.cx - t.cx) + Math.abs(existing.cy - t.cy)
				if (dist > 1) {
					newMap.set(opp.id, { cx: existing.cx, cy: existing.cy, fromCx: existing.cx, fromCy: existing.cy, toCx: t.cx, toCy: t.cy })
					needsAnim = true
				} else {
					newMap.set(opp.id, { ...existing, toCx: t.cx, toCy: t.cy })
				}
			} else {
				newMap.set(opp.id, { cx: t.cx, cy: t.cy, fromCx: t.cx, fromCy: t.cy, toCx: t.cx, toCy: t.cy })
			}
		}
		animPositions = newMap
		if (needsAnim) {
			animProgress = 0
			startAnimation()
		}
	})

	function easeOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3)
	}

	function startAnimation() {
		if (animRunning) return
		animRunning = true
		const start = performance.now()
		function tick(now: number) {
			const elapsed = now - start
			const raw = Math.min(1, elapsed / ANIM_DURATION)
			animProgress = easeOutCubic(raw)

			// Interpolate positions
			const newMap = new Map(animPositions)
			for (const [id, pos] of newMap) {
				pos.cx = pos.fromCx + (pos.toCx - pos.fromCx) * animProgress
				pos.cy = pos.fromCy + (pos.toCy - pos.fromCy) * animProgress
			}
			animPositions = newMap

			if (raw < 1) {
				requestAnimationFrame(tick)
			} else {
				animRunning = false
				// Snap to final
				const final = new Map(animPositions)
				for (const [id, pos] of final) {
					pos.cx = pos.toCx
					pos.cy = pos.toCy
					pos.fromCx = pos.toCx
					pos.fromCy = pos.toCy
				}
				animPositions = final
			}
		}
		requestAnimationFrame(tick)
	}

	function getDotPos(opp: Opportunity): { cx: number; cy: number } {
		const anim = animPositions.get(opp.id)
		if (anim) return { cx: anim.cx, cy: anim.cy }
		return targetPos(opp, lens)
	}

	/** How far this dot moved during the current transition (0..1 normalized) */
	function dotMovement(opp: Opportunity): number {
		const anim = animPositions.get(opp.id)
		if (!anim) return 0
		const dist = Math.sqrt((anim.toCx - anim.fromCx) ** 2 + (anim.toCy - anim.fromCy) ** 2)
		const maxDist = Math.sqrt((PLOT_R - PLOT_L) ** 2 + (PLOT_B - PLOT_T) ** 2)
		return dist / maxDist
	}

	function dotRadius(opp: Opportunity): number {
		const sizeWeight = perspectiveWeight(opp, lens.sizeAxis)
		return 7 + sizeWeight * 10
	}

	function simpleHash(s: string): number {
		let h = 0
		for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
		return (h & 0xffff) / 0xffff
	}

	function summaryText(): string {
		const noX = opportunities.filter((o) => perspectiveWeight(o, lens.xAxis) === 0).length
		const noY = opportunities.filter((o) => perspectiveWeight(o, lens.yAxis) === 0).length
		const total = opportunities.length
		if (total === 0) return 'No opportunities yet'

		const xLabel = PERSPECTIVE_LABELS[lens.xAxis].toLowerCase()
		const yLabel = PERSPECTIVE_LABELS[lens.yAxis].toLowerCase()
		const parts: string[] = []
		if (noX > 0) parts.push(`${noX} of ${total} have no ${xLabel} thinking`)
		if (noY > 0) parts.push(`${noY} of ${total} have no ${yLabel} thinking`)
		if (parts.length === 0) return 'All opportunities have been assessed on both axes'
		return parts.join(' · ')
	}
</script>

<div class="scatter-container">
	<div class="scatter-toolbar">
		<div class="lens-tabs">
			{#each LENSES as l}
				<button
					class="btn-ghost lens-btn"
					class:active={activeLens === l.key}
					onclick={() => (activeLens = l.key)}
				>{l.label}</button>
			{/each}
		</div>
		<p class="neglect-summary">{summaryText()}</p>
	</div>

	<svg viewBox="0 0 {W} {H}" class="scatter-svg">
		<!-- Quadrant backgrounds -->
		<rect x={PLOT_L} y={PLOT_T} width={MID_X - PLOT_L} height={MID_Y - PLOT_T} fill="var(--c-neutral-bg-light)" opacity="0.3" />
		<rect x={MID_X} y={PLOT_T} width={PLOT_R - MID_X} height={MID_Y - PLOT_T} fill="var(--c-green-bg)" opacity="0.25" />
		<rect x={PLOT_L} y={MID_Y} width={MID_X - PLOT_L} height={PLOT_B - MID_Y} fill="var(--c-neutral-bg)" opacity="0.2" />
		<rect x={MID_X} y={MID_Y} width={PLOT_R - MID_X} height={PLOT_B - MID_Y} fill="var(--c-warm-bg)" opacity="0.25" />

		<!-- Quadrant labels -->
		<text x={PLOT_L + 10} y={PLOT_T + 22} class="quadrant-name">{lens.quadrants.topLeft.name}</text>
		<text x={PLOT_L + 10} y={PLOT_T + 36} class="quadrant-action">→ {lens.quadrants.topLeft.action}</text>
		<text x={PLOT_R - 10} y={PLOT_T + 22} text-anchor="end" class="quadrant-name">{lens.quadrants.topRight.name}</text>
		<text x={PLOT_R - 10} y={PLOT_T + 36} text-anchor="end" class="quadrant-action">→ {lens.quadrants.topRight.action}</text>
		<text x={PLOT_L + 10} y={PLOT_B - 20} class="quadrant-name">{lens.quadrants.bottomLeft.name}</text>
		<text x={PLOT_L + 10} y={PLOT_B - 6} class="quadrant-action">→ {lens.quadrants.bottomLeft.action}</text>
		<text x={PLOT_R - 10} y={PLOT_B - 20} text-anchor="end" class="quadrant-name">{lens.quadrants.bottomRight.name}</text>
		<text x={PLOT_R - 10} y={PLOT_B - 6} text-anchor="end" class="quadrant-action">→ {lens.quadrants.bottomRight.action}</text>

		<!-- Axes -->
		<line x1={PLOT_L} y1={PLOT_B} x2={PLOT_R} y2={PLOT_B} stroke="var(--c-border)" stroke-width="1" />
		<line x1={PLOT_L} y1={PLOT_T} x2={PLOT_L} y2={PLOT_B} stroke="var(--c-border)" stroke-width="1" />

		<!-- Mid lines (dashed) -->
		<line x1={MID_X} y1={PLOT_T} x2={MID_X} y2={PLOT_B} stroke="var(--c-border-soft)" stroke-width="0.5" stroke-dasharray="4 3" />
		<line x1={PLOT_L} y1={MID_Y} x2={PLOT_R} y2={MID_Y} stroke="var(--c-border-soft)" stroke-width="0.5" stroke-dasharray="4 3" />

		<!-- Axis labels -->
		<text x={MID_X} y={H - 12} text-anchor="middle" class="axis-label">{PERSPECTIVE_LABELS[lens.xAxis]} →</text>
		<text x={14} y={MID_Y} text-anchor="middle" class="axis-label" transform="rotate(-90 14 {MID_Y})">
			{PERSPECTIVE_LABELS[lens.yAxis]} →
		</text>

		<!-- Size axis legend -->
		<text x={PLOT_R} y={H - 12} text-anchor="end" class="size-legend">
			Dot size = {PERSPECTIVE_LABELS[lens.sizeAxis].toLowerCase()}
		</text>

		<!-- Opportunity dots -->
		{#each opportunities as opp (opp.id)}
			{@const pos = getDotPos(opp)}
			{@const r = dotRadius(opp)}
			{@const isHovered = hoveredId === opp.id}
			{@const movement = dotMovement(opp)}
			{@const anim = animPositions.get(opp.id)}

			<!-- Movement trail (during/after animation, fades) -->
			{#if anim && movement > 0.08 && animProgress < 1}
				<line
					x1={anim.fromCx} y1={anim.fromCy}
					x2={pos.cx} y2={pos.cy}
					stroke={STAGE_COLORS[opp.stage]}
					stroke-width={1 + movement * 4}
					opacity={0.3 * (1 - animProgress)}
					stroke-linecap="round"
				/>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				class="dot-group"
				onpointerenter={() => (hoveredId = opp.id)}
				onpointerleave={() => (hoveredId = null)}
				onclick={() => onSelect(opp.id)}
				style="cursor: pointer"
			>
				<circle
					cx={pos.cx}
					cy={pos.cy}
					r={isHovered ? r + 3 : r}
					fill={STAGE_COLORS[opp.stage]}
					opacity={isHovered ? 0.95 : 0.65}
					stroke="var(--c-surface)"
					stroke-width="1.5"
				/>
				<text
					x={pos.cx}
					y={pos.cy + 1}
					text-anchor="middle"
					dominant-baseline="central"
					class="dot-label"
					font-size={r > 12 ? '10' : '8'}
				>
					{opp.title.length <= 6 ? opp.title : opp.title.slice(0, 5) + '…'}
				</text>
			</g>

			{#if isHovered}
				{@const tipX = Math.min(Math.max(pos.cx, 100), W - 100)}
				{@const tipY = pos.cy - r - 14}
				<g class="tooltip-group">
					<rect
						x={tipX - 80} y={tipY - 28}
						width="160" height="46" rx="5"
						fill="var(--c-surface)" stroke="var(--c-border)" stroke-width="0.5"
						opacity="0.97"
					/>
					<text x={tipX} y={tipY - 14} text-anchor="middle" class="tip-title">{opp.title}</text>
					<text x={tipX} y={tipY} text-anchor="middle" class="tip-meta">{STAGES.find((s) => s.key === opp.stage)?.label}</text>
					<text x={tipX} y={tipY + 12} text-anchor="middle" class="tip-scores">
						D:{Math.round(perspectiveWeight(opp, 'desirability') * 100)}%
						F:{Math.round(perspectiveWeight(opp, 'feasibility') * 100)}%
						V:{Math.round(perspectiveWeight(opp, 'viability') * 100)}%
					</text>
				</g>
			{/if}
		{/each}
	</svg>

	<div class="stage-legend">
		{#each STAGES as stage}
			<span class="legend-item">
				<span class="legend-dot" style="background: {STAGE_COLORS[stage.key]}"></span>
				{stage.label}
			</span>
		{/each}
	</div>
</div>

<style>
	.scatter-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--sp-sm) var(--sp-lg);
		min-height: 0;
		overflow: auto;
	}

	.scatter-toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-lg);
		flex-wrap: wrap;
		margin-bottom: var(--sp-xs);
	}

	.lens-tabs {
		display: flex;
		gap: 2px;
		background: var(--c-neutral-bg-light);
		border-radius: var(--radius-sm);
		padding: 2px;
	}

	.lens-btn {
		padding: var(--sp-xs) var(--sp-sm);
	}

	.lens-btn:hover {
		color: var(--c-text);
	}

	.lens-btn.active {
		background: var(--c-surface);
		color: var(--c-text);
		box-shadow: var(--shadow-sm);
	}

	.neglect-summary {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-warm);
		font-style: italic;
	}

	.scatter-svg {
		width: 100%;
		max-width: 700px;
		height: auto;
		flex: 1;
		min-height: 0;
		align-self: center;
	}

	.quadrant-name {
		fill: var(--c-text-soft);
		font-family: var(--font);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
	}

	.quadrant-action {
		fill: var(--c-text-ghost);
		font-family: var(--font);
		font-size: var(--fs-3xs);
		font-style: italic;
	}

	.axis-label {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
	}

	.size-legend {
		fill: var(--c-text-ghost);
		font-family: var(--font);
		font-size: var(--fs-3xs);
		font-style: italic;
	}

	.dot-group circle {
		transition: r 0.15s ease, opacity 0.15s ease;
	}

	.dot-label {
		fill: var(--c-surface);
		font-family: var(--font);
		font-weight: var(--fw-bold);
		pointer-events: none;
	}

	.tip-title {
		fill: var(--c-text);
		font-family: var(--font);
		font-size: var(--fs-3xs);
		font-weight: var(--fw-bold);
	}

	.tip-meta {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: var(--fs-3xs);
	}

	.tip-scores {
		fill: var(--c-text-soft);
		font-family: var(--font);
		font-size: 8px;
	}

	.stage-legend {
		display: flex;
		align-items: center;
		gap: var(--sp-lg);
		justify-content: center;
		padding: var(--sp-xs) 0;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.legend-dot {
		width: var(--dot-size-xs);
		height: var(--dot-size-xs);
		border-radius: var(--radius-full);
	}
</style>
