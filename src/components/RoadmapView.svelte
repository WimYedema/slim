<script lang="ts">
	import {
		type Opportunity,
		type Deliverable,
		type OpportunityDeliverableLink,
		type Perspective,
		type Score,
		type TShirtSize,
		PERSPECTIVES,
		PERSPECTIVE_LABELS,
		SCORE_SYMBOL,
		SCORE_DISPLAY,
		STAGES,
		linksForOpportunity,
		commitmentUrgency,
		stageConsent,
		stageIndex,
		daysInStage,
		agingLevel,
		stageLabel,
	} from '../lib/types'

	interface Props {
		opportunities: Opportunity[]
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		customHorizons: string[]
		onSelect: (id: string) => void
		onUpdateOpportunity: (opp: Opportunity) => void
		onAddHorizon: (name: string) => void
		onRemoveHorizon: (name: string) => void
	}

	let { opportunities, deliverables, links, customHorizons, onSelect, onUpdateOpportunity, onAddHorizon, onRemoveHorizon }: Props = $props()

	/** All distinct horizons: from opportunities + custom, sorted naturally */
	const horizons = $derived(() => {
		const set = new Set<string>()
		for (const opp of opportunities) {
			if (!opp.discontinuedAt && opp.horizon) set.add(opp.horizon)
		}
		for (const h of customHorizons) set.add(h)
		return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	})

	/** Opportunities grouped by horizon, each group sorted by stage (most advanced first) */
	const grouped = $derived(() => {
		const stageOrder: Record<string, number> = { decompose: 0, validate: 1, sketch: 2, explore: 3 }
		const map = new Map<string, Opportunity[]>()
		for (const h of horizons()) {
			map.set(h, [])
		}
		for (const opp of opportunities) {
			if (opp.discontinuedAt) continue
			const bucket = map.get(opp.horizon)
			if (bucket) bucket.push(opp)
		}
		for (const [, list] of map) {
			list.sort((a, b) => (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99))
		}
		return map
	})

	/** Whether a custom horizon has no opportunities (can be removed) */
	function isEmptyCustom(h: string): boolean {
		return customHorizons.includes(h) && (grouped().get(h)?.length ?? 0) === 0
	}

	/** Editing state for inline horizon rename */
	let editingHorizon: string | null = $state(null)
	let editValue = $state('')

	function startRenameHorizon(h: string) {
		editingHorizon = h
		editValue = h
	}

	function commitRenameHorizon(oldName: string) {
		const newName = editValue.trim()
		editingHorizon = null
		if (!newName || newName === oldName) return
		for (const opp of opportunities) {
			if (opp.horizon === oldName) {
				onUpdateOpportunity({ ...opp, horizon: newName })
			}
		}
		// If it was a custom horizon, remove old and add new
		if (customHorizons.includes(oldName)) {
			onRemoveHorizon(oldName)
			onAddHorizon(newName)
		}
	}

	// ── Drag & drop ──

	let draggedOppId: string | null = $state(null)
	let dropTargetHorizon: string | null = $state(null)

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
		e.preventDefault()
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
		dropTargetHorizon = horizon
	}

	function handleDragLeave(e: DragEvent, horizon: string) {
		// Only clear if truly leaving the horizon zone (not entering a child)
		const related = e.relatedTarget as HTMLElement | null
		const cell = (e.currentTarget as HTMLElement)
		if (!related || !cell.contains(related)) {
			if (dropTargetHorizon === horizon) dropTargetHorizon = null
		}
	}

	function handleDrop(e: DragEvent, horizon: string) {
		e.preventDefault()
		dropTargetHorizon = null
		if (!draggedOppId) return
		const opp = opportunities.find((o) => o.id === draggedOppId)
		if (opp && opp.horizon !== horizon) {
			onUpdateOpportunity({ ...opp, horizon })
		}
		draggedOppId = null
	}

	// ── Add horizon ──

	let newHorizonName = $state('')

	function handleAddHorizon() {
		const name = newHorizonName.trim()
		if (!name) return
		// Don't add if it already exists
		if (horizons().includes(name)) {
			newHorizonName = ''
			return
		}
		onAddHorizon(name)
		newHorizonName = ''
	}

	// ── Helpers ──

	/** T-shirt size breakdown for a horizon */
	interface SizeBreakdown {
		/** e.g. [{size: 'S', count: 2}, {size: 'L', count: 3}] — ordered XS→XL */
		sizes: { size: TShirtSize; count: number }[]
		/** Deliverables without a size estimate */
		unsized: number
		/** Average certainty (1-5) across deliverables with certainty, or null */
		avgCertainty: number | null
	}

	const SIZE_ORDER: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL']

	/** Get unique deliverables linked to a set of opportunities */
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

	function linkedDeliverableNames(oppId: string): string[] {
		return linksForOpportunity(links, oppId)
			.map((l) => deliverables.find((d) => d.id === l.deliverableId)?.title)
			.filter((t): t is string => !!t)
	}

	function currentStageSignals(opp: Opportunity): { perspective: Perspective; score: Score }[] {
		return PERSPECTIVES.map((p) => ({
			perspective: p,
			score: opp.signals[opp.stage][p].score,
		}))
	}

	function urgencyInfo(opp: Opportunity) {
		return commitmentUrgency(opp)
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

		// Objections block advancement
		if (consent.objections.length > 0) {
			const labels = consent.objections.map(p => PERSPECTIVE_LABELS[p].charAt(0)).join('')
			flags.push({ icon: '⊘', label: `${labels} objection`, level: 'danger' })
		}

		// Stale — stuck too long
		if (aging === 'stale') {
			flags.push({ icon: '⏳', label: `${days}d stuck`, level: 'danger' })
		} else if (aging === 'aging') {
			flags.push({ icon: '⏳', label: `${days}d in stage`, level: 'warn' })
		}

		// Unscored perspectives at current stage
		if (noneCount > 0 && si > 0) {
			flags.push({ icon: '○', label: `${noneCount} unscored`, level: noneCount >= 2 ? 'danger' : 'warn' })
		}

		// Late stage with no deliverables
		if (si >= 3 && !hasDeliverables) {
			flags.push({ icon: '∅', label: 'no deliverables', level: 'warn' })
		}

		// Stage maturity vs horizon position — early stage in a near horizon
		// Horizons are sorted; first horizon is nearest
		const horizonIdx = horizons().indexOf(opp.horizon)
		if (horizonIdx === 0 && si <= 1) {
			flags.push({ icon: '⚡', label: 'early stage, near horizon', level: 'danger' })
		} else if (horizonIdx <= 1 && si === 0) {
			flags.push({ icon: '⚡', label: 'still exploring', level: 'warn' })
		}

		return flags
	}
