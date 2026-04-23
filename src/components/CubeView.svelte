<script lang="ts">
	import {
		type Opportunity,
		type Stage,
		STAGES,
		PERSPECTIVE_LABELS,
		perspectiveWeight,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		onSelect: (id: string) => void
	}

	let { opportunities, onSelect }: Props = $props()

	let hoveredId: string | null = $state(null)
	let autoRotate = $state(true)
	let rotY = $state(-0.45)
	let rotX = $state(0.45)
	let dragging = $state(false)
	let animFrame = $state(0)

	// SVG viewport
	const W = 620
	const H = 520
	const CX = W / 2
	const CY = H / 2 - 10
	const SCALE = 160

	const STAGE_COLORS: Record<Stage, string> = {
		explore: '#b0b0b0',
		sketch: '#e8a735',
		validate: '#4f8ff7',
		decompose: '#3dba6a',
	}

	// 3D projection: rotate around Y then X, orthographic
	function project(x: number, y: number, z: number): { px: number; py: number; depth: number } {
		// Center coords to -0.5..0.5
		const cx = x - 0.5
		const cy = y - 0.5
		const cz = z - 0.5

		// Rotate around Y
		const cosY = Math.cos(rotY)
		const sinY = Math.sin(rotY)
		const rx = cx * cosY - cz * sinY
		const rz = cx * sinY + cz * cosY

		// Rotate around X
		const cosX = Math.cos(rotX)
		const sinX = Math.sin(rotX)
		const ry = cy * cosX - rz * sinX
		const rz2 = cy * sinX + rz * cosX

		return {
			px: CX + rx * SCALE,
			py: CY - ry * SCALE,
			depth: rz2,
		}
	}

	function dotData(opp: Opportunity) {
		const d = perspectiveWeight(opp, 'desirability')
		const f = perspectiveWeight(opp, 'feasibility')
		const v = perspectiveWeight(opp, 'viability')
		const { px, py, depth } = project(d, v, f)
		return { px, py, depth, d, f, v }
	}

	// Sort opportunities by depth (back to front)
	const sortedOpps = $derived.by(() => {
		// Touch animFrame to trigger reactivity on animation
		void animFrame
		return [...opportunities]
			.map((opp) => ({ opp, ...dotData(opp) }))
			.sort((a, b) => a.depth - b.depth)
	})

	// Cube edges: 12 edges of a unit cube
	const CUBE_VERTICES: [number, number, number][] = [
		[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
		[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
	]
	const CUBE_EDGES: [number, number][] = [
		[0, 1], [1, 2], [2, 3], [3, 0],
		[4, 5], [5, 6], [6, 7], [7, 4],
		[0, 4], [1, 5], [2, 6], [3, 7],
	]

	const cubeEdges2D = $derived.by(() => {
		void animFrame
		const verts = CUBE_VERTICES.map(([x, y, z]) => project(x, y, z))
		return CUBE_EDGES.map(([a, b]) => ({
			x1: verts[a].px, y1: verts[a].py,
			x2: verts[b].px, y2: verts[b].py,
			backFace: verts[a].depth + verts[b].depth < 0,
		}))
	})

	// Axis label positions (at the end of each axis)
	const axisLabels = $derived.by(() => {
		void animFrame
		const dEnd = project(1.12, -0.08, -0.08)
		const vEnd = project(-0.08, 1.12, -0.08)
		const fEnd = project(-0.08, -0.08, 1.12)
		return { d: dEnd, v: vEnd, f: fEnd }
	})

	// Animation loop
	$effect(() => {
		if (!autoRotate) return
		let running = true
		function tick() {
			if (!running) return
			rotY += 0.004
			animFrame++
			requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
		return () => { running = false }
	})

	// Drag rotation
	let lastPointer = { x: 0, y: 0 }

	function onPointerDown(e: PointerEvent) {
		dragging = true
		autoRotate = false
		lastPointer = { x: e.clientX, y: e.clientY }
		;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return
		const dx = e.clientX - lastPointer.x
		const dy = e.clientY - lastPointer.y
		rotY += dx * 0.008
		rotX -= dy * 0.008
		// Clamp X rotation to avoid flipping
		rotX = Math.max(-1.2, Math.min(1.2, rotX))
		lastPointer = { x: e.clientX, y: e.clientY }
		animFrame++
	}

	function onPointerUp() {
		dragging = false
	}

	// Snap to face presets
	function snapTo(face: 'dv' | 'df' | 'vf') {
		autoRotate = false
		if (face === 'dv') { rotY = 0; rotX = 0 }
		else if (face === 'df') { rotY = -Math.PI / 2; rotX = 0 }
		else { rotY = 0; rotX = Math.PI / 2 }
		animFrame++
	}

	const DOT_R = 9
</script>

<div class="cube-container">
	<div class="cube-toolbar">
		<div class="snap-btns">
			<button class="snap-btn" onclick={() => snapTo('dv')}>D × V</button>
			<button class="snap-btn" onclick={() => snapTo('df')}>D × F</button>
			<button class="snap-btn" onclick={() => snapTo('vf')}>V × F</button>
		</div>
		<button class="auto-btn" class:active={autoRotate} onclick={() => (autoRotate = !autoRotate)}>
			{autoRotate ? '⏸ Pause' : '▶ Rotate'}
		</button>
		<span class="drag-hint">Drag to rotate</span>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		viewBox="0 0 {W} {H}"
		class="cube-svg"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		style="cursor: {dragging ? 'grabbing' : 'grab'}"
	>
		<!-- Cube wireframe (back edges first) -->
		{#each cubeEdges2D as edge}
			{#if edge.backFace}
				<line
					x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
					stroke="var(--c-border-soft)" stroke-width="0.5" stroke-dasharray="3 3"
				/>
			{/if}
		{/each}

		<!-- Dots (sorted back to front) -->
		{#each sortedOpps as item (item.opp.id)}
			{@const isHovered = hoveredId === item.opp.id}
			{@const depthScale = 0.7 + (item.depth + 0.5) * 0.6}
			{@const r = DOT_R * Math.max(0.6, depthScale)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				class="dot-group"
				onpointerenter={(e) => { e.stopPropagation(); hoveredId = item.opp.id }}
				onpointerleave={() => (hoveredId = null)}
				onclick={(e) => { e.stopPropagation(); onSelect(item.opp.id) }}
				style="cursor: pointer"
			>
				<circle
					cx={item.px} cy={item.py}
					r={isHovered ? r + 3 : r}
					fill={STAGE_COLORS[item.opp.stage]}
					opacity={isHovered ? 0.95 : 0.5 + depthScale * 0.2}
					stroke={isHovered ? 'var(--c-text)' : 'var(--c-surface)'}
					stroke-width={isHovered ? 2 : 1}
				/>
				<text
					x={item.px} y={item.py + 1}
					text-anchor="middle" dominant-baseline="central"
					class="dot-label"
					font-size={r > 8 ? '9' : '7'}
				>
					{item.opp.title.slice(0, 3).toUpperCase()}
				</text>
			</g>

			{#if isHovered}
				{@const tipX = Math.min(Math.max(item.px, 90), W - 90)}
				{@const tipY = item.py - r - 14}
				<g>
					<rect
						x={tipX - 80} y={tipY - 30}
						width="160" height="48" rx="5"
						fill="var(--c-surface)" stroke="var(--c-border)" stroke-width="0.5" opacity="0.97"
					/>
					<text x={tipX} y={tipY - 16} text-anchor="middle" class="tip-title">{item.opp.title}</text>
					<text x={tipX} y={tipY - 3} text-anchor="middle" class="tip-meta">{STAGES.find((s) => s.key === item.opp.stage)?.label}</text>
					<text x={tipX} y={tipY + 10} text-anchor="middle" class="tip-scores">
						D:{Math.round(item.d * 100)}% F:{Math.round(item.f * 100)}% V:{Math.round(item.v * 100)}%
					</text>
				</g>
			{/if}
		{/each}

		<!-- Cube wireframe (front edges on top) -->
		{#each cubeEdges2D as edge}
			{#if !edge.backFace}
				<line
					x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
					stroke="var(--c-border)" stroke-width="1"
				/>
			{/if}
		{/each}

		<!-- Axis labels -->
		<text x={axisLabels.d.px} y={axisLabels.d.py} text-anchor="middle" class="axis-label axis-d">
			{PERSPECTIVE_LABELS.desirability}
		</text>
		<text x={axisLabels.v.px} y={axisLabels.v.py} text-anchor="middle" class="axis-label axis-v">
			{PERSPECTIVE_LABELS.viability}
		</text>
		<text x={axisLabels.f.px} y={axisLabels.f.py} text-anchor="middle" class="axis-label axis-f">
			{PERSPECTIVE_LABELS.feasibility}
		</text>
	</svg>

	<div class="stage-legend">
		{#each STAGES as stage}
			<span class="legend-item">
				<span class="legend-dot" style="background: {STAGE_COLORS[stage.key]}"></span>
				{stage.label}
			</span>
		{/each}
		<span class="legend-hint">· Near origin = blind spot · Near corner = one-sided · Center = balanced</span>
	</div>
</div>

<style>
	.cube-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--sp-sm) var(--sp-lg);
		min-height: 0;
		overflow: auto;
	}

	.cube-toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin-bottom: var(--sp-xs);
		flex-wrap: wrap;
	}

	.snap-btns {
		display: flex;
		gap: 2px;
		background: var(--c-neutral-bg-light);
		border-radius: var(--radius-sm);
		padding: 2px;
	}

	.snap-btn {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.snap-btn:hover {
		background: var(--c-surface);
		color: var(--c-text);
	}

	.auto-btn {
		font-family: var(--font);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		background: transparent;
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		cursor: pointer;
		transition: background var(--tr-fast), color var(--tr-fast);
	}

	.auto-btn.active {
		background: var(--c-accent-bg);
		color: var(--c-accent-text);
		border-color: var(--c-accent-border);
	}

	.drag-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}

	.cube-svg {
		width: 100%;
		max-width: 700px;
		height: auto;
		align-self: center;
		flex: 1;
		min-height: 0;
		touch-action: none;
		user-select: none;
	}

	.axis-label {
		font-family: var(--font);
		font-size: 12px;
		font-weight: 700;
	}

	.axis-d { fill: var(--c-accent); }
	.axis-v { fill: var(--c-warm); }
	.axis-f { fill: var(--c-green-signal); }

	.dot-group circle {
		transition: r 0.12s ease, opacity 0.12s ease;
	}

	.dot-label {
		fill: var(--c-surface);
		font-family: var(--font);
		font-weight: 700;
		pointer-events: none;
	}

	.tip-title {
		fill: var(--c-text);
		font-family: var(--font);
		font-size: 10px;
		font-weight: 700;
	}

	.tip-meta {
		fill: var(--c-text-muted);
		font-family: var(--font);
		font-size: 9px;
	}

	.tip-scores {
		fill: var(--c-text-soft);
		font-family: var(--font);
		font-size: 8px;
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

	.legend-hint {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
		font-style: italic;
	}
</style>
