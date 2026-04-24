<script lang="ts">
	import {
		type Deliverable,
		type OpportunityDeliverableLink,
		type Opportunity,
		type Coverage,
		type TShirtSize,
		type Certainty,
		linksForDeliverable,
		linksForOpportunity,
		STAGES,
		stageIndex,
		TSHIRT_SIZES,
		SIZE_ROW_HEIGHT,
		UNESTIMATED_ROW_HEIGHT,
		inheritedPeople,
	} from '../lib/types'

	interface Props {
		deliverables: Deliverable[]
		links: OpportunityDeliverableLink[]
		opportunities: Opportunity[]
		selectedId: string | null
		onAdd: (title: string) => Deliverable
		onUpdate: (deliverable: Deliverable) => void
		onRemove: (id: string) => void
		onLink: (opportunityId: string, deliverableId: string, coverage: Coverage) => void
		onUnlink: (opportunityId: string, deliverableId: string) => void
		onUpdateCoverage: (opportunityId: string, deliverableId: string, coverage: Coverage) => void
		onSelectOpportunity: (id: string) => void
		onSelectDeliverable: (id: string) => void
		orderedIds?: string[]
	}

	let { deliverables, links, opportunities, selectedId, onAdd, onUpdate, onRemove, onLink, onUnlink, onUpdateCoverage, onSelectOpportunity, onSelectDeliverable, orderedIds = $bindable([]) }: Props = $props()

	let newTitle = $state('')

	function handleAdd() {
		const t = newTitle.trim()
		if (!t) return
		onAdd(t)
		newTitle = ''
	}

	/** Orphan deliverables — linked to no opportunity */
	const orphanCount = $derived(deliverables.filter((d) => linksForDeliverable(links, d.id).length === 0).length)

	// ── Contributor columns ──

	/** All contributors for a deliverable: inherited experts + extras */
	function allContributors(deliverableId: string): Set<string> {
		const names = new Set<string>(inheritedPeople(deliverableId, 'contributors', links, opportunities))
		const d = deliverables.find((d) => d.id === deliverableId)
		if (d) for (const n of d.extraContributors) names.add(n)
		return names
	}

	/** Unique contributor names across all deliverables, sorted by assignment count descending */
	const contributorColumns = $derived.by(() => {
		const counts = new Map<string, number>()
		for (const d of deliverables) {
			for (const name of allContributors(d.id)) {
				counts.set(name, (counts.get(name) ?? 0) + 1)
			}
		}
		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([name, count]) => ({ name, count }))
	})

	/** Toggle contributor assignment on a deliverable */
	function toggleContributor(deliverable: Deliverable, name: string) {
		const inherited = inheritedPeople(deliverable.id, 'contributors', links, opportunities)
		if (inherited.includes(name)) return // can't toggle inherited
		if (deliverable.extraContributors.includes(name)) {
			onUpdate({ ...deliverable, extraContributors: deliverable.extraContributors.filter((n) => n !== name) })
		} else {
			onUpdate({ ...deliverable, extraContributors: [...deliverable.extraContributors, name] })
		}
	}

	// ── Matrix view data ──

	/** Find link between an opportunity and deliverable, if any */
	function findLink(opportunityId: string, deliverableId: string): OpportunityDeliverableLink | undefined {
		return links.find((l) => l.opportunityId === opportunityId && l.deliverableId === deliverableId)
	}

	/** Toggle link in matrix: no link → partial, partial → full, full → unlink */
	function cycleMatrixCell(opportunityId: string, deliverableId: string) {
		const existing = findLink(opportunityId, deliverableId)
		if (!existing) {
			onLink(opportunityId, deliverableId, 'partial')
		} else if (existing.coverage === 'partial') {
			onUpdateCoverage(opportunityId, deliverableId, 'full')
		} else {
			onUnlink(opportunityId, deliverableId)
		}
	}

	/** Is an opportunity fully covered? decompositionComplete + all links full */
	function isFullyCovered(opp: Opportunity): boolean {
		if (!opp.decompositionComplete) return false
		const oppLinks = linksForOpportunity(links, opp.id)
		return oppLinks.length > 0 && oppLinks.every((l) => l.coverage === 'full')
	}

	/** Funnel summary: total active opportunities vs those in the matrix */
	const activeOpportunityCount = $derived(opportunities.filter((o) => !o.discontinuedAt).length)

	/** Opportunities in the matrix with zero linked deliverables */
	function hasNoLinks(opp: Opportunity): boolean {
		return linksForOpportunity(links, opp.id).length === 0
	}

	/** Row status: orphan (no links), partial-only (has links but none full), ok */
	function rowStatus(deliverableId: string): 'orphan' | 'partial-only' | 'ok' {
		const dLinks = linksForDeliverable(links, deliverableId)
		if (dLinks.length === 0) return 'orphan'
		if (dLinks.every((l) => l.coverage !== 'full')) return 'partial-only'
		return 'ok'
	}

	/** Stage maturity weight: later stages = higher confidence in value */
	const STAGE_WEIGHT: Record<string, number> = { explore: 0.25, sketch: 0.5, validate: 0.75, decompose: 1.0 }

	/** Leverage score: sum of linked opportunity maturity weights / effort. Higher = do first. */
	function leverageScore(deliverableId: string): number {
		const dLinks = linksForDeliverable(links, deliverableId)
		if (dLinks.length === 0) return 0
		const valueSum = dLinks.reduce((sum, link) => {
			const opp = opportunities.find((o) => o.id === link.opportunityId)
			if (!opp) return sum
			const weight = STAGE_WEIGHT[opp.stage] ?? 0.5
			const coverageBonus = link.coverage === 'full' ? 1.0 : 0.6
			return sum + weight * coverageBonus
		}, 0)
		const d = deliverables.find((d) => d.id === deliverableId)
		const sizeIdx = d?.size ? TSHIRT_SIZES.indexOf(d.size) + 1 : 3 // unestimated = M
		return valueSum / sizeIdx
	}

	/** Cycle T-shirt size: null → XS → S → M → L → XL → null */
	function cycleSize(deliverable: Deliverable) {
		const current = deliverable.size
		if (!current) {
			onUpdate({ ...deliverable, size: 'XS' })
		} else {
			const idx = TSHIRT_SIZES.indexOf(current)
			const next = idx < TSHIRT_SIZES.length - 1 ? TSHIRT_SIZES[idx + 1] : null
			onUpdate({ ...deliverable, size: next })
		}
	}

	/** Cycle certainty: null → 1 → 2 → 3 → 4 → 5 → null */
	function cycleCertainty(deliverable: Deliverable) {
		const current = deliverable.certainty
		if (!current) {
			onUpdate({ ...deliverable, certainty: 1 })
		} else {
			const next = current < 5 ? (current + 1) as Certainty : null
			onUpdate({ ...deliverable, certainty: next })
		}
	}

	/** Row height based on size */
	function rowHeight(size: TShirtSize | null): number {
		return size ? SIZE_ROW_HEIGHT[size] : UNESTIMATED_ROW_HEIGHT
	}

	// ── Drag reorder state ──
	let rowOrder: string[] = $state([])
	let colOrder: string[] = $state([])
	let dragRowId: string | null = $state(null)
	let dragColId: string | null = $state(null)
	let dropTargetRow: string | null = $state(null)
	let dropTargetCol: string | null = $state(null)
	let vZoom: number = $state(1.0)

	/** Merge user order with current IDs: keep user-ordered items that still exist, append new ones */
	function mergeOrder(userOrder: string[], currentIds: string[]): string[] {
		const currentSet = new Set(currentIds)
		const kept = userOrder.filter((id) => currentSet.has(id))
		const keptSet = new Set(kept)
		const added = currentIds.filter((id) => !keptSet.has(id))
		return [...kept, ...added]
	}

	/** Default row order: leverage descending */
	const defaultRowIds = $derived(
		[...deliverables].sort((a, b) => leverageScore(b.id) - leverageScore(a.id)).map((d) => d.id)
	)

	/** Base set of matrix opportunities: Validate+Decompose stages, or any stage with existing links */
	const matrixOpportunityIds = $derived(
		opportunities
			.filter((o) => !o.discontinuedAt && (stageIndex(o.stage) >= 2 || linksForOpportunity(links, o.id).length > 0))
			.map((o) => o.id)
	)

	/** Ordered matrix columns — merges user drag order with current source data */
	const orderedCols = $derived.by(() => {
		const merged = mergeOrder(colOrder, matrixOpportunityIds)
		return merged.map((id) => opportunities.find((o) => o.id === id)!).filter(Boolean)
	})

	/** Ordered matrix rows — merges user drag order with default leverage sort */
	const orderedRows = $derived.by(() => {
		const merged = mergeOrder(rowOrder, defaultRowIds)
		return merged.map((id) => deliverables.find((d) => d.id === id)!).filter(Boolean)
	})

	// Expose visual row order to parent for keyboard navigation
	$effect(() => {
		orderedIds = orderedRows.map(d => d.id)
	})

	function moveItem(order: string[], fromId: string, toId: string): string[] {
		const arr = [...order]
		const fromIdx = arr.indexOf(fromId)
		const toIdx = arr.indexOf(toId)
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return arr
		arr.splice(fromIdx, 1)
		arr.splice(toIdx, 0, fromId)
		return arr
	}

	function handleRowDragStart(id: string, e: DragEvent) {
		dragRowId = id
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', id)
		}
	}
	function handleRowDragOver(id: string, e: DragEvent) {
		if (!dragRowId || dragRowId === id) return
		e.preventDefault()
		dropTargetRow = id
	}
	function handleRowDrop(id: string, e: DragEvent) {
		e.preventDefault()
		if (dragRowId && dragRowId !== id) {
			rowOrder = moveItem(orderedRows.map((d) => d.id), dragRowId, id)
		}
		dragRowId = null
		dropTargetRow = null
	}
	function handleRowDragEnd() {
		dragRowId = null
		dropTargetRow = null
	}

	function handleColDragStart(id: string, e: DragEvent) {
		dragColId = id
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', id)
		}
	}
	function handleColDragOver(id: string, e: DragEvent) {
		if (!dragColId || dragColId === id) return
		e.preventDefault()
		dropTargetCol = id
	}
	function handleColDrop(id: string, e: DragEvent) {
		e.preventDefault()
		if (dragColId && dragColId !== id) {
			colOrder = moveItem(orderedCols.map((o) => o.id), dragColId, id)
		}
		dragColId = null
		dropTargetCol = null
	}
	function handleColDragEnd() {
		dragColId = null
		dropTargetCol = null
	}

	// Scroll selected row into view on keyboard navigation
	$effect(() => {
		if (!selectedId) return
		requestAnimationFrame(() => {
			const row = document.querySelector('.matrix-table tr.row-selected') as HTMLElement | null
			row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		})
	})
