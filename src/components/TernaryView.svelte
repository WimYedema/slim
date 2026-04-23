<script lang="ts">
	import {
		type Opportunity,
		type Stage,
		STAGES,
		ternaryPosition,
		perspectiveWeight,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		onSelect: (id: string) => void
	}

	let { opportunities, onSelect }: Props = $props()

	let hoveredId: string | null = $state(null)

	// Per-triangle geometry (each triangle is in its own SVG viewport)
	const TW = 200
	const TH = 190
	const PAD = 28
	const TOP = { x: TW / 2, y: PAD }
	const BL = { x: PAD, y: TH - 12 }
	const BR = { x: TW - PAD, y: TH - 12 }
	const CENTER = { x: (TOP.x + BL.x + BR.x) / 3, y: (TOP.y + BL.y + BR.y) / 3 }

	function triPath(): string {
		return `M${TOP.x},${TOP.y} L${BL.x},${BL.y} L${BR.x},${BR.y} Z`
	}

	function toSvg(opp: Opportunity): { cx: number; cy: number } {
		const { x, y } = ternaryPosition(opp)
		const triW = BR.x - BL.x
		const triH = BL.y - TOP.y
		return {
			cx: BL.x + x * triW,
			cy: TOP.y + y * triH,
		}
	}

	const DOT_R = 10

	const STAGE_COLORS: Record<Stage, string> = {
		explore: 'var(--c-text-ghost)',
		sketch: 'var(--c-warm)',
		validate: 'var(--c-accent)',
		decompose: 'var(--c-green-signal)',
	}

	function oppsForStage(stage: Stage): Opportunity[] {
		return opportunities.filter((o) => o.stage === stage && !o.discontinuedAt)
	}

	function balanceLabel(opp: Opportunity): string {
		const d = perspectiveWeight(opp, 'desirability')
		const f = perspectiveWeight(opp, 'feasibility')
		const v = perspectiveWeight(opp, 'viability')
		if (d === 0 && f === 0 && v === 0) return 'No signals yet'
		return `D:${Math.round(d * 100)}% F:${Math.round(f * 100)}% V:${Math.round(v * 100)}%`
	}

	function gridLines(): Array<{ x1: number; y1: number; x2: number; y2: number }> {
		const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
		for (const t of [1 / 3, 2 / 3]) {
			lines.push({ ...spread(lerp(TOP, BL, t), lerp(TOP, BR, t)) })
			lines.push({ ...spread(lerp(BL, TOP, t), lerp(BL, BR, t)) })
			lines.push({ ...spread(lerp(BR, TOP, t), lerp(BR, BL, t)) })
		}
		return lines
	}

	function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
		return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
	}

	function spread(a: { x: number; y: number }, b: { x: number; y: number }) {
		return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
	}
</script>

<div class="ternary-container">
	<div class="triangles-row">
		{#each STAGES as stage, i}
			{@const cards = oppsForStage(stage.key)}
			<div class="triangle-column">
				<div class="stage-header">
					<span class="stage-name" style="color: {STAGE_COLORS[stage.key]}">{stage.label}</span>
					<span class="stage-count">{cards.length}</span>
				</div>
				<svg viewBox="0 0 {TW} {TH}" class="triangle-svg">
					<!-- Grid -->
					{#each gridLines() as line}
						<line
							x1={line.x1} y1={line.y1}
							x2={line.x2} y2={line.y2}
							stroke="var(--c-border-soft)" stroke-width="0.5"
						/>
					{/each}

					<!-- Triangle outline -->
					<path d={triPath()} fill="none" stroke="var(--c-border)" stroke-width="1" />

					<!-- Corner labels (only on first triangle) -->
					{#if i === 0}
						<text x={TOP.x} y={TOP.y - 8} text-anchor="middle" class="corner-label">D</text>
						<text x={BL.x - 8} y={BL.y + 4} text-anchor="middle" class="corner-label">F</text>
						<text x={BR.x + 8} y={BR.y + 4} text-anchor="middle" class="corner-label">V</text>
					{/if}

					<!-- Center reference -->
					<circle
						cx={CENTER.x} cy={CENTER.y} r="2"
						fill="none" stroke="var(--c-text-ghost)" stroke-width="0.5" stroke-dasharray="1.5 1.5"
					/>

					<!-- Dots for cards in this stage -->
					{#each cards as opp (opp.id)}
						{@const pos = toSvg(opp)}
						{@const isHovered = hoveredId === opp.id}
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
								r={isHovered ? DOT_R + 2 : DOT_R}
								fill={STAGE_COLORS[stage.key]}
								opacity={isHovered ? 0.95 : 0.7}
								stroke="var(--c-surface)"
								stroke-width="1.5"
							/>
							<text
								x={pos.cx}
								y={pos.cy + 1}
								text-anchor="middle"
								dominant-baseline="central"
								class="dot-label"
							>
								{opp.title.slice(0, 2).toUpperCase()}
							</text>
						</g>

						{#if isHovered}
							{@const tipX = Math.min(Math.max(pos.cx, 50), TW - 50)}
							{@const tipY = pos.cy - DOT_R - 10}
							<g class="tooltip-group">
								<rect
									x={tipX - 48} y={tipY - 24}
									width="96" height="34" rx="4"
									fill="var(--c-surface)" stroke="var(--c-border)" stroke-width="0.5"
									opacity="0.95"
								/>
								<text x={tipX} y={tipY - 10} text-anchor="middle" class="tip-title">{opp.title}</text>
								<text x={tipX} y={tipY + 2} text-anchor="middle" class="tip-meta">{balanceLabel(opp)}</text>
							</g>
						{/if}
					{/each}

					<!-- Empty state -->
					{#if cards.length === 0}
						<text x={CENTER.x} y={CENTER.y} text-anchor="middle" dominant-baseline="central" class="empty-label">empty</text>
					{/if}
				</svg>
				<span class="thinking-label">{stage.thinking}</span>
			</div>
		{/each}
	</div>

	<div class="legend">
		<span class="legend-hint">Position = perspective balance (D top, F left, V right) · Center = balanced · Corner = one-sided</span>
	</div>
</div>

<style>
	.ternary-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--sp-md) var(--sp-lg);
		min-height: 0;
		overflow: auto;
	}

	.triangles-row {
		display: flex;
		gap: var(--sp-sm);
		flex: 1;
		min-height: 0;
		justify-content: center;
		align-items: flex-start;
	}

	.triangle-column {
		flex: 1;
		max-width: 280px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stage-header {
		display: flex;
		align-items: baseline;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-xs);
	}

	.stage-name {
		font-size: var(--fs-sm);
		font-weight: 700;
	}

	.stage-count {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	.triangle-svg {
		width: 100%;
		height: auto;
	}

	.thinking-label {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
		margin-top: 2px;
	}

	.corner-label {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: 10px;
		font-weight: 700;
	}

	.dot-label {
		fill: var(--c-surface);
		font-family: var(--font);
		font-size: 8px;
		font-weight: 700;
		pointer-events: none;
	}

	.dot-group circle {
		transition: r 0.15s ease, opacity 0.15s ease;
	}

	.tip-title {
		fill: var(--c-text);
		font-family: var(--font);
		font-size: 9px;
		font-weight: 700;
	}

	.tip-meta {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: 7px;
	}

	.empty-label {
		fill: var(--c-text-ghost);
		font-family: var(--font);
		font-size: 10px;
		font-style: italic;
	}

	.legend {
		display: flex;
		justify-content: center;
		padding: var(--sp-sm) 0;
	}

	.legend-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
		text-align: center;
	}
</style>