</script>

<div class="roadmap">
	<div class="risk-legend" role="note" aria-label="Risk flag legend">
		<span class="risk-legend-item"><span class="risk-flag risk-danger" aria-hidden="true">⊘</span> Objection</span>
		<span class="risk-legend-item"><span class="risk-flag risk-danger" aria-hidden="true">⏳</span> Stale</span>
		<span class="risk-legend-item"><span class="risk-flag risk-warn" aria-hidden="true">⏳</span> Aging</span>
		<span class="risk-legend-item"><span class="risk-flag risk-warn" aria-hidden="true">○</span> Unscored</span>
		<span class="risk-legend-item"><span class="risk-flag risk-warn" aria-hidden="true">∅</span> No deliverables</span>
		<span class="risk-legend-item"><span class="risk-flag risk-danger" aria-hidden="true">⚡</span> Early stage, near horizon</span>
	</div>
	<table class="roadmap-table">
		<thead>
			<tr>
				<th class="col-title">Opportunity</th>
				<th class="col-stage">Stage</th>
				{#each PERSPECTIVES as p}
					<th class="col-signal">{PERSPECTIVE_LABELS[p]}</th>
				{/each}
				<th class="col-risk">Risk</th>
				<th class="col-deliverables">Deliverables</th>
			</tr>
		</thead>
		<tbody>
			{#each horizons() as horizon}
				{@const opps = grouped().get(horizon) ?? []}
				{@const breakdown = horizonBreakdown(opps)}
				<tr
					class="horizon-row"
					class:drop-target={dropTargetHorizon === horizon}
					ondragover={(e) => handleDragOver(e, horizon)}
					ondragleave={(e) => handleDragLeave(e, horizon)}
					ondrop={(e) => handleDrop(e, horizon)}
				>
					<td colspan="7" class="horizon-cell">
						{#if editingHorizon === horizon}
							<input
								class="horizon-input"
								type="text"
								bind:value={editValue}
								onkeydown={(e) => { if (e.key === 'Enter') commitRenameHorizon(horizon); if (e.key === 'Escape') editingHorizon = null }}
								onblur={() => commitRenameHorizon(horizon)}
							/>
						{:else}
							{@const blocked = opps.filter(o => riskFlags(o).some(f => f.level === 'danger')).length}
							{@const atRisk = opps.filter(o => riskFlags(o).length > 0).length}
							<div class="horizon-header">
								<button class="horizon-label" ondblclick={() => startRenameHorizon(horizon)}>
									{horizon}
									<span class="horizon-count">{opps.length}</span>
								</button>
								{#if opps.length > 0}
									<span class="horizon-health">
										{#if blocked > 0}
											<span class="health-danger">{blocked} blocked</span>
										{/if}
										{#if atRisk > blocked}
											<span class="health-warn">{atRisk - blocked} at risk</span>
										{/if}
										{#if atRisk === 0}
											<span class="health-clear">all clear</span>
										{/if}
									</span>
								{/if}
								{#if isEmptyCustom(horizon)}
									<button class="btn-icon remove-horizon-btn" onclick={() => onRemoveHorizon(horizon)} title="Remove empty horizon">×</button>
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
							</div>
						{/if}
					</td>
				</tr>
				{#each opps as opp}
					{@const signals = currentStageSignals(opp)}
					{@const delNames = linkedDeliverableNames(opp.id)}
					{@const urg = urgencyInfo(opp)}
					{@const risks = riskFlags(opp)}
					<tr
						class="opp-row"
						class:dragging={draggedOppId === opp.id}
						draggable="true"
						ondragstart={(e) => handleDragStart(e, opp.id)}
						ondragend={handleDragEnd}
						ondragover={(e) => handleDragOver(e, horizon)}
						ondrop={(e) => handleDrop(e, horizon)}
						onclick={() => onSelect(opp.id)}
					>
						<td class="col-title">
							<span class="drag-handle" title="Drag to move between horizons">⠿</span>
							<span class="opp-title">{opp.title}</span>
							{#if urg}
								{#if urg.daysLeft < 0}
									<span class="urgency-badge overdue">{Math.abs(urg.daysLeft)}d overdue</span>
								{:else if urg.daysLeft <= 7}
									<span class="urgency-badge soon">{urg.daysLeft}d left</span>
								{/if}
							{/if}
						</td>
						<td class="col-stage">
							<span class="stage-badge stage-{opp.stage}">{stageLabel(opp.stage)}</span>
						</td>
						{#each signals as sig}
							<td class="col-signal">
								<span class="dot score-{sig.score}" title="{PERSPECTIVE_LABELS[sig.perspective]}: {SCORE_DISPLAY[sig.score].label}" role="img" aria-label="{PERSPECTIVE_LABELS[sig.perspective]}: {SCORE_DISPLAY[sig.score].label}">{SCORE_SYMBOL[sig.score]}</span>
							</td>
						{/each}
						<td class="col-risk">
							{#if risks.length > 0}
								<span class="risk-flags" role="group" aria-label="Risk flags">
									{#each risks as flag}
										<span class="risk-flag risk-{flag.level}" title={flag.label} role="img" aria-label={flag.label}>{flag.icon}</span>
									{/each}
								</span>
							{/if}
						</td>
						<td class="col-deliverables">
							{#if delNames.length > 0}
								<span class="del-list" title={delNames.join(', ')}>
									{delNames.length} deliverable{delNames.length === 1 ? '' : 's'}
								</span>
							{:else}
								<span class="del-none">—</span>
							{/if}
						</td>
					</tr>
				{/each}
				{#if opps.length === 0}
					<tr
						class="empty-row"
						ondragover={(e) => handleDragOver(e, horizon)}
						ondragleave={(e) => handleDragLeave(e, horizon)}
						ondrop={(e) => handleDrop(e, horizon)}
					>
						<td colspan="7" class="empty-cell drop-zone">Drop opportunities here</td>
					</tr>
				{/if}
			{/each}
			{#if horizons().length === 0}
				<tr class="empty-row">
					<td colspan="7" class="empty-cell">No opportunities yet — add some in the Opportunities tab</td>
				</tr>
			{/if}
		</tbody>
	</table>

	<div class="add-horizon">
		<input
			class="add-horizon-input"
			type="text"
			placeholder="New horizon (e.g. 2026Q4, LATER)…"
			bind:value={newHorizonName}
			onkeydown={(e) => { if (e.key === 'Enter') handleAddHorizon() }}
		/>
		<button class="btn-ghost add-horizon-btn" onclick={handleAddHorizon} disabled={!newHorizonName.trim()}>+ Add horizon</button>
	</div>
</div>

<style>
	.roadmap {
		flex: 1;
		overflow: auto;
		padding: var(--sp-md);
	}

	.risk-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-md);
		padding: var(--sp-xs) var(--sp-sm);
		margin-bottom: var(--sp-sm);
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.risk-legend-item {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-xs);
	}

	.roadmap-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}

	/* ── Header ── */

	thead th {
		text-align: left;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		padding: var(--sp-xs) var(--sp-sm);
		border-bottom: 2px solid var(--c-border-soft);
		white-space: nowrap;
		position: sticky;
		top: 0;
		background: var(--c-bg);
		z-index: 1;
	}

	/* ── Column sizing ── */

	.col-title { width: auto; }
	.col-stage { width: 90px; text-align: center; }
	.col-signal { width: 50px; text-align: center; }
	.col-risk { width: 80px; }
	.col-deliverables { width: 120px; }

	.risk-flags {
		display: flex;
		gap: 3px;
	}

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

	/* ── Horizon group row ── */

	.horizon-row {
		background: var(--c-surface-alt);
		transition: background var(--tr-fast);
	}

	.horizon-row.drop-target {
		background: var(--c-accent-bg);
	}

	.horizon-cell {
		padding: var(--sp-sm) var(--sp-sm);
		border-top: 2px solid var(--c-border);
	}

	.horizon-header {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		flex-wrap: wrap;
	}

	.horizon-label {
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

	.horizon-count {
		font-size: var(--fs-xs);
		font-weight: var(--fw-normal);
		color: var(--c-text-muted);
		background: var(--c-neutral-bg);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
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

	.horizon-input {
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

	.remove-horizon-btn {
		color: var(--c-text-ghost);
		padding: 0 var(--sp-xs);
		margin-left: var(--sp-xs);
	}

	.remove-horizon-btn:hover {
		color: var(--c-red);
	}

	/* ── Effort summary (horizon header) ── */

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
		background: var(--c-neutral-bg);
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

	/* ── Opportunity rows ── */

	.opp-row {
		cursor: pointer;
		transition: background var(--tr-fast), opacity var(--tr-fast);
	}

	.opp-row:hover {
		background: var(--c-neutral-bg-light);
	}

	.opp-row.dragging {
		opacity: 0.4;
	}

	.opp-row td {
		padding: var(--sp-xs) var(--sp-sm);
		border-bottom: 1px solid var(--c-neutral-bg);
		vertical-align: middle;
	}

	.drag-handle {
		cursor: grab;
		color: var(--c-text-ghost);
		font-size: var(--fs-xs);
		margin-right: var(--sp-xs);
		user-select: none;
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.opp-title {
		font-weight: var(--fw-medium);
		color: var(--c-text);
	}

	.urgency-badge {
		font-size: var(--fs-2xs);
		padding: 1px 5px;
		border-radius: var(--radius-sm);
		margin-left: var(--sp-xs);
		font-weight: var(--fw-medium);
	}

	.urgency-badge.overdue {
		background: var(--c-red-bg);
		color: var(--c-red);
	}

	.urgency-badge.soon {
		background: var(--c-warm-bg);
		color: var(--c-warm);
	}

	/* ── Stage badge ── */

	.stage-badge {
		display: inline-block;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-medium);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.stage-explore {
		background: var(--c-neutral-bg);
		color: var(--c-stage-explore);
	}

	.stage-sketch {
		background: var(--c-warm-bg);
		color: var(--c-stage-sketch);
	}

	.stage-validate {
		background: var(--c-accent-bg);
		color: var(--c-stage-validate);
	}

	.stage-decompose {
		background: var(--c-green-bg);
		color: var(--c-stage-decompose);
	}

	/* ── Signal dots (matching ListView) ── */

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
		border: 2px dashed color-mix(in srgb, var(--c-text-ghost) var(--opacity-strong), transparent);
		color: var(--c-text-ghost);
	}

	/* ── Deliverables column ── */

	.del-list {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.del-none {
		font-size: var(--fs-xs);
		color: var(--c-text-ghost);
	}

	/* ── Empty & drop zone ── */

	.empty-row td {
		padding: var(--sp-sm) var(--sp-sm);
		color: var(--c-text-ghost);
		font-size: var(--fs-xs);
		font-style: italic;
	}

	.drop-zone {
		border: 2px dashed var(--c-border-soft);
		border-radius: var(--radius-sm);
		text-align: center;
		transition: border-color var(--tr-fast), background var(--tr-fast);
	}

	.empty-row:has(.drop-zone) {
		/* drop-zone styling handled via .drop-target on parent */
	}

	/* ── Add horizon ── */

	.add-horizon {
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
		background: var(--c-neutral-bg);
		color: var(--c-text);
	}

	.add-horizon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