</script>

<div class="deliverables-view">
	<div class="dv-header">
		<div class="dv-stats">
			<span class="stat">{deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}</span>
			{#if orphanCount > 0}
				<span class="stat orphan">{orphanCount} orphan{orphanCount !== 1 ? 's' : ''}</span>
			{/if}
		</div>
		<form class="dv-add" onsubmit={(e) => { e.preventDefault(); handleAdd() }}>
			<input type="text" class="dv-add-input" placeholder="Add deliverable…" bind:value={newTitle} onkeydown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }} />
		</form>
	</div>

	{#if orderedCols.length === 0}
			<div class="dv-empty">
				<p>No opportunities at Validate/Decompose stage or with linked deliverables yet.</p>
			</div>
		{:else}
			<div class="matrix-toolbar">
				<span class="matrix-funnel">
					Showing {orderedCols.length} of {activeOpportunityCount} opportunities (Validate & Decompose)
				</span>
				<label class="matrix-zoom">
					<input type="range" min="0.4" max="2" step="0.1" bind:value={vZoom} title="Vertical zoom" />
				</label>
			</div>
			<div class="matrix-wrapper">
				<table class="matrix-table">
					<thead>
						<tr>
							<th class="matrix-corner"></th>
							<th class="matrix-col-label">Size</th>
							<th class="matrix-col-label">Cert.</th>
							{#each orderedCols as opp (opp.id)}
								{@const covered = isFullyCovered(opp)}
								{@const empty = hasNoLinks(opp)}
								{@const oppLinks = linksForOpportunity(links, opp.id)}
								{@const fullCount = oppLinks.filter(l => l.coverage === 'full').length}
								<th
									class="matrix-opp-header"
									class:covered
									class:empty-col={empty}
									class:drag-over-col={dropTargetCol === opp.id}
									draggable="true"
									ondragstart={(e: DragEvent) => handleColDragStart(opp.id, e)}
									ondragover={(e: DragEvent) => handleColDragOver(opp.id, e)}
									ondrop={(e: DragEvent) => handleColDrop(opp.id, e)}
									ondragend={handleColDragEnd}
								>
									<button class="matrix-opp-title" onclick={() => onSelectOpportunity(opp.id)} title={opp.title}>
										{opp.title}
									</button>
									<span class="matrix-opp-stage" class:stage-validate={opp.stage === 'validate'} class:stage-decompose={opp.stage === 'decompose'}>
										{STAGES.find((s) => s.key === opp.stage)?.label ?? opp.stage}
									</span>
									<span class="matrix-opp-coverage" title="{fullCount} full, {oppLinks.length - fullCount} partial of {oppLinks.length} linked">
										{oppLinks.length === 0 ? '' : `${fullCount}/${oppLinks.length}`}
									</span>
									{#if empty}
										<span class="matrix-gap-badge" title="No deliverables linked yet">gap</span>
									{/if}
								</th>
							{/each}
							{#if contributorColumns.length > 0}
								<th class="matrix-section-divider"></th>
								{#each contributorColumns as col (col.name)}
									<th class="matrix-contributor-header">
										<span class="matrix-contributor-name">{col.name}</span>
										<span class="matrix-contributor-count">({col.count})</span>
									</th>
								{/each}
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each orderedRows as deliverable (deliverable.id)}
							{@const status = rowStatus(deliverable.id)}
							{@const h = rowHeight(deliverable.size) * vZoom}
							<tr
								class:dragging-row={dragRowId === deliverable.id}
								class:drag-over-row={dropTargetRow === deliverable.id}
								class:row-orphan={status === 'orphan'}
								class:row-partial={status === 'partial-only'}
								class:row-unestimated={!deliverable.size}
								class:row-size-xs={deliverable.size === 'XS'}
								class:row-selected={selectedId === deliverable.id}
								style="height: {h}px"
								draggable="true"
								onclick={() => onSelectDeliverable(deliverable.id)}
								ondragstart={(e: DragEvent) => handleRowDragStart(deliverable.id, e)}
								ondragover={(e: DragEvent) => handleRowDragOver(deliverable.id, e)}
								ondrop={(e: DragEvent) => handleRowDrop(deliverable.id, e)}
								ondragend={handleRowDragEnd}
							>
								<td class="matrix-del-name">
									<span class="drag-handle" title="Drag to reorder">⠿</span>
									{deliverable.title}
									{#if deliverable.externalUrl}
										<a class="matrix-del-link" href={deliverable.externalUrl} target="_blank" rel="noopener">↗</a>
									{/if}
									{#if status === 'orphan'}
										<span class="matrix-row-badge orphan-badge" title="Not linked to any opportunity">orphan</span>
									{:else if status === 'partial-only'}
										<span class="matrix-row-badge partial-badge" title="All links partial — none fully covered">partial only</span>
									{/if}
								</td>
								<td class="matrix-size-cell">
									<button class="btn-ghost size-btn" onclick={() => cycleSize(deliverable)} title="Click to cycle size">
										{deliverable.size ?? '—'}
									</button>
								</td>
								<td class="matrix-certainty-cell">
									<button class="btn-ghost certainty-btn" onclick={() => cycleCertainty(deliverable)} title="Certainty: {deliverable.certainty ?? 'unset'} of 5" aria-label="Certainty: {deliverable.certainty ?? 'unset'} of 5">
										{#each [1, 2, 3, 4, 5] as level}
											<span class="cert-bar" class:filled={deliverable.certainty != null && level <= deliverable.certainty}></span>
										{/each}
										<span class="cert-label">{deliverable.certainty ?? '–'}</span>
									</button>
								</td>
								{#each orderedCols as opp (opp.id)}
									{@const link = findLink(opp.id, deliverable.id)}
									<td class="matrix-cell">
										<button
											class="matrix-dot"
											class:full={link?.coverage === 'full'}
											class:partial={link?.coverage === 'partial'}
											onclick={() => cycleMatrixCell(opp.id, deliverable.id)}
											title={link ? (link.coverage === 'full' ? 'Full coverage' : 'Partial coverage') : 'Not linked'}
											aria-label="{deliverable.title} × {opp.title}: {link ? link.coverage : 'none'}"
										></button>
									</td>
								{/each}
								{#if contributorColumns.length > 0}
									{@const contribs = allContributors(deliverable.id)}
									{@const inherited = new Set(inheritedPeople(deliverable.id, 'contributors', links, opportunities))}
									<td class="matrix-section-divider"></td>
									{#each contributorColumns as col (col.name)}
										{@const assigned = contribs.has(col.name)}
										{@const isInherited = inherited.has(col.name)}
										<td class="matrix-cell">
											<button
												class="matrix-contributor-dot"
												class:assigned
												class:inherited={isInherited}
												onclick={() => toggleContributor(deliverable, col.name)}
												title={isInherited ? `${col.name} (inherited from opportunity)` : assigned ? `${col.name} — click to unassign` : `Click to assign ${col.name}`}
											></button>
										</td>
									{/each}
								{/if}
								{#if deliverable.externalDependency}
									<td class="matrix-external-cell" title={deliverable.externalDependency}>⚠</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="matrix-legend">
				<span class="legend-item"><span class="legend-dot legend-empty"></span> not linked</span>
				<span class="legend-item"><span class="legend-dot legend-partial"></span> partial</span>
				<span class="legend-item"><span class="legend-dot legend-full"></span> full</span>
				<span class="legend-sep">·</span>
				<span class="legend-item">click size / certainty to cycle</span>
				<span class="legend-sep">·</span>
				<span class="legend-item">sorted by leverage</span>
			</div>
		{/if}
</div>

<style>
	.deliverables-view {
		padding: var(--sp-lg);
		overflow-y: auto;
	}

	.dv-header {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin-bottom: var(--sp-lg);
	}

	.dv-stats {
		display: flex;
		gap: var(--sp-sm);
		align-items: baseline;
	}

	.stat {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}

	.stat.orphan {
		color: var(--c-orange);
	}

	.dv-add {
		flex: 1;
	}

	.dv-add-input {
		width: 100%;
		font: inherit;
		font-size: var(--fs-base);
		background: var(--c-surface);
		border: 1px solid var(--c-border-soft);
		border-radius: var(--radius-sm);
		padding: var(--sp-xs) var(--sp-sm);
		color: var(--c-text);
	}

	.dv-empty {
		text-align: center;
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		padding: var(--sp-2xl) var(--sp-lg);
	}

	.dv-empty p {
		margin: var(--sp-xs) 0;
	}

	/* Matrix view */
	.matrix-wrapper {
		overflow-x: auto;
		margin-top: var(--sp-sm);
	}

	.matrix-table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: var(--fs-xs);
	}

	.matrix-table th,
	.matrix-table td {
		padding: var(--sp-xs) var(--sp-sm);
	}

	/* ── Header row ── */
	.matrix-corner {
		background: var(--c-bg);
		position: sticky;
		left: 0;
		z-index: 2;
	}

	.matrix-opp-header {
		background: var(--c-bg);
		vertical-align: bottom;
		padding: var(--sp-sm) 2px var(--sp-xs) 2px !important;
		border-bottom: 2px solid var(--c-border);
	}

	.matrix-opp-header.covered {
		border-bottom-color: var(--c-green-signal);
	}

	.matrix-opp-title {
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xs);
		color: var(--c-text-soft);
		cursor: pointer;
		padding: 2px;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		max-height: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	.matrix-opp-title:hover {
		color: var(--c-accent);
	}

	.matrix-opp-stage {
		display: block;
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-faint);
		margin-top: var(--sp-xs);
	}

	.matrix-opp-stage.stage-validate {
		color: var(--c-stage-validate);
	}

	.matrix-opp-stage.stage-decompose {
		color: var(--c-stage-decompose);
	}

	.matrix-opp-coverage {
		display: block;
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		font-weight: var(--fw-normal);
	}

	.matrix-gap-badge {
		display: block;
		margin-top: 3px;
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-red);
		font-weight: var(--fw-medium);
	}

	.empty-col {
		border-bottom-color: var(--c-red-border) !important;
	}

	/* ── Body rows ── */
	.matrix-table tbody tr {
		transition: background 0.1s ease;
	}

	.matrix-table tbody tr:hover {
		background: var(--c-neutral-bg-light);
	}

	.matrix-table tbody tr.row-selected {
		background: color-mix(in srgb, var(--c-accent) var(--opacity-subtle), var(--c-bg));
	}

	.matrix-table tbody tr.row-selected td:first-child {
		box-shadow: inset 3px 0 0 var(--c-accent);
	}

	.matrix-table tbody tr:not(:last-child) td {
		border-bottom: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-table tbody tr:first-child td {
		border-top: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-table tbody tr:last-child td {
		border-bottom: 1px solid color-mix(in srgb, var(--c-border-soft) var(--opacity-strong), transparent);
	}

	.matrix-del-name {
		background: inherit;
		position: sticky;
		left: 0;
		z-index: 1;
		white-space: nowrap;
		font-weight: var(--fw-medium);
		color: var(--c-text);
		padding-right: var(--sp-md) !important;
	}

	.matrix-del-link {
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
		text-decoration: none;
		margin-left: var(--sp-xs);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.matrix-table tbody tr:hover .matrix-del-link {
		opacity: 1;
	}

	.matrix-del-link:hover {
		color: var(--c-accent);
	}

	.matrix-row-badge {
		font-size: var(--fs-3xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: var(--fw-medium);
		margin-left: var(--sp-sm);
		padding: 0 3px;
		border-radius: 2px;
	}

	.orphan-badge {
		color: var(--c-text-muted);
		background: var(--c-neutral-bg);
	}

	.partial-badge {
		color: var(--c-warm);
		background: var(--c-warm-bg);
	}

	.row-orphan .matrix-del-name {
		color: var(--c-text-muted);
		font-style: italic;
	}

	/* Strip vertical padding on XS rows so they can actually be thin */
	.row-size-xs td {
		padding-top: 0;
		padding-bottom: 0;
	}
	.row-size-xs .size-btn,
	.row-size-xs .certainty-btn {
		padding-top: 0;
		padding-bottom: 0;
	}

	/* ── Dot cells ── */
	.matrix-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0 !important;
	}

	.matrix-dot {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--sp-xs) var(--sp-sm);
		line-height: var(--lh-tight);
		border-radius: var(--radius-sm);
		transition: background 0.1s ease;
	}

	.matrix-dot::after {
		content: '·';
		font-size: 1.4rem;
		color: var(--c-border-soft);
	}

	.matrix-dot:hover {
		background: var(--c-neutral-bg);
	}

	.matrix-dot:hover::after {
		color: var(--c-text-muted);
	}

	.matrix-dot.partial::after {
		content: '◐';
		color: var(--c-accent);
	}

	.matrix-dot.full::after {
		content: '●';
		color: var(--c-green-signal);
	}

	/* ── Drag reorder ── */
	.drag-handle {
		color: var(--c-text-faint);
		cursor: grab;
		margin-right: var(--sp-xs);
		font-size: var(--fs-2xs);
		user-select: none;
		opacity: 0;
		transition: opacity 0.1s ease;
	}

	.matrix-table tbody tr:hover .drag-handle {
		opacity: 1;
	}

	.matrix-opp-header {
		cursor: grab;
	}

	.dragging-row {
		opacity: 0.4;
	}

	.drag-over-row td {
		box-shadow: 0 -2px 0 0 var(--c-accent) inset;
	}

	.drag-over-col {
		box-shadow: -2px 0 0 0 var(--c-accent) inset;
	}

	/* ── Toolbar: funnel + zoom ── */
	.matrix-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--sp-sm);
	}

	.matrix-funnel {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.matrix-zoom {
		display: flex;
		align-items: center;
		gap: var(--sp-xs);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
	}

	.matrix-zoom input[type="range"] {
		width: 80px;
		accent-color: var(--c-accent);
	}

	/* ── Size + Certainty column headers ── */
	.matrix-col-label {
		background: var(--c-bg);
		font-size: var(--fs-3xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c-text-muted);
		text-align: center;
		vertical-align: bottom;
		padding: var(--sp-xs) 4px !important;
		border-bottom: 2px solid var(--c-border);
	}

	/* ── Size + Certainty cells ── */
	.matrix-size-cell,
	.matrix-certainty-cell {
		text-align: center;
		vertical-align: middle;
		padding: 0 2px !important;
	}

	.size-btn {
		color: var(--c-text);
		min-width: 28px;
	}

	.size-btn:hover {
		background: var(--c-neutral-bg);
	}

	.certainty-btn {
		display: flex;
		align-items: center;
		gap: 1.5px;
	}

	.certainty-btn:hover {
		background: var(--c-neutral-bg);
	}

	.cert-bar {
		display: inline-block;
		width: 3px;
		height: 10px;
		background: var(--c-border-soft);
		border-radius: 1px;
	}

	.cert-bar.filled {
		background: var(--c-accent);
	}

	.cert-label {
		font-size: var(--fs-3xs);
		color: var(--c-text-muted);
		margin-left: 2px;
		min-width: 1ch;
	}

	/* ── Variable row height + unestimated blur ── */
	.row-unestimated td {
		border-top: 1px solid transparent;
		border-bottom: 1px solid transparent;
		border-image: linear-gradient(to right, transparent, var(--c-border-soft) 30%, var(--c-border-soft) 70%, transparent) 1;
	}

	/* ── Contributor columns ── */
	.matrix-section-divider {
		width: 8px;
		border: none !important;
		background: none;
	}

	.matrix-contributor-header {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		white-space: nowrap;
		vertical-align: bottom;
		padding: var(--sp-xs) 2px var(--sp-sm) 2px;
		font-weight: var(--fw-normal);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.matrix-contributor-name {
		display: inline;
	}

	.matrix-contributor-count {
		font-size: var(--fs-3xs);
		color: var(--c-text-faint);
	}

	.matrix-contributor-dot {
		display: block;
		width: var(--dot-size-md);
		height: var(--dot-size-md);
		border-radius: 50%;
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
		cursor: pointer;
		padding: 0;
		margin: 0 auto;
		transition: background var(--tr-fast), border-color var(--tr-fast);
	}

	.matrix-contributor-dot.assigned {
		background: var(--c-accent);
		border-color: var(--c-accent);
	}

	.matrix-contributor-dot.inherited {
		background: var(--c-text-muted);
		border-color: var(--c-text-muted);
		cursor: default;
		opacity: 0.6;
	}

	.matrix-contributor-dot:not(.assigned):hover {
		border-color: var(--c-accent);
	}

	.matrix-external-cell {
		text-align: center;
		font-size: var(--fs-2xs);
		color: var(--c-warm);
		cursor: help;
		border: none !important;
		padding-left: 4px;
	}

	/* ── Legend ── */
	.matrix-legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-sm);
		margin-top: var(--sp-md);
		font-size: var(--fs-2xs);
		color: var(--c-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.legend-dot {
		display: inline-block;
		width: var(--dot-size-xs);
		height: var(--dot-size-xs);
		border-radius: var(--radius-full);
	}

	.legend-empty {
		border: 1.5px solid var(--c-border-soft);
		background: transparent;
	}

	.legend-partial {
		background: var(--c-accent);
		clip-path: inset(0 50% 0 0);
		border: 1.5px solid var(--c-accent);
	}

	.legend-full {
		background: var(--c-green-signal);
	}

	.legend-sep {
		color: var(--c-border-soft);
	}
</style>
