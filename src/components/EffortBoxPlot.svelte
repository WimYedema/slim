<script lang="ts">
	import { type BoxPlotRow } from '../lib/types'

	interface Props {
		rows: BoxPlotRow[]
		combined: BoxPlotRow
	}

	let { rows, combined }: Props = $props()

	const ROW_H = 24
	const LABEL_W = 120
	const CHART_PAD_R = 48
	const BAR_H = 12
	const COMBINED_H = 16

	const allRows = $derived([...rows, combined])
	const maxVal = $derived(Math.max(...allRows.map((r) => r.p90)) * 1.1)
	const chartW = $derived(280)
	const totalW = $derived(LABEL_W + chartW + CHART_PAD_R)
	const totalH = $derived(rows.length * ROW_H + 8 + ROW_H + 4)
	const sepY = $derived(rows.length * ROW_H + 2)
	const combY = $derived(sepY + 6 + ROW_H / 2)
	const combTop = $derived(combY - COMBINED_H / 2)

	function x(val: number): number {
		return LABEL_W + (val / maxVal) * chartW
	}

	function fmtDays(val: number): string {
		if (val < 0.75) return '½d'
		if (val < 1.5) return '1d'
		return `${Math.round(val)}d`
	}

	function rowTip(row: BoxPlotRow, label: string): string {
		const cov = row.coverage === 'partial' ? ' (partial coverage)' : ''
		return `${label}${cov}\nMedian: ${fmtDays(row.p50)}\nLikely range (P25–P75): ${fmtDays(row.p25)} – ${fmtDays(row.p75)}\nExtended range (P10–P90): ${fmtDays(row.p10)} – ${fmtDays(row.p90)}`
	}
</script>

<svg
	class="effort-box-plot"
	viewBox="0 0 {totalW} {totalH}"
	width="100%"
	preserveAspectRatio="xMinYMin meet"
	role="img"
	aria-label="Effort estimate box plot"
>
	{#each rows as row, i (row.label)}
		{@const cy = i * ROW_H + ROW_H / 2}
		{@const barTop = cy - BAR_H / 2}

		<g class="bp-row">
			<title>{rowTip(row, row.label)}</title>

			<!-- Hit area -->
			<rect x={0} y={i * ROW_H} width={totalW} height={ROW_H} fill="transparent" />

			<!-- Label -->
			<text
				x={LABEL_W - 6}
				y={cy}
				text-anchor="end"
				dominant-baseline="central"
				class="bp-label"
			>{row.label.length > 16 ? row.label.slice(0, 15) + '…' : row.label}{#if row.coverage === 'partial'}<tspan class="bp-partial"> (½)</tspan>{/if}</text>

			<!-- Whisker line P10–P90 -->
			<line x1={x(row.p10)} y1={cy} x2={x(row.p90)} y2={cy} class="bp-whisker" />
			<!-- Whisker caps -->
			<line x1={x(row.p10)} y1={barTop} x2={x(row.p10)} y2={barTop + BAR_H} class="bp-whisker" />
			<line x1={x(row.p90)} y1={barTop} x2={x(row.p90)} y2={barTop + BAR_H} class="bp-whisker" />

			<!-- IQR box P25–P75 -->
			<rect
				x={x(row.p25)}
				y={barTop}
				width={x(row.p75) - x(row.p25)}
				height={BAR_H}
				class="bp-box"
				class:bp-partial={row.coverage === 'partial'}
			/>

			<!-- Median line -->
			<line x1={x(row.p50)} y1={barTop} x2={x(row.p50)} y2={barTop + BAR_H} class="bp-median" />

			<!-- P50 label -->
			<text
				x={x(row.p90) + 4}
				y={cy}
				dominant-baseline="central"
				class="bp-value"
			>{fmtDays(row.p50)}</text>
		</g>
	{/each}

	<!-- Separator line -->
	<line x1={LABEL_W} y1={sepY} x2={totalW - CHART_PAD_R} y2={sepY} class="bp-separator" />

	<!-- Combined row -->
	<g class="bp-row">
		<title>{rowTip(combined, 'Total (all deliverables)')}</title>

		<!-- Hit area -->
		<rect x={0} y={sepY} width={totalW} height={totalH - sepY} fill="transparent" />

		<text
			x={LABEL_W - 6}
			y={combY}
			text-anchor="end"
			dominant-baseline="central"
			class="bp-label bp-combined-label"
		>Total</text>

		<line x1={x(combined.p10)} y1={combY} x2={x(combined.p90)} y2={combY} class="bp-whisker bp-combined-whisker" />
		<line x1={x(combined.p10)} y1={combTop} x2={x(combined.p10)} y2={combTop + COMBINED_H} class="bp-whisker bp-combined-whisker" />
		<line x1={x(combined.p90)} y1={combTop} x2={x(combined.p90)} y2={combTop + COMBINED_H} class="bp-whisker bp-combined-whisker" />

		<rect
			x={x(combined.p25)}
			y={combTop}
			width={x(combined.p75) - x(combined.p25)}
			height={COMBINED_H}
			class="bp-box bp-combined-box"
		/>

		<line x1={x(combined.p50)} y1={combTop} x2={x(combined.p50)} y2={combTop + COMBINED_H} class="bp-median bp-combined-median" />

		<text
			x={x(combined.p90) + 4}
			y={combY}
			dominant-baseline="central"
			class="bp-value bp-combined-value"
		>{fmtDays(combined.p50)}</text>
	</g>
</svg>

<style>
	.effort-box-plot {
		display: block;
		max-width: 448px;
	}

	.bp-label {
		font-size: 10px;
		fill: var(--c-text-muted);
		font-family: var(--font);
	}

	.bp-partial {
		font-size: 9px;
		fill: var(--c-text-ghost);
	}

	.bp-combined-label {
		font-weight: var(--fw-semibold);
		fill: var(--c-text);
	}

	.bp-whisker {
		stroke: var(--c-text-muted);
		stroke-width: 1;
	}

	.bp-combined-whisker {
		stroke: var(--c-accent);
		stroke-width: 1.5;
	}

	.bp-box {
		fill: var(--c-accent-bg, oklch(0.92 0.03 250));
		stroke: var(--c-accent);
		stroke-width: 1;
		rx: 2;
	}

	.bp-box.bp-partial {
		fill: var(--c-neutral-bg);
		stroke: var(--c-text-muted);
		stroke-dasharray: 3 2;
	}

	.bp-combined-box {
		fill: var(--c-accent-bg, oklch(0.88 0.05 250));
		stroke: var(--c-accent);
		stroke-width: 1.5;
	}

	.bp-median {
		stroke: var(--c-accent);
		stroke-width: 2;
	}

	.bp-combined-median {
		stroke-width: 2.5;
	}

	.bp-separator {
		stroke: var(--c-border);
		stroke-width: 1;
		stroke-dasharray: 4 3;
	}

	.bp-value {
		font-size: 10px;
		fill: var(--c-text-muted);
		font-family: var(--font);
	}

	.bp-combined-value {
		font-weight: var(--fw-semibold);
		fill: var(--c-accent);
		font-size: 11px;
	}
</style>
