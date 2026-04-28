<script lang="ts">
	import { type Stage, STAGES } from '../lib/types'

	interface TriageInfo {
		urgent: number
		attention: number
	}

	interface Props {
		stageCounts: { key: Stage; label: string; count: number }[]
		hoveredStage: string | null
		filteredStage?: string | null
		triageByStage?: Record<string, TriageInfo>
		onHover: (stage: string | null) => void
		onClick?: (stage: string) => void
	}

	let { stageCounts, hoveredStage, filteredStage = null, triageByStage = {}, onHover, onClick }: Props = $props()

	const W = 480
	const H = 48
	const SEG_W = W / 4
	const H_MAX = H * 0.95
	const H_MIN = H * 0.15

	const refCount = $derived(Math.max(...stageCounts.map(s => s.count), 1))
	const segHeights = $derived(stageCounts.map(s => Math.max(s.count / refCount * H_MAX, H_MIN)))

	const activeStage = $derived(filteredStage ?? hoveredStage)
</script>

<div class="funnel-strip" onpointerleave={() => onHover(null)}>
	<svg viewBox="0 0 {W} {H}" class="funnel-svg" role="img" aria-label="Pipeline funnel">
		{#each stageCounts as stage, i}
			{@const leftH = segHeights[i]}
			{@const rightH = i < 3 ? segHeights[i + 1] : H_MIN}
			{@const x = i * SEG_W}
			{@const leftY = (H - leftH) / 2}
			{@const rightY = (H - rightH) / 2}
			{@const hasItems = stage.count > 0}
			{@const triage = triageByStage[stage.key]}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				class="funnel-group"
				class:funnel-active={activeStage === stage.key}
				class:funnel-dimmed={activeStage !== null && activeStage !== stage.key}
				class:funnel-locked={filteredStage === stage.key}
				onpointerenter={() => onHover(stage.key)}
				onclick={() => onClick?.(stage.key)}
			>
				<polygon
					points="{x},{leftY} {x + SEG_W},{rightY} {x + SEG_W},{rightY + rightH} {x},{leftY + leftH}"
					class="funnel-segment"
					class:funnel-empty={!hasItems}
					style="--stage-color: var(--c-stage-{stage.key})"
				/>
				{#if i > 0}
					<line x1={x} y1={leftY} x2={x} y2={leftY + leftH} class="funnel-divider" />
				{/if}
				<text x={x + 8} y={H / 2 - 4} class="funnel-text funnel-text-label">{stage.label}</text>
				<text x={x + 8} y={H / 2 + 10} class="funnel-text funnel-text-count">{stage.count}</text>
				{#if triage && hasItems}
					{@const dotX = x + SEG_W - 12}
					{#if triage.urgent > 0}
						<circle cx={dotX} cy={H / 2 - 4} r="3" class="triage-dot triage-urgent" />
					{:else if triage.attention > 0}
						<circle cx={dotX} cy={H / 2 - 4} r="3" class="triage-dot triage-attention" />
					{/if}
				{/if}
			</g>
		{/each}
	</svg>
</div>

<style>
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
	.funnel-group.funnel-locked .funnel-segment {
		fill: color-mix(in srgb, var(--stage-color) var(--opacity-emphasis), transparent);
		stroke: var(--stage-color);
		stroke-width: 1.5;
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

	.triage-dot {
		pointer-events: none;
	}
	.triage-urgent { fill: var(--c-red); }
	.triage-attention { fill: var(--c-warm); }
</style>
